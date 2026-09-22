-- Restrict Click Split member administration to the group creator while
-- preserving self-join/self-leave used by invite links.

DROP POLICY IF EXISTS split_group_members_insert ON public.split_group_members;
CREATE POLICY split_group_members_insert
  ON public.split_group_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    OR EXISTS (
      SELECT 1
      FROM public.split_groups g
      WHERE g.id = group_id
        AND g.created_by = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS split_group_members_delete ON public.split_group_members;
CREATE POLICY split_group_members_delete
  ON public.split_group_members
  FOR DELETE
  TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    OR EXISTS (
      SELECT 1
      FROM public.split_groups g
      WHERE g.id = group_id
        AND g.created_by = (SELECT auth.uid())
    )
  );
