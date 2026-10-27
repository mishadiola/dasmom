CREATE INDEX IF NOT EXISTS pregnancy_info_edd_lookup_idx
  ON public.pregnancy_info (pregn_postp, lmd);

INSERT INTO public.role_permission_catalog
  (permission_key, category, label, description, display_order)
VALUES
  (
    'edd.schedule.view.own_station',
    'Patient Visits and Scheduling',
    'View EDD schedules at own station',
    'View estimated due dates calculated from LMP for pregnant patients assigned to the logged-in user''s station.',
    53
  ),
  (
    'edd.schedule.view.other_station',
    'Patient Visits and Scheduling',
    'View EDD schedules at other stations',
    'View estimated due dates calculated from LMP for pregnant patients at other stations.',
    54
  )
ON CONFLICT (permission_key) DO UPDATE SET
  category = EXCLUDED.category,
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order;

WITH permission_defaults(permission_key, staff_allowed, cho_allowed, patient_allowed) AS (
  VALUES
    ('edd.schedule.view.own_station', TRUE, TRUE, FALSE),
    ('edd.schedule.view.other_station', FALSE, FALSE, FALSE)
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
