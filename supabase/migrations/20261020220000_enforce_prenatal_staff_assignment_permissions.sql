CREATE OR REPLACE FUNCTION public.assign_prenatal_visit(
  p_visit_id UUID,
  p_assigned_staff UUID,
  p_assigned_station UUID DEFAULT NULL
)
RETURNS public.prenatal_visits
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
SET row_security = off
AS $$
DECLARE
  v_patient_station UUID;
  v_assignee_station UUID;
  v_visit public.prenatal_visits;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'An authenticated user is required to assign health staff';
  END IF;

  SELECT *
  INTO v_visit
  FROM public.prenatal_visits
  WHERE id = p_visit_id
    AND status = 'Scheduled'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only a scheduled visit can be assigned';
  END IF;

  v_patient_station := public.get_patient_station(v_visit.patient_id);
  IF v_patient_station IS NULL OR NOT public.has_station_permission(
    'patient.assign_staff.own_station',
    'patient.assign_staff.other_station',
    v_patient_station
  ) THEN
    RAISE EXCEPTION 'You do not have permission to assign health staff to this patient';
  END IF;

  IF p_assigned_staff IS NOT NULL THEN
    SELECT station_ass
    INTO v_assignee_station
    FROM public.staff_profiles
    WHERE id = p_assigned_staff;

    IF NOT FOUND OR v_assignee_station IS DISTINCT FROM v_patient_station
      OR NOT public.staff_member_belongs_to_station(p_assigned_staff, v_patient_station) THEN
      RAISE EXCEPTION 'Select an operational staff member from the patient station';
    END IF;
  END IF;

  IF p_assigned_station IS NOT NULL
    AND p_assigned_station IS DISTINCT FROM v_patient_station THEN
    RAISE EXCEPTION 'Assigned staff station must match the patient station';
  END IF;

  UPDATE public.prenatal_visits
  SET assigned_staff = p_assigned_staff,
      assigned_station = v_patient_station
  WHERE id = p_visit_id
  RETURNING * INTO v_visit;

  RETURN v_visit;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_prenatal_visit(UUID, UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_prenatal_visit(UUID, UUID, UUID) TO authenticated;
