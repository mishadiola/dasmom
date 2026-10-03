-- Dasmom RLS
-- Patient records are visible across stations; operational writes remain scoped.

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS VARCHAR
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
  SELECT CASE
    WHEN LOWER(REPLACE(TRIM(ut.user_type), '_', ' ')) = 'station staff' THEN 'staff'
    ELSE LOWER(REPLACE(TRIM(ut.user_type), '_', ' '))
  END
  FROM public.users u
  INNER JOIN public.user_type ut ON u.usertype = ut.id
  WHERE u.id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_my_station()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
  SELECT COALESCE(
    (SELECT station_ass FROM public.staff_profiles WHERE id = auth.uid() LIMIT 1),
    (SELECT station_ass FROM public.patient_basic_info WHERE id = auth.uid() LIMIT 1)
  );
$$;
CREATE OR REPLACE FUNCTION public.belongs_to_my_station(patient_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.patient_basic_info
    WHERE id = patient_id
      AND station_ass = public.get_my_station()
  );
$$;

CREATE OR REPLACE FUNCTION public.newborn_in_my_station(newborn_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.newborns n
    INNER JOIN public.patient_basic_info p ON n.mother_id = p.id
    WHERE n.id = newborn_id
      AND p.station_ass = public.get_my_station()
  );
$$;

CREATE OR REPLACE FUNCTION public.patient_assigned_to_me(p_patient_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.prenatal_visits v
    WHERE v.patient_id = p_patient_id
      AND v.assigned_staff = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.staff_member_belongs_to_station(p_staff_id UUID, p_station_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.staff_profiles sp
    INNER JOIN public.users u ON u.id = sp.id
    INNER JOIN public.user_type ut ON ut.id = u.usertype
      WHERE sp.id = p_staff_id
        AND sp.station_ass = p_station_id
        AND LOWER(REPLACE(TRIM(ut.user_type), '_', ' ')) IN ('staff', 'station staff', 'cho personnel')
  );
$$;

CREATE OR REPLACE FUNCTION public.get_staff_directory()
RETURNS TABLE(
  id UUID,
  email_address TEXT,
  user_type TEXT,
  is_archived BOOLEAN,
  is_deactivated BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
DECLARE
  v_role TEXT := public.get_my_role();
  v_station UUID := public.get_my_station();
BEGIN
  IF auth.uid() IS NULL OR COALESCE(v_role, '') NOT IN ('admin', 'staff', 'cho personnel') THEN
    RAISE EXCEPTION 'Not authorized to view the staff directory';
  END IF;

  RETURN QUERY
  SELECT sp.id, u.email_address::TEXT, ut.user_type::TEXT, u.is_archived, u.is_deactivated
  FROM public.staff_profiles sp
  INNER JOIN public.users u ON u.id = sp.id
  INNER JOIN public.user_type ut ON ut.id = u.usertype
  WHERE v_role = 'admin'
     OR (v_station IS NOT NULL AND sp.station_ass = v_station)
  ORDER BY sp.full_name;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_assignable_staff(p_station_id UUID)
RETURNS TABLE(id UUID, full_name TEXT, station_ass UUID)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
  SELECT sp.id, sp.full_name, sp.station_ass
  FROM public.staff_profiles sp
  INNER JOIN public.users u ON u.id = sp.id
  INNER JOIN public.user_type ut ON ut.id = u.usertype
    WHERE sp.station_ass = p_station_id
      AND LOWER(REPLACE(TRIM(ut.user_type), '_', ' ')) IN ('staff', 'station staff', 'cho personnel')
    AND (
      public.get_my_role() = 'admin'
      OR (
        public.get_my_role() = 'cho personnel'
        AND p_station_id = public.get_my_station()
      )
      OR (
        public.get_my_role() = 'staff'
        AND p_station_id = public.get_my_station()
      )
    )
  ORDER BY sp.full_name;
$$;

CREATE OR REPLACE FUNCTION public.set_patient_station(p_patient_id UUID, p_station_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
BEGIN
  IF auth.uid() IS NULL OR COALESCE(public.get_my_role(), '') NOT IN ('staff', 'cho personnel', 'admin') THEN
    RAISE EXCEPTION 'Not authorized to change patient station';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.stations WHERE id = p_station_id) THEN
    RAISE EXCEPTION 'Station not found';
  END IF;

  IF public.get_my_role() <> 'admin' AND NOT EXISTS (
    SELECT 1
    FROM public.patient_basic_info
    WHERE id = p_patient_id
      AND (station_ass IS NOT DISTINCT FROM public.get_my_station() OR created_by = auth.uid())
  ) THEN
    RAISE EXCEPTION 'Not authorized to change this patient station';
  END IF;

  UPDATE public.patient_basic_info
  SET station_ass = p_station_id
  WHERE id = p_patient_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Patient not found';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_prenatal_visit(
  p_visit_id UUID,
  p_payload JSONB,
  p_actual_station UUID DEFAULT NULL
)
RETURNS public.prenatal_visits
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
DECLARE
  v_role TEXT := public.get_my_role();
  v_station UUID;
  v_actual_station UUID;
  v_payload public.prenatal_visits;
  v_visit public.prenatal_visits;
BEGIN
  IF auth.uid() IS NULL OR COALESCE(v_role, '') NOT IN ('staff', 'cho personnel', 'admin') THEN
    RAISE EXCEPTION 'Not authorized to complete prenatal visits';
  END IF;

  SELECT station_ass INTO v_station
  FROM public.staff_profiles
  WHERE id = auth.uid();

  IF v_role IN ('staff', 'cho personnel') THEN
    IF v_station IS NULL THEN
      RAISE EXCEPTION 'Your account has no assigned station';
    END IF;
    v_actual_station := v_station;
  ELSE
    v_actual_station := COALESCE(p_actual_station, v_station);
  END IF;

  IF v_actual_station IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.stations WHERE id = v_actual_station
  ) THEN
    RAISE EXCEPTION 'Select a valid visit station';
  END IF;

  SELECT * INTO v_visit
  FROM public.prenatal_visits
  WHERE id = p_visit_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Prenatal visit not found';
  END IF;

  IF v_role IN ('staff', 'cho personnel')
    AND (v_visit.status IS NULL OR v_visit.status NOT IN ('Scheduled', 'Missed')) THEN
    RAISE EXCEPTION 'Only a pending visit can be completed';
  END IF;

  SELECT * INTO v_payload
  FROM jsonb_populate_record(v_visit, COALESCE(p_payload, '{}'::jsonb));

  UPDATE public.prenatal_visits AS visit SET
    visit_date = COALESCE(v_payload.visit_date, visit.visit_date),
    trimester = COALESCE(v_payload.trimester, visit.trimester),
    gestational_age = COALESCE(v_payload.gestational_age, visit.gestational_age),
    bp_systolic = v_payload.bp_systolic,
    bp_diastolic = v_payload.bp_diastolic,
    weight_kg = v_payload.weight_kg,
    height_cm = v_payload.height_cm,
    temp_c = v_payload.temp_c,
    pulse_bpm = v_payload.pulse_bpm,
    resp_rate_cpm = v_payload.resp_rate_cpm,
    fundal_height_cm = v_payload.fundal_height_cm,
    fhr_bpm = v_payload.fhr_bpm,
    fetal_movement = v_payload.fetal_movement,
    presentation = v_payload.presentation,
    tests_done = v_payload.tests_done,
    clinical_notes = v_payload.clinical_notes,
    advice_given = v_payload.advice_given,
    is_referred = COALESCE(v_payload.is_referred, FALSE),
    referred_to = v_payload.referred_to,
    referral_reason = v_payload.referral_reason,
    risk_factors = v_payload.risk_factors,
    calculated_risk = v_payload.calculated_risk,
    next_appt_date = v_payload.next_appt_date,
    next_appt_type = v_payload.next_appt_type,
    status = 'Attended',
    attended_date = COALESCE(v_payload.attended_date, CURRENT_DATE),
    station_ass = v_actual_station,
    performed_by = auth.uid()
  WHERE visit.id = p_visit_id
  RETURNING visit.* INTO v_visit;

  RETURN v_visit;
