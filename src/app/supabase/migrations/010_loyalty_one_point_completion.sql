-- Loyalty points are awarded once, when an owned booking is completed.
-- Rule: 1 completed booking = 1 point. 10 points = 1 reward.

CREATE OR REPLACE FUNCTION award_loyalty_points_on_booking()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' AND NEW.user_id IS NOT NULL THEN
    INSERT INTO loyalty_transactions (user_id, points_change, transaction_type, reference_id)
    VALUES (NEW.user_id, 1, 'booking_completed', NEW.id)
    ON CONFLICT DO NOTHING;

    UPDATE users
    SET loyalty_points = COALESCE(loyalty_points, 0) + 1
    WHERE id = NEW.user_id
      AND EXISTS (
        SELECT 1
        FROM loyalty_transactions
        WHERE user_id = NEW.user_id
          AND reference_id = NEW.id
          AND transaction_type = 'booking_completed'
      );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
