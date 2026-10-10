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

ALTER TABLE public.postpartum_visits
  ADD COLUMN IF NOT EXISTS visit_type TEXT,
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Scheduled',
  ADD COLUMN IF NOT EXISTS attended_date DATE,
  ADD COLUMN IF NOT EXISTS assigned_staff UUID,
  ADD COLUMN IF NOT EXISTS personnel_present UUID,
  ADD COLUMN IF NOT EXISTS performed_by UUID,
  ADD COLUMN IF NOT EXISTS station_ass UUID,
  ADD COLUMN IF NOT EXISTS assessment JSONB NOT NULL DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS created_by UUID;

UPDATE public.postpartum_visits pv
SET visit_type = COALESCE(pv.visit_type, '24 hours after birth'),
    scheduled_at = COALESCE(
      pv.scheduled_at,
      (
        (d.delivery_date + COALESCE(d.delivery_time, TIME '00:00'))
        AT TIME ZONE 'Asia/Manila'
      ) + INTERVAL '24 hours'
    ),
    station_ass = COALESCE(pv.station_ass, d.station_ass),
    created_by = COALESCE(pv.created_by, d.created_by, d.attending_staff)
FROM public.deliveries d
WHERE pv.delivery_id = d.id;

ALTER TABLE public.postpartum_visits
  ALTER COLUMN visit_type SET NOT NULL,
  ALTER COLUMN scheduled_at SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'postpartum_visits_delivery_id_fkey'
      AND conrelid = 'public.postpartum_visits'::regclass
  ) THEN
    ALTER TABLE public.postpartum_visits
      ADD CONSTRAINT postpartum_visits_delivery_id_fkey
      FOREIGN KEY (delivery_id) REFERENCES public.deliveries(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'postpartum_visits_patient_id_fkey'
      AND conrelid = 'public.postpartum_visits'::regclass
  ) THEN
    ALTER TABLE public.postpartum_visits
      ADD CONSTRAINT postpartum_visits_patient_id_fkey
      FOREIGN KEY (patient_id) REFERENCES public.patient_basic_info(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'postpartum_visits_assigned_staff_fkey'
      AND conrelid = 'public.postpartum_visits'::regclass
  ) THEN
    ALTER TABLE public.postpartum_visits
      ADD CONSTRAINT postpartum_visits_assigned_staff_fkey
      FOREIGN KEY (assigned_staff) REFERENCES public.staff_profiles(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'postpartum_visits_performed_by_fkey'
      AND conrelid = 'public.postpartum_visits'::regclass
  ) THEN
    ALTER TABLE public.postpartum_visits
      ADD CONSTRAINT postpartum_visits_performed_by_fkey
      FOREIGN KEY (performed_by) REFERENCES public.staff_profiles(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'postpartum_visits_personnel_present_fkey'
      AND conrelid = 'public.postpartum_visits'::regclass
  ) THEN
    ALTER TABLE public.postpartum_visits
      ADD CONSTRAINT postpartum_visits_personnel_present_fkey
      FOREIGN KEY (personnel_present) REFERENCES public.staff_profiles(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'postpartum_visits_station_ass_fkey'
      AND conrelid = 'public.postpartum_visits'::regclass
  ) THEN
    ALTER TABLE public.postpartum_visits
      ADD CONSTRAINT postpartum_visits_station_ass_fkey
      FOREIGN KEY (station_ass) REFERENCES public.stations(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'postpartum_visits_created_by_fkey'
      AND conrelid = 'public.postpartum_visits'::regclass
  ) THEN
    ALTER TABLE public.postpartum_visits
      ADD CONSTRAINT postpartum_visits_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'postpartum_visits_visit_type_check'
      AND conrelid = 'public.postpartum_visits'::regclass
  ) THEN
    ALTER TABLE public.postpartum_visits
      ADD CONSTRAINT postpartum_visits_visit_type_check
      CHECK (visit_type IN (
        '24 hours after birth',
        '3 days after birth',
        '7 days after birth',
        '6 weeks after birth'
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'postpartum_visits_status_check'
      AND conrelid = 'public.postpartum_visits'::regclass
  ) THEN
    ALTER TABLE public.postpartum_visits
      ADD CONSTRAINT postpartum_visits_status_check
      CHECK (status IN ('Scheduled', 'Completed', 'Missed', 'Cancelled'));
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS postpartum_visits_delivery_type_uidx
  ON public.postpartum_visits (delivery_id, visit_type);

CREATE INDEX IF NOT EXISTS postpartum_visits_patient_schedule_idx
  ON public.postpartum_visits (patient_id, scheduled_at);

CREATE OR REPLACE FUNCTION public.is_latest_prenatal_staff_for_patient(
  p_patient_id UUID,
  p_staff_id UUID
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
  SELECT p_staff_id IS NOT NULL
    AND p_staff_id = (
      SELECT v.assigned_staff
      FROM public.prenatal_visits v
      WHERE v.patient_id = p_patient_id
        AND v.assigned_staff IS NOT NULL
      ORDER BY (v.status = 'Scheduled') DESC, v.visit_date DESC NULLS LAST, v.created_at DESC NULLS LAST
      LIMIT 1
    );
$$;

CREATE OR REPLACE FUNCTION public.create_postpartum_visits_for_delivery()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
DECLARE
  v_birth_at TIMESTAMPTZ;
  v_assigned_staff UUID;
BEGIN
  v_birth_at := (
    (NEW.delivery_date + COALESCE(NEW.delivery_time, TIME '00:00'))
    AT TIME ZONE 'Asia/Manila'
  );

  SELECT v.assigned_staff
  INTO v_assigned_staff
  FROM public.prenatal_visits v
  WHERE v.patient_id = NEW.mother_id
    AND v.assigned_staff IS NOT NULL
  ORDER BY (v.status = 'Scheduled') DESC, v.visit_date DESC NULLS LAST, v.created_at DESC NULLS LAST
  LIMIT 1;

  INSERT INTO public.postpartum_visits (
    delivery_id,
    patient_id,
    visit_type,
    scheduled_at,
    status,
    assigned_staff,
    station_ass,
    created_by
  )
  VALUES
    (NEW.id, NEW.mother_id, '24 hours after birth', v_birth_at + INTERVAL '24 hours', 'Scheduled', v_assigned_staff, NEW.station_ass, COALESCE(NEW.created_by, NEW.attending_staff)),
    (NEW.id, NEW.mother_id, '3 days after birth', v_birth_at + INTERVAL '3 days', 'Scheduled', v_assigned_staff, NEW.station_ass, COALESCE(NEW.created_by, NEW.attending_staff)),
    (NEW.id, NEW.mother_id, '7 days after birth', v_birth_at + INTERVAL '7 days', 'Scheduled', v_assigned_staff, NEW.station_ass, COALESCE(NEW.created_by, NEW.attending_staff)),
    (NEW.id, NEW.mother_id, '6 weeks after birth', v_birth_at + INTERVAL '6 weeks', 'Scheduled', v_assigned_staff, NEW.station_ass, COALESCE(NEW.created_by, NEW.attending_staff))
  ON CONFLICT (delivery_id, visit_type) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS create_postpartum_visits_after_delivery ON public.deliveries;
CREATE TRIGGER create_postpartum_visits_after_delivery
AFTER INSERT ON public.deliveries
FOR EACH ROW
EXECUTE FUNCTION public.create_postpartum_visits_for_delivery();

ALTER TABLE public.postpartum_visits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.postpartum_visits FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.postpartum_visits TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_station() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_latest_prenatal_staff_for_patient(UUID, UUID) TO authenticated;

DROP POLICY IF EXISTS postpartum_visits_read ON public.postpartum_visits;
DROP POLICY IF EXISTS postpartum_visits_insert ON public.postpartum_visits;
DROP POLICY IF EXISTS postpartum_visits_update ON public.postpartum_visits;

CREATE POLICY postpartum_visits_read ON public.postpartum_visits
  FOR SELECT TO authenticated
  USING (
    patient_id = auth.uid()
    OR public.get_my_role() = 'admin'
    OR (
      public.get_my_role() IN ('cho personnel', 'staff')
      AND station_ass IS NOT DISTINCT FROM public.get_my_station()
    )
  );

CREATE POLICY postpartum_visits_insert ON public.postpartum_visits
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.deliveries d
      WHERE d.id = delivery_id
        AND d.mother_id = patient_id
    )
    AND (assigned_staff IS NULL OR public.is_latest_prenatal_staff_for_patient(patient_id, assigned_staff))
    AND (performed_by IS NULL OR performed_by = auth.uid())
    AND (
      (
        patient_id = auth.uid()
        AND created_by = auth.uid()
      )
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
    )
    AND (assigned_staff IS NULL OR public.is_latest_prenatal_staff_for_patient(patient_id, assigned_staff))
    AND (performed_by IS NULL OR performed_by = auth.uid())
    AND (
      public.get_my_role() = 'admin'
      OR (
        public.get_my_role() IN ('cho personnel', 'staff')
        AND station_ass IS NOT DISTINCT FROM public.get_my_station()
      )
    )
  );
