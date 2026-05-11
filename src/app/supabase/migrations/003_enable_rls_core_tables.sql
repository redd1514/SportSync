-- Enable RLS on tables that were fully exposed to anon/authenticated clients.
-- Service role (API server) bypasses RLS. Direct browser PostgREST access will be denied until you add policies.
ALTER TABLE public.sports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facility_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hourly_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.court_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_specializations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
