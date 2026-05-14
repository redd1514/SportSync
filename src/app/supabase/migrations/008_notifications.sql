CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type VARCHAR(80) NOT NULL DEFAULT 'general',
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created
  ON notifications(recipient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON notifications(recipient_id)
  WHERE read_at IS NULL;
