INSERT INTO public.role_permission_catalog
  (permission_key, category, label, description, display_order)
VALUES
  (
    'patient.assign_staff.own_station',
    'Patient Visits and Scheduling',
    'Assign health workers to patients at own station',
    'Assign a health worker to prenatal visits and pending vaccinations for patients at the logged-in user''s station.',
    61
  ),
  (
    'patient.assign_staff.other_station',
    'Patient Visits and Scheduling',
    'Assign health workers to patients at other stations',
    'Assign a health worker to prenatal visits and pending vaccinations for patients at a different station.',
    62
  )
ON CONFLICT (permission_key) DO UPDATE SET
  category = EXCLUDED.category,
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order;

WITH permission_defaults(permission_key, staff_allowed, cho_allowed) AS (
  VALUES
    ('patient.assign_staff.own_station', TRUE, TRUE),
    ('patient.assign_staff.other_station', FALSE, FALSE)
)
INSERT INTO public.role_permissions (role_id, permission_key, is_allowed)
SELECT
  ut.id,
  defaults.permission_key,
  CASE
    WHEN LOWER(REPLACE(TRIM(ut.user_type), '_', ' ')) = 'admin' THEN TRUE
    WHEN LOWER(REPLACE(TRIM(ut.user_type), '_', ' ')) IN ('staff', 'station staff')
      THEN defaults.staff_allowed
    WHEN LOWER(REPLACE(TRIM(ut.user_type), '_', ' ')) = 'cho personnel'
      THEN defaults.cho_allowed
    ELSE FALSE
  END
FROM public.user_type AS ut
CROSS JOIN permission_defaults AS defaults
ON CONFLICT (role_id, permission_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_assignable_staff(p_station_id UUID)
RETURNS TABLE(id UUID, full_name TEXT, station_ass UUID)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
SET row_security = off
AS $$
  SELECT sp.id, sp.full_name, sp.station_ass
  FROM public.staff_profiles AS sp
  JOIN public.users AS u ON u.id = sp.id
  JOIN public.user_type AS ut ON ut.id = u.usertype
  WHERE sp.station_ass = p_station_id
    AND LOWER(REPLACE(TRIM(ut.user_type), '_', ' ')) IN ('staff', 'station staff', 'cho personnel')
    AND (
      public.has_station_permission(
        'patient.assign_staff.own_station',
        'patient.assign_staff.other_station',
        p_station_id
      )
      OR (
        p_station_id IS NOT DISTINCT FROM public.get_my_station()
        AND public.has_permission('staff.view.own_station')
      )
    )
  ORDER BY sp.full_name;
$$;

REVOKE ALL ON FUNCTION public.get_assignable_staff(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_assignable_staff(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.assign_patient_prenatal_staff(
  p_patient_id UUID,
  p_assigned_staff UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
SET row_security = off
AS $$
DECLARE
  v_patient_station UUID;
  v_updated_count INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'An authenticated user is required to assign health staff';
  END IF;

  SELECT p.station_ass
  INTO v_patient_station
  FROM public.patient_basic_info AS p
  WHERE p.id = p_patient_id;

  IF NOT FOUND OR v_patient_station IS NULL THEN
    RAISE EXCEPTION 'Patient station not found';
  END IF;

  IF NOT public.has_patient_station_permission(
    p_patient_id,
    'patient.assign_staff.own_station',
    'patient.assign_staff.other_station'
  ) THEN
    RAISE EXCEPTION 'You do not have permission to assign health staff to this patient';
  END IF;

  IF p_assigned_staff IS NULL
    OR NOT public.staff_member_belongs_to_station(p_assigned_staff, v_patient_station) THEN
    RAISE EXCEPTION 'Select an operational staff member from the patient station';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.prenatal_visits
    WHERE patient_id = p_patient_id
      AND status = 'Scheduled'
      AND assigned_staff IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Patient already has an assigned health worker';
  END IF;

  UPDATE public.prenatal_visits
  SET assigned_staff = p_assigned_staff,
      assigned_station = v_patient_station
  WHERE patient_id = p_patient_id
    AND status = 'Scheduled'
    AND assigned_staff IS NULL;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  IF v_updated_count = 0 THEN
    RAISE EXCEPTION 'No unassigned scheduled prenatal visits found';
  END IF;

  UPDATE public.vaccinations
  SET assigned_staff = p_assigned_staff
  WHERE patient_id = p_patient_id
    AND status = 'Pending'
    AND assigned_staff IS NULL;

  RETURN v_updated_count;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_patient_prenatal_staff(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_patient_prenatal_staff(UUID, UUID) TO authenticated;
