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
    'totalNewborns', (
      SELECT COUNT(*)
      FROM public.newborns AS newborn
      WHERE newborn.mother_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM archived_patients AS archived
          WHERE archived.id = newborn.mother_id
        )
    ),
    'trimesterDist', JSONB_BUILD_ARRAY(
      JSONB_BUILD_OBJECT('label', '1st Trimester', 'count', trimester_summary.first_trimester, 'color', 'tri1'),
      JSONB_BUILD_OBJECT('label', '2nd Trimester', 'count', trimester_summary.second_trimester, 'color', 'tri2'),
      JSONB_BUILD_OBJECT('label', '3rd Trimester', 'count', trimester_summary.third_trimester, 'color', 'tri3')
    )
  )
  FROM trimester_summary;
$$;

CREATE OR REPLACE FUNCTION public.get_dashboard_newborn_count()
RETURNS BIGINT
LANGUAGE SQL
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
  SELECT COUNT(*)
  FROM public.newborns AS newborn
  WHERE newborn.mother_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.users AS archived
      WHERE archived.id = newborn.mother_id
        AND archived.is_archived IS TRUE
    );
$$;

REVOKE ALL ON FUNCTION public.get_dashboard_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_overview() TO authenticated;
REVOKE ALL ON FUNCTION public.get_dashboard_newborn_count() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_newborn_count() TO authenticated;
