import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { computeExpenseShares } from '@/lib/shareCalculation';

export const dynamic = 'force-dynamic';

interface ExpenseItem {
  id?: string;
  label: string;
  price: number;
  assignedTo: string | null;
}

interface UpdateExpenseBody {
  description: string;
  totalAmount: number;
  paidBy: string;
  splitMethod: 'even' | 'by_item' | 'custom_percent';
  items?: ExpenseItem[];
  customPercentages?: Record<string, number>;
}

/**
 * GET /api/split/expenses/[id]
 * Returns single expense with items and shares.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: expense, error: expError } = await supabase
    .from('split_expenses')
    .select('*')
    .eq('id', id)
    .single();

  if (expError || !expense) {
    return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
  }

  // Verify membership in the expense's group
  const { data: member } = await supabase
    .from('split_group_members')
    .select('user_id')
    .eq('group_id', expense.group_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!member) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Get items
  const { data: items } = await supabase
    .from('split_expense_items')
    .select('*')
    .eq('expense_id', id);

  // Get shares
  const { data: shares } = await supabase
    .from('split_expense_shares')
    .select('*')
    .eq('expense_id', id);

  return NextResponse.json({
    expense,
    items: items ?? [],
    shares: shares ?? [],
  });
}

/**
 * PUT /api/split/expenses/[id]
 * Updates an expense, updates items, and recomputes shares.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: existing } = await supabase
    .from('split_expenses')
    .select('group_id, paid_by')
    .eq('id', id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
  }

  // Verify membership
  const { data: member } = await supabase
    .from('split_group_members')
    .select('user_id')
    .eq('group_id', existing.group_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!member) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = (await request.json()) as UpdateExpenseBody;
  const { description, totalAmount, paidBy, splitMethod, items, customPercentages } = body;

  if (!description?.trim() || !Number.isFinite(totalAmount) || totalAmount <= 0 || !paidBy) {
    return NextResponse.json({ error: 'Invalid expense fields' }, { status: 400 });
  }

  // Fetch all group members before mutating anything so the split can be validated first.
  const { data: membersData, error: membersError } = await supabase
    .from('split_group_members')
    .select('user_id')
    .eq('group_id', existing.group_id);

  if (membersError || !membersData || membersData.length === 0) {
    return NextResponse.json({ error: 'Group members could not be loaded' }, { status: 400 });
  }

  const memberIds = membersData.map((m: { user_id: string }) => m.user_id);
  if (!memberIds.includes(paidBy)) {
    return NextResponse.json({ error: 'Payer must be a member of the group' }, { status: 400 });
  }

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

  const { error: updateError } = await supabase
    .from('split_expenses')
    .update({
      description: description.trim(),
      total_amount: totalAmount,
      paid_by: paidBy,
      split_method: splitMethod,
    })
    .eq('id', id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const { error: deleteItemsError } = await supabase
    .from('split_expense_items')
    .delete()
    .eq('expense_id', id);
  if (deleteItemsError) {
    return NextResponse.json({ error: deleteItemsError.message }, { status: 500 });
  }

  if (items && items.length > 0) {
    const { error: itemError } = await supabase.from('split_expense_items').insert(
      items.map((item) => ({
        expense_id: id,
        label: item.label,
        price: item.price,
        assigned_to: item.assignedTo,
      })),
    );
    if (itemError) {
      return NextResponse.json({ error: itemError.message }, { status: 500 });
    }
  }

  const { error: deleteSharesError } = await supabase
    .from('split_expense_shares')
    .delete()
    .eq('expense_id', id);
  if (deleteSharesError) {
    return NextResponse.json({ error: deleteSharesError.message }, { status: 500 });
  }

  const { error: shareError } = await supabase.from('split_expense_shares').insert(
    computedShares.map((share) => ({
      expense_id: id,
      user_id: share.userId,
      share_amount: share.amount,
    })),
  );
  if (shareError) {
    return NextResponse.json({ error: shareError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

/**
 * DELETE /api/split/expenses/[id]
 * Deletes expense and cascades to items and shares.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: expense } = await supabase
    .from('split_expenses')
    .select('group_id')
    .eq('id', id)
    .single();

  if (!expense) {
    return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
  }

  // Verify group membership
  const { data: member } = await supabase
    .from('split_group_members')
    .select('user_id')
    .eq('group_id', expense.group_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!member) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { error: delError } = await supabase
    .from('split_expenses')
    .delete()
    .eq('id', id);

  if (delError) {
    return NextResponse.json({ error: delError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
