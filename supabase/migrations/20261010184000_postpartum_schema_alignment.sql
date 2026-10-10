ALTER TABLE public.postpartum_visits
  ADD COLUMN IF NOT EXISTS visit_number INTEGER,
  ADD COLUMN IF NOT EXISTS scheduled_date DATE,
  ADD COLUMN IF NOT EXISTS missed_reason TEXT,
  ADD COLUMN IF NOT EXISTS assigned_station UUID,
  ADD COLUMN IF NOT EXISTS bp_systolic INTEGER,
  ADD COLUMN IF NOT EXISTS bp_diastolic INTEGER,
  ADD COLUMN IF NOT EXISTS weight_kg NUMERIC,
  ADD COLUMN IF NOT EXISTS temp_c NUMERIC,
  ADD COLUMN IF NOT EXISTS pulse_bpm INTEGER,
  ADD COLUMN IF NOT EXISTS resp_rate_cpm INTEGER,
  ADD COLUMN IF NOT EXISTS uterine_involution TEXT,
  ADD COLUMN IF NOT EXISTS lochia_assessment TEXT,
  ADD COLUMN IF NOT EXISTS perineal_or_wound_condition TEXT,
  ADD COLUMN IF NOT EXISTS pain_assessment TEXT,
  ADD COLUMN IF NOT EXISTS breast_assessment TEXT,
  ADD COLUMN IF NOT EXISTS breastfeeding_status TEXT,
  ADD COLUMN IF NOT EXISTS urination_and_bowel_status TEXT,
  ADD COLUMN IF NOT EXISTS mental_health_assessment TEXT,
  ADD COLUMN IF NOT EXISTS danger_signs TEXT[],
  ADD COLUMN IF NOT EXISTS clinical_notes TEXT,
  ADD COLUMN IF NOT EXISTS advice_given TEXT,
  ADD COLUMN IF NOT EXISTS treatments_given TEXT,
  ADD COLUMN IF NOT EXISTS medications_review TEXT,
  ADD COLUMN IF NOT EXISTS family_planning_counseling TEXT,
  ADD COLUMN IF NOT EXISTS is_referred BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS referred_to TEXT,
  ADD COLUMN IF NOT EXISTS referral_reason TEXT,
  ADD COLUMN IF NOT EXISTS next_appt_date DATE,
  ADD COLUMN IF NOT EXISTS next_appt_type TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE public.postpartum_visits
SET visit_number = COALESCE(
      visit_number,
      CASE visit_type
        WHEN '24 hours after birth' THEN 1
        WHEN '3 days after birth' THEN 2
        WHEN '7 days after birth' THEN 3
        WHEN '6 weeks after birth' THEN 4
      END
    ),
    scheduled_date = COALESCE(
      scheduled_date,
      (scheduled_at AT TIME ZONE 'Asia/Manila')::DATE
    );

ALTER TABLE public.postpartum_visits
  ALTER COLUMN visit_number SET NOT NULL,
  ALTER COLUMN scheduled_date SET NOT NULL;

ALTER TABLE public.postpartum_visits
  DROP CONSTRAINT IF EXISTS postpartum_visits_created_by_fkey,
  DROP CONSTRAINT IF EXISTS postpartum_visits_status_check,
  DROP CONSTRAINT IF EXISTS postpartum_visits_visit_number_check,
  DROP CONSTRAINT IF EXISTS postpartum_visits_assigned_station_fkey;

