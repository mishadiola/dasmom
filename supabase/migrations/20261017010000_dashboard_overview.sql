CREATE INDEX IF NOT EXISTS pregnancy_info_patient_created_at_idx
  ON public.pregnancy_info (patient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS prenatal_visits_attended_patient_date_idx
  ON public.prenatal_visits (patient_id, visit_date DESC)
  WHERE status = 'Attended';

CREATE INDEX IF NOT EXISTS deliveries_mother_id_idx
  ON public.deliveries (mother_id);

CREATE INDEX IF NOT EXISTS newborns_mother_id_idx
  ON public.newborns (mother_id);

CREATE OR REPLACE FUNCTION public.get_dashboard_overview()
RETURNS JSONB
LANGUAGE SQL
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
  WITH archived_patients AS (
    SELECT u.id
    FROM public.users AS u
    WHERE u.is_archived IS TRUE
  ),
  latest_pregnancies AS (
    SELECT DISTINCT ON (p.patient_id)
      p.patient_id,
      p.pregn_postp,
      p.lmd,
      p.created_at
    FROM public.pregnancy_info AS p
    WHERE p.patient_id IS NOT NULL
    ORDER BY p.patient_id, p.created_at DESC NULLS LAST
  ),
  active_pregnancies AS (
    SELECT p.patient_id, p.lmd
    FROM latest_pregnancies AS p
    WHERE LOWER(p.pregn_postp) = 'pregnant'
      AND NOT EXISTS (
        SELECT 1 FROM archived_patients AS a WHERE a.id = p.patient_id
      )
      AND EXISTS (
        SELECT 1 FROM public.patient_basic_info AS patient
        WHERE patient.id = p.patient_id
      )
  ),
  latest_attended_visits AS (
    SELECT DISTINCT ON (v.patient_id)
      v.patient_id,
      v.risk_factors
    FROM public.prenatal_visits AS v
    INNER JOIN public.patient_basic_info AS patient
      ON patient.id = v.patient_id
    WHERE v.patient_id IS NOT NULL
      AND v.status = 'Attended'
    ORDER BY v.patient_id, v.visit_date DESC NULLS LAST
  ),
  eligible_high_risk_patients AS (
    SELECT p.patient_id, v.risk_factors
    FROM latest_pregnancies AS p
    INNER JOIN latest_attended_visits AS v
      ON v.patient_id = p.patient_id
    WHERE LOWER(p.pregn_postp) = 'pregnant'
      AND NOT EXISTS (
        SELECT 1 FROM archived_patients AS a WHERE a.id = p.patient_id
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.deliveries AS d WHERE d.mother_id = p.patient_id
      )
  ),
  visit_summary AS (
    SELECT
      COUNT(*) AS total_visits,
      COUNT(*) FILTER (
        WHERE v.bp_systolic IS NOT NULL
          AND v.bp_diastolic IS NOT NULL
          AND v.bp_systolic < 140
          AND v.bp_diastolic < 90
      ) AS normal_bp,
      COUNT(*) FILTER (
        WHERE v.bp_systolic IS NOT NULL
          AND v.bp_diastolic IS NOT NULL
          AND (v.bp_systolic >= 140 OR v.bp_diastolic >= 90)
      ) AS pre_eclampsia,
      COUNT(*) FILTER (
        WHERE EXISTS (
          SELECT 1
          FROM regexp_split_to_table(
            TRIM(BOTH '[]' FROM REPLACE(COALESCE(v.risk_factors::TEXT, ''), '"', '')),
            ','
          ) AS factors(value)
          WHERE LOWER(BTRIM(value)) IN ('anemia', 'anaemia')
        )
      ) AS anaemia,
      COUNT(*) FILTER (
        WHERE EXISTS (
          SELECT 1
          FROM regexp_split_to_table(
            TRIM(BOTH '[]' FROM REPLACE(COALESCE(v.risk_factors::TEXT, ''), '"', '')),
            ','
          ) AS factors(value)
          WHERE LOWER(BTRIM(value)) IN ('gestational diabetes', 'diabetes')
        )
      ) AS gestational_diabetes
    FROM public.prenatal_visits AS v
    WHERE NOT EXISTS (
      SELECT 1 FROM archived_patients AS a WHERE a.id = v.patient_id
    )
  ),
  trimester_summary AS (
    SELECT
      COUNT(*) FILTER (
        WHERE lmd IS NOT NULL
          AND FLOOR((CURRENT_DATE - lmd)::NUMERIC / 7) <= 12
      ) AS first_trimester,
      COUNT(*) FILTER (
        WHERE lmd IS NOT NULL
          AND FLOOR((CURRENT_DATE - lmd)::NUMERIC / 7) > 12
          AND FLOOR((CURRENT_DATE - lmd)::NUMERIC / 7) <= 26
      ) AS second_trimester,
      COUNT(*) FILTER (
        WHERE lmd IS NOT NULL
          AND FLOOR((CURRENT_DATE - lmd)::NUMERIC / 7) > 26
      ) AS third_trimester
    FROM active_pregnancies
  )
  SELECT JSONB_BUILD_OBJECT(
    'totalPatients', (SELECT COUNT(*) FROM active_pregnancies),
    'archivedPatientIds', COALESCE((
      SELECT JSONB_AGG(id) FROM archived_patients
    ), '[]'::JSONB),
    'totalNewborns', (
      SELECT COUNT(*)
      FROM public.newborns AS n
      WHERE n.mother_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM archived_patients AS a WHERE a.id = n.mother_id
        )
    ),
    'highRiskPatients', COALESCE((
      SELECT JSONB_AGG(JSONB_BUILD_OBJECT('id', patient_id, 'risk_factors', risk_factors))
      FROM eligible_high_risk_patients
    ), '[]'::JSONB),
    'conditions', JSONB_BUILD_ARRAY(
      JSONB_BUILD_OBJECT(
        'label', 'Normal BP',
        'pct', CASE WHEN visit_summary.total_visits > 0
          THEN ROUND(visit_summary.normal_bp * 100.0 / visit_summary.total_visits)
          ELSE 0 END,
        'color', 'sage'
      ),
      JSONB_BUILD_OBJECT(
        'label', 'Pre-eclampsia',
        'pct', CASE WHEN visit_summary.total_visits > 0
          THEN ROUND(visit_summary.pre_eclampsia * 100.0 / visit_summary.total_visits)
          ELSE 0 END,
        'color', 'rose'
      ),
      JSONB_BUILD_OBJECT(
        'label', 'Anaemia',
        'pct', CASE WHEN visit_summary.total_visits > 0
          THEN ROUND(visit_summary.anaemia * 100.0 / visit_summary.total_visits)
          ELSE 0 END,
        'color', 'orange'
      ),
      JSONB_BUILD_OBJECT(
        'label', 'Gestational Diabetes',
        'pct', CASE WHEN visit_summary.total_visits > 0
          THEN ROUND(visit_summary.gestational_diabetes * 100.0 / visit_summary.total_visits)
          ELSE 0 END,
        'color', 'yellow'
      )
    ),
    'trimesterDist', JSONB_BUILD_ARRAY(
      JSONB_BUILD_OBJECT('label', '1st Trimester', 'count', trimester_summary.first_trimester, 'color', 'tri1'),
      JSONB_BUILD_OBJECT('label', '2nd Trimester', 'count', trimester_summary.second_trimester, 'color', 'tri2'),
      JSONB_BUILD_OBJECT('label', '3rd Trimester', 'count', trimester_summary.third_trimester, 'color', 'tri3')
    )
  )
  FROM visit_summary, trimester_summary;
$$;

REVOKE ALL ON FUNCTION public.get_dashboard_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_overview() TO authenticated;
