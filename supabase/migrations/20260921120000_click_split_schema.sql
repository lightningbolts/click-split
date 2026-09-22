-- Click Split schema - additive-only, safe to run on the shared Click Supabase project.
-- All tables are namespaced with `split_` to avoid collisions.

SET search_path = public, extensions, pg_temp;

-- ────────────────── Tables ──────────────────

CREATE TABLE IF NOT EXISTS public.split_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  icon TEXT,  -- emoji or icon key
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.split_group_members (
  group_id UUID NOT NULL REFERENCES public.split_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.split_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.split_groups(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  total_amount NUMERIC(10,2) NOT NULL,
  paid_by UUID NOT NULL REFERENCES auth.users(id),
  split_method TEXT NOT NULL DEFAULT 'even',  -- 'even' | 'by_item' | 'custom_percent'
  source TEXT NOT NULL DEFAULT 'manual',       -- 'manual' | 'receipt_scan'
  receipt_image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.split_expense_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID NOT NULL REFERENCES public.split_expenses(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  assigned_to UUID REFERENCES auth.users(id)  -- NULL = split evenly
);

CREATE TABLE IF NOT EXISTS public.split_expense_shares (
  expense_id UUID NOT NULL REFERENCES public.split_expenses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  share_amount NUMERIC(10,2) NOT NULL,
  PRIMARY KEY (expense_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.split_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.split_groups(id) ON DELETE CASCADE,
  from_user UUID NOT NULL REFERENCES auth.users(id),  -- who paid
  to_user UUID NOT NULL REFERENCES auth.users(id),    -- who received
  amount NUMERIC(10,2) NOT NULL,
  method TEXT,  -- 'venmo' | 'zelle' | 'cash'
  settled_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ────────────────── Indexes ──────────────────

CREATE INDEX IF NOT EXISTS idx_split_group_members_user ON public.split_group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_split_expenses_group ON public.split_expenses(group_id);
CREATE INDEX IF NOT EXISTS idx_split_expenses_created ON public.split_expenses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_split_expense_items_expense ON public.split_expense_items(expense_id);
CREATE INDEX IF NOT EXISTS idx_split_expense_shares_user ON public.split_expense_shares(user_id);
CREATE INDEX IF NOT EXISTS idx_split_settlements_group ON public.split_settlements(group_id);

-- ────────────────── RLS Policies ──────────────────

ALTER TABLE public.split_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.split_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.split_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.split_expense_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.split_expense_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.split_settlements ENABLE ROW LEVEL SECURITY;

-- Helper: is the current user a member of the given group?
CREATE OR REPLACE FUNCTION public.is_split_group_member(gid UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.split_group_members
    WHERE group_id = gid AND user_id = auth.uid()
  );
$$;

-- split_groups: viewable/insertable by members (creator auto-joins)
DO $$ BEGIN
  DROP POLICY IF EXISTS split_groups_select ON public.split_groups;
  CREATE POLICY split_groups_select ON public.split_groups FOR SELECT
    USING (public.is_split_group_member(id) OR created_by = auth.uid());
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS split_groups_insert ON public.split_groups;
  CREATE POLICY split_groups_insert ON public.split_groups FOR INSERT
    WITH CHECK (created_by = auth.uid());
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS split_groups_update ON public.split_groups;
  CREATE POLICY split_groups_update ON public.split_groups FOR UPDATE
    USING (public.is_split_group_member(id) OR created_by = auth.uid());
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS split_groups_delete ON public.split_groups;
  CREATE POLICY split_groups_delete ON public.split_groups FOR DELETE
    USING (created_by = auth.uid());
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- split_group_members: viewable by fellow members, joinable by invite
DO $$ BEGIN
  DROP POLICY IF EXISTS split_group_members_select ON public.split_group_members;
  CREATE POLICY split_group_members_select ON public.split_group_members FOR SELECT
    USING (user_id = auth.uid() OR public.is_split_group_member(group_id));
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS split_group_members_insert ON public.split_group_members;
  CREATE POLICY split_group_members_insert ON public.split_group_members FOR INSERT
    WITH CHECK (public.is_split_group_member(group_id) OR user_id = auth.uid());
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS split_group_members_delete ON public.split_group_members;
  CREATE POLICY split_group_members_delete ON public.split_group_members FOR DELETE
    USING (user_id = auth.uid() OR public.is_split_group_member(group_id));
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- split_expenses: CRUD for group members
DO $$ BEGIN
  DROP POLICY IF EXISTS split_expenses_select ON public.split_expenses;
  CREATE POLICY split_expenses_select ON public.split_expenses FOR SELECT
    USING (public.is_split_group_member(group_id));
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS split_expenses_insert ON public.split_expenses;
  CREATE POLICY split_expenses_insert ON public.split_expenses FOR INSERT
    WITH CHECK (public.is_split_group_member(group_id));
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS split_expenses_update ON public.split_expenses;
  CREATE POLICY split_expenses_update ON public.split_expenses FOR UPDATE
    USING (public.is_split_group_member(group_id));
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS split_expenses_delete ON public.split_expenses;
  CREATE POLICY split_expenses_delete ON public.split_expenses FOR DELETE
    USING (public.is_split_group_member(group_id));
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- split_expense_items: inherit from parent expense
DO $$ BEGIN
  DROP POLICY IF EXISTS split_expense_items_select ON public.split_expense_items;
  CREATE POLICY split_expense_items_select ON public.split_expense_items FOR SELECT
    USING (EXISTS (
      SELECT 1 FROM public.split_expenses e
      WHERE e.id = expense_id AND public.is_split_group_member(e.group_id)
    ));
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS split_expense_items_insert ON public.split_expense_items;
  CREATE POLICY split_expense_items_insert ON public.split_expense_items FOR INSERT
    WITH CHECK (EXISTS (
      SELECT 1 FROM public.split_expenses e
      WHERE e.id = expense_id AND public.is_split_group_member(e.group_id)
    ));
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- split_expense_shares: inherit from parent expense
DO $$ BEGIN
  DROP POLICY IF EXISTS split_expense_shares_select ON public.split_expense_shares;
  CREATE POLICY split_expense_shares_select ON public.split_expense_shares FOR SELECT
    USING (EXISTS (
      SELECT 1 FROM public.split_expenses e
      WHERE e.id = expense_id AND public.is_split_group_member(e.group_id)
    ));
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS split_expense_shares_insert ON public.split_expense_shares;
  CREATE POLICY split_expense_shares_insert ON public.split_expense_shares FOR INSERT
    WITH CHECK (EXISTS (
      SELECT 1 FROM public.split_expenses e
      WHERE e.id = expense_id AND public.is_split_group_member(e.group_id)
    ));
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- split_settlements: group members only, either party can record
DO $$ BEGIN
  DROP POLICY IF EXISTS split_settlements_select ON public.split_settlements;
  CREATE POLICY split_settlements_select ON public.split_settlements FOR SELECT
    USING (public.is_split_group_member(group_id));
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS split_settlements_insert ON public.split_settlements;
  CREATE POLICY split_settlements_insert ON public.split_settlements FOR INSERT
    WITH CHECK (public.is_split_group_member(group_id) AND (from_user = auth.uid() OR to_user = auth.uid()));
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- ────────────────── Balance calculation RPC ──────────────────

-- Returns the net balance for a user within a group.
-- Positive = owed to user. Negative = user owes.
CREATE OR REPLACE FUNCTION public.calculate_split_group_balance(
  p_group_id UUID,
  p_user_id UUID
)
RETURNS NUMERIC(10,2)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      -- Money owed to this user (they paid, others owe shares)
      SELECT COALESCE(SUM(ses.share_amount), 0)
      FROM public.split_expense_shares ses
      JOIN public.split_expenses se ON se.id = ses.expense_id
      WHERE se.group_id = p_group_id
        AND se.paid_by = p_user_id
        AND ses.user_id != p_user_id
    )
    -
    (
      -- Money this user owes others (others paid, user owes share)
      SELECT COALESCE(SUM(ses.share_amount), 0)
      FROM public.split_expense_shares ses
      JOIN public.split_expenses se ON se.id = ses.expense_id
      WHERE se.group_id = p_group_id
        AND se.paid_by != p_user_id
        AND ses.user_id = p_user_id
    )
    +
    (
      -- Settlements this user has already paid out (reduces what they owe)
      SELECT COALESCE(SUM(amount), 0)
      FROM public.split_settlements
      WHERE group_id = p_group_id AND from_user = p_user_id
    )
    -
    (
      -- Settlements this user has received (reduces what is owed to them)
      SELECT COALESCE(SUM(amount), 0)
      FROM public.split_settlements
      WHERE group_id = p_group_id AND to_user = p_user_id
    ),
    0
  )::NUMERIC(10,2);
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.calculate_split_group_balance(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_split_group_member(UUID) TO authenticated;
