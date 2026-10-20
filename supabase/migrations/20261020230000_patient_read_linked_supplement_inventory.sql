DROP POLICY IF EXISTS role_permission_main_supplement_select ON public.supplement_inventory;
CREATE POLICY role_permission_main_supplement_select
  ON public.supplement_inventory AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    public.has_permission('inventory.main.view')
    OR public.has_permission('inventory.main.stock.add')
    OR public.has_permission('inventory.main.distribute.to_stations')
    OR (
      public.get_my_role() IN ('mother', 'patient')
      AND EXISTS (
        SELECT 1
        FROM public.supplements AS s
        WHERE s.supplement_inventory_id = supplement_inventory.id
          AND s.patient_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS patient_read_linked_supplement_inventory ON public.supplement_inventory;
CREATE POLICY patient_read_linked_supplement_inventory
  ON public.supplement_inventory FOR SELECT TO authenticated
  USING (
    public.get_my_role() IN ('mother', 'patient')
    AND EXISTS (
      SELECT 1
      FROM public.supplements AS s
      WHERE s.supplement_inventory_id = supplement_inventory.id
        AND s.patient_id = auth.uid()
    )
  );