END;
$$;

CREATE OR REPLACE FUNCTION public.rebalance_prenatal_visits(
  p_current_visit_id UUID,
  p_schedule JSONB,
  p_future_visit_ids UUID[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
DECLARE
  v_role TEXT := public.get_my_role();
  v_current public.prenatal_visits;
  v_item JSONB;
  v_first_date DATE;
BEGIN
  IF auth.uid() IS NULL OR COALESCE(v_role, '') NOT IN ('staff', 'cho personnel', 'admin') THEN
    RAISE EXCEPTION 'Not authorized to rebalance prenatal visits';
  END IF;

  SELECT * INTO v_current
  FROM public.prenatal_visits
  WHERE id = p_current_visit_id
  FOR UPDATE;

  IF NOT FOUND OR v_current.status IS DISTINCT FROM 'Attended' THEN
    RAISE EXCEPTION 'A completed visit is required to rebalance the schedule';
  END IF;

  IF v_role IN ('staff', 'cho personnel') AND v_current.performed_by IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Only the user who handled this visit can rebalance its schedule';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(p_schedule, '[]'::jsonb))
  LOOP
    UPDATE public.prenatal_visits
    SET visit_number = (v_item->>'visitNumber')::INTEGER,
        visit_date = (v_item->>'date')::DATE,
        trimester = (v_item->>'trimester')::INTEGER,
        gestational_age = (v_item->>'week') || 'w',
        next_appt_type = COALESCE(v_item->>'type', 'Routine Prenatal'),
        next_appt_date = NULLIF(v_item->>'nextApptDate', '')::DATE
    WHERE id = (v_item->>'id')::UUID
      AND id = ANY(COALESCE(p_future_visit_ids, ARRAY[]::UUID[]))
      AND patient_id = v_current.patient_id
      AND visit_number > v_current.visit_number
      AND status = 'Scheduled';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'A scheduled future visit could not be rebalanced';
    END IF;

    IF v_first_date IS NULL THEN
      v_first_date := (v_item->>'date')::DATE;
    END IF;
  END LOOP;

  UPDATE public.prenatal_visits
  SET next_appt_date = v_first_date
  WHERE id = p_current_visit_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_prenatal_visit(
  p_visit_id UUID,
  p_assigned_staff UUID,
  p_assigned_station UUID DEFAULT NULL
)
RETURNS public.prenatal_visits
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
DECLARE
  v_role TEXT := public.get_my_role();
  v_station UUID;
  v_assignee_station UUID;
  v_visit public.prenatal_visits;
BEGIN
  IF auth.uid() IS NULL OR COALESCE(v_role, '') NOT IN ('staff', 'cho personnel', 'admin') THEN
    RAISE EXCEPTION 'Not authorized to assign prenatal visits';
  END IF;

  SELECT * INTO v_visit
  FROM public.prenatal_visits
  WHERE id = p_visit_id AND status = 'Scheduled'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only a scheduled visit can be assigned';
  END IF;

  IF v_role IN ('staff', 'cho personnel') THEN
    SELECT station_ass INTO v_station FROM public.staff_profiles WHERE id = auth.uid();
    IF v_station IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.patient_basic_info
      WHERE id = v_visit.patient_id AND station_ass = v_station
    ) THEN
      RAISE EXCEPTION 'Staff can assign visits only for patients at their station';
    END IF;
    IF v_role IN ('staff', 'cho personnel') AND p_assigned_staff IS NOT NULL
      AND NOT public.staff_member_belongs_to_station(p_assigned_staff, v_station) THEN
      RAISE EXCEPTION 'Station personnel can only assign staff from their own station';
    END IF;
    v_assignee_station := v_station;
  ELSE
    IF p_assigned_staff IS NOT NULL THEN
      SELECT station_ass INTO v_assignee_station
      FROM public.staff_profiles
      WHERE id = p_assigned_staff;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Assigned staff member not found';
      END IF;
      IF NOT public.staff_member_belongs_to_station(p_assigned_staff, v_assignee_station) THEN
        RAISE EXCEPTION 'Assigned user is not operational staff';
      END IF;
    ELSE
      v_assignee_station := COALESCE(p_assigned_station, v_visit.assigned_station, v_visit.station_ass);
    END IF;
  END IF;

  UPDATE public.prenatal_visits
  SET assigned_staff = p_assigned_staff,
      assigned_station = CASE
        WHEN v_role = 'cho personnel' THEN v_station
        ELSE COALESCE(p_assigned_station, v_assignee_station)
      END
  WHERE id = p_visit_id
  RETURNING * INTO v_visit;

  RETURN v_visit;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_patient_prenatal_staff(
  p_patient_id UUID,
  p_assigned_staff UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
DECLARE
  v_role TEXT := public.get_my_role();
  v_station UUID;
  v_patient_station UUID;
  v_updated_count INTEGER;
BEGIN
  IF auth.uid() IS NULL OR COALESCE(v_role, '') NOT IN ('staff', 'cho personnel', 'admin') THEN
    RAISE EXCEPTION 'Not authorized to assign patients';
  END IF;

  SELECT station_ass INTO v_patient_station
  FROM public.patient_basic_info
  WHERE id = p_patient_id;

  IF NOT FOUND OR v_patient_station IS NULL THEN
    RAISE EXCEPTION 'Patient station not found';
  END IF;

  IF v_role IN ('staff', 'cho personnel') THEN
    v_station := public.get_my_station();
    IF v_station IS NULL OR v_patient_station IS DISTINCT FROM v_station THEN
      RAISE EXCEPTION 'You can assign patients only at your station';
    END IF;
  END IF;

  IF p_assigned_staff IS NULL
    OR NOT public.staff_member_belongs_to_station(p_assigned_staff, v_patient_station) THEN
    RAISE EXCEPTION 'Select an operational staff member from the patient station';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.prenatal_visits
    WHERE patient_id = p_patient_id
      AND status = 'Scheduled'
      AND assigned_staff IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Patient already has an assigned health worker';
  END IF;

  UPDATE public.prenatal_visits
  SET assigned_staff = p_assigned_staff,
      assigned_station = v_patient_station
  WHERE patient_id = p_patient_id
    AND status = 'Scheduled'
    AND assigned_staff IS NULL;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  IF v_updated_count = 0 THEN
    RAISE EXCEPTION 'No unassigned scheduled prenatal visits found';
  END IF;

  UPDATE public.vaccinations
  SET assigned_staff = p_assigned_staff
  WHERE patient_id = p_patient_id
    AND status = 'Pending'
    AND assigned_staff IS NULL;

  RETURN v_updated_count;
END;
$$;

REVOKE ALL ON FUNCTION public.set_patient_station(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_patient_station(UUID, UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.get_assignable_staff(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_assignable_staff(UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.get_staff_directory() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_staff_directory() TO authenticated;
REVOKE ALL ON FUNCTION public.complete_prenatal_visit(UUID, JSONB, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_prenatal_visit(UUID, JSONB, UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.rebalance_prenatal_visits(UUID, JSONB, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rebalance_prenatal_visits(UUID, JSONB, UUID[]) TO authenticated;
REVOKE ALL ON FUNCTION public.assign_prenatal_visit(UUID, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_prenatal_visit(UUID, UUID, UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.assign_patient_prenatal_staff(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_patient_prenatal_staff(UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.staff_attended_my_delivery(p_staff_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.deliveries d
    WHERE d.mother_id = auth.uid()
      AND d.attending_staff = p_staff_id
  );
$$;

CREATE OR REPLACE FUNCTION public.staff_assigned_my_prenatal_visit(p_staff_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.prenatal_visits v
    WHERE v.patient_id = auth.uid()
      AND v.assigned_staff = p_staff_id
  );
$$;

CREATE OR REPLACE FUNCTION public.newborn_assigned_to_me(p_newborn_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.newborns n
    INNER JOIN public.prenatal_visits v ON v.patient_id = n.mother_id
    WHERE n.id = p_newborn_id
      AND v.assigned_staff = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.create_patient_user_record(
  p_user_id UUID,
  p_email TEXT,
  p_role TEXT,
  p_password TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
DECLARE
  v_role_id UUID;
BEGIN
  SELECT id INTO v_role_id
  FROM public.user_type
  WHERE LOWER(REPLACE(TRIM(user_type), '_', ' ')) = LOWER(REPLACE(TRIM(p_role), '_', ' '))
  LIMIT 1;

  IF v_role_id IS NULL THEN
    RAISE EXCEPTION 'Invalid role: %', p_role;
  END IF;

  INSERT INTO public.users (id, email_address, usertype, password)
  VALUES (p_user_id, LOWER(TRIM(p_email)), v_role_id, p_password)
  ON CONFLICT (id) DO UPDATE SET
    email_address = LOWER(TRIM(p_email)),
    usertype = v_role_id,
    password = COALESCE(p_password, public.users.password);
END;
$$;

ALTER TABLE public.user_type ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_basic_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pregnancy_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prenatal_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newborns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newborn_growth ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplement_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vaccine_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vaccinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vaccine_distribution ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplement_distribution ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.station_vaccine_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.station_supplement_inventory ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.vaccinations
  ADD COLUMN IF NOT EXISTS station_ass UUID REFERENCES public.stations(id);

ALTER TABLE public.supplements
  ADD COLUMN IF NOT EXISTS administered_by UUID REFERENCES public.staff_profiles(id),
  ADD COLUMN IF NOT EXISTS station_ass UUID REFERENCES public.stations(id);

UPDATE public.prenatal_visits
SET station_ass = NULL
WHERE status IN ('Scheduled', 'Missed')
  AND station_ass IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_email_address_unique_idx
  ON public.users (LOWER(BTRIM(email_address)))
  WHERE email_address IS NOT NULL AND BTRIM(email_address) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS vaccine_inventory_item_key_unique_idx
  ON public.vaccine_inventory (
    LOWER(BTRIM(vaccine_name)),
    LOWER(BTRIM(COALESCE(brand, ''))),
    COALESCE(expiration_date, DATE '0001-01-01')
  );

CREATE UNIQUE INDEX IF NOT EXISTS supplement_inventory_item_key_unique_idx
  ON public.supplement_inventory (
    LOWER(BTRIM(supplement_name)),
    LOWER(BTRIM(COALESCE(brand, ''))),
    COALESCE(expiration_date, DATE '0001-01-01')
  );

-- Backfill existing vaccination ownership from the latest assigned prenatal visit.
WITH latest_patient_assignment AS (
  SELECT DISTINCT ON (patient_id) patient_id, assigned_staff
  FROM public.prenatal_visits
  WHERE assigned_staff IS NOT NULL
  ORDER BY patient_id, visit_date DESC NULLS LAST, created_at DESC NULLS LAST
)
UPDATE public.vaccinations v
SET assigned_staff = a.assigned_staff
FROM latest_patient_assignment a
WHERE v.patient_id = a.patient_id
  AND v.assigned_staff IS NULL;

WITH latest_patient_assignment AS (
  SELECT DISTINCT ON (patient_id) patient_id, assigned_staff
  FROM public.prenatal_visits
  WHERE assigned_staff IS NOT NULL
  ORDER BY patient_id, visit_date DESC NULLS LAST, created_at DESC NULLS LAST
)
UPDATE public.vaccinations v
SET assigned_staff = a.assigned_staff
FROM public.newborns n
JOIN latest_patient_assignment a ON a.patient_id = n.mother_id
WHERE v.newborn_id = n.id
  AND v.assigned_staff IS NULL;

-- Make this full script safe to run over the current policy set.
DO $$
DECLARE
  policy_record RECORD;
BEGIN
  FOR policy_record IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'user_type', 'users', 'staff_profiles', 'patient_basic_info',
        'deliveries',
        'pregnancy_info', 'prenatal_visits', 'newborns', 'newborn_growth',
        'supplement_inventory', 'supplements', 'vaccine_inventory',
        'vaccinations', 'stations', 'vaccine_distribution',
        'supplement_distribution', 'station_vaccine_inventory',
        'station_supplement_inventory'
      )
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  END LOOP;
END;
$$;

-- user_type
CREATE POLICY admin_user_type ON public.user_type FOR ALL TO authenticated
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');
CREATE POLICY read_user_type ON public.user_type FOR SELECT TO authenticated
  USING (TRUE);

-- users
-- Use the SECURITY DEFINER role helper so users and user_type policies
-- do not query each other through RLS.
CREATE POLICY admin_users ON public.users FOR ALL TO authenticated
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');
CREATE POLICY read_own_user ON public.users FOR SELECT TO authenticated
  USING (id = auth.uid());
CREATE POLICY update_own_user ON public.users FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- staff_profiles
CREATE POLICY admin_staff ON public.staff_profiles FOR ALL TO authenticated
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');
CREATE POLICY cho_staff ON public.staff_profiles FOR ALL TO authenticated
  USING (
    get_my_role() = 'cho personnel'
    AND (station_ass IS NOT DISTINCT FROM get_my_station() OR id = auth.uid())
  )
  WITH CHECK (
    get_my_role() = 'cho personnel'
    AND station_ass IS NOT DISTINCT FROM get_my_station()
    AND public.staff_member_belongs_to_station(id, get_my_station())
  );
CREATE POLICY staff_read_staff ON public.staff_profiles FOR SELECT TO authenticated
  USING (
    get_my_role() = 'staff'
    AND id = auth.uid()
  );
CREATE POLICY staff_read_station_staff ON public.staff_profiles FOR SELECT TO authenticated
  USING (
    get_my_role() = 'staff'
    AND station_ass IS NOT DISTINCT FROM get_my_station()
  );
CREATE POLICY staff_insert_station_staff ON public.staff_profiles FOR INSERT TO authenticated
  WITH CHECK (
    get_my_role() = 'staff'
    AND station_ass IS NOT DISTINCT FROM get_my_station()
    AND public.staff_member_belongs_to_station(id, get_my_station())
  );
CREATE POLICY operational_read_prenatal_staff ON public.staff_profiles FOR SELECT TO authenticated
  USING (
    get_my_role() IN ('staff', 'cho personnel')
    AND (
      staff_profiles.station_ass IS NOT DISTINCT FROM get_my_station()
      OR EXISTS (
        SELECT 1 FROM public.prenatal_visits v
        WHERE v.assigned_staff = staff_profiles.id
           OR v.performed_by = staff_profiles.id
      )
      OR EXISTS (
        SELECT 1 FROM public.vaccinations v
        WHERE v.assigned_staff = staff_profiles.id
      )
    )
  );
CREATE POLICY patient_read_assigned_staff ON public.staff_profiles FOR SELECT TO authenticated
  USING (
    get_my_role() IN ('mother', 'patient')
    AND (
      public.staff_assigned_my_prenatal_visit(staff_profiles.id)
      OR EXISTS (
        SELECT 1 FROM public.prenatal_visits v
        WHERE v.patient_id = auth.uid()
          AND v.performed_by = staff_profiles.id
      )
      OR EXISTS (
        SELECT 1 FROM public.vaccinations v
        WHERE v.patient_id = auth.uid()
          AND v.assigned_staff = staff_profiles.id
      )
      OR EXISTS (
        SELECT 1
        FROM public.newborns n
        JOIN public.vaccinations v ON v.newborn_id = n.id
        WHERE n.mother_id = auth.uid()
          AND v.assigned_staff = staff_profiles.id
      )
      OR public.staff_attended_my_delivery(staff_profiles.id)
    )
  );

-- patient_basic_info
CREATE POLICY admin_patients ON public.patient_basic_info FOR ALL TO authenticated
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');
CREATE POLICY cho_read_all_patients ON public.patient_basic_info FOR SELECT TO authenticated
  USING (get_my_role() = 'cho personnel');
CREATE POLICY staff_read_all_patients ON public.patient_basic_info FOR SELECT TO authenticated
  USING (get_my_role() = 'staff');
CREATE POLICY cho_insert_patients ON public.patient_basic_info FOR INSERT TO authenticated
  WITH CHECK (get_my_role() = 'cho personnel' AND created_by = auth.uid() AND station_ass IS NOT NULL);
CREATE POLICY cho_update_patients ON public.patient_basic_info FOR UPDATE TO authenticated
  USING (get_my_role() = 'cho personnel' AND station_ass IS NOT DISTINCT FROM get_my_station())
  WITH CHECK (get_my_role() = 'cho personnel' AND station_ass IS NOT DISTINCT FROM get_my_station());
CREATE POLICY cho_delete_patients ON public.patient_basic_info FOR DELETE TO authenticated
  USING (get_my_role() = 'cho personnel' AND station_ass IS NOT DISTINCT FROM get_my_station());
CREATE POLICY staff_insert_patients ON public.patient_basic_info FOR INSERT TO authenticated
  WITH CHECK (
    get_my_role() = 'staff'
    AND created_by = auth.uid()
    AND station_ass IS NOT NULL
  );
CREATE POLICY staff_update_assigned_patients ON public.patient_basic_info FOR UPDATE TO authenticated
  USING (
    get_my_role() = 'staff'
    AND patient_assigned_to_me(id)
  )
  WITH CHECK (
    get_my_role() = 'staff'
    AND station_ass IS NOT DISTINCT FROM get_my_station()
  );
CREATE POLICY staff_delete_assigned_patients ON public.patient_basic_info FOR DELETE TO authenticated
  USING (
    get_my_role() = 'staff'
    AND patient_assigned_to_me(id)
  );
CREATE POLICY patient_read_own ON public.patient_basic_info FOR SELECT TO authenticated
  USING (id = auth.uid());

-- deliveries
CREATE POLICY admin_read_all_deliveries ON public.deliveries FOR SELECT TO authenticated
  USING (get_my_role() = 'admin');
CREATE POLICY insert_recorded_delivery ON public.deliveries FOR INSERT TO authenticated
  WITH CHECK (
    get_my_role() IN ('admin', 'cho personnel', 'staff')
    AND attending_staff = auth.uid()
    AND station_ass IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.staff_profiles attending_profile
      WHERE attending_profile.id = auth.uid()
        AND attending_profile.station_ass = deliveries.station_ass
    )
  );
CREATE POLICY admin_update_deliveries ON public.deliveries FOR UPDATE TO authenticated
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');
CREATE POLICY admin_delete_deliveries ON public.deliveries FOR DELETE TO authenticated
  USING (get_my_role() = 'admin');
CREATE POLICY cho_update_deliveries ON public.deliveries FOR UPDATE TO authenticated
  USING (get_my_role() = 'cho personnel' AND station_ass IS NOT DISTINCT FROM get_my_station())
  WITH CHECK (
    get_my_role() = 'cho personnel'
    AND station_ass IS NOT DISTINCT FROM get_my_station()
    AND (attending_staff IS NULL OR public.staff_member_belongs_to_station(attending_staff, station_ass))
  );
CREATE POLICY cho_delete_deliveries ON public.deliveries FOR DELETE TO authenticated
  USING (get_my_role() = 'cho personnel' AND station_ass IS NOT DISTINCT FROM get_my_station());
CREATE POLICY staff_update_deliveries ON public.deliveries FOR UPDATE TO authenticated
  USING (get_my_role() = 'staff' AND station_ass IS NOT DISTINCT FROM get_my_station())
  WITH CHECK (
    get_my_role() = 'staff'
    AND station_ass IS NOT DISTINCT FROM get_my_station()
    AND (attending_staff IS NULL OR public.staff_member_belongs_to_station(attending_staff, station_ass))
  );
CREATE POLICY staff_delete_deliveries ON public.deliveries FOR DELETE TO authenticated
  USING (get_my_role() = 'staff' AND station_ass IS NOT DISTINCT FROM get_my_station());
CREATE POLICY patient_deliveries_read ON public.deliveries FOR SELECT TO authenticated
  USING (mother_id = auth.uid());
CREATE POLICY cho_read_all_deliveries ON public.deliveries FOR SELECT TO authenticated
  USING (get_my_role() = 'cho personnel');
CREATE POLICY staff_read_all_deliveries ON public.deliveries FOR SELECT TO authenticated
  USING (get_my_role() = 'staff');

-- pregnancy_info
CREATE POLICY admin_pregnancy ON public.pregnancy_info FOR ALL TO authenticated
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');
CREATE POLICY cho_pregnancy ON public.pregnancy_info FOR ALL TO authenticated
  USING (get_my_role() = 'cho personnel' AND belongs_to_my_station(patient_id))
  WITH CHECK (get_my_role() = 'cho personnel' AND belongs_to_my_station(patient_id));
CREATE POLICY cho_read_all_pregnancy ON public.pregnancy_info FOR SELECT TO authenticated
  USING (get_my_role() = 'cho personnel');
CREATE POLICY cho_insert_registered_pregnancy ON public.pregnancy_info FOR INSERT TO authenticated
  WITH CHECK (
    get_my_role() = 'cho personnel'
    AND created_by = auth.uid()
    AND (
      belongs_to_my_station(patient_id)
      OR EXISTS (
        SELECT 1 FROM public.patient_basic_info p
        WHERE p.id = patient_id AND p.created_by = auth.uid()
      )
    )
  );
CREATE POLICY staff_read_pregnancy ON public.pregnancy_info FOR SELECT TO authenticated
  USING (get_my_role() = 'staff');
-- Registration inserts pregnancy_info before the first assigned prenatal visit exists.
CREATE POLICY staff_insert_pregnancy ON public.pregnancy_info FOR INSERT TO authenticated
  WITH CHECK (
    get_my_role() = 'staff'
    AND created_by = auth.uid()
    AND (
      belongs_to_my_station(patient_id)
      OR EXISTS (
        SELECT 1 FROM public.patient_basic_info p
        WHERE p.id = patient_id AND p.created_by = auth.uid()
      )
    )
  );
CREATE POLICY delivery_attending_insert_pregnancy ON public.pregnancy_info FOR INSERT TO authenticated
  WITH CHECK (
    get_my_role() IN ('staff', 'cho personnel')
    AND created_by = auth.uid()
    AND (
      EXISTS (
        SELECT 1
        FROM public.deliveries d
        WHERE d.mother_id = pregnancy_info.patient_id
          AND d.attending_staff = auth.uid()
          AND pregnancy_info.pregn_postp = 'Postpartum'
      )
      OR (
        miscarriage_info IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.pregnancy_info current_pregnancy
          WHERE current_pregnancy.patient_id = pregnancy_info.patient_id
            AND current_pregnancy.pregn_postp = 'Pregnant'
        )
      )
    )
  );
CREATE POLICY staff_update_pregnancy ON public.pregnancy_info FOR UPDATE TO authenticated
  USING (get_my_role() = 'staff' AND patient_assigned_to_me(patient_id))
  WITH CHECK (get_my_role() = 'staff' AND patient_assigned_to_me(patient_id));
CREATE POLICY staff_delete_pregnancy ON public.pregnancy_info FOR DELETE TO authenticated
  USING (get_my_role() = 'staff' AND patient_assigned_to_me(patient_id));
CREATE POLICY patient_pregnancy_read ON public.pregnancy_info FOR SELECT TO authenticated
  USING (patient_id = auth.uid());
CREATE POLICY patient_pregnancy_update_prefs ON public.pregnancy_info FOR UPDATE TO authenticated
  USING (patient_id = auth.uid())
  WITH CHECK (patient_id = auth.uid());

-- prenatal_visits
CREATE POLICY admin_prenatal ON public.prenatal_visits FOR ALL TO authenticated
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');
CREATE POLICY cho_read_prenatal ON public.prenatal_visits FOR SELECT TO authenticated
  USING (get_my_role() = 'cho personnel');
CREATE POLICY cho_insert_prenatal ON public.prenatal_visits FOR INSERT TO authenticated
  WITH CHECK (
    get_my_role() = 'cho personnel'
    AND (
      (
        status = 'Scheduled'
        AND station_ass IS NULL
        AND assigned_station IS NOT DISTINCT FROM get_my_station()
        AND (assigned_staff IS NULL OR public.staff_member_belongs_to_station(assigned_staff, get_my_station()))
        AND performed_by IS NULL
      )
      OR (
        status = 'Scheduled'
        AND assigned_staff IS NULL
        AND created_by = auth.uid()
        AND station_ass IS NULL
        AND EXISTS (
          SELECT 1 FROM public.patient_basic_info p
          WHERE p.id = patient_id
            AND p.station_ass IS NOT DISTINCT FROM assigned_station
        )
        AND performed_by IS NULL
      )
      OR (
        status = 'Attended'
        AND created_by = auth.uid()
        AND performed_by = auth.uid()
        AND station_ass IS NOT DISTINCT FROM get_my_station()
        AND (
          assigned_staff IS NULL
          OR EXISTS (
            SELECT 1 FROM public.patient_basic_info p
            WHERE p.id = patient_id
              AND public.staff_member_belongs_to_station(assigned_staff, p.station_ass)
          )
        )
      )
    )
  );
CREATE POLICY cho_update_prenatal ON public.prenatal_visits FOR UPDATE TO authenticated
  USING (
    get_my_role() = 'cho personnel'
    AND status IN ('Scheduled', 'Missed')
    AND assigned_station IS NOT DISTINCT FROM get_my_station()
    AND (
      assigned_staff IS NULL
      OR EXISTS (
        SELECT 1 FROM public.patient_basic_info p
        WHERE p.id = patient_id
          AND public.staff_member_belongs_to_station(assigned_staff, p.station_ass)
      )
    )
  )
  WITH CHECK (
    get_my_role() = 'cho personnel'
    AND status IN ('Scheduled', 'Missed')
    AND station_ass IS NULL
    AND assigned_station IS NOT DISTINCT FROM get_my_station()
    AND (assigned_staff IS NULL OR public.staff_member_belongs_to_station(assigned_staff, get_my_station()))
    AND performed_by IS NULL
  );
CREATE POLICY cho_delete_prenatal ON public.prenatal_visits FOR DELETE TO authenticated
  USING (
    get_my_role() = 'cho personnel'
    AND status = 'Scheduled'
    AND assigned_station IS NOT DISTINCT FROM get_my_station()
  );
CREATE POLICY staff_read_prenatal ON public.prenatal_visits FOR SELECT TO authenticated
  USING (get_my_role() = 'staff');
CREATE POLICY staff_insert_prenatal ON public.prenatal_visits FOR INSERT TO authenticated
  WITH CHECK (
    get_my_role() = 'staff'
    AND (
      (
        status = 'Scheduled'
        AND (assigned_staff IS NULL OR public.staff_member_belongs_to_station(assigned_staff, get_my_station()))
        AND station_ass IS NULL
        AND assigned_station IS NOT DISTINCT FROM get_my_station()
        AND performed_by IS NULL
      )
      OR (
        status = 'Scheduled'
        AND assigned_staff IS NULL
        AND created_by = auth.uid()
        AND station_ass IS NULL
        AND EXISTS (
          SELECT 1 FROM public.patient_basic_info p
          WHERE p.id = patient_id
            AND p.station_ass IS NOT DISTINCT FROM assigned_station
        )
        AND performed_by IS NULL
      )
      OR (
        status = 'Attended'
        AND created_by = auth.uid()
        AND performed_by = auth.uid()
        AND station_ass IS NOT DISTINCT FROM get_my_station()
        AND (
          assigned_staff IS NULL
          OR EXISTS (
            SELECT 1 FROM public.patient_basic_info p
            WHERE p.id = patient_id
              AND public.staff_member_belongs_to_station(assigned_staff, p.station_ass)
          )
        )
      )
    )
  );
CREATE POLICY staff_update_prenatal ON public.prenatal_visits FOR UPDATE TO authenticated
  USING (
    get_my_role() = 'staff'
    AND assigned_staff = auth.uid()
    AND status IN ('Scheduled', 'Missed')
    AND assigned_station IS NOT DISTINCT FROM get_my_station()
  )
  WITH CHECK (
    get_my_role() = 'staff'
    AND assigned_staff = auth.uid()
    AND status IN ('Scheduled', 'Missed')
    AND station_ass IS NULL
    AND assigned_station IS NOT DISTINCT FROM get_my_station()
    AND performed_by IS NULL
  );
CREATE POLICY staff_delete_prenatal ON public.prenatal_visits FOR DELETE TO authenticated
  USING (
    get_my_role() = 'staff'
    AND assigned_staff = auth.uid()
    AND status = 'Scheduled'
    AND assigned_station IS NOT DISTINCT FROM get_my_station()
  );
CREATE POLICY patient_prenatal_read ON public.prenatal_visits FOR SELECT TO authenticated
  USING (patient_id = auth.uid());

-- newborns
CREATE POLICY admin_newborns ON public.newborns FOR ALL TO authenticated
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');
CREATE POLICY cho_newborns ON public.newborns FOR ALL TO authenticated
  USING (get_my_role() = 'cho personnel' AND belongs_to_my_station(mother_id))
  WITH CHECK (get_my_role() = 'cho personnel' AND belongs_to_my_station(mother_id));
CREATE POLICY staff_newborns ON public.newborns FOR ALL TO authenticated
  USING (get_my_role() = 'staff' AND newborn_assigned_to_me(id))
  WITH CHECK (get_my_role() = 'staff' AND newborn_assigned_to_me(id));
CREATE POLICY delivery_attending_insert_newborns ON public.newborns FOR INSERT TO authenticated
  WITH CHECK (
    get_my_role() IN ('staff', 'cho personnel')
    AND EXISTS (
      SELECT 1
      FROM public.deliveries d
      JOIN public.staff_profiles attending_profile ON attending_profile.id = auth.uid()
      WHERE d.id = newborns.delivery_id
        AND d.mother_id = newborns.mother_id
        AND d.attending_staff = auth.uid()
        AND d.station_ass = attending_profile.station_ass
    )
  );
CREATE POLICY cho_read_all_newborns ON public.newborns FOR SELECT TO authenticated
  USING (get_my_role() = 'cho personnel');
CREATE POLICY staff_read_all_newborns ON public.newborns FOR SELECT TO authenticated
  USING (get_my_role() = 'staff');
CREATE POLICY patient_newborns_read ON public.newborns FOR SELECT TO authenticated
  USING (mother_id = auth.uid());

-- newborn_growth
CREATE POLICY admin_newborn_growth ON public.newborn_growth FOR ALL TO authenticated
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');
CREATE POLICY cho_newborn_growth ON public.newborn_growth FOR ALL TO authenticated
  USING (get_my_role() = 'cho personnel' AND newborn_in_my_station(newborn_id))
  WITH CHECK (get_my_role() = 'cho personnel' AND newborn_in_my_station(newborn_id));
CREATE POLICY staff_newborn_growth ON public.newborn_growth FOR ALL TO authenticated
  USING (get_my_role() = 'staff' AND newborn_assigned_to_me(newborn_id))
  WITH CHECK (get_my_role() = 'staff' AND newborn_assigned_to_me(newborn_id));
CREATE POLICY cho_read_all_newborn_growth ON public.newborn_growth FOR SELECT TO authenticated
  USING (get_my_role() = 'cho personnel');
CREATE POLICY staff_read_all_newborn_growth ON public.newborn_growth FOR SELECT TO authenticated
  USING (get_my_role() = 'staff');
CREATE POLICY patient_newborn_growth_read ON public.newborn_growth FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.newborns n
    WHERE n.id = newborn_id AND n.mother_id = auth.uid()
  ));

-- inventories
CREATE POLICY admin_vaccine_inv ON public.vaccine_inventory FOR ALL TO authenticated
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');
CREATE POLICY cho_vaccine_inv ON public.vaccine_inventory FOR SELECT TO authenticated
  USING (get_my_role() = 'cho personnel');
CREATE POLICY staff_vaccine_inv ON public.vaccine_inventory FOR SELECT TO authenticated
  USING (get_my_role() = 'staff');
CREATE POLICY admin_supplement_inv ON public.supplement_inventory FOR ALL TO authenticated
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');
CREATE POLICY cho_supplement_inv ON public.supplement_inventory FOR SELECT TO authenticated
  USING (get_my_role() = 'cho personnel');
CREATE POLICY staff_supplement_inv ON public.supplement_inventory FOR SELECT TO authenticated
  USING (get_my_role() = 'staff');

-- vaccinations
CREATE POLICY admin_vaccinations ON public.vaccinations FOR ALL TO authenticated
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');
CREATE POLICY cho_vaccinations ON public.vaccinations FOR ALL TO authenticated
  USING (
    get_my_role() = 'cho personnel'
    AND (belongs_to_my_station(patient_id) OR newborn_in_my_station(newborn_id))
  )
  WITH CHECK (
    get_my_role() = 'cho personnel'
    AND (belongs_to_my_station(patient_id) OR newborn_in_my_station(newborn_id))
    AND (assigned_staff IS NULL OR public.staff_member_belongs_to_station(assigned_staff, get_my_station()))
  );
CREATE POLICY cho_read_all_vaccinations ON public.vaccinations FOR SELECT TO authenticated
  USING (get_my_role() = 'cho personnel');
CREATE POLICY staff_vaccinations ON public.vaccinations FOR ALL TO authenticated
  USING (
    get_my_role() = 'staff'
    AND (belongs_to_my_station(patient_id) OR newborn_in_my_station(newborn_id))
  )
  WITH CHECK (
    get_my_role() = 'staff'
    AND (belongs_to_my_station(patient_id) OR newborn_in_my_station(newborn_id))
    AND (assigned_staff IS NULL OR public.staff_member_belongs_to_station(assigned_staff, get_my_station()))
  );
CREATE POLICY registration_vaccinations ON public.vaccinations FOR INSERT TO authenticated
  WITH CHECK (
    get_my_role() IN ('staff', 'cho personnel')
    AND created_by = auth.uid()
    AND status = 'Pending'
    AND assigned_staff IS NULL
    AND patient_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.patient_basic_info p
      WHERE p.id = patient_id
        AND p.created_by = auth.uid()
        AND p.station_ass IS DISTINCT FROM get_my_station()
    )
  );
CREATE POLICY schedule_vaccinations_for_any_mother ON public.vaccinations FOR INSERT TO authenticated
  WITH CHECK (
    get_my_role() IN ('staff', 'cho personnel')
    AND created_by = auth.uid()
    AND status = 'Pending'
    AND vaccinated_date IS NULL
    AND (
      (patient_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.patient_basic_info p
        WHERE p.id = patient_id
          AND (
            assigned_staff IS NULL
            OR public.staff_member_belongs_to_station(assigned_staff, p.station_ass)
          )
      ))
      OR (newborn_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.newborns n
        JOIN public.patient_basic_info p ON p.id = n.mother_id
        WHERE n.id = newborn_id
          AND (
            assigned_staff IS NULL
            OR public.staff_member_belongs_to_station(assigned_staff, p.station_ass)
          )
      ))
    )
  );
CREATE POLICY staff_read_all_vaccinations ON public.vaccinations FOR SELECT TO authenticated
  USING (get_my_role() = 'staff');
CREATE POLICY patient_vaccinations_read ON public.vaccinations FOR SELECT TO authenticated
  USING (
    patient_id = auth.uid()
    OR (
      newborn_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.newborns n
        WHERE n.id = newborn_id AND n.mother_id = auth.uid()
      )
    )
  );
CREATE POLICY cho_administer_vaccinations ON public.vaccinations FOR INSERT TO authenticated
  WITH CHECK (
    get_my_role() = 'cho personnel'
    AND status = 'Completed'
    AND vaccinated_date IS NOT NULL
    AND station_ass IS NOT DISTINCT FROM get_my_station()
    AND vaccinated_by = auth.uid()
    AND public.staff_member_belongs_to_station(auth.uid(), get_my_station())
    AND (
      (patient_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.patient_basic_info p WHERE p.id = patient_id
      ))
      OR (newborn_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.newborns n WHERE n.id = newborn_id
      ))
    )
    AND (
      assigned_staff IS NULL
      OR EXISTS (
        SELECT 1 FROM public.patient_basic_info p
        WHERE p.id = patient_id
          AND public.staff_member_belongs_to_station(assigned_staff, p.station_ass)
      )
      OR EXISTS (
        SELECT 1 FROM public.newborns n
        JOIN public.patient_basic_info p ON p.id = n.mother_id
        WHERE n.id = newborn_id
          AND public.staff_member_belongs_to_station(assigned_staff, p.station_ass)
      )
    )
  );
CREATE POLICY staff_administer_vaccinations ON public.vaccinations FOR INSERT TO authenticated
  WITH CHECK (
    get_my_role() = 'staff'
    AND status = 'Completed'
    AND vaccinated_date IS NOT NULL
    AND station_ass IS NOT DISTINCT FROM get_my_station()
    AND vaccinated_by = auth.uid()
    AND public.staff_member_belongs_to_station(auth.uid(), get_my_station())
    AND (
      (patient_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.patient_basic_info p WHERE p.id = patient_id
      ))
      OR (newborn_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.newborns n WHERE n.id = newborn_id
      ))
    )
    AND (
      assigned_staff IS NULL
      OR EXISTS (
        SELECT 1 FROM public.patient_basic_info p
        WHERE p.id = patient_id
          AND public.staff_member_belongs_to_station(assigned_staff, p.station_ass)
      )
      OR EXISTS (
        SELECT 1 FROM public.newborns n
        JOIN public.patient_basic_info p ON p.id = n.mother_id
        WHERE n.id = newborn_id
          AND public.staff_member_belongs_to_station(assigned_staff, p.station_ass)
      )
    )
  );
CREATE POLICY cho_update_vaccinations_any_station ON public.vaccinations FOR UPDATE TO authenticated
  USING (
    get_my_role() = 'cho personnel'
    AND status = 'Pending'
    AND (patient_id IS NOT NULL OR newborn_id IS NOT NULL)
  )
  WITH CHECK (
    get_my_role() = 'cho personnel'
    AND status = 'Completed'
    AND station_ass IS NOT DISTINCT FROM get_my_station()
    AND vaccinated_by = auth.uid()
    AND public.staff_member_belongs_to_station(auth.uid(), get_my_station())
    AND (
      assigned_staff IS NULL
      OR EXISTS (
        SELECT 1 FROM public.patient_basic_info p
        WHERE p.id = patient_id
          AND public.staff_member_belongs_to_station(assigned_staff, p.station_ass)
      )
      OR EXISTS (
        SELECT 1 FROM public.newborns n
        JOIN public.patient_basic_info p ON p.id = n.mother_id
        WHERE n.id = newborn_id
          AND public.staff_member_belongs_to_station(assigned_staff, p.station_ass)
      )
    )
  );
CREATE POLICY staff_update_vaccinations_any_station ON public.vaccinations FOR UPDATE TO authenticated
  USING (
    get_my_role() = 'staff'
    AND status = 'Pending'
    AND (patient_id IS NOT NULL OR newborn_id IS NOT NULL)
  )
  WITH CHECK (
    get_my_role() = 'staff'
    AND status = 'Completed'
    AND station_ass IS NOT DISTINCT FROM get_my_station()
    AND vaccinated_by = auth.uid()
    AND public.staff_member_belongs_to_station(auth.uid(), get_my_station())
    AND (
      assigned_staff IS NULL
      OR EXISTS (
        SELECT 1 FROM public.patient_basic_info p
        WHERE p.id = patient_id
          AND public.staff_member_belongs_to_station(assigned_staff, p.station_ass)
      )
      OR EXISTS (
        SELECT 1 FROM public.newborns n
        JOIN public.patient_basic_info p ON p.id = n.mother_id
        WHERE n.id = newborn_id
          AND public.staff_member_belongs_to_station(assigned_staff, p.station_ass)
      )
    )
  );

-- supplements
CREATE POLICY admin_supplements ON public.supplements FOR ALL TO authenticated
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');
CREATE POLICY cho_supplements ON public.supplements FOR ALL TO authenticated
  USING (get_my_role() = 'cho personnel' AND belongs_to_my_station(patient_id))
  WITH CHECK (get_my_role() = 'cho personnel' AND belongs_to_my_station(patient_id));
CREATE POLICY staff_supplements ON public.supplements FOR ALL TO authenticated
  USING (get_my_role() = 'staff' AND patient_assigned_to_me(patient_id))
  WITH CHECK (get_my_role() = 'staff' AND patient_assigned_to_me(patient_id));
CREATE POLICY cho_read_all_supplements ON public.supplements FOR SELECT TO authenticated
  USING (get_my_role() = 'cho personnel');
CREATE POLICY staff_read_all_supplements ON public.supplements FOR SELECT TO authenticated
  USING (get_my_role() = 'staff');
CREATE POLICY patient_supplements_read ON public.supplements FOR SELECT TO authenticated
  USING (patient_id = auth.uid());
CREATE POLICY cho_administer_supplements ON public.supplements FOR INSERT TO authenticated
  WITH CHECK (
    get_my_role() = 'cho personnel'
    AND station_ass IS NOT DISTINCT FROM get_my_station()
    AND created_by = auth.uid()
    AND administered_by = auth.uid()
    AND public.staff_member_belongs_to_station(auth.uid(), get_my_station())
    AND EXISTS (SELECT 1 FROM public.patient_basic_info p WHERE p.id = patient_id)
  );
CREATE POLICY staff_administer_supplements ON public.supplements FOR INSERT TO authenticated
  WITH CHECK (
    get_my_role() = 'staff'
    AND station_ass IS NOT DISTINCT FROM get_my_station()
    AND created_by = auth.uid()
    AND administered_by = auth.uid()
    AND public.staff_member_belongs_to_station(auth.uid(), get_my_station())
    AND EXISTS (SELECT 1 FROM public.patient_basic_info p WHERE p.id = patient_id)
  );

-- stations
CREATE POLICY admin_stations ON public.stations FOR ALL TO authenticated
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');
CREATE POLICY read_stations ON public.stations FOR SELECT TO authenticated
  USING (TRUE);

-- distributions
CREATE POLICY admin_vaccine_dist ON public.vaccine_distribution FOR ALL TO authenticated
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');
CREATE POLICY cho_vaccine_dist ON public.vaccine_distribution FOR SELECT TO authenticated
  USING (get_my_role() = 'cho personnel' AND station_id IS NOT DISTINCT FROM get_my_station());
CREATE POLICY staff_vaccine_dist ON public.vaccine_distribution FOR SELECT TO authenticated
  USING (get_my_role() = 'staff' AND station_id IS NOT DISTINCT FROM get_my_station());
CREATE POLICY admin_supplement_dist ON public.supplement_distribution FOR ALL TO authenticated
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');
CREATE POLICY cho_supplement_dist ON public.supplement_distribution FOR SELECT TO authenticated
  USING (get_my_role() = 'cho personnel' AND station_id IS NOT DISTINCT FROM get_my_station());
CREATE POLICY staff_supplement_dist ON public.supplement_distribution FOR SELECT TO authenticated
  USING (get_my_role() = 'staff' AND station_id IS NOT DISTINCT FROM get_my_station());

-- station inventory
CREATE POLICY admin_station_vaccine_inv ON public.station_vaccine_inventory FOR ALL TO authenticated
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');
CREATE POLICY cho_station_vaccine_inv ON public.station_vaccine_inventory FOR ALL TO authenticated
  USING (get_my_role() = 'cho personnel' AND station_id IS NOT DISTINCT FROM get_my_station())
  WITH CHECK (get_my_role() = 'cho personnel' AND station_id IS NOT DISTINCT FROM get_my_station());
CREATE POLICY staff_station_vaccine_inv ON public.station_vaccine_inventory FOR SELECT TO authenticated
  USING (get_my_role() = 'staff' AND station_id IS NOT DISTINCT FROM get_my_station());
CREATE POLICY staff_update_station_vaccine_inv ON public.station_vaccine_inventory FOR UPDATE TO authenticated
  USING (get_my_role() = 'staff' AND station_id IS NOT DISTINCT FROM get_my_station())
  WITH CHECK (get_my_role() = 'staff' AND station_id IS NOT DISTINCT FROM get_my_station());
CREATE POLICY admin_station_supplement_inv ON public.station_supplement_inventory FOR ALL TO authenticated
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');
CREATE POLICY cho_station_supplement_inv ON public.station_supplement_inventory FOR ALL TO authenticated
  USING (get_my_role() = 'cho personnel' AND station_id IS NOT DISTINCT FROM get_my_station())
  WITH CHECK (get_my_role() = 'cho personnel' AND station_id IS NOT DISTINCT FROM get_my_station());
CREATE POLICY staff_station_supplement_inv ON public.station_supplement_inventory FOR SELECT TO authenticated
  USING (get_my_role() = 'staff' AND station_id IS NOT DISTINCT FROM get_my_station());
CREATE POLICY staff_update_station_supplement_inv ON public.station_supplement_inventory FOR UPDATE TO authenticated
  USING (get_my_role() = 'staff' AND station_id IS NOT DISTINCT FROM get_my_station())
  WITH CHECK (get_my_role() = 'staff' AND station_id IS NOT DISTINCT FROM get_my_station());
