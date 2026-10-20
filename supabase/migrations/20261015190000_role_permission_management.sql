CREATE TABLE IF NOT EXISTS public.role_permission_catalog (
  permission_key TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT NOT NULL,
  display_order INTEGER NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES public.user_type(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL REFERENCES public.role_permission_catalog(permission_key) ON DELETE RESTRICT,
  is_allowed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (role_id, permission_key)
);

CREATE INDEX IF NOT EXISTS role_permissions_role_id_idx
  ON public.role_permissions (role_id);

CREATE TABLE IF NOT EXISTS public.role_permission_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  role_id UUID REFERENCES public.user_type(id) ON DELETE SET NULL,
  permission_key TEXT NOT NULL,
  previous_value BOOLEAN,
  new_value BOOLEAN NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS role_permission_audit_changed_at_idx
  ON public.role_permission_audit (changed_at DESC);

INSERT INTO public.role_permission_catalog
  (permission_key, category, label, description, display_order)
VALUES
  ('patient.view.own_station', 'Patient Management', 'View patients at own station', 'View patient records assigned to the logged-in staff member''s or CHO personnel''s station.', 1),
  ('patient.view.other_station', 'Patient Management', 'View patients at other stations', 'View patient records assigned to a different station.', 2),
  ('patient.see.other_station', 'Patient Management', 'See patients from other stations', 'Allow cross-station patient visibility in addition to the cross-station view permission.', 3),
  ('patient.register.own_station', 'Patient Management', 'Register patients at own station', 'Register patients assigned to the logged-in user''s station.', 4),
  ('patient.register.other_station', 'Patient Management', 'Register patients at other stations', 'Register patients assigned to a different station.', 5),
  ('patient.register.assign_other_station', 'Patient Management', 'Assign a new patient to another station', 'Assign a newly registered patient to a station other than the logged-in user''s station.', 6),
  ('patient.edit.own_station', 'Patient Management', 'Edit patients at own station', 'Edit patient records assigned to the logged-in user''s station.', 7),
  ('patient.edit.other_station', 'Patient Management', 'Edit patients at other stations', 'Edit patient records assigned to a different station.', 8),
  ('patient.archive.own_station', 'Patient Management', 'Archive patients at own station', 'Archive or restore patients assigned to the logged-in user''s station.', 9),
  ('patient.archive.other_station', 'Patient Management', 'Archive patients at other stations', 'Archive or restore patients assigned to a different station.', 10),
  ('patient.deactivate.own_station', 'Patient Management', 'Deactivate patients at own station', 'Deactivate or reactivate patient accounts assigned to the logged-in user''s station.', 11),
  ('patient.deactivate.other_station', 'Patient Management', 'Deactivate patients at other stations', 'Deactivate or reactivate patient accounts assigned to a different station.', 12),
  ('patient.reschedule.own_station', 'Patient Visits and Scheduling', 'Reschedule patients at own station', 'Reschedule prenatal, postpartum, and vaccination visits for patients assigned to the logged-in user''s station.', 13),
  ('patient.reschedule.other_station', 'Patient Visits and Scheduling', 'Reschedule patients at other stations', 'Reschedule visits for patients assigned to a different station.', 14),
  ('prenatal.schedule.view.own_station', 'Patient Visits and Scheduling', 'View prenatal schedules at own station', 'View prenatal visit schedules for patients assigned to the logged-in user''s station.', 15),
  ('prenatal.schedule.view.other_station', 'Patient Visits and Scheduling', 'View prenatal schedules at other stations', 'View prenatal visit schedules for patients assigned to a different station.', 16),
  ('prenatal.record.own_station', 'Prenatal Visits', 'Record prenatal visits at own station', 'Create or update prenatal visit records for patients assigned to the logged-in user''s station.', 17),
  ('prenatal.record.other_station', 'Prenatal Visits', 'Record prenatal visits at other stations', 'Create or update prenatal visit records for patients assigned to a different station.', 18),
  ('prenatal.record.other_station_at_own_station', 'Prenatal Visits', 'Record an own-station visit for another station''s patient', 'Record prenatal care at the logged-in user''s station without transferring the patient from their assigned station.', 19),
  ('postpartum.record.own_station', 'Postpartum Visits', 'Record postpartum visits at own station', 'Record postpartum visits for patients assigned to the logged-in user''s station.', 20),
  ('postpartum.record.other_station', 'Postpartum Visits', 'Record postpartum visits at other stations', 'Record postpartum visits for patients assigned to a different station.', 21),
  ('postpartum.schedule.view.own_station', 'Postpartum Visits', 'View postpartum schedules at own station', 'View postpartum schedules for patients assigned to the logged-in user''s station.', 22),
  ('postpartum.schedule.view.other_station', 'Postpartum Visits', 'View postpartum schedules at other stations', 'View postpartum schedules for patients assigned to a different station.', 23),
  ('vaccine.schedule.create.own_station', 'Vaccination', 'Schedule vaccines at own station', 'Create vaccination schedules for patients assigned to the logged-in user''s station.', 24),
  ('vaccine.schedule.create.other_station', 'Vaccination', 'Schedule vaccines at other stations', 'Create vaccination schedules for patients assigned to a different station.', 25),
  ('vaccine.schedule.view.own_station', 'Vaccination', 'View vaccination schedules at own station', 'View mother and newborn vaccination schedules for patients assigned to the logged-in user''s station.', 26),
  ('vaccine.schedule.view.other_station', 'Vaccination', 'View vaccination schedules at other stations', 'View mother and newborn vaccination schedules for patients assigned to a different station.', 27),
  ('vaccine.administer.own_station', 'Vaccination', 'Administer vaccines at own station', 'Record vaccine administration for patients assigned to the logged-in user''s station.', 28),
  ('vaccine.administer.other_station', 'Vaccination', 'Administer vaccines at other stations', 'Record vaccine administration for patients assigned to a different station.', 29),
  ('staff.view.own_station', 'Staff and CHO Personnel Management', 'View staff at own station', 'View staff and CHO personnel assigned to the logged-in user''s station.', 30),
  ('staff.view.other_station', 'Staff and CHO Personnel Management', 'View staff at other stations', 'View staff and CHO personnel assigned to a different station.', 31),
  ('staff.register.own_station', 'Staff and CHO Personnel Management', 'Register staff at own station', 'Register staff or CHO personnel assigned to the logged-in user''s station.', 32),
  ('staff.register.other_station', 'Staff and CHO Personnel Management', 'Register staff at other stations', 'Register staff or CHO personnel assigned to a different station.', 33),
  ('staff.password.change.own_station', 'Staff and CHO Personnel Management', 'Change passwords at own station', 'Change passwords for staff and CHO personnel assigned to the logged-in user''s station through Supabase Auth.', 34),
  ('staff.password.change.other_station', 'Staff and CHO Personnel Management', 'Change passwords at other stations', 'Change passwords for staff and CHO personnel assigned to a different station through Supabase Auth.', 35),
  ('staff.station.change.other_station', 'Staff and CHO Personnel Management', 'Change staff station assignment', 'Change a staff member''s assigned station to a different station.', 36),
  ('inventory.main.view', 'Inventory Management', 'View main inventory', 'View central vaccine and supplement stock, not just item details referenced by station stock.', 37),
  ('inventory.main.stock.add', 'Inventory Management', 'Add stock to main inventory', 'Add or update stock in the central inventory.', 38),
  ('inventory.main.distribute.to_stations', 'Inventory Management', 'Distribute main inventory to stations', 'Distribute stock from central inventory to station inventory.', 39),
  ('inventory.station.view.own_station', 'Inventory Management', 'View inventory at own station', 'View vaccine and supplement stock assigned to the logged-in user''s station.', 40),
  ('inventory.station.view.other_station', 'Inventory Management', 'View inventory at other stations', 'View vaccine and supplement stock assigned to a different station.', 41),
  ('supplement.distribute.patient.own_station', 'Inventory Management', 'Distribute supplements to own-station patients', 'Record supplement distributions for patients assigned to the logged-in user''s station.', 42),
  ('supplement.distribute.patient.other_station', 'Inventory Management', 'Distribute supplements to other-station patients', 'Record supplement distributions for patients assigned to a different station.', 43),
  ('newborn.view.own_station', 'Newborn and Delivery Records', 'View newborn records at own station', 'View newborn records whose mother is assigned to the logged-in user''s station.', 44),
  ('newborn.view.other_station', 'Newborn and Delivery Records', 'View newborn records at other stations', 'View newborn records whose mother is assigned to a different station.', 45),
  ('delivery.add.own_station', 'Newborn and Delivery Records', 'Add delivery records at own station', 'Add delivery records for patients assigned to the logged-in user''s station.', 46),
  ('delivery.view.own_station', 'Newborn and Delivery Records', 'View delivery records at own station', 'View delivery records for patients assigned to the logged-in user''s station.', 47),
  ('delivery.view.other_station', 'Newborn and Delivery Records', 'View delivery records at other stations', 'View delivery records for patients assigned to a different station.', 48),
  ('inventory.station.stock.adjust.own_station', 'Inventory Management', 'Adjust inventory at own station', 'Add, update, or remove station inventory records at the logged-in user''s station.', 49),
  ('inventory.station.stock.adjust.other_station', 'Inventory Management', 'Adjust inventory at other stations', 'Add, update, or remove station inventory records at a different station.', 50)
ON CONFLICT (permission_key) DO UPDATE SET
  category = EXCLUDED.category,
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order;

CREATE OR REPLACE FUNCTION public.has_permission(p_permission_key TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
SET row_security = off
AS $$
  SELECT auth.uid() IS NOT NULL
    AND (
      public.get_my_role() = 'admin'
      OR EXISTS (
        SELECT 1
        FROM public.users AS u
        JOIN public.user_type AS ut ON ut.id = u.usertype
        JOIN public.role_permissions AS rp ON rp.role_id = ut.id
        WHERE u.id = auth.uid()
          AND LOWER(REPLACE(TRIM(ut.user_type), '_', ' ')) =
              LOWER(REPLACE(TRIM(public.get_my_role()), '_', ' '))
          AND rp.permission_key = p_permission_key
          AND rp.is_allowed
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.has_station_permission(
  p_own_station_permission TEXT,
  p_other_station_permission TEXT,
  p_record_station_id UUID
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
SET row_security = off
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN FALSE
    WHEN p_record_station_id IS NULL THEN public.has_permission(p_other_station_permission)
    WHEN p_record_station_id IS NOT DISTINCT FROM public.get_my_station()
      THEN public.has_permission(p_own_station_permission)
    ELSE public.has_permission(p_other_station_permission)
  END;
$$;

CREATE OR REPLACE FUNCTION public.get_patient_station(p_patient_id UUID)
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
SET row_security = off
AS $$
  SELECT p.station_ass
  FROM public.patient_basic_info AS p
  WHERE p.id = p_patient_id;
$$;

CREATE OR REPLACE FUNCTION public.has_patient_station_permission(
  p_patient_id UUID,
  p_own_station_permission TEXT,
  p_other_station_permission TEXT
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
SET row_security = off
AS $$
  SELECT public.has_station_permission(
    p_own_station_permission,
    p_other_station_permission,
    public.get_patient_station(p_patient_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.patient_is_at_own_station(p_patient_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
SET row_security = off
AS $$
  SELECT public.get_patient_station(p_patient_id) IS NOT NULL
    AND public.get_patient_station(p_patient_id) IS NOT DISTINCT FROM public.get_my_station();
$$;

CREATE OR REPLACE FUNCTION public.get_my_permissions()
RETURNS TABLE(permission_key TEXT, is_allowed BOOLEAN)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
SET row_security = off
AS $$
  SELECT rp.permission_key, rp.is_allowed
  FROM public.users AS u
  JOIN public.user_type AS ut ON ut.id = u.usertype
  JOIN public.role_permissions AS rp ON rp.role_id = ut.id
  WHERE auth.uid() IS NOT NULL
    AND u.id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.has_permission(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_station_permission(TEXT, TEXT, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_patient_station(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_patient_station_permission(UUID, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.patient_is_at_own_station(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_permissions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_permission(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_station_permission(TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_patient_station_permission(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.patient_is_at_own_station(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_permissions() TO authenticated;

CREATE OR REPLACE FUNCTION public.set_role_permission_metadata()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_role_permission_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
SET row_security = off
AS $$
BEGIN
  INSERT INTO public.role_permission_audit
    (actor_id, role_id, permission_key, previous_value, new_value)
  VALUES
    (auth.uid(), NEW.role_id, NEW.permission_key,
      CASE WHEN TG_OP = 'UPDATE' THEN OLD.is_allowed ELSE NULL END,
      NEW.is_allowed);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_admin_role_permissions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
SET row_security = off
AS $$
BEGIN
  IF NOT NEW.is_allowed AND EXISTS (
    SELECT 1
    FROM public.user_type AS ut
    WHERE ut.id = NEW.role_id
      AND LOWER(REPLACE(TRIM(ut.user_type), '_', ' ')) = 'admin'
  ) THEN
    RAISE EXCEPTION 'Administrator permissions are always enabled';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS role_permissions_set_metadata ON public.role_permissions;
CREATE TRIGGER role_permissions_set_metadata
  BEFORE INSERT OR UPDATE ON public.role_permissions
  FOR EACH ROW EXECUTE FUNCTION public.set_role_permission_metadata();

DROP TRIGGER IF EXISTS role_permissions_guard_admin ON public.role_permissions;
CREATE TRIGGER role_permissions_guard_admin
  BEFORE INSERT OR UPDATE ON public.role_permissions
  FOR EACH ROW EXECUTE FUNCTION public.guard_admin_role_permissions();

DROP TRIGGER IF EXISTS role_permissions_audit_change ON public.role_permissions;
CREATE TRIGGER role_permissions_audit_change
  AFTER INSERT OR UPDATE ON public.role_permissions
  FOR EACH ROW EXECUTE FUNCTION public.audit_role_permission_change();

WITH permission_defaults(permission_key, staff_allowed, cho_allowed, patient_allowed) AS (
  VALUES
    ('patient.view.own_station', TRUE, TRUE, TRUE),
    ('patient.view.other_station', TRUE, TRUE, FALSE),
    ('patient.see.other_station', TRUE, TRUE, FALSE),
    ('patient.register.own_station', TRUE, TRUE, FALSE),
    ('patient.register.other_station', FALSE, FALSE, FALSE),
    ('patient.register.assign_other_station', FALSE, FALSE, FALSE),
    ('patient.edit.own_station', TRUE, TRUE, FALSE),
    ('patient.edit.other_station', FALSE, FALSE, FALSE),
    ('patient.archive.own_station', FALSE, FALSE, FALSE),
    ('patient.archive.other_station', FALSE, FALSE, FALSE),
    ('patient.deactivate.own_station', FALSE, FALSE, FALSE),
    ('patient.deactivate.other_station', FALSE, FALSE, FALSE),
    ('patient.reschedule.own_station', TRUE, TRUE, FALSE),
    ('patient.reschedule.other_station', FALSE, FALSE, FALSE),
    ('prenatal.schedule.view.own_station', TRUE, TRUE, TRUE),
    ('prenatal.schedule.view.other_station', TRUE, TRUE, FALSE),
    ('prenatal.record.own_station', TRUE, TRUE, FALSE),
    ('prenatal.record.other_station', FALSE, FALSE, FALSE),
    ('prenatal.record.other_station_at_own_station', TRUE, TRUE, FALSE),
    ('postpartum.record.own_station', TRUE, TRUE, FALSE),
    ('postpartum.record.other_station', TRUE, TRUE, FALSE),
    ('postpartum.schedule.view.own_station', TRUE, TRUE, TRUE),
    ('postpartum.schedule.view.other_station', TRUE, TRUE, FALSE),
    ('vaccine.schedule.create.own_station', TRUE, TRUE, FALSE),
    ('vaccine.schedule.create.other_station', TRUE, TRUE, FALSE),
    ('vaccine.schedule.view.own_station', TRUE, TRUE, TRUE),
    ('vaccine.schedule.view.other_station', TRUE, TRUE, FALSE),
    ('vaccine.administer.own_station', TRUE, TRUE, FALSE),
    ('vaccine.administer.other_station', TRUE, TRUE, FALSE),
    ('staff.view.own_station', TRUE, TRUE, FALSE),
    ('staff.view.other_station', FALSE, FALSE, FALSE),
    ('staff.register.own_station', TRUE, TRUE, FALSE),
    ('staff.register.other_station', FALSE, FALSE, FALSE),
    ('staff.password.change.own_station', FALSE, FALSE, FALSE),
    ('staff.password.change.other_station', FALSE, FALSE, FALSE),
    ('staff.station.change.other_station', FALSE, FALSE, FALSE),
    ('inventory.main.view', FALSE, FALSE, FALSE),
    ('inventory.main.stock.add', FALSE, FALSE, FALSE),
    ('inventory.main.distribute.to_stations', FALSE, FALSE, FALSE),
    ('inventory.station.view.own_station', TRUE, TRUE, FALSE),
    ('inventory.station.view.other_station', FALSE, FALSE, FALSE),
    ('supplement.distribute.patient.own_station', TRUE, TRUE, FALSE),
    ('supplement.distribute.patient.other_station', FALSE, FALSE, FALSE),
    ('newborn.view.own_station', TRUE, TRUE, FALSE),
    ('newborn.view.other_station', TRUE, TRUE, FALSE),
    ('delivery.add.own_station', TRUE, TRUE, FALSE),
    ('delivery.view.own_station', TRUE, TRUE, TRUE),
    ('delivery.view.other_station', TRUE, TRUE, FALSE),
    ('inventory.station.stock.adjust.own_station', FALSE, FALSE, FALSE),
    ('inventory.station.stock.adjust.other_station', FALSE, FALSE, FALSE)
)
INSERT INTO public.role_permissions (role_id, permission_key, is_allowed)
SELECT ut.id,
       catalog.permission_key,
       CASE
         WHEN LOWER(REPLACE(TRIM(ut.user_type), '_', ' ')) = 'admin' THEN TRUE
         WHEN LOWER(REPLACE(TRIM(ut.user_type), '_', ' ')) IN ('staff', 'station staff')
           THEN defaults.staff_allowed
         WHEN LOWER(REPLACE(TRIM(ut.user_type), '_', ' ')) = 'cho personnel'
           THEN defaults.cho_allowed
         WHEN LOWER(REPLACE(TRIM(ut.user_type), '_', ' ')) IN ('patient', 'mother')
           THEN defaults.patient_allowed
         ELSE FALSE
       END
FROM public.user_type AS ut
CROSS JOIN public.role_permission_catalog AS catalog
JOIN permission_defaults AS defaults USING (permission_key)
ON CONFLICT (role_id, permission_key) DO NOTHING;

ALTER TABLE public.role_permission_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permission_audit ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.role_permission_catalog TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.role_permissions TO authenticated;
GRANT SELECT ON public.role_permission_audit TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.role_permission_catalog FROM anon, authenticated;
REVOKE DELETE ON public.role_permissions FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.role_permission_audit FROM anon, authenticated;

DROP POLICY IF EXISTS admin_read_permission_catalog ON public.role_permission_catalog;
CREATE POLICY admin_read_permission_catalog
  ON public.role_permission_catalog FOR SELECT TO authenticated
  USING (public.get_my_role() = 'admin');

DROP POLICY IF EXISTS admin_read_role_permissions ON public.role_permissions;
CREATE POLICY admin_read_role_permissions
  ON public.role_permissions FOR SELECT TO authenticated
  USING (public.get_my_role() = 'admin');

DROP POLICY IF EXISTS admin_insert_role_permissions ON public.role_permissions;
CREATE POLICY admin_insert_role_permissions
  ON public.role_permissions FOR INSERT TO authenticated
  WITH CHECK (public.get_my_role() = 'admin');

DROP POLICY IF EXISTS admin_update_role_permissions ON public.role_permissions;
CREATE POLICY admin_update_role_permissions
  ON public.role_permissions FOR UPDATE TO authenticated
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

DROP POLICY IF EXISTS admin_read_role_permission_audit ON public.role_permission_audit;
CREATE POLICY admin_read_role_permission_audit
  ON public.role_permission_audit FOR SELECT TO authenticated
  USING (public.get_my_role() = 'admin');

CREATE OR REPLACE FUNCTION public.guard_user_security_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
SET row_security = off
AS $$
DECLARE
  v_patient_station UUID;
  v_staff_station UUID;
  v_trusted_server BOOLEAN := COALESCE(auth.role(), '') = 'service_role';
BEGIN
  IF v_trusted_server THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.password IS NOT NULL THEN
      RAISE EXCEPTION 'Passwords must be managed through Supabase Auth';
    END IF;
    IF NEW.usertype IS NOT NULL
      AND NEW.id IS DISTINCT FROM auth.uid()
      AND public.get_my_role() IS DISTINCT FROM 'admin' THEN
      RAISE EXCEPTION 'Only administrators may assign a user type';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.password IS DISTINCT FROM OLD.password AND NEW.password IS NOT NULL THEN
    RAISE EXCEPTION 'Passwords must be managed through Supabase Auth';
  END IF;

  IF NEW.usertype IS DISTINCT FROM OLD.usertype
    AND public.get_my_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Only administrators may change a user type';
  END IF;

  IF NEW.is_archived IS DISTINCT FROM OLD.is_archived THEN
    SELECT station_ass INTO v_patient_station
    FROM public.patient_basic_info WHERE id = NEW.id;
    IF FOUND THEN
      IF NOT public.has_station_permission(
        'patient.archive.own_station',
        'patient.archive.other_station',
        v_patient_station
      ) THEN
        RAISE EXCEPTION 'Not authorized to archive this patient';
      END IF;
    ELSIF public.get_my_role() IS DISTINCT FROM 'admin' THEN
      RAISE EXCEPTION 'Only administrators may archive staff accounts';
    END IF;
  END IF;

  IF NEW.is_deactivated IS DISTINCT FROM OLD.is_deactivated THEN
    SELECT station_ass INTO v_patient_station
    FROM public.patient_basic_info WHERE id = NEW.id;
    IF FOUND THEN
      IF NOT public.has_station_permission(
        'patient.deactivate.own_station',
        'patient.deactivate.other_station',
        v_patient_station
      ) THEN
        RAISE EXCEPTION 'Not authorized to deactivate this patient';
      END IF;
    ELSIF public.get_my_role() IS DISTINCT FROM 'admin' THEN
      RAISE EXCEPTION 'Only administrators may deactivate staff accounts';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_guard_security_fields ON public.users;
CREATE TRIGGER users_guard_security_fields
  BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.guard_user_security_fields();

UPDATE public.users
SET password = NULL
WHERE password IS NOT NULL;

CREATE OR REPLACE FUNCTION public.guard_staff_station_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
SET row_security = off
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF COALESCE(auth.role(), '') = 'service_role' THEN
      RETURN NEW;
    END IF;
    IF NOT public.has_station_permission(
      'staff.register.own_station',
      'staff.register.other_station',
      NEW.station_ass
    ) THEN
      RAISE EXCEPTION 'Not authorized to register staff at this station';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.station_ass IS DISTINCT FROM OLD.station_ass
    AND NEW.station_ass IS DISTINCT FROM public.get_my_station()
    AND NOT public.has_permission('staff.station.change.other_station') THEN
    RAISE EXCEPTION 'Not authorized to change this staff member''s station';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS staff_profiles_guard_station ON public.staff_profiles;
CREATE TRIGGER staff_profiles_guard_station
  BEFORE INSERT OR UPDATE OF station_ass ON public.staff_profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_staff_station_change();

CREATE OR REPLACE FUNCTION public.guard_visit_reschedule()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
SET row_security = off
AS $$
DECLARE
  v_patient_id UUID := NULLIF(to_jsonb(NEW)->>'patient_id', '')::UUID;
  v_patient_station UUID;
BEGIN
  IF v_patient_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'prenatal_visits'
    AND (
      NEW.visit_date IS DISTINCT FROM OLD.visit_date
      OR (OLD.status = 'Scheduled' AND NEW.status = 'Cancelled')
    ) THEN
    v_patient_station := public.get_patient_station(v_patient_id);
  ELSIF TG_TABLE_NAME = 'postpartum_visits'
    AND (
      NEW.scheduled_date IS DISTINCT FROM OLD.scheduled_date
      OR NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at
      OR (OLD.status = 'Scheduled' AND NEW.status = 'Cancelled')
    ) THEN
    v_patient_station := public.get_patient_station(v_patient_id);
  ELSIF TG_TABLE_NAME = 'vaccinations'
    AND (
      NEW.scheduled_vaccination IS DISTINCT FROM OLD.scheduled_vaccination
      OR (OLD.status = 'Pending' AND NEW.status = 'Cancelled')
    ) THEN
    IF NEW.patient_id IS NOT NULL THEN
      v_patient_station := public.get_patient_station(NEW.patient_id);
    ELSE
      SELECT public.get_patient_station(n.mother_id)
      INTO v_patient_station
      FROM public.newborns AS n
      WHERE n.id = NEW.newborn_id;
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  IF NOT public.has_station_permission(
    'patient.reschedule.own_station',
    'patient.reschedule.other_station',
    v_patient_station
  ) THEN
    RAISE EXCEPTION 'Not authorized to reschedule this visit';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prenatal_visits_guard_reschedule ON public.prenatal_visits;
CREATE TRIGGER prenatal_visits_guard_reschedule
  BEFORE UPDATE OF visit_date, status ON public.prenatal_visits
  FOR EACH ROW EXECUTE FUNCTION public.guard_visit_reschedule();

DROP TRIGGER IF EXISTS postpartum_visits_guard_reschedule ON public.postpartum_visits;
CREATE TRIGGER postpartum_visits_guard_reschedule
  BEFORE UPDATE OF scheduled_date, scheduled_at, status ON public.postpartum_visits
  FOR EACH ROW EXECUTE FUNCTION public.guard_visit_reschedule();

DROP TRIGGER IF EXISTS vaccinations_guard_reschedule ON public.vaccinations;
CREATE TRIGGER vaccinations_guard_reschedule
  BEFORE UPDATE OF scheduled_vaccination, status ON public.vaccinations
  FOR EACH ROW EXECUTE FUNCTION public.guard_visit_reschedule();

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

  IF v_requires_permission THEN
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

DROP TRIGGER IF EXISTS vaccinations_guard_administration ON public.vaccinations;
CREATE TRIGGER vaccinations_guard_administration
  BEFORE INSERT OR UPDATE OF status, vaccinated_date ON public.vaccinations
  FOR EACH ROW EXECUTE FUNCTION public.guard_vaccine_administration();

CREATE OR REPLACE FUNCTION public.get_station_inventory_catalog(p_station_id UUID DEFAULT NULL)
RETURNS TABLE(
  item_type TEXT,
  item_id UUID,
  item_name TEXT,
  unit TEXT,
  brand TEXT,
  expiration_date DATE,
  batch_number TEXT,
  manufactured_date DATE,
  max_quantity NUMERIC,
  doses TEXT,
  station_id UUID,
  station_name TEXT,
  quantity BIGINT,
  batch INTEGER,
  updated_at DATE
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
SET row_security = off
AS $$
DECLARE
  v_station_id UUID := COALESCE(p_station_id, public.get_my_station());
  v_role TEXT := public.get_my_role();
BEGIN
  IF auth.uid() IS NULL OR v_station_id IS NULL THEN
    RAISE EXCEPTION 'An authenticated user and station are required';
  END IF;
  IF COALESCE(v_role, '') <> 'admin' AND NOT public.has_station_permission(
    'inventory.station.view.own_station',
    'inventory.station.view.other_station',
    v_station_id
  ) THEN
    RAISE EXCEPTION 'Not authorized to view inventory at this station';
  END IF;

  RETURN QUERY
  SELECT
    'Vaccine'::TEXT,
    vi.id,
    vi.vaccine_name::TEXT,
    vi.unit::TEXT,
    vi.brand::TEXT,
    vi.expiration_date,
    NULL::TEXT,
    vi.manufactured_date,
    vi.max_quantity::NUMERIC,
    vi.doses::TEXT,
    svi.station_id,
    st.station_name::TEXT,
    svi.quantity::BIGINT,
    svi.batch::INTEGER,
    svi.updated_at
  FROM public.station_vaccine_inventory AS svi
  JOIN public.vaccine_inventory AS vi ON vi.id = svi.vaccine_id
  LEFT JOIN public.stations AS st ON st.id = svi.station_id
  WHERE svi.station_id = v_station_id

  UNION ALL

  SELECT
    'Supplement'::TEXT,
    si.id,
    si.supplement_name::TEXT,
    si.unit::TEXT,
    si.brand::TEXT,
    si.expiration_date,
    si.batch_number::TEXT,
    si.manufactured_date,
    si.max_quant::NUMERIC,
    NULL::TEXT,
    ssi.station_id,
    st.station_name::TEXT,
    ssi.quantity::BIGINT,
    ssi.batch::INTEGER,
    ssi.updated_at
  FROM public.station_supplement_inventory AS ssi
  JOIN public.supplement_inventory AS si ON si.id = ssi.supplement_inventory_id
  LEFT JOIN public.stations AS st ON st.id = ssi.station_id
  WHERE ssi.station_id = v_station_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_station_inventory_catalog(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_station_inventory_catalog(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_patient_data_read(p_patient_id UUID, p_own_permission TEXT, p_other_permission TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
SET row_security = off
AS $$
  SELECT
    (p_patient_id = auth.uid() AND public.has_permission(p_own_permission))
    OR (
      public.has_patient_station_permission(
        p_patient_id,
        p_own_permission,
        p_other_permission
      )
      AND (
        public.patient_is_at_own_station(p_patient_id)
        OR public.has_permission('patient.see.other_station')
      )
    );
$$;

REVOKE ALL ON FUNCTION public.guard_patient_data_read(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.guard_patient_data_read(UUID, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_patient_email(p_patient_id UUID)
RETURNS TABLE(email_address TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
SET row_security = off
AS $$
BEGIN
  IF auth.uid() IS NULL
    OR COALESCE(public.get_my_role(), '') NOT IN ('admin', 'staff', 'cho personnel')
    OR NOT public.guard_patient_data_read(
      p_patient_id,
      'patient.view.own_station',
      'patient.view.other_station'
    ) THEN
    RAISE EXCEPTION 'Not authorized to view patient email';
  END IF;

  RETURN QUERY
  SELECT u.email_address::TEXT
  FROM public.users AS u
  JOIN public.patient_basic_info AS p ON p.id = u.id
  WHERE p.id = p_patient_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Patient not found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.get_patient_email(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_patient_email(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_patient_account_status(
  p_patient_id UUID,
  p_is_archived BOOLEAN DEFAULT NULL,
  p_is_deactivated BOOLEAN DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
SET row_security = off
AS $$
DECLARE
  v_station_id UUID;
  v_is_patient BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'An authenticated caller is required';
  END IF;

  SELECT p.station_ass, LOWER(REPLACE(TRIM(ut.user_type), '_', ' ')) IN ('patient', 'mother')
  INTO v_station_id, v_is_patient
  FROM public.patient_basic_info AS p
  JOIN public.users AS u ON u.id = p.id
  JOIN public.user_type AS ut ON ut.id = u.usertype
  WHERE p.id = p_patient_id;

  IF NOT FOUND OR NOT v_is_patient THEN
    RAISE EXCEPTION 'Patient account not found';
  END IF;

  IF p_is_archived IS NOT NULL
    AND NOT public.has_station_permission(
      'patient.archive.own_station',
      'patient.archive.other_station',
      v_station_id
    ) THEN
    RAISE EXCEPTION 'Not authorized to archive this patient';
  END IF;

  IF p_is_deactivated IS NOT NULL
    AND NOT public.has_station_permission(
      'patient.deactivate.own_station',
      'patient.deactivate.other_station',
      v_station_id
    ) THEN
    RAISE EXCEPTION 'Not authorized to deactivate this patient';
  END IF;

  UPDATE public.users
  SET is_archived = COALESCE(p_is_archived, is_archived),
      is_deactivated = COALESCE(p_is_deactivated, is_deactivated)
  WHERE id = p_patient_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_patient_account_status(UUID, BOOLEAN, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_patient_account_status(UUID, BOOLEAN, BOOLEAN) TO authenticated;

DROP POLICY IF EXISTS role_permission_patient_select ON public.patient_basic_info;
CREATE POLICY role_permission_patient_select
  ON public.patient_basic_info AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    public.guard_patient_data_read(id, 'patient.view.own_station', 'patient.view.other_station')
    AND (
      station_ass IS NOT DISTINCT FROM public.get_my_station()
      OR public.has_permission('patient.see.other_station')
    )
  );

DROP POLICY IF EXISTS role_permission_patient_insert ON public.patient_basic_info;
CREATE POLICY role_permission_patient_insert
  ON public.patient_basic_info AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND public.has_station_permission(
      'patient.register.own_station',
      'patient.register.other_station',
      station_ass
    )
    AND (
      station_ass IS NOT DISTINCT FROM public.get_my_station()
      OR public.has_permission('patient.register.assign_other_station')
    )
  );

DROP POLICY IF EXISTS role_permission_patient_update ON public.patient_basic_info;
CREATE POLICY role_permission_patient_update
  ON public.patient_basic_info AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.has_station_permission('patient.edit.own_station', 'patient.edit.other_station', station_ass))
  WITH CHECK (public.has_station_permission('patient.edit.own_station', 'patient.edit.other_station', station_ass));

DROP POLICY IF EXISTS role_permission_patient_delete ON public.patient_basic_info;
CREATE POLICY role_permission_patient_delete
  ON public.patient_basic_info AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.has_station_permission('patient.archive.own_station', 'patient.archive.other_station', station_ass));

DROP POLICY IF EXISTS role_permission_users_select ON public.users;
CREATE POLICY role_permission_users_select
  ON public.users AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.has_station_permission(
      'staff.view.own_station',
      'staff.view.other_station',
      (SELECT sp.station_ass FROM public.staff_profiles AS sp WHERE sp.id = users.id)
    )
    OR public.guard_patient_data_read(id, 'patient.view.own_station', 'patient.view.other_station')
  );

DROP POLICY IF EXISTS role_permission_users_update ON public.users;
CREATE POLICY role_permission_users_update
  ON public.users AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.get_my_role() = 'admin')
  WITH CHECK (id = auth.uid() OR public.get_my_role() = 'admin');

DROP POLICY IF EXISTS role_permission_staff_select ON public.staff_profiles;
CREATE POLICY role_permission_staff_select
  ON public.staff_profiles AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.has_station_permission('staff.view.own_station', 'staff.view.other_station', station_ass)
  );

DROP POLICY IF EXISTS role_permission_staff_insert ON public.staff_profiles;
CREATE POLICY role_permission_staff_insert
  ON public.staff_profiles AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.has_station_permission('staff.register.own_station', 'staff.register.other_station', station_ass));

DROP POLICY IF EXISTS role_permission_pregnancy_select ON public.pregnancy_info;
CREATE POLICY role_permission_pregnancy_select
  ON public.pregnancy_info AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.guard_patient_data_read(patient_id, 'patient.view.own_station', 'patient.view.other_station'));

DROP POLICY IF EXISTS role_permission_pregnancy_insert ON public.pregnancy_info;
CREATE POLICY role_permission_pregnancy_insert
  ON public.pregnancy_info AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    (
      public.has_patient_station_permission(patient_id, 'patient.register.own_station', 'patient.register.other_station')
      AND (
        public.patient_is_at_own_station(patient_id)
        OR public.has_permission('patient.register.assign_other_station')
      )
    )
    OR (
      pregn_postp = 'Postpartum'
      AND public.has_patient_station_permission(patient_id, 'postpartum.record.own_station', 'postpartum.record.other_station')
    )
  );

DROP POLICY IF EXISTS role_permission_pregnancy_update ON public.pregnancy_info;
CREATE POLICY role_permission_pregnancy_update
  ON public.pregnancy_info AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (
    patient_id = auth.uid()
    OR public.has_patient_station_permission(patient_id, 'patient.edit.own_station', 'patient.edit.other_station')
  )
  WITH CHECK (
    patient_id = auth.uid()
    OR public.has_patient_station_permission(patient_id, 'patient.edit.own_station', 'patient.edit.other_station')
  );

DROP POLICY IF EXISTS role_permission_pregnancy_update_access ON public.pregnancy_info;
CREATE POLICY role_permission_pregnancy_update_access
  ON public.pregnancy_info FOR UPDATE TO authenticated
  USING (
    patient_id = auth.uid()
    OR public.has_patient_station_permission(patient_id, 'patient.edit.own_station', 'patient.edit.other_station')
  )
  WITH CHECK (
    patient_id = auth.uid()
    OR public.has_patient_station_permission(patient_id, 'patient.edit.own_station', 'patient.edit.other_station')
  );

DROP POLICY IF EXISTS role_permission_pregnancy_delete ON public.pregnancy_info;
CREATE POLICY role_permission_pregnancy_delete
  ON public.pregnancy_info AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.has_patient_station_permission(patient_id, 'patient.archive.own_station', 'patient.archive.other_station'));

DROP POLICY IF EXISTS role_permission_prenatal_select ON public.prenatal_visits;
CREATE POLICY role_permission_prenatal_select
  ON public.prenatal_visits AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    public.guard_patient_data_read(patient_id, 'prenatal.schedule.view.own_station', 'prenatal.schedule.view.other_station')
  );
DROP POLICY IF EXISTS role_permission_prenatal_select_access ON public.prenatal_visits;
CREATE POLICY role_permission_prenatal_select_access
  ON public.prenatal_visits FOR SELECT TO authenticated
  USING (public.guard_patient_data_read(patient_id, 'prenatal.schedule.view.own_station', 'prenatal.schedule.view.other_station'));

DROP POLICY IF EXISTS role_permission_prenatal_insert ON public.prenatal_visits;
CREATE POLICY role_permission_prenatal_insert
  ON public.prenatal_visits AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    (
      public.has_patient_station_permission(patient_id, 'prenatal.record.own_station', 'prenatal.record.other_station')
      AND (
        public.patient_is_at_own_station(patient_id)
        OR status <> 'Attended'
        OR station_ass IS DISTINCT FROM public.get_my_station()
        OR public.has_permission('prenatal.record.other_station_at_own_station')
      )
    )
  );

DROP POLICY IF EXISTS role_permission_prenatal_update ON public.prenatal_visits;
CREATE POLICY role_permission_prenatal_update
  ON public.prenatal_visits AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.has_patient_station_permission(patient_id, 'prenatal.record.own_station', 'prenatal.record.other_station'))
  WITH CHECK (public.has_patient_station_permission(patient_id, 'prenatal.record.own_station', 'prenatal.record.other_station'));

DROP POLICY IF EXISTS role_permission_prenatal_delete ON public.prenatal_visits;
CREATE POLICY role_permission_prenatal_delete
  ON public.prenatal_visits AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.has_patient_station_permission(patient_id, 'prenatal.record.own_station', 'prenatal.record.other_station'));

DROP POLICY IF EXISTS role_permission_postpartum_select ON public.postpartum_visits;
CREATE POLICY role_permission_postpartum_select
  ON public.postpartum_visits AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.guard_patient_data_read(patient_id, 'postpartum.schedule.view.own_station', 'postpartum.schedule.view.other_station'));
DROP POLICY IF EXISTS role_permission_postpartum_select_access ON public.postpartum_visits;
CREATE POLICY role_permission_postpartum_select_access
  ON public.postpartum_visits FOR SELECT TO authenticated
  USING (public.guard_patient_data_read(patient_id, 'postpartum.schedule.view.own_station', 'postpartum.schedule.view.other_station'));

DROP POLICY IF EXISTS role_permission_postpartum_insert ON public.postpartum_visits;
CREATE POLICY role_permission_postpartum_insert
  ON public.postpartum_visits AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.has_patient_station_permission(patient_id, 'postpartum.record.own_station', 'postpartum.record.other_station'));

DROP POLICY IF EXISTS role_permission_postpartum_update ON public.postpartum_visits;
CREATE POLICY role_permission_postpartum_update
  ON public.postpartum_visits AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.has_patient_station_permission(patient_id, 'postpartum.record.own_station', 'postpartum.record.other_station'))
  WITH CHECK (public.has_patient_station_permission(patient_id, 'postpartum.record.own_station', 'postpartum.record.other_station'));

DROP POLICY IF EXISTS role_permission_delivery_select ON public.deliveries;
CREATE POLICY role_permission_delivery_select
  ON public.deliveries AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    (mother_id = auth.uid() AND public.has_permission('delivery.view.own_station'))
    OR public.guard_patient_data_read(mother_id, 'delivery.view.own_station', 'delivery.view.other_station')
  );
DROP POLICY IF EXISTS role_permission_delivery_select_access ON public.deliveries;
CREATE POLICY role_permission_delivery_select_access
  ON public.deliveries FOR SELECT TO authenticated
  USING (public.guard_patient_data_read(mother_id, 'delivery.view.own_station', 'delivery.view.other_station'));

DROP POLICY IF EXISTS role_permission_delivery_insert ON public.deliveries;
CREATE POLICY role_permission_delivery_insert
  ON public.deliveries AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    (public.get_my_role() = 'admin' OR public.patient_is_at_own_station(mother_id))
    AND public.has_patient_station_permission(mother_id, 'delivery.add.own_station', 'delivery.add.own_station')
  );

DROP POLICY IF EXISTS role_permission_newborn_select ON public.newborns;
CREATE POLICY role_permission_newborn_select
  ON public.newborns AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    (mother_id = auth.uid() AND public.has_permission('newborn.view.own_station'))
    OR public.guard_patient_data_read(mother_id, 'newborn.view.own_station', 'newborn.view.other_station')
  );
DROP POLICY IF EXISTS role_permission_newborn_select_access ON public.newborns;
CREATE POLICY role_permission_newborn_select_access
  ON public.newborns FOR SELECT TO authenticated
  USING (public.guard_patient_data_read(mother_id, 'newborn.view.own_station', 'newborn.view.other_station'));

DROP POLICY IF EXISTS role_permission_newborn_insert ON public.newborns;
CREATE POLICY role_permission_newborn_insert
  ON public.newborns AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.deliveries AS d
      WHERE d.id = newborns.delivery_id
        AND d.mother_id = newborns.mother_id
    )
    AND (public.get_my_role() = 'admin' OR public.patient_is_at_own_station(mother_id))
    AND public.has_patient_station_permission(mother_id, 'delivery.add.own_station', 'delivery.add.own_station')
  );

DROP POLICY IF EXISTS role_permission_newborn_growth_select ON public.newborn_growth;
CREATE POLICY role_permission_newborn_growth_select
  ON public.newborn_growth AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.newborns AS n
      WHERE n.id = newborn_growth.newborn_id
        AND (
          (n.mother_id = auth.uid() AND public.has_permission('newborn.view.own_station'))
          OR public.guard_patient_data_read(n.mother_id, 'newborn.view.own_station', 'newborn.view.other_station')
        )
    )
  );
DROP POLICY IF EXISTS role_permission_newborn_growth_select_access ON public.newborn_growth;
CREATE POLICY role_permission_newborn_growth_select_access
  ON public.newborn_growth FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1
    FROM public.newborns AS n
    WHERE n.id = newborn_growth.newborn_id
      AND public.guard_patient_data_read(n.mother_id, 'newborn.view.own_station', 'newborn.view.other_station')
  ));

DROP POLICY IF EXISTS role_permission_vaccinations_select ON public.vaccinations;
CREATE POLICY role_permission_vaccinations_select
  ON public.vaccinations AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    public.guard_patient_data_read(
      COALESCE(patient_id, (SELECT n.mother_id FROM public.newborns AS n WHERE n.id = vaccinations.newborn_id)),
      'vaccine.schedule.view.own_station',
      'vaccine.schedule.view.other_station'
    )
  );
DROP POLICY IF EXISTS role_permission_vaccinations_select_access ON public.vaccinations;
CREATE POLICY role_permission_vaccinations_select_access
  ON public.vaccinations FOR SELECT TO authenticated
  USING (public.guard_patient_data_read(
    COALESCE(patient_id, (SELECT n.mother_id FROM public.newborns AS n WHERE n.id = vaccinations.newborn_id)),
    'vaccine.schedule.view.own_station',
    'vaccine.schedule.view.other_station'
  ));

DROP POLICY IF EXISTS role_permission_vaccinations_insert ON public.vaccinations;
CREATE POLICY role_permission_vaccinations_insert
  ON public.vaccinations AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    CASE WHEN status = 'Completed' THEN
      public.has_patient_station_permission(
        COALESCE(patient_id, (SELECT n.mother_id FROM public.newborns AS n WHERE n.id = vaccinations.newborn_id)),
        'vaccine.administer.own_station',
        'vaccine.administer.other_station'
      )
    ELSE
      public.has_patient_station_permission(
        COALESCE(patient_id, (SELECT n.mother_id FROM public.newborns AS n WHERE n.id = vaccinations.newborn_id)),
        'vaccine.schedule.create.own_station',
        'vaccine.schedule.create.other_station'
      )
    END
  );

