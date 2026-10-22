CREATE OR REPLACE FUNCTION public.get_public_landing_stats()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'mothers', (SELECT count(*) FROM public.patient_basic_info),
    'vaccinations', (SELECT count(*) FROM public.vaccinations),
    'stations', (SELECT count(*) FROM public.stations),
    'deliveries', (SELECT count(*) FROM public.deliveries)
  );
$$;

REVOKE ALL ON FUNCTION public.get_public_landing_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_landing_stats() TO anon, authenticated;
