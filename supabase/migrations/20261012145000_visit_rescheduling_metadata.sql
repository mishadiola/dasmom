ALTER TABLE public.prenatal_visits
  ADD COLUMN IF NOT EXISTS reschedule_reason TEXT,
  ADD COLUMN IF NOT EXISTS rescheduled_from_date DATE,
  ADD COLUMN IF NOT EXISTS rescheduled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rescheduled_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reschedule_event_id UUID;

ALTER TABLE public.postpartum_visits
  ADD COLUMN IF NOT EXISTS reschedule_reason TEXT,
  ADD COLUMN IF NOT EXISTS rescheduled_from_date DATE,
  ADD COLUMN IF NOT EXISTS rescheduled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rescheduled_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reschedule_event_id UUID;

ALTER TABLE public.vaccinations
  ADD COLUMN IF NOT EXISTS reschedule_reason TEXT,
  ADD COLUMN IF NOT EXISTS rescheduled_from_date DATE,
  ADD COLUMN IF NOT EXISTS rescheduled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rescheduled_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reschedule_event_id UUID;

CREATE TABLE IF NOT EXISTS public.visit_reschedule_email_events (
  event_id UUID PRIMARY KEY,
  visit_type TEXT NOT NULL CHECK (
    visit_type IN ('prenatal', 'postpartum', 'maternal_vaccination', 'newborn_vaccination')
  ),
  visit_id UUID NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('processing', 'sent', 'failed')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.visit_reschedule_email_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.visit_reschedule_email_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.visit_reschedule_email_events TO service_role;
