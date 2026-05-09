-- ============================================
-- SPORTSYNC - Database Functions & Triggers
-- ============================================

-- ============================================
-- FUNCTION: Update user updated_at timestamp
-- ============================================

CREATE OR REPLACE FUNCTION update_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_users_updated_at();

-- ============================================
-- FUNCTION: Update bookings updated_at timestamp
-- ============================================

CREATE OR REPLACE FUNCTION update_bookings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_bookings_updated_at();

-- ============================================
-- FUNCTION: Calculate booking total price
-- ============================================

CREATE OR REPLACE FUNCTION calculate_booking_total()
RETURNS TRIGGER AS $$
DECLARE
  addon_total DECIMAL;
BEGIN
  -- Sum add-on prices
  SELECT COALESCE(SUM(ba.price_per_unit * ba.quantity), 0)
  INTO addon_total
  FROM booking_addons ba
  WHERE ba.booking_id = NEW.id;
  
  -- Set total price
  NEW.total_price = COALESCE(NEW.base_price, 0) + addon_total;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_booking_total
  AFTER INSERT OR UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION calculate_booking_total();

-- ============================================
-- FUNCTION: Award loyalty points on booking
-- ============================================

CREATE OR REPLACE FUNCTION award_loyalty_points_on_booking()
RETURNS TRIGGER AS $$
DECLARE
  points INT;
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    -- Award 1 point per 100 peso spent
    points := FLOOR(NEW.total_price / 100);
    
    INSERT INTO loyalty_transactions (user_id, points_change, transaction_type, reference_id)
    VALUES (NEW.user_id, points, 'booking', NEW.id);
    
    -- Update user's loyalty points
    UPDATE users 
    SET loyalty_points = loyalty_points + points
    WHERE id = NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_award_points_on_booking
  AFTER UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION award_loyalty_points_on_booking();

-- ============================================
-- FUNCTION: Update coach rating after review
-- ============================================

CREATE OR REPLACE FUNCTION update_coach_rating()
RETURNS TRIGGER AS $$
DECLARE
  avg_rating DECIMAL;
  review_count INT;
BEGIN
  SELECT AVG(rating), COUNT(*) 
  INTO avg_rating, review_count
  FROM reviews
  WHERE coach_id = NEW.coach_id;
  
  UPDATE coaches
  SET rating = COALESCE(avg_rating, 0),
      review_count = COALESCE(review_count, 0)
  WHERE id = NEW.coach_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_coach_rating
  AFTER INSERT OR UPDATE ON reviews
  FOR EACH ROW
  WHEN (NEW.coach_id IS NOT NULL)
  EXECUTE FUNCTION update_coach_rating();

-- ============================================
-- FUNCTION: Log changes to audit_log
-- ============================================

CREATE OR REPLACE FUNCTION audit_log_changes()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_log (user_id, action, table_name, record_id, old_values, new_values)
  VALUES (
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
    CASE WHEN TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN row_to_json(OLD) ELSE NULL END,
    CASE WHEN TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN row_to_json(NEW) ELSE NULL END
  );
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

-- Attach audit trigger to key tables
CREATE TRIGGER trigger_audit_users
  AFTER INSERT OR UPDATE OR DELETE ON users
  FOR EACH ROW
  EXECUTE FUNCTION audit_log_changes();

CREATE TRIGGER trigger_audit_bookings
  AFTER INSERT OR UPDATE OR DELETE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION audit_log_changes();

CREATE TRIGGER trigger_audit_payments
  AFTER INSERT OR UPDATE OR DELETE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION audit_log_changes();

-- ============================================
-- FUNCTION: Check booking conflicts
-- ============================================

CREATE OR REPLACE FUNCTION check_booking_conflict(
  p_court_id UUID,
  p_booking_date DATE,
  p_start_time TIME,
  p_end_time TIME,
  p_exclude_booking_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  conflict_count INT;
BEGIN
  SELECT COUNT(*)
  INTO conflict_count
  FROM bookings
  WHERE court_id = p_court_id
    AND booking_date = p_booking_date
    AND status IN ('pending', 'confirmed', 'checked_in')
    AND (
      (start_time, end_time) OVERLAPS (p_start_time, p_end_time)
    )
    AND (p_exclude_booking_id IS NULL OR id != p_exclude_booking_id);
  
  RETURN conflict_count > 0;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Auto-generate QR code for booking
-- ============================================

CREATE OR REPLACE FUNCTION generate_qr_code_token()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.qr_code_token IS NULL THEN
    NEW.qr_code_token := encode(gen_random_bytes(32), 'hex');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_qr_code
  BEFORE INSERT ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION generate_qr_code_token();