DROP POLICY IF EXISTS role_permission_vaccinations_update ON public.vaccinations;
CREATE POLICY role_permission_vaccinations_update
  ON public.vaccinations AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (
    public.guard_patient_data_read(
      COALESCE(patient_id, (SELECT n.mother_id FROM public.newborns AS n WHERE n.id = vaccinations.newborn_id)),
      'vaccine.schedule.view.own_station',
      'vaccine.schedule.view.other_station'
    )
  )
  WITH CHECK (
    (
      public.has_patient_station_permission(
        COALESCE(patient_id, (SELECT n.mother_id FROM public.newborns AS n WHERE n.id = vaccinations.newborn_id)),
        'vaccine.schedule.create.own_station',
        'vaccine.schedule.create.other_station'
      )
      OR public.has_patient_station_permission(
        COALESCE(patient_id, (SELECT n.mother_id FROM public.newborns AS n WHERE n.id = vaccinations.newborn_id)),
        'vaccine.administer.own_station',
        'vaccine.administer.other_station'
      )
    )
  );

DROP POLICY IF EXISTS role_permission_supplements_select ON public.supplements;
CREATE POLICY role_permission_supplements_select
  ON public.supplements AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.guard_patient_data_read(patient_id, 'patient.view.own_station', 'patient.view.other_station'));

