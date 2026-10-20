CREATE OR REPLACE FUNCTION public.guard_visit_reschedule()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
SET row_security = off
AS $$
DECLARE
  v_new JSONB := to_jsonb(NEW);
  v_old JSONB := to_jsonb(OLD);
  v_patient_id UUID := NULLIF(v_new->>'patient_id', '')::UUID;
  v_patient_station UUID;
BEGIN
  IF v_patient_id IS NULL AND TG_TABLE_NAME <> 'vaccinations' THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'prenatal_visits'
    AND (
      v_new->>'visit_date' IS DISTINCT FROM v_old->>'visit_date'
      OR (v_old->>'status' = 'Scheduled' AND v_new->>'status' = 'Cancelled')
    ) THEN
    v_patient_station := public.get_patient_station(v_patient_id);
  ELSIF TG_TABLE_NAME = 'postpartum_visits'
    AND (
      v_new->>'scheduled_date' IS DISTINCT FROM v_old->>'scheduled_date'
      OR v_new->>'scheduled_at' IS DISTINCT FROM v_old->>'scheduled_at'
      OR (v_old->>'status' = 'Scheduled' AND v_new->>'status' = 'Cancelled')
    ) THEN
    v_patient_station := public.get_patient_station(v_patient_id);
  ELSIF TG_TABLE_NAME = 'vaccinations'
    AND (
      v_new->>'scheduled_vaccination' IS DISTINCT FROM v_old->>'scheduled_vaccination'
      OR (v_old->>'status' = 'Pending' AND v_new->>'status' = 'Cancelled')
    ) THEN
    IF v_patient_id IS NOT NULL THEN
      v_patient_station := public.get_patient_station(v_patient_id);
    ELSE
      SELECT public.get_patient_station(n.mother_id)
      INTO v_patient_station
      FROM public.newborns AS n
      WHERE n.id = NULLIF(v_new->>'newborn_id', '')::UUID;
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  IF NOT public.has_station_permission(
    'patient.reschedule.own_station',
    'patient.reschedule.other_station',
    v_patient_station
  ) THEN
    RAISE EXCEPTION 'Not authorized to reschedule this visit';
  END IF;
  RETURN NEW;
END;
$$;
