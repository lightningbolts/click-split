import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { computeExpenseShares } from '@/lib/shareCalculation';

interface ExpenseItem {
  label: string;
  price: number;
  assignedTo: string | null; // user_id or null for split
}

interface CreateExpenseBody {
  groupId: string;
  description: string;
  totalAmount: number;
  paidBy: string;
  splitMethod: 'even' | 'by_item' | 'custom_percent';
  source?: 'manual' | 'receipt_scan';
  receiptImageUrl?: string;
  items?: ExpenseItem[];
  customPercentages?: Record<string, number>;
}

interface MemberRow {
  user_id: string;
}

/**
 * POST /api/split/expenses
 * Creates an expense, writes items (if any), and computes shares atomically.
 */
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json()) as CreateExpenseBody;
  const { groupId, description, totalAmount, paidBy, splitMethod, source, receiptImageUrl, items, customPercentages } = body;

  // Validate inputs
  if (!groupId || !description?.trim() || !Number.isFinite(totalAmount) || totalAmount <= 0 || !paidBy || !splitMethod) {
    return NextResponse.json({ error: 'Invalid or missing required fields' }, { status: 400 });
  }

  // Get group members
  const { data: membersData, error: memError } = await supabase
    .from('split_group_members')
    .select('user_id')
    .eq('group_id', groupId);

  if (memError || !membersData || membersData.length === 0) {
    return NextResponse.json({ error: 'Group not found or you are not a member' }, { status: 404 });
  }

  const members = membersData as MemberRow[];
  const memberIds = members.map((m) => m.user_id);

  // Verify current user is a member and the selected payer belongs to the group.
  if (!memberIds.includes(user.id)) {
    return NextResponse.json({ error: 'Not a member of this group' }, { status: 403 });
  }
  if (!memberIds.includes(paidBy)) {
    return NextResponse.json({ error: 'Payer must be a member of the group' }, { status: 400 });
  }

  // Compute shares through one cent-safe implementation
  let computedShares;
  try {
    computedShares = computeExpenseShares({
      totalAmount,
      memberIds,
      splitMethod,
      items: items?.map((item) => ({ price: item.price, assignedTo: item.assignedTo })) ?? [],
      customPercentages,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid split configuration' },
      { status: 400 },
    );
  }

  const itemRows = (items ?? []).map((item) => ({
    label: item.label,
    price: item.price,
    assigned_to: item.assignedTo,
  }));

  const shareRows = computedShares.map((share) => ({
    user_id: share.userId,
    share_amount: share.amount,
  }));

  // 1. Attempt atomic PostgreSQL RPC execution
  const { data: rpcExpenseId, error: rpcError } = await supabase.rpc(
    'create_split_expense_transaction',
    {
      p_group_id: groupId,
      p_description: description.trim(),
      p_total_amount: totalAmount,
      p_paid_by: paidBy,
      p_split_method: splitMethod,
      p_source: source ?? 'manual',
      p_receipt_image_url: receiptImageUrl ?? null,
      p_items: itemRows,
      p_shares: shareRows,
    },
  );

  if (!rpcError && rpcExpenseId) {
    const formattedShares = computedShares.map((s) => ({
      expense_id: rpcExpenseId,
      user_id: s.userId,
      share_amount: s.amount,
    }));
    return NextResponse.json({ expense: { id: rpcExpenseId }, shares: formattedShares }, { status: 201 });
  }

  // 2. Fallback to sequential inserts if RPC is not yet deployed
  const { data: expense, error: expError } = await supabase
    .from('split_expenses')
    .insert({
      group_id: groupId,
      description: description.trim(),
      total_amount: totalAmount,
      paid_by: paidBy,
      split_method: splitMethod,
      source: source ?? 'manual',
      receipt_image_url: receiptImageUrl ?? null,
    })
    .select('id')
    .single();

  if (expError || !expense) {
    return NextResponse.json({ error: expError?.message ?? 'Failed to create expense' }, { status: 500 });
  }

  if (itemRows.length > 0) {
    const itemsToInsert = itemRows.map((item) => ({
      expense_id: expense.id,
      label: item.label,
      price: item.price,
      assigned_to: item.assigned_to,
    }));
    const { error: itemError } = await supabase.from('split_expense_items').insert(itemsToInsert);
    if (itemError) {
      await supabase.from('split_expenses').delete().eq('id', expense.id);
      return NextResponse.json({ error: 'Failed to save expense items' }, { status: 500 });
    }
  }

  const sharesToInsert = computedShares.map((share) => ({
    expense_id: expense.id,
    user_id: share.userId,
    share_amount: share.amount,
  }));

  const { error: shareError } = await supabase.from('split_expense_shares').insert(sharesToInsert);
  if (shareError) {
    await supabase.from('split_expenses').delete().eq('id', expense.id);
    return NextResponse.json({ error: 'Failed to save expense shares' }, { status: 500 });
  }

  return NextResponse.json({ expense: { id: expense.id }, shares: sharesToInsert }, { status: 201 });
}