DROP POLICY IF EXISTS role_permission_supplements_write ON public.supplements;
CREATE POLICY role_permission_supplements_write
  ON public.supplements AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.has_patient_station_permission(patient_id, 'supplement.distribute.patient.own_station', 'supplement.distribute.patient.other_station'));

DROP POLICY IF EXISTS role_permission_supplements_update ON public.supplements;
CREATE POLICY role_permission_supplements_update
  ON public.supplements AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.has_patient_station_permission(patient_id, 'supplement.distribute.patient.own_station', 'supplement.distribute.patient.other_station'))
  WITH CHECK (public.has_patient_station_permission(patient_id, 'supplement.distribute.patient.own_station', 'supplement.distribute.patient.other_station'));

DROP POLICY IF EXISTS role_permission_supplements_delete ON public.supplements;
CREATE POLICY role_permission_supplements_delete
  ON public.supplements AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.has_patient_station_permission(patient_id, 'supplement.distribute.patient.own_station', 'supplement.distribute.patient.other_station'));

DROP POLICY IF EXISTS role_permission_main_vaccine_select ON public.vaccine_inventory;
CREATE POLICY role_permission_main_vaccine_select
  ON public.vaccine_inventory AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    public.has_permission('inventory.main.view')
    OR public.has_permission('inventory.main.stock.add')
    OR public.has_permission('inventory.main.distribute.to_stations')
  );
