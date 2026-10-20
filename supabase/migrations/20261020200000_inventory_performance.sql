ALTER TABLE public.vaccine_inventory
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

ALTER TABLE public.supplement_inventory
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

CREATE INDEX IF NOT EXISTS vaccine_inventory_created_at_idx
  ON public.vaccine_inventory (created_at DESC);

CREATE INDEX IF NOT EXISTS supplement_inventory_created_at_idx
  ON public.supplement_inventory (created_at DESC);

CREATE INDEX IF NOT EXISTS station_vaccine_inventory_station_item_idx
  ON public.station_vaccine_inventory (station_id, vaccine_id);

CREATE INDEX IF NOT EXISTS station_supplement_inventory_station_item_idx
  ON public.station_supplement_inventory (station_id, supplement_inventory_id);

CREATE INDEX IF NOT EXISTS vaccine_distribution_station_date_idx
  ON public.vaccine_distribution (station_id, distributed_date DESC);

CREATE INDEX IF NOT EXISTS supplement_distribution_station_date_idx
  ON public.supplement_distribution (station_id, distributed_date DESC);

CREATE INDEX IF NOT EXISTS vaccinations_pending_inventory_idx
  ON public.vaccinations (vaccine_inventory_id)
  WHERE status IN ('Pending', 'Overdue');

CREATE OR REPLACE FUNCTION public.get_inventory_user_scope()
RETURNS TABLE(
  user_id UUID,
  role TEXT,
  station_id UUID,
  station_name TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
SET row_security = off
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_station_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  v_station_id := public.get_my_station();
  RETURN QUERY
  SELECT
    v_user_id,
    COALESCE(public.get_my_role(), 'user')::TEXT,
    v_station_id,
    st.station_name::TEXT
  FROM (SELECT 1) AS singleton
  LEFT JOIN public.stations AS st ON st.id = v_station_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_inventory_user_scope() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_inventory_user_scope() TO authenticated;

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
  v_station_id UUID;
  v_role TEXT := public.get_my_role();
  v_can_view_all BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'An authenticated user is required';
  END IF;

  v_can_view_all := COALESCE(
    v_role = 'admin' OR public.has_permission('inventory.station.view.other_station'),
    FALSE
  );

  IF p_station_id IS NULL THEN
    v_station_id := CASE
      WHEN v_can_view_all THEN NULL
      ELSE public.get_my_station()
    END;
  ELSE
    v_station_id := p_station_id;
  END IF;

  IF v_station_id IS NULL AND NOT v_can_view_all THEN
    RAISE EXCEPTION 'A station is required to view inventory';
  END IF;

  IF v_station_id IS NOT NULL
    AND COALESCE(v_role, '') <> 'admin'
    AND NOT public.has_station_permission(
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
  WHERE v_station_id IS NULL OR svi.station_id = v_station_id

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
  WHERE v_station_id IS NULL OR ssi.station_id = v_station_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_station_inventory_catalog(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_station_inventory_catalog(UUID) TO authenticated;
