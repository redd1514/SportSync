-- ============================================
-- SPORTSYNC - Indexes for Query Performance
-- ============================================

-- Users
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

-- Courts
CREATE INDEX IF NOT EXISTS idx_courts_is_active ON courts(is_active);
CREATE INDEX IF NOT EXISTS idx_courts_sport_facility ON courts(sport_id, facility_id);

-- Hourly Rates
CREATE INDEX IF NOT EXISTS idx_hourly_rates_court_id ON hourly_rates(court_id);
CREATE INDEX IF NOT EXISTS idx_hourly_rates_time_slots ON hourly_rates(start_time, end_time);

-- Bookings (Most important for queries)
CREATE INDEX IF NOT EXISTS idx_bookings_user_date ON bookings(user_id, booking_date DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_court_date_time ON bookings(court_id, booking_date, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_bookings_created_at ON bookings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_qr_code ON bookings(qr_code_token);

-- Booking Requests
CREATE INDEX IF NOT EXISTS idx_booking_requests_booking_id ON booking_requests(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_requests_status ON booking_requests(status);

-- Coaching
CREATE INDEX IF NOT EXISTS idx_coaches_user_id ON coaches(user_id);
CREATE INDEX IF NOT EXISTS idx_coaches_is_available ON coaches(is_available);
CREATE INDEX IF NOT EXISTS idx_coach_specs_coach_sport ON coach_specializations(coach_id, sport_id);
CREATE INDEX IF NOT EXISTS idx_coaching_sessions_status ON coaching_sessions(status);
CREATE INDEX IF NOT EXISTS idx_coaching_sessions_coach_user_date ON coaching_sessions(coach_id, user_id, session_date);

-- Payments
CREATE INDEX IF NOT EXISTS idx_payments_booking_id ON payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_coaching_id ON payments(coaching_session_id);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_reference_id ON payments(paymongo_reference_id);

-- Announcements
CREATE INDEX IF NOT EXISTS idx_announcements_is_published ON announcements(is_published);
CREATE INDEX IF NOT EXISTS idx_announcements_expires_at ON announcements(expires_at);

-- Audit Log
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_table_name ON audit_log(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);

-- Loyalty
CREATE INDEX IF NOT EXISTS idx_loyalty_user_id ON loyalty_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_created_at ON loyalty_transactions(created_at DESC);

-- Reviews
CREATE INDEX IF NOT EXISTS idx_reviews_coach_id ON reviews(coach_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer_id ON reviews(reviewer_id);