import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

interface MemberRow {
  user_id: string;
  joined_at: string;
}

interface UserRow {
  id: string;
  name: string | null;
  image: string | null;
}

interface ExpenseRow {
  id: string;
  description: string;
  total_amount: number;
  paid_by: string;
  split_method: string;
  source: string;
  created_at: string;
}

interface ShareRow {
  expense_id: string;
  user_id: string;
  share_amount: number;
}

/**
 * GET /api/split/groups/[id]
 * Returns group detail: info, members, expenses, and balances.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get group
  const { data: group, error: grpError } = await supabase
    .from('split_groups')
    .select('id, name, icon, created_at, created_by')
    .eq('id', id)
    .single();

  if (grpError || !group) {
    return NextResponse.json({ error: 'Group not found' }, { status: 404 });
  }

  // Get members with user details
  const { data: members } = await supabase
    .from('split_group_members')
    .select('user_id, joined_at')
    .eq('group_id', id);

  const memberIds = (members as MemberRow[] ?? []).map((m) => m.user_id);

  // Verify current user is a member
  if (!memberIds.includes(user.id)) {
    return NextResponse.json({ error: 'Not a member' }, { status: 403 });
  }

  // Get user details for members
  const { data: usersData } = await supabase
    .from('users')
    .select('id, name, image')
    .in('id', memberIds);

  const users = (usersData ?? []) as UserRow[];

  // Get expenses with payer info
  const { data: expensesData } = await supabase
    .from('split_expenses')
    .select('id, description, total_amount, paid_by, split_method, source, created_at')
    .eq('group_id', id)
    .order('created_at', { ascending: false });

  const expenses = (expensesData ?? []) as ExpenseRow[];

  // Get all shares for these expenses
  const expenseIds = expenses.map((e) => e.id);
  let shares: ShareRow[] = [];
  if (expenseIds.length > 0) {
    const { data: sharesData } = await supabase
      .from('split_expense_shares')
      .select('expense_id, user_id, share_amount')
      .in('expense_id', expenseIds);
    shares = (sharesData ?? []) as ShareRow[];
  }

  // Build user map
  const userMap = new Map(users.map((u) => [u.id, u]));

  // Enrich expenses with user's share
  const enrichedExpenses = expenses.map((expense) => {
    const expenseShares = shares.filter((s) => s.expense_id === expense.id);
    const userShare = expenseShares.find((s) => s.user_id === user.id);
    const payer = userMap.get(expense.paid_by);

    // Calculate what this expense means for the current user
    let userNet = 0;
    if (expense.paid_by === user.id) {
      // User paid: they're owed the total minus their own share
      const theirShare = userShare ? Number(userShare.share_amount) : 0;
      userNet = Number(expense.total_amount) - theirShare;
    } else {
      // Someone else paid: user owes their share
      userNet = userShare ? -Number(userShare.share_amount) : 0;
    }

    return {
      ...expense,
      total_amount: Number(expense.total_amount),
      payerName: payer?.name ?? 'Unknown',
      userShare: userShare ? Number(userShare.share_amount) : 0,
      userNet,
      memberCount: expenseShares.length,
    };
  });

  // Calculate per-member balances
  const memberBalances = await Promise.all(
    memberIds.map(async (memberId: string) => {
      const { data: balance } = await supabase.rpc('calculate_split_group_balance', {
        p_group_id: id,
        p_user_id: memberId,
      });
      const memberUser = userMap.get(memberId);
      return {
        userId: memberId,
        name: memberUser?.name ?? 'Unknown',
        image: memberUser?.image ?? null,
        balance: Number(balance ?? 0),
      };
    }),
  );

  // Calculate what each member owes/is owed relative to the current user
  const userBalance = memberBalances.find((m) => m.userId === user.id)?.balance ?? 0;

  return NextResponse.json({
    group,
    members: memberBalances,
    expenses: enrichedExpenses,
    userBalance,
  });
}