DROP POLICY IF EXISTS role_permission_main_vaccine_select_access ON public.vaccine_inventory;
CREATE POLICY role_permission_main_vaccine_select_access
  ON public.vaccine_inventory FOR SELECT TO authenticated
  USING (
    public.has_permission('inventory.main.view')
    OR public.has_permission('inventory.main.stock.add')
    OR public.has_permission('inventory.main.distribute.to_stations')
  );

DROP POLICY IF EXISTS role_permission_main_vaccine_write ON public.vaccine_inventory;
CREATE POLICY role_permission_main_vaccine_write
  ON public.vaccine_inventory AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('inventory.main.stock.add'));
DROP POLICY IF EXISTS role_permission_main_vaccine_insert_access ON public.vaccine_inventory;
CREATE POLICY role_permission_main_vaccine_insert_access
  ON public.vaccine_inventory FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('inventory.main.stock.add'));

DROP POLICY IF EXISTS role_permission_main_vaccine_update ON public.vaccine_inventory;
CREATE POLICY role_permission_main_vaccine_update
  ON public.vaccine_inventory AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.has_permission('inventory.main.stock.add') OR public.has_permission('inventory.main.distribute.to_stations'))
  WITH CHECK (public.has_permission('inventory.main.stock.add') OR public.has_permission('inventory.main.distribute.to_stations'));
