DROP POLICY IF EXISTS role_permission_patient_select ON public.patient_basic_info;
CREATE POLICY role_permission_patient_select
  ON public.patient_basic_info AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    (
      public.guard_patient_data_read(id, 'patient.view.own_station', 'patient.view.other_station')
      AND (
        station_ass IS NOT DISTINCT FROM public.get_my_station()
        OR public.has_permission('patient.see.other_station')
      )
    )
    OR public.has_patient_station_permission(
      id,
      'postpartum.schedule.view.own_station',
      'postpartum.schedule.view.other_station'
    )
    OR public.has_patient_station_permission(
      id,
      'postpartum.record.own_station',
      'postpartum.record.other_station'
    )
  );
