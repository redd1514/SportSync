-- Coach applications (user-submitted "be a coach" forms)
CREATE TABLE IF NOT EXISTS coach_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  user_name TEXT NOT NULL DEFAULT '',
  user_email TEXT NOT NULL DEFAULT '',
  sport TEXT NOT NULL,
  experience TEXT DEFAULT '',
  bio TEXT DEFAULT '',
  availability TEXT[] DEFAULT ARRAY[]::TEXT[],
  requested_rate DECIMAL(10, 2) DEFAULT 0,
  certifications TEXT DEFAULT '',
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coach_applications_status ON coach_applications(status);
CREATE INDEX IF NOT EXISTS idx_coach_applications_submitted ON coach_applications(submitted_at DESC);

-- Generic JSON blobs for server-backed UI state (facility map editor, coaching requests queue, sport add-ons)
CREATE TABLE IF NOT EXISTS app_kv_store (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE coach_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_kv_store ENABLE ROW LEVEL SECURITY;
