# Report templates

The Analytics and Station Reports pages can save and reuse templates built from the pages' existing report calculations and currently authorized data. The builder includes:

- Analytics Overview, Maternal Health, Vaccination Coverage, and Delivery Outcomes, with category-specific metric selection.
- Station Reports, with selectable data fields and visible station rows.
- Private templates for the owner and shared templates visible to users who can access that report type.
- Drag-and-drop document blocks for titles, subtitles, filter metadata, text, logos, and report tables.
- Block-level font family and size, text/fill colors, bold, italic, underline, alignment, and borders.
- Page background/borders and table header/border styling.
- Custom headings, column order, widths, page orientation, margins, and page numbering.
- Styled PDF output and data-focused Excel output using the current page filters and data.
- Private PNG/JPEG logo uploads (up to 2 MB) in Supabase Storage. Logo assets are private and follow the template's report access and editing permissions.

Text styling applies to the selected document block; this is a Word-like report layout editor, not a full word processor with arbitrary rich-text selection.

## Database setup

The linked Supabase project has `supabase/migrations/20261027170000_report_templates.sql`, `supabase/migrations/20261027180000_report_template_assets.sql`, and `supabase/migrations/20261027190000_report_template_admin_access.sql` applied, with each new migration version recorded. The latest migration explicitly gives the database-backed `admin` role full access to report templates and their logos. Other roles continue to follow the role permissions configured in System Settings. These migrations do not deploy frontend code; no frontend code has been pushed or deployed.

The remote migration history still contains three earlier versions absent from this local checkout. Those versions were left untouched. The normal `supabase db push` flow may therefore require migration-history reconciliation; do not mark the missing versions as reverted or otherwise reconcile them without recovering their contents.

In Settings → Role Permissions, configure these permissions independently:

- **Create Report Templates** (`reports.templates.create`)
- **Edit Report Templates** (`reports.templates.edit`)
- **Export Analytics Reports** (`reports.analytics.export`)
- **Export Station Reports** (`reports.station.export`)

Template creation and modification require their respective permission and the existing view permission for the associated report category. Logo uploads and removal additionally require the edit permission. A shared template is readable by other users who can access that report type; editing/deleting it additionally requires the edit permission. Private templates remain owner-only. Template permissions do not grant access to patient records or stations; existing role permissions and table RLS remain in force for report data.

There is no separate template-view or template-share permission: template reads require the existing Analytics/Station Reports view permission, and the share setting applies only to template layout metadata. Creating or editing that setting requires the corresponding create/edit permission.

The app checks export permissions through `has_permission` before generating a file. Data retrieval remains subject to existing report-page authorization and Supabase RLS. PDF/Excel files are generated in the browser, so export permission is an application workflow permission rather than a separate server-side data-delivery endpoint.

## Local verification

1. Apply both migrations to a development Supabase project.
2. Grant report-view permissions and the desired template/export permissions to test roles in Settings → Role Permissions.
3. Sign in with each role and open Analytics or Station Reports.
4. Open **Create Format**, add/reorder document blocks, upload a private logo, save a private/shared template, select it again, and test styled PDF and Excel output with different reporting periods and station filters.
5. Test a role without template or export permissions; it should be unable to save/edit templates or generate exports.

The initial phase does not upload PDF templates or map PDF fields automatically. A later extension needs text/table extraction, mapping review against known report fields, OCR for scanned pages where needed, and a final document preview.
