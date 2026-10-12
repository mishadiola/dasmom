WITH ordered_visits AS (
  SELECT
    visit.id,
    ROW_NUMBER() OVER (
      PARTITION BY visit.patient_id
      ORDER BY visit.visit_date ASC, visit.created_at ASC, visit.id ASC
    ) AS corrected_visit_number
  FROM public.prenatal_visits AS visit
)
UPDATE public.prenatal_visits AS visit
SET visit_number = ordered.corrected_visit_number
FROM ordered_visits AS ordered
WHERE visit.id = ordered.id
  AND visit.visit_number IS DISTINCT FROM ordered.corrected_visit_number;
