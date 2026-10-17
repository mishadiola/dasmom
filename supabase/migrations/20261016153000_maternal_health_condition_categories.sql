-- Migration: Support structured categorized maternal health conditions
-- Preserves compatibility with existing risk_factors string while enabling JSON-based condition categorization

ALTER TABLE public.prenatal_visits
  ADD COLUMN IF NOT EXISTS categorized_conditions JSONB DEFAULT '[]'::jsonb;

ALTER TABLE public.pregnancy_info
  ADD COLUMN IF NOT EXISTS documented_conditions JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.prenatal_visits.categorized_conditions IS 'Structured list of maternal health conditions with name, category, and metadata';
COMMENT ON COLUMN public.pregnancy_info.documented_conditions IS 'Structured list of documented conditions with category classifications';