ALTER TABLE public.postpartum_visits
  ADD CONSTRAINT postpartum_visits_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.staff_profiles(id),
  ADD CONSTRAINT postpartum_visits_status_check
    CHECK (status IN ('Scheduled', 'Attended', 'Missed', 'Cancelled')),
  ADD CONSTRAINT postpartum_visits_visit_number_check
    CHECK (visit_number > 0),
  ADD CONSTRAINT postpartum_visits_assigned_station_fkey
    FOREIGN KEY (assigned_station) REFERENCES public.stations(id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'postpartum_visits_bp_systolic_check' AND conrelid = 'public.postpartum_visits'::regclass) THEN
    ALTER TABLE public.postpartum_visits ADD CONSTRAINT postpartum_visits_bp_systolic_check CHECK (bp_systolic IS NULL OR bp_systolic > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'postpartum_visits_bp_diastolic_check' AND conrelid = 'public.postpartum_visits'::regclass) THEN
    ALTER TABLE public.postpartum_visits ADD CONSTRAINT postpartum_visits_bp_diastolic_check CHECK (bp_diastolic IS NULL OR bp_diastolic > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'postpartum_visits_pulse_check' AND conrelid = 'public.postpartum_visits'::regclass) THEN
    ALTER TABLE public.postpartum_visits ADD CONSTRAINT postpartum_visits_pulse_check CHECK (pulse_bpm IS NULL OR pulse_bpm > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'postpartum_visits_resp_rate_check' AND conrelid = 'public.postpartum_visits'::regclass) THEN
    ALTER TABLE public.postpartum_visits ADD CONSTRAINT postpartum_visits_resp_rate_check CHECK (resp_rate_cpm IS NULL OR resp_rate_cpm > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'postpartum_visits_weight_check' AND conrelid = 'public.postpartum_visits'::regclass) THEN
    ALTER TABLE public.postpartum_visits ADD CONSTRAINT postpartum_visits_weight_check CHECK (weight_kg IS NULL OR weight_kg > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'postpartum_visits_temperature_check' AND conrelid = 'public.postpartum_visits'::regclass) THEN
    ALTER TABLE public.postpartum_visits ADD CONSTRAINT postpartum_visits_temperature_check CHECK (temp_c IS NULL OR temp_c > 0);
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'postpartum_visits_delivery_visit_unique'
      AND conrelid = 'public.postpartum_visits'::regclass
  ) THEN
    ALTER TABLE public.postpartum_visits
      ADD CONSTRAINT postpartum_visits_delivery_visit_unique
      UNIQUE (delivery_id, visit_number);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS postpartum_visits_delivery_id_idx
  ON public.postpartum_visits (delivery_id);
CREATE INDEX IF NOT EXISTS postpartum_visits_patient_id_idx
  ON public.postpartum_visits (patient_id);
CREATE INDEX IF NOT EXISTS postpartum_visits_scheduled_date_idx
  ON public.postpartum_visits (scheduled_date);
CREATE INDEX IF NOT EXISTS postpartum_visits_assigned_staff_idx
  ON public.postpartum_visits (assigned_staff);
CREATE INDEX IF NOT EXISTS postpartum_visits_assigned_station_idx
  ON public.postpartum_visits (assigned_station);
CREATE INDEX IF NOT EXISTS postpartum_visits_station_ass_idx
  ON public.postpartum_visits (station_ass);
CREATE INDEX IF NOT EXISTS postpartum_visits_status_idx
  ON public.postpartum_visits (status);

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
    visit_number,
    scheduled_date,
    visit_type,
    scheduled_at,
    status,
    assigned_staff,
    assigned_station,
    station_ass,
    created_by
  )
  VALUES
    (NEW.id, NEW.mother_id, 1, ((v_birth_at + INTERVAL '24 hours') AT TIME ZONE 'Asia/Manila')::DATE, '24 hours after birth', v_birth_at + INTERVAL '24 hours', 'Scheduled', v_assigned_staff, NEW.station_ass, NEW.station_ass, COALESCE(NEW.created_by, NEW.attending_staff)),
    (NEW.id, NEW.mother_id, 2, ((v_birth_at + INTERVAL '3 days') AT TIME ZONE 'Asia/Manila')::DATE, '3 days after birth', v_birth_at + INTERVAL '3 days', 'Scheduled', v_assigned_staff, NEW.station_ass, NEW.station_ass, COALESCE(NEW.created_by, NEW.attending_staff)),
    (NEW.id, NEW.mother_id, 3, ((v_birth_at + INTERVAL '7 days') AT TIME ZONE 'Asia/Manila')::DATE, '7 days after birth', v_birth_at + INTERVAL '7 days', 'Scheduled', v_assigned_staff, NEW.station_ass, NEW.station_ass, COALESCE(NEW.created_by, NEW.attending_staff)),
    (NEW.id, NEW.mother_id, 4, ((v_birth_at + INTERVAL '6 weeks') AT TIME ZONE 'Asia/Manila')::DATE, '6 weeks after birth', v_birth_at + INTERVAL '6 weeks', 'Scheduled', v_assigned_staff, NEW.station_ass, NEW.station_ass, COALESCE(NEW.created_by, NEW.attending_staff))
  ON CONFLICT (delivery_id, visit_type) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS create_postpartum_visits_after_delivery ON public.deliveries;
CREATE TRIGGER create_postpartum_visits_after_delivery
AFTER INSERT ON public.deliveries
FOR EACH ROW
EXECUTE FUNCTION public.create_postpartum_visits_for_delivery();

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
      (
        patient_id = auth.uid()
        AND created_by IS NULL
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

GRANT INSERT, UPDATE ON public.postpartum_visits TO authenticated;