DROP POLICY IF EXISTS role_permission_main_vaccine_update_access ON public.vaccine_inventory;
CREATE POLICY role_permission_main_vaccine_update_access
  ON public.vaccine_inventory FOR UPDATE TO authenticated
  USING (public.has_permission('inventory.main.stock.add') OR public.has_permission('inventory.main.distribute.to_stations'))
  WITH CHECK (public.has_permission('inventory.main.stock.add') OR public.has_permission('inventory.main.distribute.to_stations'));

DROP POLICY IF EXISTS role_permission_main_vaccine_delete ON public.vaccine_inventory;
CREATE POLICY role_permission_main_vaccine_delete
  ON public.vaccine_inventory AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.has_permission('inventory.main.stock.add'));
DROP POLICY IF EXISTS role_permission_main_vaccine_delete_access ON public.vaccine_inventory;
CREATE POLICY role_permission_main_vaccine_delete_access
  ON public.vaccine_inventory FOR DELETE TO authenticated
  USING (public.has_permission('inventory.main.stock.add'));

DROP POLICY IF EXISTS role_permission_main_supplement_select ON public.supplement_inventory;
CREATE POLICY role_permission_main_supplement_select
  ON public.supplement_inventory AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    public.has_permission('inventory.main.view')
    OR public.has_permission('inventory.main.stock.add')
    OR public.has_permission('inventory.main.distribute.to_stations')
  );
