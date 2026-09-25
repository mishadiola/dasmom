-- Dasmom RLS
-- Staff can only read and manage prenatal visits assigned to their own user ID.
-- CHO personnel and admins retain their broader operational access.

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS VARCHAR
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
  SELECT LOWER(TRIM(ut.user_type))
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
  WHERE LOWER(TRIM(user_type)) = LOWER(TRIM(p_role))
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
  ADD COLUMN IF NOT EXISTS assigned_staff UUID;

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
  );
CREATE POLICY staff_read_staff ON public.staff_profiles FOR SELECT TO authenticated
  USING (
    get_my_role() = 'staff'
    AND id = auth.uid()
  );
CREATE POLICY patient_read_assigned_staff ON public.staff_profiles FOR SELECT TO authenticated
  USING (
    get_my_role() IN ('mother', 'patient')
    AND (
      EXISTS (
        SELECT 1 FROM public.prenatal_visits v
        WHERE v.patient_id = auth.uid()
          AND v.assigned_staff = staff_profiles.id
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
      OR EXISTS (
        SELECT 1 FROM public.deliveries d
        WHERE d.mother_id = auth.uid()
          AND d.attending_staff = staff_profiles.id
      )
    )
  );

-- patient_basic_info
CREATE POLICY admin_patients ON public.patient_basic_info FOR ALL TO authenticated
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');
CREATE POLICY cho_patients ON public.patient_basic_info FOR ALL TO authenticated
  USING (
    get_my_role() = 'cho personnel'
    AND station_ass IS NOT DISTINCT FROM get_my_station()
  )
  WITH CHECK (
    get_my_role() = 'cho personnel'
    AND station_ass IS NOT DISTINCT FROM get_my_station()
  );
CREATE POLICY staff_read_assigned_patients ON public.patient_basic_info FOR SELECT TO authenticated
  USING (
    get_my_role() = 'staff'
    AND patient_assigned_to_me(id)
  );
CREATE POLICY staff_insert_patients ON public.patient_basic_info FOR INSERT TO authenticated
  WITH CHECK (
    get_my_role() = 'staff'
    AND station_ass IS NOT DISTINCT FROM get_my_station()
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
CREATE POLICY admin_deliveries ON public.deliveries FOR ALL TO authenticated
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');
CREATE POLICY cho_deliveries ON public.deliveries FOR ALL TO authenticated
  USING (get_my_role() = 'cho personnel' AND belongs_to_my_station(mother_id))
  WITH CHECK (get_my_role() = 'cho personnel' AND belongs_to_my_station(mother_id));
CREATE POLICY staff_deliveries ON public.deliveries FOR ALL TO authenticated
  USING (get_my_role() = 'staff' AND patient_assigned_to_me(mother_id))
  WITH CHECK (get_my_role() = 'staff' AND patient_assigned_to_me(mother_id));
CREATE POLICY patient_deliveries_read ON public.deliveries FOR SELECT TO authenticated
  USING (mother_id = auth.uid());

-- pregnancy_info
CREATE POLICY admin_pregnancy ON public.pregnancy_info FOR ALL TO authenticated
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');
CREATE POLICY cho_pregnancy ON public.pregnancy_info FOR ALL TO authenticated
  USING (get_my_role() = 'cho personnel' AND belongs_to_my_station(patient_id))
  WITH CHECK (get_my_role() = 'cho personnel' AND belongs_to_my_station(patient_id));
CREATE POLICY staff_read_pregnancy ON public.pregnancy_info FOR SELECT TO authenticated
  USING (get_my_role() = 'staff' AND patient_assigned_to_me(patient_id))
;
-- Registration inserts pregnancy_info before the first assigned prenatal visit exists.
CREATE POLICY staff_insert_pregnancy ON public.pregnancy_info FOR INSERT TO authenticated
  WITH CHECK (
    get_my_role() = 'staff'
    AND belongs_to_my_station(patient_id)
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
CREATE POLICY cho_prenatal ON public.prenatal_visits FOR ALL TO authenticated
  USING (get_my_role() = 'cho personnel' AND belongs_to_my_station(patient_id))
  WITH CHECK (get_my_role() = 'cho personnel' AND belongs_to_my_station(patient_id));
-- Staff can only see, update, or create their own assigned schedules.
CREATE POLICY staff_prenatal ON public.prenatal_visits FOR ALL TO authenticated
  USING (get_my_role() = 'staff' AND assigned_staff = auth.uid())
  WITH CHECK (get_my_role() = 'staff' AND assigned_staff = auth.uid());
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
  );
CREATE POLICY staff_vaccinations ON public.vaccinations FOR ALL TO authenticated
  USING (
    get_my_role() = 'staff'
    AND assigned_staff = auth.uid()
  )
  WITH CHECK (
    get_my_role() = 'staff'
    AND assigned_staff = auth.uid()
  );
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
CREATE POLICY patient_supplements_read ON public.supplements FOR SELECT TO authenticated
  USING (patient_id = auth.uid());

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
CREATE POLICY admin_station_supplement_inv ON public.station_supplement_inventory FOR ALL TO authenticated
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');
CREATE POLICY cho_station_supplement_inv ON public.station_supplement_inventory FOR ALL TO authenticated
  USING (get_my_role() = 'cho personnel' AND station_id IS NOT DISTINCT FROM get_my_station())
  WITH CHECK (get_my_role() = 'cho personnel' AND station_id IS NOT DISTINCT FROM get_my_station());
CREATE POLICY staff_station_supplement_inv ON public.station_supplement_inventory FOR SELECT TO authenticated
  USING (get_my_role() = 'staff' AND station_id IS NOT DISTINCT FROM get_my_station());
