CREATE OR REPLACE FUNCTION public.cancel_future_scheduled_visit(
  p_visit_kind TEXT,
  p_visit_id UUID,
  p_patient_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
DECLARE
  v_role TEXT := public.get_my_role();
  v_station UUID := public.get_my_station();
  v_updated INTEGER := 0;
BEGIN
  IF auth.uid() IS NULL OR COALESCE(v_role, '') NOT IN ('admin', 'staff', 'cho personnel') THEN
    RAISE EXCEPTION 'Not authorized to cancel scheduled visits';
  END IF;

  IF v_role <> 'admin' AND (
    v_station IS NULL OR NOT public.belongs_to_my_station(p_patient_id)
  ) THEN
    RAISE EXCEPTION 'You can only manage visits for patients assigned to your station';
  END IF;

  IF p_visit_kind = 'prenatal' THEN
    UPDATE public.prenatal_visits
    SET status = 'Cancelled'
    WHERE id = p_visit_id
      AND patient_id = p_patient_id
      AND status = 'Scheduled'
      AND visit_date >= CURRENT_DATE
      AND (
        v_role = 'admin'
        OR (
          v_role = 'staff'
          AND (assigned_staff = auth.uid() OR created_by = auth.uid())
          AND assigned_station IS NOT DISTINCT FROM v_station
        )
        OR (
          v_role = 'cho personnel'
          AND (
            assigned_station IS NOT DISTINCT FROM v_station
            OR created_by = auth.uid()
          )
        )
      );
    GET DIAGNOSTICS v_updated = ROW_COUNT;
  ELSIF p_visit_kind = 'postpartum' THEN
    UPDATE public.postpartum_visits
    SET status = 'Cancelled'
    WHERE id = p_visit_id
      AND patient_id = p_patient_id
      AND status = 'Scheduled'
      AND scheduled_date >= CURRENT_DATE;
    GET DIAGNOSTICS v_updated = ROW_COUNT;
  ELSIF p_visit_kind IN ('maternal_vaccination', 'newborn_vaccination') THEN
    UPDATE public.vaccinations AS vaccination
    SET status = 'Cancelled'
    WHERE vaccination.id = p_visit_id
      AND vaccination.status = 'Pending'
      AND vaccination.vaccinated_date IS NULL
      AND vaccination.scheduled_vaccination >= CURRENT_DATE
      AND (
        (p_visit_kind = 'maternal_vaccination'
          AND vaccination.patient_id = p_patient_id
          AND vaccination.newborn_id IS NULL)
        OR
        (p_visit_kind = 'newborn_vaccination'
          AND vaccination.patient_id IS NULL
          AND EXISTS (
            SELECT 1
            FROM public.newborns newborn
            WHERE newborn.id = vaccination.newborn_id
              AND newborn.mother_id = p_patient_id
          ))
      );
    GET DIAGNOSTICS v_updated = ROW_COUNT;
  ELSE
    RAISE EXCEPTION 'Unsupported visit category';
  END IF;

  IF v_updated <> 1 THEN
    RAISE EXCEPTION 'Visit not found or no longer eligible for cancellation';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_future_scheduled_visit(TEXT, UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_future_scheduled_visit(TEXT, UUID, UUID) TO authenticated;
