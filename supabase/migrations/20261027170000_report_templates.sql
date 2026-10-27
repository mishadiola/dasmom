INSERT INTO public.role_permission_catalog
  (permission_key, category, label, description, display_order)
VALUES
  ('reports.templates.create', 'Reports & Analytics', 'Create Report Templates', 'Create and save report templates for report types the role can access.', 63),
  ('reports.templates.edit', 'Reports & Analytics', 'Edit Report Templates', 'Edit or delete owned or shared report templates for report types the role can access.', 64),
  ('reports.analytics.export', 'Reports & Analytics', 'Export Analytics Reports', 'Export reports generated from the Analytics page.', 65),
  ('reports.station.export', 'Reports & Analytics', 'Export Station Reports', 'Export reports generated from the Station Reports page.', 66)
ON CONFLICT (permission_key) DO UPDATE SET
  category = EXCLUDED.category,
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order;

INSERT INTO public.role_permissions (role_id, permission_key, is_allowed)
SELECT user_type.id, permission.permission_key,
       LOWER(REPLACE(TRIM(user_type.user_type), '_', ' ')) = 'admin'
FROM public.user_type AS user_type
CROSS JOIN (
  VALUES
    ('reports.templates.create'),
    ('reports.templates.edit'),
    ('reports.analytics.export'),
    ('reports.station.export')
) AS permission(permission_key)
ON CONFLICT (role_id, permission_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.report_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 100),
  description TEXT NOT NULL DEFAULT '' CHECK (char_length(description) <= 500),
  report_type TEXT NOT NULL CHECK (
    report_type IN (
      'analytics.overview',
      'analytics.maternal',
      'analytics.vaccination',
      'analytics.delivery',
      'station.summary'
    )
  ),
  layout_config JSONB NOT NULL DEFAULT '{}'::JSONB
    CHECK (jsonb_typeof(layout_config) = 'object' AND pg_column_size(layout_config) <= 32768),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_shared BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS report_templates_type_updated_idx
  ON public.report_templates (report_type, updated_at DESC);

CREATE INDEX IF NOT EXISTS report_templates_owner_type_idx
  ON public.report_templates (created_by, report_type);

ALTER TABLE public.report_templates ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_templates TO authenticated;
REVOKE ALL ON public.report_templates FROM anon;

CREATE OR REPLACE FUNCTION public.set_report_template_metadata()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
      RAISE EXCEPTION 'A report template owner cannot be changed';
    END IF;
    IF NEW.report_type IS DISTINCT FROM OLD.report_type THEN
      RAISE EXCEPTION 'A report template category cannot be changed';
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS report_templates_set_metadata ON public.report_templates;
CREATE TRIGGER report_templates_set_metadata
  BEFORE INSERT OR UPDATE ON public.report_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_report_template_metadata();

DROP POLICY IF EXISTS report_templates_read_authorized ON public.report_templates;
CREATE POLICY report_templates_read_authorized
  ON public.report_templates FOR SELECT TO authenticated
  USING (
    (
      (
        report_type LIKE 'analytics.%'
        AND public.has_permission('reports.analytics.view')
      )
      OR (
        report_type = 'station.summary'
        AND public.has_permission('reports.station.view')
      )
    )
    AND (created_by = auth.uid() OR is_shared)
  );

DROP POLICY IF EXISTS report_templates_create_authorized ON public.report_templates;
CREATE POLICY report_templates_create_authorized
  ON public.report_templates FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND public.has_permission('reports.templates.create')
    AND (
      (report_type LIKE 'analytics.%' AND public.has_permission('reports.analytics.view'))
      OR (report_type = 'station.summary' AND public.has_permission('reports.station.view'))
    )
  );

DROP POLICY IF EXISTS report_templates_edit_authorized ON public.report_templates;
CREATE POLICY report_templates_edit_authorized
  ON public.report_templates FOR UPDATE TO authenticated
  USING (
    public.has_permission('reports.templates.edit')
    AND (created_by = auth.uid() OR is_shared)
    AND (
      (report_type LIKE 'analytics.%' AND public.has_permission('reports.analytics.view'))
      OR (report_type = 'station.summary' AND public.has_permission('reports.station.view'))
    )
  )
  WITH CHECK (
    public.has_permission('reports.templates.edit')
    AND (created_by = auth.uid() OR is_shared)
    AND (
      (report_type LIKE 'analytics.%' AND public.has_permission('reports.analytics.view'))
      OR (report_type = 'station.summary' AND public.has_permission('reports.station.view'))
    )
  );

DROP POLICY IF EXISTS report_templates_delete_authorized ON public.report_templates;
CREATE POLICY report_templates_delete_authorized
  ON public.report_templates FOR DELETE TO authenticated
  USING (
    public.has_permission('reports.templates.edit')
    AND (created_by = auth.uid() OR is_shared)
    AND (
      (report_type LIKE 'analytics.%' AND public.has_permission('reports.analytics.view'))
      OR (report_type = 'station.summary' AND public.has_permission('reports.station.view'))
    )
  );
