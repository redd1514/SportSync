-- ============================================
-- SPORTSYNC - Row Level Security (RLS) Policies
-- ============================================

-- ============================================
-- USERS TABLE - RLS
-- ============================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  USING (auth.uid() = auth_id);

-- Admins can view all users
CREATE POLICY "Admins can view all users"
  ON users FOR SELECT
  USING (
    auth.uid() IN (
      SELECT auth_id FROM users WHERE role = 'admin'
    )
  );

-- Staff can view users with bookings
CREATE POLICY "Staff can view users with bookings"
  ON users FOR SELECT
  USING (
    auth.uid() IN (
      SELECT auth_id FROM users WHERE role = 'staff'
    )
  );

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (auth.uid() = auth_id)
  WITH CHECK (auth.uid() = auth_id);

-- ============================================
-- BOOKINGS TABLE - RLS
-- ============================================

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Users can view their own bookings
CREATE POLICY "Users can view own bookings"
  ON bookings FOR SELECT
  USING (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));

-- Admins can view all bookings
CREATE POLICY "Admins can view all bookings"
  ON bookings FOR SELECT
  USING (
    auth.uid() IN (
      SELECT auth_id FROM users WHERE role = 'admin'
    )
  );

-- Staff can view bookings for their facility
CREATE POLICY "Staff can view facility bookings"
  ON bookings FOR SELECT
  USING (
    auth.uid() IN (
      SELECT auth_id FROM users WHERE role = 'staff'
    )
  );

-- Users can create bookings
CREATE POLICY "Users can create bookings"
  ON bookings FOR INSERT
  WITH CHECK (
    user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
  );

-- Users can update their own pending bookings
CREATE POLICY "Users can update own pending bookings"
  ON bookings FOR UPDATE
  USING (
    user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
    AND status = 'pending'
  )
  WITH CHECK (
    user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
    AND status = 'pending'
  );

-- Admins/Staff can update any booking
CREATE POLICY "Staff can update bookings"
  ON bookings FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT auth_id FROM users WHERE role IN ('staff', 'admin')
    )
  );

-- ============================================
-- COACHING_SESSIONS TABLE - RLS
-- ============================================

ALTER TABLE coaching_sessions ENABLE ROW LEVEL SECURITY;

-- Users can view their own coaching sessions
CREATE POLICY "Users can view own coaching sessions"
  ON coaching_sessions FOR SELECT
  USING (
    user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
    OR coach_id IN (SELECT id FROM coaches WHERE user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()))
  );

-- Coaches can view their sessions
CREATE POLICY "Coaches can view their sessions"
  ON coaching_sessions FOR SELECT
  USING (
    coach_id IN (SELECT id FROM coaches WHERE user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()))
  );

-- Admins/Staff can view all sessions
CREATE POLICY "Admins can view all coaching sessions"
  ON coaching_sessions FOR SELECT
  USING (
    auth.uid() IN (
      SELECT auth_id FROM users WHERE role IN ('staff', 'admin')
    )
  );

-- Users can request coaching sessions
CREATE POLICY "Users can request coaching sessions"
  ON coaching_sessions FOR INSERT
  WITH CHECK (
    user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
  );

-- ============================================
-- COACHES TABLE - RLS
-- ============================================

ALTER TABLE coaches ENABLE ROW LEVEL SECURITY;

-- Everyone can view active coaches
CREATE POLICY "Users can view coaches"
  ON coaches FOR SELECT
  USING (is_available = true);

-- Coaches can view their own profile
CREATE POLICY "Coaches can view own profile"
  ON coaches FOR SELECT
  USING (
    user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
  );

-- Coaches can update their own profile
CREATE POLICY "Coaches can update own profile"
  ON coaches FOR UPDATE
  USING (
    user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
  );

-- ============================================
-- PAYMENTS TABLE - RLS
-- ============================================

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Users can view their own payments
CREATE POLICY "Users can view own payments"
  ON payments FOR SELECT
  USING (
    user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
  );

-- Admins can view all payments
CREATE POLICY "Admins can view all payments"
  ON payments FOR SELECT
  USING (
    auth.uid() IN (
      SELECT auth_id FROM users WHERE role = 'admin'
    )
  );

-- ============================================
-- ANNOUNCEMENTS TABLE - RLS
-- ============================================

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- Everyone can view published announcements
CREATE POLICY "Users can view published announcements"
  ON announcements FOR SELECT
  USING (is_published = true AND (expires_at IS NULL OR expires_at > NOW()));

-- Admins/Staff can view/create announcements
CREATE POLICY "Staff can manage announcements"
  ON announcements FOR ALL
  USING (
    auth.uid() IN (
      SELECT auth_id FROM users WHERE role IN ('staff', 'admin')
    )
  );

-- ============================================
-- FACILITY_LAYOUT TABLE - RLS
-- ============================================

ALTER TABLE facility_layout ENABLE ROW LEVEL SECURITY;

-- Everyone can view facility layout
CREATE POLICY "Users can view facility layout"
  ON facility_layout FOR SELECT
  USING (true);

-- Admins can manage facility layout
CREATE POLICY "Admins can manage facility layout"
  ON facility_layout FOR ALL
  USING (
    auth.uid() IN (
      SELECT auth_id FROM users WHERE role = 'admin'
    )
  );