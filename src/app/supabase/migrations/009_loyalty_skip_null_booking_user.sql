-- Staff walk-ins and legacy map rows can have no linked app user.
-- Loyalty points are only meaningful for app users, so skip null owners.
CREATE OR REPLACE FUNCTION award_loyalty_points_on_booking()
RETURNS TRIGGER AS $$
DECLARE
  points INT;
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' AND NEW.user_id IS NOT NULL THEN
    points := FLOOR(NEW.total_price / 100);

    INSERT INTO loyalty_transactions (user_id, points_change, transaction_type, reference_id)
    VALUES (NEW.user_id, points, 'booking', NEW.id);

    UPDATE users
    SET loyalty_points = loyalty_points + points
    WHERE id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