DROP POLICY IF EXISTS role_permission_main_supplement_select_access ON public.supplement_inventory;
CREATE POLICY role_permission_main_supplement_select_access
  ON public.supplement_inventory FOR SELECT TO authenticated
  USING (
    public.has_permission('inventory.main.view')
    OR public.has_permission('inventory.main.stock.add')
    OR public.has_permission('inventory.main.distribute.to_stations')
  );

DROP POLICY IF EXISTS role_permission_main_supplement_write ON public.supplement_inventory;
CREATE POLICY role_permission_main_supplement_write
  ON public.supplement_inventory AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('inventory.main.stock.add'));
DROP POLICY IF EXISTS role_permission_main_supplement_insert_access ON public.supplement_inventory;
CREATE POLICY role_permission_main_supplement_insert_access
  ON public.supplement_inventory FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('inventory.main.stock.add'));

DROP POLICY IF EXISTS role_permission_main_supplement_update ON public.supplement_inventory;
CREATE POLICY role_permission_main_supplement_update
  ON public.supplement_inventory AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.has_permission('inventory.main.stock.add') OR public.has_permission('inventory.main.distribute.to_stations'))
  WITH CHECK (public.has_permission('inventory.main.stock.add') OR public.has_permission('inventory.main.distribute.to_stations'));
DROP POLICY IF EXISTS role_permission_main_supplement_update_access ON public.supplement_inventory;
CREATE POLICY role_permission_main_supplement_update_access
  ON public.supplement_inventory FOR UPDATE TO authenticated
  USING (public.has_permission('inventory.main.stock.add') OR public.has_permission('inventory.main.distribute.to_stations'))
  WITH CHECK (public.has_permission('inventory.main.stock.add') OR public.has_permission('inventory.main.distribute.to_stations'));

DROP POLICY IF EXISTS role_permission_main_supplement_delete ON public.supplement_inventory;
CREATE POLICY role_permission_main_supplement_delete
  ON public.supplement_inventory AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.has_permission('inventory.main.stock.add'));
DROP POLICY IF EXISTS role_permission_main_supplement_delete_access ON public.supplement_inventory;
CREATE POLICY role_permission_main_supplement_delete_access
  ON public.supplement_inventory FOR DELETE TO authenticated
  USING (public.has_permission('inventory.main.stock.add'));
DROP POLICY IF EXISTS role_permission_station_vaccine_inventory ON public.station_vaccine_inventory;
CREATE POLICY role_permission_station_vaccine_inventory
  ON public.station_vaccine_inventory AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.has_station_permission('inventory.station.view.own_station', 'inventory.station.view.other_station', station_id));
DROP POLICY IF EXISTS role_permission_station_vaccine_inventory_select_access ON public.station_vaccine_inventory;
CREATE POLICY role_permission_station_vaccine_inventory_select_access
  ON public.station_vaccine_inventory FOR SELECT TO authenticated
  USING (public.has_station_permission('inventory.station.view.own_station', 'inventory.station.view.other_station', station_id));

DROP POLICY IF EXISTS role_permission_station_vaccine_inventory_insert ON public.station_vaccine_inventory;
CREATE POLICY role_permission_station_vaccine_inventory_insert
  ON public.station_vaccine_inventory AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    public.has_station_permission('inventory.station.stock.adjust.own_station', 'inventory.station.stock.adjust.other_station', station_id)
    OR public.has_permission('inventory.main.distribute.to_stations')
  );
DROP POLICY IF EXISTS role_permission_station_vaccine_inventory_insert_access ON public.station_vaccine_inventory;
CREATE POLICY role_permission_station_vaccine_inventory_insert_access
  ON public.station_vaccine_inventory FOR INSERT TO authenticated
  WITH CHECK (
    public.has_station_permission('inventory.station.stock.adjust.own_station', 'inventory.station.stock.adjust.other_station', station_id)
    OR public.has_permission('inventory.main.distribute.to_stations')
  );

DROP POLICY IF EXISTS role_permission_station_vaccine_inventory_update ON public.station_vaccine_inventory;
CREATE POLICY role_permission_station_vaccine_inventory_update
  ON public.station_vaccine_inventory AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (
    public.has_station_permission('inventory.station.stock.adjust.own_station', 'inventory.station.stock.adjust.other_station', station_id)
    OR public.has_permission('inventory.main.distribute.to_stations')
  )
  WITH CHECK (
    public.has_station_permission('inventory.station.stock.adjust.own_station', 'inventory.station.stock.adjust.other_station', station_id)
    OR public.has_permission('inventory.main.distribute.to_stations')
  );
DROP POLICY IF EXISTS role_permission_station_vaccine_inventory_update_access ON public.station_vaccine_inventory;
CREATE POLICY role_permission_station_vaccine_inventory_update_access
  ON public.station_vaccine_inventory FOR UPDATE TO authenticated
  USING (
    public.has_station_permission('inventory.station.stock.adjust.own_station', 'inventory.station.stock.adjust.other_station', station_id)
    OR public.has_permission('inventory.main.distribute.to_stations')
  )
  WITH CHECK (
    public.has_station_permission('inventory.station.stock.adjust.own_station', 'inventory.station.stock.adjust.other_station', station_id)
    OR public.has_permission('inventory.main.distribute.to_stations')
  );

