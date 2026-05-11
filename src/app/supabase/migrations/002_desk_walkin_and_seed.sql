-- Walk-in / desk bookings: no linked app user; optional staff on kiosk flows
ALTER TABLE public.bookings ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.payments ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.staff_operations ALTER COLUMN staff_id DROP NOT NULL;

-- Seed facility + sports + courts aligned with app ALL_COURTS (idempotent)
DO $$
DECLARE
  fid uuid;
  sid_basketball uuid;
  sid_volleyball uuid;
  sid_badminton uuid;
  sid_pickleball uuid;
  sid_billiards uuid;
  sid_tt uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.facility_config LIMIT 1) THEN
    INSERT INTO public.facility_config (facility_name, timezone)
    VALUES ('JRC Ballpark', 'Asia/Manila')
    RETURNING id INTO fid;
  ELSE
    SELECT id INTO fid FROM public.facility_config ORDER BY created_at LIMIT 1;
  END IF;

  INSERT INTO public.sports (name) VALUES ('Basketball') ON CONFLICT (name) DO NOTHING;
  INSERT INTO public.sports (name) VALUES ('Volleyball') ON CONFLICT (name) DO NOTHING;
  INSERT INTO public.sports (name) VALUES ('Badminton') ON CONFLICT (name) DO NOTHING;
  INSERT INTO public.sports (name) VALUES ('Pickleball') ON CONFLICT (name) DO NOTHING;
  INSERT INTO public.sports (name) VALUES ('Billiards') ON CONFLICT (name) DO NOTHING;
  INSERT INTO public.sports (name) VALUES ('Table Tennis') ON CONFLICT (name) DO NOTHING;

  SELECT id INTO sid_basketball FROM public.sports WHERE name = 'Basketball' LIMIT 1;
  SELECT id INTO sid_volleyball FROM public.sports WHERE name = 'Volleyball' LIMIT 1;
  SELECT id INTO sid_badminton FROM public.sports WHERE name = 'Badminton' LIMIT 1;
  SELECT id INTO sid_pickleball FROM public.sports WHERE name = 'Pickleball' LIMIT 1;
  SELECT id INTO sid_billiards FROM public.sports WHERE name = 'Billiards' LIMIT 1;
  SELECT id INTO sid_tt FROM public.sports WHERE name = 'Table Tennis' LIMIT 1;

  INSERT INTO public.courts (facility_id, name, sport_id, capacity)
  SELECT fid, v.name, v.sid, 10
  FROM (VALUES
    ('Basketball 1', sid_basketball),
    ('Volleyball 1', sid_volleyball),
    ('Badminton 1', sid_badminton),
    ('Badminton 2', sid_badminton),
    ('Badminton 3', sid_badminton),
    ('Pickleball 1', sid_pickleball),
    ('Pickleball 2', sid_pickleball),
    ('Pickleball 3', sid_pickleball),
    ('Billiards 1', sid_billiards),
    ('Billiards 2', sid_billiards),
    ('Billiards 3', sid_billiards),
    ('Billiards 4', sid_billiards),
    ('Table Tennis 1', sid_tt),
    ('Table Tennis 2', sid_tt),
    ('Table Tennis 3', sid_tt),
    ('Table Tennis 4', sid_tt)
  ) AS v(name, sid)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.courts c WHERE c.facility_id = fid AND c.name = v.name
  );
END $$;
