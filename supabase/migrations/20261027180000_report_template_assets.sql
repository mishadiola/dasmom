INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'report-template-assets',
  'report-template-assets',
  FALSE,
  2097152,
  ARRAY['image/png', 'image/jpeg']
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  public = FALSE,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

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
        AND (template.created_by = auth.uid() OR template.is_shared)
        AND public.has_permission('reports.templates.edit')
        AND (
          (template.report_type LIKE 'analytics.%' AND public.has_permission('reports.analytics.view'))
          OR (template.report_type = 'station.summary' AND public.has_permission('reports.station.view'))
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
        AND (template.created_by = auth.uid() OR template.is_shared)
        AND public.has_permission('reports.templates.edit')
        AND (
          (template.report_type LIKE 'analytics.%' AND public.has_permission('reports.analytics.view'))
          OR (template.report_type = 'station.summary' AND public.has_permission('reports.station.view'))
        )
    )
  );