DROP POLICY IF EXISTS role_permission_station_vaccine_inventory_delete ON public.station_vaccine_inventory;
CREATE POLICY role_permission_station_vaccine_inventory_delete
  ON public.station_vaccine_inventory AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.has_station_permission('inventory.station.stock.adjust.own_station', 'inventory.station.stock.adjust.other_station', station_id));
DROP POLICY IF EXISTS role_permission_station_vaccine_inventory_delete_access ON public.station_vaccine_inventory;
CREATE POLICY role_permission_station_vaccine_inventory_delete_access
  ON public.station_vaccine_inventory FOR DELETE TO authenticated
  USING (public.has_station_permission('inventory.station.stock.adjust.own_station', 'inventory.station.stock.adjust.other_station', station_id));

DROP POLICY IF EXISTS role_permission_station_supplement_inventory ON public.station_supplement_inventory;
CREATE POLICY role_permission_station_supplement_inventory
  ON public.station_supplement_inventory AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.has_station_permission('inventory.station.view.own_station', 'inventory.station.view.other_station', station_id));
DROP POLICY IF EXISTS role_permission_station_supplement_inventory_select_access ON public.station_supplement_inventory;
CREATE POLICY role_permission_station_supplement_inventory_select_access
  ON public.station_supplement_inventory FOR SELECT TO authenticated
  USING (public.has_station_permission('inventory.station.view.own_station', 'inventory.station.view.other_station', station_id));

DROP POLICY IF EXISTS role_permission_station_supplement_inventory_insert ON public.station_supplement_inventory;
CREATE POLICY role_permission_station_supplement_inventory_insert
  ON public.station_supplement_inventory AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    public.has_station_permission('inventory.station.stock.adjust.own_station', 'inventory.station.stock.adjust.other_station', station_id)
    OR public.has_permission('inventory.main.distribute.to_stations')
  );
DROP POLICY IF EXISTS role_permission_station_supplement_inventory_insert_access ON public.station_supplement_inventory;
CREATE POLICY role_permission_station_supplement_inventory_insert_access
  ON public.station_supplement_inventory FOR INSERT TO authenticated
  WITH CHECK (
    public.has_station_permission('inventory.station.stock.adjust.own_station', 'inventory.station.stock.adjust.other_station', station_id)
    OR public.has_permission('inventory.main.distribute.to_stations')
  );

DROP POLICY IF EXISTS role_permission_station_supplement_inventory_update ON public.station_supplement_inventory;
CREATE POLICY role_permission_station_supplement_inventory_update
  ON public.station_supplement_inventory AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (
    public.has_station_permission('inventory.station.stock.adjust.own_station', 'inventory.station.stock.adjust.other_station', station_id)
    OR public.has_permission('inventory.main.distribute.to_stations')
  )
  WITH CHECK (
    public.has_station_permission('inventory.station.stock.adjust.own_station', 'inventory.station.stock.adjust.other_station', station_id)
    OR public.has_permission('inventory.main.distribute.to_stations')
  );
DROP POLICY IF EXISTS role_permission_station_supplement_inventory_update_access ON public.station_supplement_inventory;
CREATE POLICY role_permission_station_supplement_inventory_update_access
  ON public.station_supplement_inventory FOR UPDATE TO authenticated
  USING (
    public.has_station_permission('inventory.station.stock.adjust.own_station', 'inventory.station.stock.adjust.other_station', station_id)
    OR public.has_permission('inventory.main.distribute.to_stations')
  )
  WITH CHECK (
    public.has_station_permission('inventory.station.stock.adjust.own_station', 'inventory.station.stock.adjust.other_station', station_id)
    OR public.has_permission('inventory.main.distribute.to_stations')
  );

DROP POLICY IF EXISTS role_permission_station_supplement_inventory_delete ON public.station_supplement_inventory;
CREATE POLICY role_permission_station_supplement_inventory_delete
  ON public.station_supplement_inventory AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.has_station_permission('inventory.station.stock.adjust.own_station', 'inventory.station.stock.adjust.other_station', station_id));
DROP POLICY IF EXISTS role_permission_station_supplement_inventory_delete_access ON public.station_supplement_inventory;
CREATE POLICY role_permission_station_supplement_inventory_delete_access
  ON public.station_supplement_inventory FOR DELETE TO authenticated
  USING (public.has_station_permission('inventory.station.stock.adjust.own_station', 'inventory.station.stock.adjust.other_station', station_id));

DROP POLICY IF EXISTS role_permission_vaccine_distribution ON public.vaccine_distribution;
CREATE POLICY role_permission_vaccine_distribution
  ON public.vaccine_distribution AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    public.has_permission('inventory.main.distribute.to_stations')
    OR public.has_station_permission('inventory.station.view.own_station', 'inventory.station.view.other_station', station_id)
  )
  WITH CHECK (public.has_permission('inventory.main.distribute.to_stations'));
DROP POLICY IF EXISTS role_permission_vaccine_distribution_select_access ON public.vaccine_distribution;
CREATE POLICY role_permission_vaccine_distribution_select_access
  ON public.vaccine_distribution FOR SELECT TO authenticated
  USING (
    public.has_permission('inventory.main.distribute.to_stations')
    OR public.has_station_permission('inventory.station.view.own_station', 'inventory.station.view.other_station', station_id)
  );
DROP POLICY IF EXISTS role_permission_vaccine_distribution_insert_access ON public.vaccine_distribution;
CREATE POLICY role_permission_vaccine_distribution_insert_access
  ON public.vaccine_distribution FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('inventory.main.distribute.to_stations'));

DROP POLICY IF EXISTS role_permission_supplement_distribution ON public.supplement_distribution;
CREATE POLICY role_permission_supplement_distribution
  ON public.supplement_distribution AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    public.has_permission('inventory.main.distribute.to_stations')
    OR public.has_station_permission('inventory.station.view.own_station', 'inventory.station.view.other_station', station_id)
  )
  WITH CHECK (public.has_permission('inventory.main.distribute.to_stations'));
DROP POLICY IF EXISTS role_permission_supplement_distribution_select_access ON public.supplement_distribution;
CREATE POLICY role_permission_supplement_distribution_select_access
  ON public.supplement_distribution FOR SELECT TO authenticated
  USING (
    public.has_permission('inventory.main.distribute.to_stations')
    OR public.has_station_permission('inventory.station.view.own_station', 'inventory.station.view.other_station', station_id)
  );
DROP POLICY IF EXISTS role_permission_supplement_distribution_insert_access ON public.supplement_distribution;
CREATE POLICY role_permission_supplement_distribution_insert_access
  ON public.supplement_distribution FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('inventory.main.distribute.to_stations'));

