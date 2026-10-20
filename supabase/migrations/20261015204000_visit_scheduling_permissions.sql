INSERT INTO public.role_permission_catalog
  (permission_key, category, label, description, display_order)
VALUES
  (
    'visit.schedule.own_station',
    'Patient Visits and Scheduling',
    'Schedule visits for patients at own station',
    'Schedule prenatal or postpartum visits for patients assigned to the logged-in user''s station.',
    51
  ),
  (
    'visit.schedule.other_station',
    'Patient Visits and Scheduling',
    'Schedule visits for patients at other stations',
    'Schedule prenatal or postpartum visits for patients assigned to a different station.',
    52
  )
ON CONFLICT (permission_key) DO UPDATE SET
  category = EXCLUDED.category,
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order;

WITH permission_defaults(permission_key, staff_allowed, cho_allowed, patient_allowed) AS (
  VALUES
    ('visit.schedule.own_station', TRUE, TRUE, FALSE),
    ('visit.schedule.other_station', FALSE, FALSE, FALSE)
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
    WHEN LOWER(REPLACE(TRIM(ut.user_type), '_', ' ')) IN ('patient', 'mother')
      THEN defaults.patient_allowed
    ELSE FALSE
  END
FROM public.user_type AS ut
CROSS JOIN permission_defaults AS defaults
ON CONFLICT (role_id, permission_key) DO NOTHING;

DROP POLICY IF EXISTS role_permission_prenatal_insert ON public.prenatal_visits;
CREATE POLICY role_permission_prenatal_insert
  ON public.prenatal_visits AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    (
      status = 'Scheduled'
      AND public.has_patient_station_permission(
        patient_id,
        'visit.schedule.own_station',
        'visit.schedule.other_station'
      )
    )
    OR (
      status IS DISTINCT FROM 'Scheduled'
      AND public.has_patient_station_permission(
        patient_id,
        'prenatal.record.own_station',
        'prenatal.record.other_station'
      )
      AND (
        public.patient_is_at_own_station(patient_id)
        OR status <> 'Attended'
        OR station_ass IS DISTINCT FROM public.get_my_station()
        OR public.has_permission('prenatal.record.other_station_at_own_station')
      )
    )
  );

DROP POLICY IF EXISTS role_permission_postpartum_insert ON public.postpartum_visits;
CREATE POLICY role_permission_postpartum_insert
  ON public.postpartum_visits AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    (
      status = 'Scheduled'
      AND public.has_patient_station_permission(
        patient_id,
        'visit.schedule.own_station',
        'visit.schedule.other_station'
      )
    )
    OR (
      status IS DISTINCT FROM 'Scheduled'
      AND public.has_patient_station_permission(
        patient_id,
        'postpartum.record.own_station',
        'postpartum.record.other_station'
      )
    )
  );
