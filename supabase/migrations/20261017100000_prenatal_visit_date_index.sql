CREATE INDEX IF NOT EXISTS prenatal_visits_visit_date_desc_idx
  ON public.prenatal_visits (visit_date DESC);

CREATE INDEX IF NOT EXISTS patient_basic_info_created_at_desc_idx
  ON public.patient_basic_info (created_at DESC);
