CREATE OR REPLACE FUNCTION public.is_report_template_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
SET row_security = off
AS $$
  SELECT auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.users AS u
      JOIN public.user_type AS ut ON ut.id = u.usertype
      WHERE u.id = auth.uid()
        AND LOWER(REPLACE(TRIM(ut.user_type), '_', ' ')) = 'admin'
    );
$$;

REVOKE ALL ON FUNCTION public.is_report_template_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_report_template_admin() TO authenticated;

DROP POLICY IF EXISTS report_templates_read_authorized ON public.report_templates;
CREATE POLICY report_templates_read_authorized
  ON public.report_templates FOR SELECT TO authenticated
  USING (
    public.is_report_template_admin()
    OR (
      (
        (report_type LIKE 'analytics.%' AND public.has_permission('reports.analytics.view'))
        OR (report_type = 'station.summary' AND public.has_permission('reports.station.view'))
      )
      AND (created_by = auth.uid() OR is_shared)
    )
  );

DROP POLICY IF EXISTS report_templates_create_authorized ON public.report_templates;
CREATE POLICY report_templates_create_authorized
  ON public.report_templates FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      public.is_report_template_admin()
      OR (
        public.has_permission('reports.templates.create')
        AND (
          (report_type LIKE 'analytics.%' AND public.has_permission('reports.analytics.view'))
          OR (report_type = 'station.summary' AND public.has_permission('reports.station.view'))
        )
      )
    )
  );

DROP POLICY IF EXISTS report_templates_edit_authorized ON public.report_templates;
CREATE POLICY report_templates_edit_authorized
  ON public.report_templates FOR UPDATE TO authenticated
  USING (
    public.is_report_template_admin()
    OR (
      public.has_permission('reports.templates.edit')
      AND (created_by = auth.uid() OR is_shared)
      AND (
        (report_type LIKE 'analytics.%' AND public.has_permission('reports.analytics.view'))
        OR (report_type = 'station.summary' AND public.has_permission('reports.station.view'))
      )
    )
  )
  WITH CHECK (
    public.is_report_template_admin()
    OR (
      public.has_permission('reports.templates.edit')
      AND (created_by = auth.uid() OR is_shared)
      AND (
        (report_type LIKE 'analytics.%' AND public.has_permission('reports.analytics.view'))
        OR (report_type = 'station.summary' AND public.has_permission('reports.station.view'))
      )
    )
  );

DROP POLICY IF EXISTS report_templates_delete_authorized ON public.report_templates;
CREATE POLICY report_templates_delete_authorized
  ON public.report_templates FOR DELETE TO authenticated
  USING (
    public.is_report_template_admin()
    OR (
      public.has_permission('reports.templates.edit')
      AND (created_by = auth.uid() OR is_shared)
      AND (
        (report_type LIKE 'analytics.%' AND public.has_permission('reports.analytics.view'))
        OR (report_type = 'station.summary' AND public.has_permission('reports.station.view'))
      )
    )
  );

DROP POLICY IF EXISTS report_template_assets_read_authorized ON storage.objects;
CREATE POLICY report_template_assets_read_authorized
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'report-template-assets'
    AND EXISTS (
      SELECT 1
      FROM public.report_templates AS template
      WHERE template.id::text = (storage.foldername(name))[1]
        AND template.layout_config ->> 'logoPath' = name
        AND (
          public.is_report_template_admin()
          OR (
            (template.created_by = auth.uid() OR template.is_shared)
            AND (
              (template.report_type LIKE 'analytics.%' AND public.has_permission('reports.analytics.view'))
              OR (template.report_type = 'station.summary' AND public.has_permission('reports.station.view'))
            )
          )
        )
    )
  );

DROP POLICY IF EXISTS report_template_assets_upload_authorized ON storage.objects;
CREATE POLICY report_template_assets_upload_authorized
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'report-template-assets'
    AND name ~ '^[0-9a-fA-F-]{36}/logo-[0-9a-fA-F-]{36}\.(png|jpg)$'
    AND EXISTS (
      SELECT 1
      FROM public.report_templates AS template
      WHERE template.id::text = (storage.foldername(name))[1]
        AND (
          public.is_report_template_admin()
          OR (
            (template.created_by = auth.uid() OR template.is_shared)
            AND public.has_permission('reports.templates.edit')
            AND (
              (template.report_type LIKE 'analytics.%' AND public.has_permission('reports.analytics.view'))
              OR (template.report_type = 'station.summary' AND public.has_permission('reports.station.view'))
            )
          )
        )
    )
  );

DROP POLICY IF EXISTS report_template_assets_delete_authorized ON storage.objects;
CREATE POLICY report_template_assets_delete_authorized
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'report-template-assets'
    AND name ~ '^[0-9a-fA-F-]{36}/logo-[0-9a-fA-F-]{36}\.(png|jpg)$'
    AND EXISTS (
      SELECT 1
      FROM public.report_templates AS template
      WHERE template.id::text = (storage.foldername(name))[1]
        AND (
          public.is_report_template_admin()
          OR (
            (template.created_by = auth.uid() OR template.is_shared)
            AND public.has_permission('reports.templates.edit')
            AND (
              (template.report_type LIKE 'analytics.%' AND public.has_permission('reports.analytics.view'))
              OR (template.report_type = 'station.summary' AND public.has_permission('reports.station.view'))
            )
          )
        )
    )
  );
