ALTER TABLE public.vaccinations
  ADD COLUMN IF NOT EXISTS delivery_id UUID
    REFERENCES public.deliveries(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS vaccinations_delivery_dose_unique_idx
  ON public.vaccinations (delivery_id, dose_number);

CREATE OR REPLACE FUNCTION public.create_maternal_tetanus_schedule_for_delivery()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
DECLARE
  v_assigned_staff UUID;
  v_tt1_date DATE;
  v_tt2_date DATE;
  v_tt3_date DATE;
  v_tt4_date DATE;
BEGIN
  v_tt1_date := (NEW.delivery_date + INTERVAL '1 month')::DATE;
  v_tt2_date := (NEW.delivery_date + INTERVAL '6 months')::DATE;
  v_tt3_date := (v_tt2_date + INTERVAL '6 months')::DATE;
  v_tt4_date := (v_tt3_date + INTERVAL '1 year')::DATE;

  SELECT v.assigned_staff
  INTO v_assigned_staff
  FROM public.prenatal_visits v
  WHERE v.patient_id = NEW.mother_id
    AND v.assigned_staff IS NOT NULL
  ORDER BY (v.status = 'Scheduled') DESC, v.visit_date DESC NULLS LAST, v.created_at DESC NULLS LAST
  LIMIT 1;

  INSERT INTO public.vaccinations (
    patient_id,
    newborn_id,
    delivery_id,
    dose_number,
    scheduled_vaccination,
    vaccinated_date,
    status,
    assigned_staff,
    station_ass,
    created_by,
    notes
  )
  VALUES
    (NEW.mother_id, NULL, NEW.id, 1, v_tt1_date, NULL, 'Pending', v_assigned_staff, NEW.station_ass, COALESCE(NEW.created_by, NEW.attending_staff), 'Maternal Tetanus Toxoid (TT1)'),
    (NEW.mother_id, NULL, NEW.id, 2, v_tt2_date, NULL, 'Pending', v_assigned_staff, NEW.station_ass, COALESCE(NEW.created_by, NEW.attending_staff), 'Maternal Tetanus Toxoid (TT2)'),
    (NEW.mother_id, NULL, NEW.id, 3, v_tt3_date, NULL, 'Pending', v_assigned_staff, NEW.station_ass, COALESCE(NEW.created_by, NEW.attending_staff), 'Maternal Tetanus Toxoid (TT3)'),
    (NEW.mother_id, NULL, NEW.id, 4, v_tt4_date, NULL, 'Pending', v_assigned_staff, NEW.station_ass, COALESCE(NEW.created_by, NEW.attending_staff), 'Maternal Tetanus Toxoid (TT4)')
  ON CONFLICT (delivery_id, dose_number) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS create_maternal_tetanus_schedule_after_delivery ON public.deliveries;
CREATE TRIGGER create_maternal_tetanus_schedule_after_delivery
AFTER INSERT ON public.deliveries
FOR EACH ROW
EXECUTE FUNCTION public.create_maternal_tetanus_schedule_for_delivery();

WITH delivery_schedules AS (
  SELECT
    d.id AS delivery_id,
    d.mother_id AS patient_id,
    d.station_ass,
    COALESCE(d.created_by, d.attending_staff) AS created_by,
    (d.delivery_date + INTERVAL '1 month')::DATE AS tt1_date,
    (d.delivery_date + INTERVAL '6 months')::DATE AS tt2_date,
    ((d.delivery_date + INTERVAL '6 months')::DATE + INTERVAL '6 months')::DATE AS tt3_date,
    (((d.delivery_date + INTERVAL '6 months')::DATE + INTERVAL '6 months')::DATE + INTERVAL '1 year')::DATE AS tt4_date,
    assignment.assigned_staff
  FROM public.deliveries d
  LEFT JOIN LATERAL (
    SELECT v.assigned_staff
    FROM public.prenatal_visits v
    WHERE v.patient_id = d.mother_id
      AND v.assigned_staff IS NOT NULL
    ORDER BY (v.status = 'Scheduled') DESC, v.visit_date DESC NULLS LAST, v.created_at DESC NULLS LAST
    LIMIT 1
  ) assignment ON TRUE
  WHERE d.delivery_date IS NOT NULL
),
scheduled_doses AS (
  SELECT
    delivery_id,
    patient_id,
    station_ass,
    created_by,
    assigned_staff,
    dose.dose_number,
    dose.scheduled_date,
    dose.notes
  FROM delivery_schedules
  CROSS JOIN LATERAL (VALUES
    (1, tt1_date, 'Maternal Tetanus Toxoid (TT1)'),
    (2, tt2_date, 'Maternal Tetanus Toxoid (TT2)'),
    (3, tt3_date, 'Maternal Tetanus Toxoid (TT3)'),
    (4, tt4_date, 'Maternal Tetanus Toxoid (TT4)')
  ) AS dose(dose_number, scheduled_date, notes)
)
INSERT INTO public.vaccinations (
  patient_id,
  newborn_id,
  delivery_id,
  dose_number,
  scheduled_vaccination,
  vaccinated_date,
  status,
  assigned_staff,
  station_ass,
  created_by,
  notes
)
SELECT
  dose.patient_id,
  NULL,
  dose.delivery_id,
  dose.dose_number,
  dose.scheduled_date,
  NULL,
  'Pending',
  dose.assigned_staff,
  dose.station_ass,
  dose.created_by,
  dose.notes
FROM scheduled_doses dose
WHERE NOT EXISTS (
  SELECT 1
  FROM public.vaccinations existing
  WHERE existing.delivery_id = dose.delivery_id
    AND existing.dose_number = dose.dose_number
)
ON CONFLICT (delivery_id, dose_number) DO NOTHING;
