-- Migration: Atomic Expense Creation & Share Computation RPC
-- Resolves partial state failures by executing expense + items + shares in a single ACID transaction.

SET search_path = public, extensions, pg_temp;

CREATE OR REPLACE FUNCTION public.create_split_expense_transaction(
  p_group_id UUID,
  p_description TEXT,
  p_total_amount NUMERIC(10,2),
  p_paid_by UUID,
  p_split_method TEXT,                -- 'even' | 'by_item' | 'custom_percent'
  p_source TEXT DEFAULT 'manual',     -- 'manual' | 'receipt_scan'
  p_receipt_image_url TEXT DEFAULT NULL,
  p_items JSONB DEFAULT '[]'::JSONB,
  p_shares JSONB DEFAULT '[]'::JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expense_id UUID;
  v_member_ids UUID[];
  v_member_count INTEGER;
  v_total_cents INTEGER;
  v_base_cents INTEGER;
  v_rem_cents INTEGER;
  v_user_share_cents INTEGER;
  v_share_sum NUMERIC(10,2);
  i INTEGER;
BEGIN
  -- 1. Authorization: check caller is a member of the group
  IF NOT public.is_split_group_member(p_group_id) THEN
    RAISE EXCEPTION 'Not authorized: caller is not a member of this group';
  END IF;

  -- 2. Validate payer is a member of the group
  IF NOT EXISTS (
    SELECT 1 FROM public.split_group_members
    WHERE group_id = p_group_id AND user_id = p_paid_by
  ) THEN
    RAISE EXCEPTION 'Payer must be a member of the group';
  END IF;

  -- 3. Validate inputs
  IF p_total_amount <= 0 THEN
    RAISE EXCEPTION 'Total amount must be greater than zero';
  END IF;

  IF trim(COALESCE(p_description, '')) = '' THEN
    RAISE EXCEPTION 'Expense description cannot be empty';
  END IF;

  IF p_split_method NOT IN ('even', 'by_item', 'custom_percent') THEN
    RAISE EXCEPTION 'Invalid split method: %', p_split_method;
  END IF;

  -- 4. Insert the parent expense
  INSERT INTO public.split_expenses (
    group_id,
    description,
    total_amount,
    paid_by,
    split_method,
    source,
    receipt_image_url
  ) VALUES (
    p_group_id,
    trim(p_description),
    p_total_amount,
    p_paid_by,
    p_split_method,
    COALESCE(p_source, 'manual'),
    p_receipt_image_url
  ) RETURNING id INTO v_expense_id;

  -- 5. Insert items if provided
  IF p_items IS NOT NULL AND jsonb_array_length(p_items) > 0 THEN
    INSERT INTO public.split_expense_items (
      expense_id,
      label,
      price,
      assigned_to
    )
    SELECT
      v_expense_id,
      COALESCE(item->>'label', 'Item'),
      (item->>'price')::NUMERIC(10,2),
      CASE 
        WHEN item->>'assigned_to' IS NOT NULL AND item->>'assigned_to' <> '' 
        THEN (item->>'assigned_to')::UUID 
        ELSE NULL 
      END
    FROM jsonb_array_elements(p_items) AS item;
  END IF;

  -- 6. Insert or calculate shares
  IF p_shares IS NOT NULL AND jsonb_array_length(p_shares) > 0 THEN
    -- Explicit shares supplied by client (used for custom_percent, custom amounts, or pre-computed shares)
    INSERT INTO public.split_expense_shares (
      expense_id,
      user_id,
      share_amount
    )
    SELECT
      v_expense_id,
      (s->>'user_id')::UUID,
      (s->>'share_amount')::NUMERIC(10,2)
    FROM jsonb_array_elements(p_shares) AS s;

    -- Validate share sum against total amount (allowing penny rounding margin)
    SELECT COALESCE(SUM(share_amount), 0) INTO v_share_sum
    FROM public.split_expense_shares
    WHERE expense_id = v_expense_id;

    IF abs(v_share_sum - p_total_amount) > 0.05 THEN
      RAISE EXCEPTION 'Share sum (%) does not equal total amount (%)', v_share_sum, p_total_amount;
    END IF;

  ELSIF p_split_method = 'even' THEN
    -- Deterministic penny-perfect even split across all group members
    SELECT array_agg(user_id ORDER BY joined_at ASC) INTO v_member_ids
    FROM public.split_group_members
    WHERE group_id = p_group_id;

    v_member_count := cardinality(v_member_ids);
    IF v_member_count = 0 OR v_member_ids IS NULL THEN
      RAISE EXCEPTION 'Cannot split expense: group has no members';
    END IF;

    v_total_cents := round(p_total_amount * 100)::INTEGER;
    v_base_cents := v_total_cents / v_member_count;
    v_rem_cents := v_total_cents % v_member_count;

    FOR i IN 1..v_member_count LOOP
      v_user_share_cents := v_base_cents + (CASE WHEN i <= v_rem_cents THEN 1 ELSE 0 END);
      INSERT INTO public.split_expense_shares (
        expense_id,
        user_id,
        share_amount
      ) VALUES (
        v_expense_id,
        v_member_ids[i],
        (v_user_share_cents::NUMERIC / 100)::NUMERIC(10,2)
      );
    END LOOP;

  ELSE
    RAISE EXCEPTION 'Explicit shares required for split method: %', p_split_method;
  END IF;

  RETURN v_expense_id;
END;
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.create_split_expense_transaction(
  UUID, TEXT, NUMERIC, UUID, TEXT, TEXT, TEXT, JSONB, JSONB
) TO authenticated;
