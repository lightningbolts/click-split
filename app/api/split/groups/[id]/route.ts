import { NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseServiceRoleClient } from '@/lib/supabase/server';

interface MemberRow {
  user_id: string;
  joined_at: string;
}

interface UserRow {
  id: string;
  name: string | null;
  full_name?: string | null;
  email?: string | null;
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
 * If user is not yet a member, returns isMember: false with basic preview so they can join.
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

  // First try fetching with authenticated user client
  let { data: group } = await supabase
    .from('split_groups')
    .select('id, name, icon, created_at, created_by')
    .eq('id', id)
    .maybeSingle();

  // If not visible under user RLS (e.g. invited non-member), try service role for preview
  if (!group) {
    const serviceRole = createSupabaseServiceRoleClient();
    const { data: previewGroup } = await serviceRole
      .from('split_groups')
      .select('id, name, icon, created_at, created_by')
      .eq('id', id)
      .maybeSingle();
    group = previewGroup;
  }

  if (!group) {
    return NextResponse.json({ error: 'Group not found' }, { status: 404 });
  }

  // Get members with user details
  const serviceRole = createSupabaseServiceRoleClient();
  const { data: members } = await serviceRole
    .from('split_group_members')
    .select('user_id, joined_at')
    .eq('group_id', id);

  const memberIds = (members as MemberRow[] ?? []).map((m) => m.user_id);

  // If current user is not a member, return invite preview
  if (!memberIds.includes(user.id)) {
    return NextResponse.json({
      group: { id: group.id, name: group.name, icon: group.icon, created_at: group.created_at },
      isMember: false,
      memberCount: memberIds.length,
      members: [],
      expenses: [],
      userBalance: 0,
    });
  }

  // Get user details for members
  const { data: usersData } = await serviceRole
    .from('users')
    .select('id, name, full_name, email, image')
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

  // Build user map with clean name fallback
  const userMap = new Map(
    users.map((u) => [
      u.id,
      {
        id: u.id,
        name: u.name || u.full_name || (u.email ? u.email.split('@')[0] : 'Member'),
        image: u.image ?? null,
      },
    ]),
  );

  // Enrich expenses with user's share
  const enrichedExpenses = expenses.map((expense) => {
    const expenseShares = shares.filter((s) => s.expense_id === expense.id);
    const userShare = expenseShares.find((s) => s.user_id === user.id);
    const payer = userMap.get(expense.paid_by);

    let userNet = 0;
    if (expense.paid_by === user.id) {
      const theirShare = userShare ? Number(userShare.share_amount) : 0;
      userNet = Number(expense.total_amount) - theirShare;
    } else {
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
        name: memberUser?.name ?? 'Member',
        image: memberUser?.image ?? null,
        balance: Number(balance ?? 0),
      };
    }),
  );

  const userBalance = memberBalances.find((m) => m.userId === user.id)?.balance ?? 0;

  return NextResponse.json({
    group,
    isMember: true,
    members: memberBalances,
    expenses: enrichedExpenses,
    userBalance,
  });
}
