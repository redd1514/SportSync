-- Seed core sports for coach_specializations.sport_id resolution.
-- Safe to run multiple times (idempotent by name).

INSERT INTO sports (name, description, is_active) VALUES
  ('Basketball', 'Court basketball', true),
  ('Volleyball', 'Court volleyball', true),
  ('Badminton', 'Badminton courts', true),
  ('Pickleball', 'Pickleball', true),
  ('Billiards', 'Billiards tables', true),
  ('Table Tennis', 'Table tennis', true)
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active;