CREATE OR REPLACE FUNCTION public.set_patient_station(p_patient_id UUID, p_station_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
SET row_security = off
AS $$
DECLARE
  v_role TEXT := public.get_my_role();
  v_patient_station UUID;
  v_created_by UUID;
BEGIN
  IF auth.uid() IS NULL OR COALESCE(v_role, '') NOT IN ('staff', 'cho personnel', 'admin') THEN
    RAISE EXCEPTION 'Not authorized to change patient station';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.stations WHERE id = p_station_id) THEN
    RAISE EXCEPTION 'Station not found';
  END IF;

  SELECT station_ass, created_by INTO v_patient_station, v_created_by
  FROM public.patient_basic_info
  WHERE id = p_patient_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Patient not found';
  END IF;

  IF v_role <> 'admin'
    AND v_patient_station IS DISTINCT FROM public.get_my_station()
    AND v_created_by IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Not authorized to change this patient station';
  END IF;

  IF p_station_id IS DISTINCT FROM public.get_my_station()
    AND NOT (
      public.has_permission('patient.register.other_station')
      AND public.has_permission('patient.register.assign_other_station')
    ) THEN
    RAISE EXCEPTION 'Not authorized to assign a patient to another station';
  END IF;

  UPDATE public.patient_basic_info
  SET station_ass = p_station_id
  WHERE id = p_patient_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_patient_station(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_patient_station(UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_patient_user_record(
  p_user_id UUID,
  p_email TEXT,
  p_role TEXT,
  p_password TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
SET row_security = off
AS $$
DECLARE
  v_role_id UUID;
  v_email TEXT;
  v_role TEXT := LOWER(REPLACE(TRIM(COALESCE(p_role, '')), '_', ' '));
  v_is_admin BOOLEAN := public.get_my_role() = 'admin';
  v_is_service BOOLEAN := COALESCE(auth.role(), '') = 'service_role';
BEGIN
  IF p_user_id IS NULL OR (auth.uid() IS NULL AND NOT v_is_service) THEN
    RAISE EXCEPTION 'A trusted authenticated caller is required';
  END IF;
  IF p_password IS NOT NULL THEN
    RAISE EXCEPTION 'Passwords must be managed through Supabase Auth';
  END IF;
  IF NOT v_is_service AND NOT v_is_admin THEN
    IF auth.uid() IS DISTINCT FROM p_user_id OR v_role NOT IN ('patient', 'mother') THEN
      RAISE EXCEPTION 'Only administrators may create or assign staff roles';
    END IF;
  END IF;
  IF v_role NOT IN ('admin', 'staff', 'station staff', 'cho personnel', 'patient', 'mother') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  SELECT LOWER(TRIM(au.email)) INTO v_email
  FROM auth.users AS au
  WHERE au.id = p_user_id;
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'The Supabase Auth user does not exist';
  END IF;

  SELECT ut.id INTO v_role_id
  FROM public.user_type AS ut
  WHERE LOWER(REPLACE(TRIM(ut.user_type), '_', ' ')) = v_role
  LIMIT 1;
  IF v_role_id IS NULL THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  INSERT INTO public.users (id, email_address, usertype)
  VALUES (p_user_id, v_email, v_role_id)
  ON CONFLICT (id) DO UPDATE SET
    email_address = EXCLUDED.email_address,
    usertype = CASE
      WHEN v_is_service OR v_is_admin THEN EXCLUDED.usertype
      ELSE public.users.usertype
    END;
END;
$$;

REVOKE ALL ON FUNCTION public.create_patient_user_record(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_patient_user_record(UUID, TEXT, TEXT, TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.complete_prenatal_visit(
  p_visit_id UUID,
  p_payload JSONB,
  p_actual_station UUID DEFAULT NULL
)
RETURNS public.prenatal_visits
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
SET row_security = off
AS $$
DECLARE
  v_role TEXT := public.get_my_role();
  v_station UUID;
  v_actual_station UUID;
  v_patient_station UUID;
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

  v_patient_station := public.get_patient_station(v_visit.patient_id);
  IF NOT public.has_station_permission(
    'prenatal.record.own_station',
    'prenatal.record.other_station',
    v_patient_station
  ) THEN
    RAISE EXCEPTION 'Not authorized to record prenatal visits for this patient';
  END IF;
  IF v_patient_station IS DISTINCT FROM v_station
    AND v_actual_station = v_station
    AND NOT public.has_permission('prenatal.record.other_station_at_own_station') THEN
    RAISE EXCEPTION 'Not authorized to record an own-station visit for another station''s patient';
  END IF;
  IF v_visit.status IS DISTINCT FROM 'Scheduled' THEN
    RAISE EXCEPTION 'Only a scheduled visit can be completed in place';
  END IF;

  SELECT * INTO v_payload
  FROM jsonb_populate_record(v_visit, COALESCE(p_payload, '{}'::jsonb));
  IF v_payload.visit_date IS DISTINCT FROM v_visit.visit_date THEN
    RAISE EXCEPTION 'A scheduled visit date cannot be changed while completing it';
  END IF;

  UPDATE public.prenatal_visits AS visit SET
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

CREATE OR REPLACE FUNCTION public.cancel_future_scheduled_visit(
  p_visit_kind TEXT,
  p_visit_id UUID,
  p_patient_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
SET row_security = off
AS $$
DECLARE
  v_role TEXT := public.get_my_role();
  v_station UUID := public.get_my_station();
  v_patient_station UUID;
  v_updated INTEGER := 0;
BEGIN
  IF auth.uid() IS NULL OR COALESCE(v_role, '') NOT IN ('admin', 'staff', 'cho personnel') THEN
    RAISE EXCEPTION 'Not authorized to cancel scheduled visits';
  END IF;
  v_patient_station := public.get_patient_station(p_patient_id);
  IF NOT public.has_station_permission(
    'patient.reschedule.own_station',
    'patient.reschedule.other_station',
    v_patient_station
  ) THEN
    RAISE EXCEPTION 'Not authorized to reschedule visits for this patient';
  END IF;

  IF v_role <> 'admin' AND (
    v_station IS NULL OR NOT public.belongs_to_my_station(p_patient_id)
  ) THEN
    RAISE EXCEPTION 'You can only manage visits for patients assigned to your station';
  END IF;

  IF p_visit_kind = 'prenatal' THEN
    UPDATE public.prenatal_visits
    SET status = 'Cancelled'
    WHERE id = p_visit_id
      AND patient_id = p_patient_id
      AND status = 'Scheduled'
      AND visit_date >= CURRENT_DATE
      AND (
        v_role = 'admin'
        OR (
          v_role = 'staff'
          AND (assigned_staff = auth.uid() OR created_by = auth.uid())
          AND assigned_station IS NOT DISTINCT FROM v_station
        )
        OR (
          v_role = 'cho personnel'
          AND (assigned_station IS NOT DISTINCT FROM v_station OR created_by = auth.uid())
        )
      );
    GET DIAGNOSTICS v_updated = ROW_COUNT;
  ELSIF p_visit_kind = 'postpartum' THEN
    UPDATE public.postpartum_visits
    SET status = 'Cancelled'
    WHERE id = p_visit_id
      AND patient_id = p_patient_id
      AND status = 'Scheduled'
      AND scheduled_date >= CURRENT_DATE;
    GET DIAGNOSTICS v_updated = ROW_COUNT;
  ELSIF p_visit_kind IN ('maternal_vaccination', 'newborn_vaccination') THEN
    UPDATE public.vaccinations AS vaccination
    SET status = 'Cancelled'
    WHERE vaccination.id = p_visit_id
      AND vaccination.status = 'Pending'
      AND vaccination.vaccinated_date IS NULL
      AND vaccination.scheduled_vaccination >= CURRENT_DATE
      AND (
        (p_visit_kind = 'maternal_vaccination'
          AND vaccination.patient_id = p_patient_id
          AND vaccination.newborn_id IS NULL)
        OR
        (p_visit_kind = 'newborn_vaccination'
          AND vaccination.patient_id IS NULL
          AND EXISTS (
            SELECT 1 FROM public.newborns AS newborn
            WHERE newborn.id = vaccination.newborn_id
              AND newborn.mother_id = p_patient_id
          ))
      );
    GET DIAGNOSTICS v_updated = ROW_COUNT;
  ELSE
    RAISE EXCEPTION 'Unsupported visit category';
  END IF;

  IF v_updated <> 1 THEN
    RAISE EXCEPTION 'Visit not found or no longer eligible for cancellation';
  END IF;
END;
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
SET search_path = pg_catalog, public
SET row_security = off
AS $$
DECLARE
  v_role TEXT := public.get_my_role();
BEGIN
  IF auth.uid() IS NULL OR COALESCE(v_role, '') NOT IN ('admin', 'staff', 'cho personnel') THEN
    RAISE EXCEPTION 'Not authorized to view the staff directory';
  END IF;

  RETURN QUERY
  SELECT sp.id, u.email_address::TEXT, ut.user_type::TEXT, u.is_archived, u.is_deactivated
  FROM public.staff_profiles AS sp
  JOIN public.users AS u ON u.id = sp.id
  JOIN public.user_type AS ut ON ut.id = u.usertype
  WHERE public.has_station_permission(
      'staff.view.own_station',
      'staff.view.other_station',
      sp.station_ass
    )
  ORDER BY sp.full_name;
END;
$$;

REVOKE ALL ON FUNCTION public.get_staff_directory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_staff_directory() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_assignable_staff(p_station_id UUID)
RETURNS TABLE(id UUID, full_name TEXT, station_ass UUID)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
SET row_security = off
AS $$
  SELECT sp.id, sp.full_name, sp.station_ass
  FROM public.staff_profiles AS sp
  JOIN public.users AS u ON u.id = sp.id
  JOIN public.user_type AS ut ON ut.id = u.usertype
  WHERE sp.station_ass = p_station_id
    AND LOWER(REPLACE(TRIM(ut.user_type), '_', ' ')) IN ('staff', 'station staff', 'cho personnel')
    AND (
      public.get_my_role() = 'admin'
      OR (
        public.get_my_role() IN ('staff', 'cho personnel')
        AND p_station_id IS NOT DISTINCT FROM public.get_my_station()
        AND public.has_permission('staff.view.own_station')
      )
    )
  ORDER BY sp.full_name;
$$;

REVOKE ALL ON FUNCTION public.get_assignable_staff(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_assignable_staff(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_distribution_releasers(p_user_ids UUID[])
RETURNS TABLE(id UUID, full_name TEXT, email_address TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
SET row_security = off
AS $$
DECLARE
  v_role TEXT := public.get_my_role();
  v_station UUID := public.get_my_station();
BEGIN
  IF auth.uid() IS NULL OR COALESCE(v_role, '') NOT IN ('admin', 'staff', 'cho personnel') THEN
    RAISE EXCEPTION 'Not authorized to view distribution releasers';
  END IF;

  IF v_role <> 'admin'
    AND NOT public.has_permission('inventory.station.view.own_station')
    AND NOT public.has_permission('inventory.main.distribute.to_stations') THEN
    RAISE EXCEPTION 'Not authorized to view distribution releasers';
  END IF;

  RETURN QUERY
  SELECT u.id, sp.full_name::TEXT, u.email_address::TEXT
  FROM public.users AS u
  LEFT JOIN public.staff_profiles AS sp ON sp.id = u.id
  WHERE u.id = ANY(COALESCE(p_user_ids, ARRAY[]::UUID[]))
    AND (
      v_role = 'admin'
      OR public.has_permission('inventory.main.distribute.to_stations')
      OR EXISTS (
        SELECT 1 FROM public.vaccine_distribution AS vd
        WHERE vd.distributed_by = u.id
          AND vd.station_id IS NOT DISTINCT FROM v_station
      )
      OR EXISTS (
        SELECT 1 FROM public.supplement_distribution AS sd
        WHERE sd.distributed_by = u.id
          AND sd.station_id IS NOT DISTINCT FROM v_station
      )
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_distribution_releasers(UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_distribution_releasers(UUID[]) TO authenticated;
