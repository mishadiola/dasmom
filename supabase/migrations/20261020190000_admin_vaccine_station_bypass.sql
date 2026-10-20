CREATE OR REPLACE FUNCTION public.guard_vaccine_administration()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
SET row_security = off
AS $$
DECLARE
  v_patient_id UUID := NEW.patient_id;
  v_patient_station UUID;
  v_requires_permission BOOLEAN := FALSE;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_requires_permission := NEW.status = 'Completed';
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'Completed' THEN
    v_requires_permission := OLD.status IS DISTINCT FROM 'Completed'
      OR NEW.vaccinated_date IS DISTINCT FROM OLD.vaccinated_date;
  END IF;

  IF v_requires_permission AND public.get_my_role() IS DISTINCT FROM 'admin' THEN
    IF v_patient_id IS NULL THEN
      SELECT n.mother_id INTO v_patient_id
      FROM public.newborns AS n
      WHERE n.id = NEW.newborn_id;
    END IF;

    v_patient_station := public.get_patient_station(v_patient_id);
    IF NOT public.has_station_permission(
      'vaccine.administer.own_station',
      'vaccine.administer.other_station',
      v_patient_station
    ) THEN
      RAISE EXCEPTION 'Not authorized to administer this vaccine';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
