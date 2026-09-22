-- Keep Click Split realtime subscriptions and authenticated expense editing functional.
-- Applied to the shared Click Supabase project as migration 20260922164817.

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'split_groups',
    'split_group_members',
    'split_expenses',
    'split_expense_items',
    'split_expense_shares',
    'split_settlements'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = table_name
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', table_name);
    END IF;
  END LOOP;
END
$$;

DROP POLICY IF EXISTS split_expense_items_delete ON public.split_expense_items;
CREATE POLICY split_expense_items_delete
ON public.split_expense_items
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.split_expenses e
    WHERE e.id = split_expense_items.expense_id
      AND public.is_split_group_member(e.group_id)
  )
);

DROP POLICY IF EXISTS split_expense_shares_delete ON public.split_expense_shares;
CREATE POLICY split_expense_shares_delete
ON public.split_expense_shares
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.split_expenses e
    WHERE e.id = split_expense_shares.expense_id
      AND public.is_split_group_member(e.group_id)
  )
);

DROP POLICY IF EXISTS split_expenses_update ON public.split_expenses;
CREATE POLICY split_expenses_update
ON public.split_expenses
FOR UPDATE
TO authenticated
USING (public.is_split_group_member(group_id))
WITH CHECK (public.is_split_group_member(group_id));
