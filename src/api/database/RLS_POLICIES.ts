/**
 * RLS Policies for Realtime Synchronization
 * 
 * These policies ensure that users only see data they have access to.
 * Apply these policies to your Supabase tables to secure realtime subscriptions.
 * 
 * Note: RLS policies automatically apply to Realtime subscriptions.
 * Users can only subscribe to rows they can SELECT.
 */

/**
 * BOOKINGS TABLE RLS POLICIES
 * 
 * -- Users can see their own bookings
 * CREATE POLICY "users_see_own_bookings"
 *   ON bookings FOR SELECT
 *   USING (auth.uid()::text = user_id OR auth.jwt() ->> 'role' = 'admin');
 * 
 * -- Users can create their own bookings
 * CREATE POLICY "users_create_own_bookings"
 *   ON bookings FOR INSERT
 *   WITH CHECK (auth.uid()::text = user_id);
 * 
 * -- Users can update their own bookings (non-completed ones)
 * CREATE POLICY "users_update_own_bookings"
 *   ON bookings FOR UPDATE
 *   USING (auth.uid()::text = user_id AND status != 'completed')
 *   WITH CHECK (auth.uid()::text = user_id);
 * 
 * -- Users can delete their own pending bookings
 * CREATE POLICY "users_delete_own_pending_bookings"
 *   ON bookings FOR DELETE
 *   USING (auth.uid()::text = user_id AND status = 'pending');
 * 
 * -- Admin can see all bookings
 * CREATE POLICY "admin_see_all_bookings"
 *   ON bookings FOR SELECT
 *   USING (auth.jwt() ->> 'role' = 'admin');
 * 
 * -- Admin can update any booking
 * CREATE POLICY "admin_update_bookings"
 *   ON bookings FOR UPDATE
 *   USING (auth.jwt() ->> 'role' = 'admin');
 */

/**
 * COACHING_SESSIONS TABLE RLS POLICIES
 * 
 * -- Users see their own sessions
 * CREATE POLICY "users_see_own_coaching_sessions"
 *   ON coaching_sessions FOR SELECT
 *   USING (auth.uid()::text = user_id);
 * 
 * -- Coaches see sessions assigned to them
 * CREATE POLICY "coaches_see_assigned_sessions"
 *   ON coaching_sessions FOR SELECT
 *   USING (auth.uid()::text = coach_id);
 * 
 * -- Users can create coaching session requests
 * CREATE POLICY "users_create_coaching_sessions"
 *   ON coaching_sessions FOR INSERT
 *   WITH CHECK (auth.uid()::text = user_id);
 * 
 * -- Coaches can update session status
 * CREATE POLICY "coaches_update_session_status"
 *   ON coaching_sessions FOR UPDATE
 *   USING (auth.uid()::text = coach_id)
 *   WITH CHECK (auth.uid()::text = coach_id);
 * 
 * -- Admin sees all sessions
 * CREATE POLICY "admin_see_all_sessions"
 *   ON coaching_sessions FOR SELECT
 *   USING (auth.jwt() ->> 'role' = 'admin');
 * 
 * -- Admin can manage all sessions
 * CREATE POLICY "admin_manage_sessions"
 *   ON coaching_sessions FOR ALL
 *   USING (auth.jwt() ->> 'role' = 'admin');
 */

/**
 * NOTIFICATIONS TABLE RLS POLICIES
 * 
 * -- Users see only their own notifications
 * CREATE POLICY "users_see_own_notifications"
 *   ON notifications FOR SELECT
 *   USING (auth.uid()::text = recipient_id);
 * 
 * -- System and services can create notifications
 * CREATE POLICY "system_create_notifications"
 *   ON notifications FOR INSERT
 *   WITH CHECK (true); -- Or restrict to service role
 * 
 * -- Users can update their own notifications (mark as read)
 * CREATE POLICY "users_update_own_notifications"
 *   ON notifications FOR UPDATE
 *   USING (auth.uid()::text = recipient_id)
 *   WITH CHECK (auth.uid()::text = recipient_id);
 * 
 * -- Admin sees all notifications
 * CREATE POLICY "admin_see_all_notifications"
 *   ON notifications FOR SELECT
 *   USING (auth.jwt() ->> 'role' = 'admin');
 */

