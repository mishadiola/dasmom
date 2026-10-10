DROP POLICY IF EXISTS postpartum_visits_update ON public.postpartum_visits;

CREATE POLICY postpartum_visits_update ON public.postpartum_visits
  FOR UPDATE TO authenticated
  USING (
    public.get_my_role() = 'admin'
    OR (
      public.get_my_role() IN ('cho personnel', 'staff')
      AND station_ass IS NOT DISTINCT FROM public.get_my_station()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.deliveries d
      WHERE d.id = delivery_id
        AND d.mother_id = patient_id
        AND d.station_ass IS NOT DISTINCT FROM public.postpartum_visits.station_ass
    )
    AND (assigned_staff IS NULL OR public.is_latest_prenatal_staff_for_patient(patient_id, assigned_staff))
    AND (
      public.get_my_role() = 'admin'
      OR (
        public.get_my_role() IN ('cho personnel', 'staff')
        AND station_ass IS NOT DISTINCT FROM public.get_my_station()
      )
    )
  );
