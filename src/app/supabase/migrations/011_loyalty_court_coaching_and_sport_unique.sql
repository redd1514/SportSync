-- Loyalty: 1 point per completed booking.
-- Court + coaching packages: point is awarded only after the linked coaching session is completed.
-- Idempotency: one loyalty row per booking reference.

CREATE UNIQUE INDEX IF NOT EXISTS idx_loyalty_booking_completed_unique
  ON loyalty_transactions (user_id, reference_id, transaction_type)
  WHERE reference_id IS NOT NULL AND transaction_type = 'booking_completed';

CREATE OR REPLACE FUNCTION award_loyalty_points_on_booking()
RETURNS TRIGGER AS $$
DECLARE
  has_linked_coaching BOOLEAN;
  coaching_completed BOOLEAN;
  new_tx_id UUID;
BEGIN
  IF NEW.status = 'completed'
     AND OLD.status IS DISTINCT FROM 'completed'
     AND NEW.user_id IS NOT NULL THEN

    SELECT EXISTS (
      SELECT 1
      FROM coaching_sessions cs
      WHERE cs.notes ILIKE '%linked_booking:' || NEW.id::text || '%'
    ) INTO has_linked_coaching;

    IF has_linked_coaching THEN
      SELECT EXISTS (
        SELECT 1
        FROM coaching_sessions cs
        WHERE cs.notes ILIKE '%linked_booking:' || NEW.id::text || '%'
          AND (
            cs.status = 'completed'
            OR COALESCE(cs.admin_notes, '') ~* 'COACHING_CHECKED_OUT|checked_out:'
          )
      ) INTO coaching_completed;

      IF NOT coaching_completed THEN
        RETURN NEW;
      END IF;
    END IF;

    INSERT INTO loyalty_transactions (user_id, points_change, transaction_type, reference_id)
    VALUES (NEW.user_id, 1, 'booking_completed', NEW.id)
    ON CONFLICT DO NOTHING
    RETURNING id INTO new_tx_id;

    IF new_tx_id IS NOT NULL THEN
      UPDATE users
      SET loyalty_points = COALESCE(loyalty_points, 0) + 1
      WHERE id = NEW.user_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
