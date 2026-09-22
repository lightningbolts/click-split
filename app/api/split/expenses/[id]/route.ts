import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

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
  const { description, totalAmount, paidBy, splitMethod, items } = body;

  // Update expense record
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

  // Re-write items
  await supabase.from('split_expense_items').delete().eq('expense_id', id);
  if (items && items.length > 0) {
    await supabase.from('split_expense_items').insert(
      items.map((i) => ({
        expense_id: id,
        label: i.label,
        price: i.price,
        assigned_to: i.assignedTo,
      })),
    );
  }

  // Fetch all group members for share recomputation
  const { data: membersData } = await supabase
    .from('split_group_members')
    .select('user_id')
    .eq('group_id', existing.group_id);

  const memberIds = (membersData ?? []).map((m: { user_id: string }) => m.user_id);

  // Recompute shares
  await supabase.from('split_expense_shares').delete().eq('expense_id', id);

  if (splitMethod === 'even' || !items || items.length === 0) {
    const sharePerPerson = Math.round((totalAmount / memberIds.length) * 100) / 100;
    let remainder = Math.round((totalAmount - sharePerPerson * memberIds.length) * 100) / 100;

    const shareRows = memberIds.map((mId: string, idx: number) => {
      let amount = sharePerPerson;
      if (idx === 0 && remainder !== 0) {
        amount = Math.round((amount + remainder) * 100) / 100;
      }
      return {
        expense_id: id,
        user_id: mId,
        share_amount: amount,
      };
    });

    await supabase.from('split_expense_shares').insert(shareRows);
  } else {
    // Itemized shares
    const memberTotals: Record<string, number> = {};
    for (const mId of memberIds) {
      memberTotals[mId] = 0;
    }

    let sharedItemTotal = 0;
    for (const item of items) {
      if (item.assignedTo && memberTotals[item.assignedTo] !== undefined) {
        memberTotals[item.assignedTo] += item.price;
      } else {
        sharedItemTotal += item.price;
      }
    }

    const sharedPerPerson = sharedItemTotal / memberIds.length;
    const shareRows = memberIds.map((mId: string) => ({
      expense_id: id,
      user_id: mId,
      share_amount: Math.round((memberTotals[mId] + sharedPerPerson) * 100) / 100,
    }));

    await supabase.from('split_expense_shares').insert(shareRows);
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
