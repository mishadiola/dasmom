INSERT INTO public.role_permission_catalog
  (permission_key, category, label, description, display_order)
VALUES
  ('reports.station.view', 'Reports & Analytics', 'Access station reports', 'Open station-level reports and reporting tools.', 59),
  ('reports.analytics.view', 'Reports & Analytics', 'Access analytics', 'Open system analytics dashboards and trends.', 60)
ON CONFLICT (permission_key) DO UPDATE SET
  category = EXCLUDED.category,
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order;

INSERT INTO public.role_permissions (role_id, permission_key, is_allowed)
SELECT
  user_type.id,
  permission.permission_key,
  CASE
    WHEN LOWER(REPLACE(TRIM(user_type.user_type), '_', ' ')) = 'admin' THEN TRUE
    WHEN permission.permission_key = 'reports.analytics.view'
      AND LOWER(REPLACE(TRIM(user_type.user_type), '_', ' ')) = 'cho personnel' THEN TRUE
    WHEN permission.permission_key = 'reports.station.view'
      AND LOWER(REPLACE(TRIM(user_type.user_type), '_', ' ')) IN ('cho personnel', 'staff', 'station staff') THEN TRUE
    ELSE FALSE
  END
FROM public.user_type AS user_type
CROSS JOIN (
  VALUES ('reports.station.view'), ('reports.analytics.view')
) AS permission(permission_key)
ON CONFLICT (role_id, permission_key) DO NOTHING;
