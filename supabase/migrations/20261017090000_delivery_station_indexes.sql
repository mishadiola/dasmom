CREATE INDEX IF NOT EXISTS deliveries_station_date_created_idx
  ON public.deliveries (station_ass, delivery_date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS patient_basic_info_station_ass_idx
  ON public.patient_basic_info (station_ass);
