-- Migration: Allow mothers/patients to resolve assigned staff profiles and names
-- Description:
-- 1. Updates role_permission_staff_select so that mothers/patients are not blocked by the restrictive staff-view policy.
-- 2. Enhances patient_read_assigned_staff to cover postpartum visits, prenatal visits, vaccinations, and retained station staff.
-- 3. Provides a secure SECURITY DEFINER RPC get_assigned_staff_names() to resolve healthcare worker names reliably for care appointments.

DROP POLICY IF EXISTS role_permission_staff_select ON public.staff_profiles;
CREATE POLICY role_permission_staff_select
  ON public.staff_profiles AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.get_my_role() IN ('mother', 'patient')
    OR public.has_station_permission('staff.view.own_station', 'staff.view.other_station', station_ass)
  );

DROP POLICY IF EXISTS patient_read_assigned_staff ON public.staff_profiles;
CREATE POLICY patient_read_assigned_staff
  ON public.staff_profiles FOR SELECT TO authenticated
  USING (
    public.get_my_role() IN ('mother', 'patient')
    AND (
      public.staff_assigned_my_prenatal_visit(staff_profiles.id)
      OR EXISTS (
        SELECT 1 FROM public.prenatal_visits v
        WHERE v.patient_id = auth.uid()
          AND (v.assigned_staff = staff_profiles.id OR v.performed_by = staff_profiles.id)
      )
      OR EXISTS (
        SELECT 1 FROM public.postpartum_visits pv
        WHERE pv.patient_id = auth.uid()
          AND (pv.assigned_staff = staff_profiles.id OR pv.performed_by = staff_profiles.id OR pv.personnel_present = staff_profiles.id)
      )
      OR EXISTS (
        SELECT 1 FROM public.vaccinations v
        WHERE v.patient_id = auth.uid()
          AND (v.assigned_staff = staff_profiles.id OR v.vaccinated_by = staff_profiles.id)
      )
      OR EXISTS (
        SELECT 1
        FROM public.newborns n
        JOIN public.vaccinations v ON v.newborn_id = n.id
        WHERE n.mother_id = auth.uid()
          AND (v.assigned_staff = staff_profiles.id OR v.vaccinated_by = staff_profiles.id)
      )
      OR public.staff_attended_my_delivery(staff_profiles.id)
      OR EXISTS (
        SELECT 1 FROM public.patient_basic_info pbi
        WHERE pbi.id = auth.uid()
          AND (pbi.retained_staff = staff_profiles.id OR pbi.station_ass = staff_profiles.station_ass)
      )
    )
  );

CREATE OR REPLACE FUNCTION public.get_assigned_staff_names(p_staff_ids UUID[])
RETURNS TABLE(id UUID, full_name TEXT, station_name TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
SET row_security = off
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT sp.id, sp.full_name::TEXT, st.station_name::TEXT
  FROM public.staff_profiles AS sp
  LEFT JOIN public.stations AS st ON st.id = sp.station_ass
  WHERE sp.id = ANY(COALESCE(p_staff_ids, ARRAY[]::UUID[]));
END;
$$;

REVOKE ALL ON FUNCTION public.get_assigned_staff_names(UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_assigned_staff_names(UUID[]) TO authenticated;
