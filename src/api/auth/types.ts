/** DB `users.role` (CHECK constraint). */
export type DbUserRole = 'user' | 'staff' | 'admin';

/** Application role including coach (derived from `coaches` row). */
export type AppRole = 'user' | 'staff' | 'admin' | 'coach';

export type ApiAuthContext = {
  /** `public.users.id` */
  userId: string;
  email: string;
  dbRole: DbUserRole;
  appRole: AppRole;
  /** Supabase Auth user id when token is a Supabase access_token; absent for demo API JWT */
  supabaseAuthUserId?: string;
};