/**
 * ANNOUNCEMENTS TABLE RLS POLICIES
 * 
 * -- Everyone can see published announcements
 * CREATE POLICY "public_see_announcements"
 *   ON announcements FOR SELECT
 *   USING (is_published = true);
 * 
 * -- Admin can see all announcements
 * CREATE POLICY "admin_see_all_announcements"
 *   ON announcements FOR SELECT
 *   USING (auth.jwt() ->> 'role' = 'admin');
 * 
 * -- Admin can create/update/delete announcements
 * CREATE POLICY "admin_manage_announcements"
 *   ON announcements FOR ALL
 *   USING (auth.jwt() ->> 'role' = 'admin');
 */

/**
 * FACILITIES TABLE RLS POLICIES
 * 
 * -- Everyone can see published facilities
 * CREATE POLICY "public_see_facilities"
 *   ON facilities FOR SELECT
 *   USING (is_published = true);
 * 
 * -- Admin can see all facilities
 * CREATE POLICY "admin_see_all_facilities"
 *   ON facilities FOR SELECT
 *   USING (auth.jwt() ->> 'role' = 'admin');
 * 
 * -- Admin can manage facilities
 * CREATE POLICY "admin_manage_facilities"
 *   ON facilities FOR ALL
 *   USING (auth.jwt() ->> 'role' = 'admin');
 */

/**
 * COACHES TABLE RLS POLICIES
 * 
 * -- Everyone can see available coaches
 * CREATE POLICY "public_see_coaches"
 *   ON coaches FOR SELECT
 *   USING (is_available = true);
 * 
 * -- Coaches can see their own profile
 * CREATE POLICY "coaches_see_own_profile"
 *   ON coaches FOR SELECT
 *   USING (auth.uid()::text = user_id);
 * 
 * -- Coaches can update their own profile
 * CREATE POLICY "coaches_update_own_profile"
 *   ON coaches FOR UPDATE
 *   USING (auth.uid()::text = user_id)
 *   WITH CHECK (auth.uid()::text = user_id);
 * 
 * -- Admin can see and manage all coaches
 * CREATE POLICY "admin_manage_coaches"
 *   ON coaches FOR ALL
 *   USING (auth.jwt() ->> 'role' = 'admin');
 */

export const RLS_POLICIES_DOCUMENTATION = `
# Realtime Synchronization RLS Policies

## Overview
These Row Level Security (RLS) policies ensure that Supabase Realtime subscriptions
are automatically filtered based on user permissions.

## Key Principles
1. Users can only subscribe to data they can SELECT
2. Realtime subscriptions respect all RLS policies
3. Admins bypass row-level restrictions
4. Role-based filtering is enforced at the database level

## Implementation Steps

1. Enable RLS on all tables:
   ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
   ALTER TABLE coaching_sessions ENABLE ROW LEVEL SECURITY;
   ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
   ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
   ALTER TABLE facilities ENABLE ROW LEVEL SECURITY;
   ALTER TABLE coaches ENABLE ROW LEVEL SECURITY;

2. Apply policies from the comments above

3. Test with: 
   SELECT * FROM bookings; -- as different user roles

4. Verify realtime subscriptions work with:
   const channel = supabase.channel('bookings-test')
     .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'bookings' },
          (payload) => console.log(payload))
     .subscribe();

## Security Considerations

1. Service role key has admin privileges and bypasses RLS
2. Anon key respects RLS policies
3. JWT claims (role, user_id) can be checked with auth.jwt()
4. Cast auth.uid() to text when comparing with text columns

## Debugging

- Check which policies are active:
  SELECT * FROM pg_policies WHERE tablename = 'bookings';

- Test policy as specific user:
  SELECT set_config('request.jwt.claim.sub', 'user-uuid', false);
  SELECT * FROM bookings; -- shows only their bookings

- Monitor RLS performance:
  EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM bookings;
`;

export default RLS_POLICIES_DOCUMENTATION;
