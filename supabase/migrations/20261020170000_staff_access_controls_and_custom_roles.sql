INSERT INTO public.role_permission_catalog
  (permission_key, category, label, description, display_order)
VALUES
  ('staff.archive.own_station', 'Staff and CHO Personnel Management', 'Archive staff at own station', 'Archive or restore staff accounts assigned to the logged-in user''s station.', 53),
  ('staff.archive.other_station', 'Staff and CHO Personnel Management', 'Archive staff at other stations', 'Archive or restore staff accounts assigned to a different station.', 54),
  ('staff.deactivate.own_station', 'Staff and CHO Personnel Management', 'Deactivate staff at own station', 'Deactivate or reactivate staff accounts assigned to the logged-in user''s station.', 55),
  ('staff.deactivate.other_station', 'Staff and CHO Personnel Management', 'Deactivate staff at other stations', 'Deactivate or reactivate staff accounts assigned to a different station.', 56),
  ('staff.password.reset.own_station', 'Staff and CHO Personnel Management', 'Reset passwords at own station', 'Send a password reset link to staff assigned to the logged-in user''s station.', 57),
  ('staff.password.reset.other_station', 'Staff and CHO Personnel Management', 'Reset passwords at other stations', 'Send a password reset link to staff assigned to a different station.', 58)
ON CONFLICT (permission_key) DO UPDATE SET
  category = EXCLUDED.category,
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order;

INSERT INTO public.role_permissions (role_id, permission_key, is_allowed)
SELECT
  user_type.id,
  catalog.permission_key,
  LOWER(REPLACE(TRIM(user_type.user_type), '_', ' ')) = 'admin'
FROM public.user_type AS user_type
CROSS JOIN public.role_permission_catalog AS catalog
WHERE catalog.permission_key IN (
  'staff.archive.own_station',
  'staff.archive.other_station',
  'staff.deactivate.own_station',
  'staff.deactivate.other_station',
  'staff.password.reset.own_station',
  'staff.password.reset.other_station'
)
ON CONFLICT (role_id, permission_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.create_user_type(p_user_type TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
SET row_security = off
AS $$
DECLARE
  v_user_type TEXT := LOWER(REPLACE(TRIM(COALESCE(p_user_type, '')), '_', ' '));
  v_role_id UUID;
BEGIN
  IF public.get_my_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Only administrators may create user types';
  END IF;

  IF v_user_type = '' OR LENGTH(v_user_type) > 64
    OR v_user_type !~ '^[a-z0-9][a-z0-9 -]*$' THEN
    RAISE EXCEPTION 'Enter a valid user type using letters, numbers, spaces, or hyphens';
  END IF;

  IF v_user_type IN ('admin', 'staff', 'station staff', 'cho personnel', 'patient', 'mother', 'user') THEN
    RAISE EXCEPTION 'This user type is reserved';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.user_type AS existing
    WHERE LOWER(REPLACE(TRIM(existing.user_type), '_', ' ')) = v_user_type
  ) THEN
    RAISE EXCEPTION 'This user type already exists';
  END IF;

  INSERT INTO public.user_type (user_type)
  VALUES (v_user_type)
  RETURNING id INTO v_role_id;

  INSERT INTO public.role_permissions (role_id, permission_key, is_allowed)
  SELECT v_role_id, permission_key, FALSE
  FROM public.role_permission_catalog
  ON CONFLICT (role_id, permission_key) DO NOTHING;

  RETURN v_role_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_user_type(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_user_type(TEXT) TO authenticated;

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
    ELSE
      SELECT station_ass INTO v_staff_station
      FROM public.staff_profiles WHERE id = NEW.id;
      IF NOT FOUND OR NOT public.has_station_permission(
        'staff.archive.own_station',
        'staff.archive.other_station',
        v_staff_station
      ) THEN
        RAISE EXCEPTION 'Not authorized to archive this staff account';
      END IF;
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
    ELSE
      SELECT station_ass INTO v_staff_station
      FROM public.staff_profiles WHERE id = NEW.id;
      IF NOT FOUND OR NOT public.has_station_permission(
        'staff.deactivate.own_station',
        'staff.deactivate.other_station',
        v_staff_station
      ) THEN
        RAISE EXCEPTION 'Not authorized to deactivate this staff account';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
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

  SELECT ut.id INTO v_role_id
  FROM public.user_type AS ut
  WHERE LOWER(REPLACE(TRIM(ut.user_type), '_', ' ')) = v_role
  LIMIT 1;
  IF v_role_id IS NULL THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  SELECT LOWER(TRIM(au.email)) INTO v_email
  FROM auth.users AS au
  WHERE au.id = p_user_id;
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'The Supabase Auth user does not exist';
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

CREATE OR REPLACE FUNCTION public.set_staff_account_status(
  p_user_id UUID,
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
  v_station UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT station_ass INTO v_station
  FROM public.staff_profiles
  WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Staff account not found';
  END IF;

  IF p_is_archived IS NOT NULL AND NOT public.has_station_permission(
    'staff.archive.own_station',
    'staff.archive.other_station',
    v_station
  ) THEN
    RAISE EXCEPTION 'Not authorized to archive this staff account';
  END IF;

  IF p_is_deactivated IS NOT NULL AND NOT public.has_station_permission(
    'staff.deactivate.own_station',
    'staff.deactivate.other_station',
    v_station
  ) THEN
    RAISE EXCEPTION 'Not authorized to deactivate this staff account';
  END IF;

  UPDATE public.users
  SET is_archived = COALESCE(p_is_archived, is_archived),
      is_deactivated = COALESCE(p_is_deactivated, is_deactivated)
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User account not found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_staff_account_status(UUID, BOOLEAN, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_staff_account_status(UUID, BOOLEAN, BOOLEAN) TO authenticated;
