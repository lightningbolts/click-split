import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

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
}

interface MemberRow {
  user_id: string;
}

/**
 * POST /api/split/expenses
 * Creates an expense, writes items (if any), and computes shares.
 */
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json()) as CreateExpenseBody;
  const { groupId, description, totalAmount, paidBy, splitMethod, source, receiptImageUrl, items } = body;

  // Validate
  if (!groupId || !description || !totalAmount || !paidBy || !splitMethod) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
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

  // Verify current user is a member
  if (!memberIds.includes(user.id)) {
    return NextResponse.json({ error: 'Not a member of this group' }, { status: 403 });
  }

  // Create the expense
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

  // Insert items if provided
  if (items && items.length > 0) {
    const itemRows = items.map((item) => ({
      expense_id: expense.id,
      label: item.label,
      price: item.price,
      assigned_to: item.assignedTo,
    }));

    const { error: itemError } = await supabase
      .from('split_expense_items')
      .insert(itemRows);

    if (itemError) {
      console.error('Error inserting items:', itemError.message);
    }
  }

  // Compute shares based on split method
  const shares: Array<{ expense_id: string; user_id: string; share_amount: number }> = [];

  if (splitMethod === 'even') {
    const perPerson = Math.round((totalAmount / memberIds.length) * 100) / 100;
    // Adjust for rounding - give the remainder to the last person
    let remaining = totalAmount;
    memberIds.forEach((memberId: string, i: number) => {
      const share = i === memberIds.length - 1 ? Math.round(remaining * 100) / 100 : perPerson;
      shares.push({ expense_id: expense.id, user_id: memberId, share_amount: share });
      remaining -= perPerson;
    });
  } else if (splitMethod === 'by_item' && items && items.length > 0) {
    // Items assigned to specific users go to them; unassigned items split evenly
    const userTotals = new Map<string, number>();
    memberIds.forEach((id: string) => userTotals.set(id, 0));

    let unassignedTotal = 0;
    for (const item of items) {
      if (item.assignedTo && memberIds.includes(item.assignedTo)) {
        userTotals.set(item.assignedTo, (userTotals.get(item.assignedTo) ?? 0) + item.price);
      } else {
        unassignedTotal += item.price;
      }
    }

    // Split unassigned items evenly
    const unassignedPerPerson = unassignedTotal / memberIds.length;
    memberIds.forEach((id: string) => {
      const total = (userTotals.get(id) ?? 0) + unassignedPerPerson;
      shares.push({
        expense_id: expense.id,
        user_id: id,
        share_amount: Math.round(total * 100) / 100,
      });
    });
  } else {
    // Default to even split
    const perPerson = Math.round((totalAmount / memberIds.length) * 100) / 100;
    memberIds.forEach((memberId: string) => {
      shares.push({ expense_id: expense.id, user_id: memberId, share_amount: perPerson });
    });
  }

  const { error: shareError } = await supabase
    .from('split_expense_shares')
    .insert(shares);

  if (shareError) {
    console.error('Error inserting shares:', shareError.message);
    return NextResponse.json({ error: 'Failed to compute shares' }, { status: 500 });
  }

  return NextResponse.json({ expense: { id: expense.id }, shares }, { status: 201 });
}
