DROP POLICY IF EXISTS postpartum_visits_insert ON public.postpartum_visits;

CREATE POLICY postpartum_visits_insert ON public.postpartum_visits
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.deliveries d
      WHERE d.id = delivery_id
        AND d.mother_id = patient_id
        AND d.station_ass IS NOT DISTINCT FROM public.postpartum_visits.station_ass
    )
    AND (assigned_staff IS NULL OR public.is_latest_prenatal_staff_for_patient(patient_id, assigned_staff))
    AND (performed_by IS NULL OR performed_by = auth.uid())
    AND (
      (patient_id = auth.uid() AND created_by IS NULL)
      OR (
        public.get_my_role() = 'admin'
        AND (created_by IS NULL OR created_by = auth.uid())
      )
      OR (
        public.get_my_role() IN ('cho personnel', 'staff')
        AND station_ass IS NOT DISTINCT FROM public.get_my_station()
        AND (created_by IS NULL OR created_by = auth.uid())
      )
    )
  );

WITH delivery_schedules AS (
  SELECT
    d.*,
    (
      (d.delivery_date + COALESCE(d.delivery_time, TIME '00:00'))
      AT TIME ZONE 'Asia/Manila'
    ) AS birth_at,
    (
      SELECT v.assigned_staff
      FROM public.prenatal_visits v
      WHERE v.patient_id = d.mother_id
        AND v.assigned_staff IS NOT NULL
      ORDER BY (v.status = 'Scheduled') DESC, v.visit_date DESC NULLS LAST, v.created_at DESC NULLS LAST
      LIMIT 1
    ) AS prenatal_staff
  FROM public.deliveries d
)
INSERT INTO public.postpartum_visits (
  delivery_id,
  patient_id,
  visit_number,
  scheduled_date,
  visit_type,
  scheduled_at,
  status,
  assigned_staff,
  assigned_station,
  station_ass,
  created_by,
  assessment
)
SELECT
  d.id,
  d.mother_id,
  schedule.visit_number,
  ((d.birth_at + schedule.after_birth) AT TIME ZONE 'Asia/Manila')::DATE,
  schedule.visit_type,
  d.birth_at + schedule.after_birth,
  'Scheduled',
  d.prenatal_staff,
  d.station_ass,
  d.station_ass,
  COALESCE(d.created_by, d.attending_staff),
  '{}'::JSONB
FROM delivery_schedules d
CROSS JOIN (VALUES
  (1, '24 hours after birth', INTERVAL '24 hours'),
  (2, '3 days after birth', INTERVAL '3 days'),
  (3, '7 days after birth', INTERVAL '7 days'),
  (4, '6 weeks after birth', INTERVAL '6 weeks')
) AS schedule(visit_number, visit_type, after_birth)
ON CONFLICT (delivery_id, visit_number) DO NOTHING;
