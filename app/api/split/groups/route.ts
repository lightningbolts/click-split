import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * GET /api/split/groups
 * Lists all groups for the authenticated user, with balance for each.
 */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get all groups the user is a member of
  const { data: memberships, error: memError } = await supabase
    .from('split_group_members')
    .select('group_id')
    .eq('user_id', user.id);

  if (memError) {
    return NextResponse.json({ error: memError.message }, { status: 500 });
  }

  if (!memberships || memberships.length === 0) {
    return NextResponse.json({ groups: [] });
  }

  const groupIds = memberships.map((m: { group_id: string }) => m.group_id);

  // Get group details
  const { data: groups, error: grpError } = await supabase
    .from('split_groups')
    .select('id, name, icon, created_at')
    .in('id', groupIds)
    .order('created_at', { ascending: false });

  if (grpError) {
    return NextResponse.json({ error: grpError.message }, { status: 500 });
  }

  // Get all members for these groups (for member summary)
  const { data: allMembers } = await supabase
    .from('split_group_members')
    .select('group_id, user_id')
    .in('group_id', groupIds);

  // Get user names
  const memberUserIds = [...new Set((allMembers ?? []).map((m: { user_id: string }) => m.user_id))];
  const { data: users } = await supabase
    .from('users')
    .select('id, name, full_name, email')
    .in('id', memberUserIds);

  const userNameMap = new Map(
    (users ?? []).map((u: { id: string; name: string | null; full_name?: string | null; email?: string | null }) => [
      u.id,
      u.name || u.full_name || (u.email ? u.email.split('@')[0] : 'Unknown'),
    ]),
  );

  // Get all expenses for these groups in a single batched query
  const { data: allExpenses } = await supabase
    .from('split_expenses')
    .select('id, group_id, description, total_amount, paid_by, created_at')
    .in('group_id', groupIds)
    .order('created_at', { ascending: false });

  // Calculate balance for each group via RPC
  const groupsWithBalance = await Promise.all(
    (groups ?? []).map(async (group: { id: string; name: string; icon: string | null; created_at: string }) => {
      const { data: balance } = await supabase.rpc('calculate_split_group_balance', {
        p_group_id: group.id,
        p_user_id: user.id,
      });

      const groupMembers = (allMembers ?? [])
        .filter((m: { group_id: string; user_id: string }) => m.group_id === group.id)
        .map((m: { group_id: string; user_id: string }) => userNameMap.get(m.user_id) ?? 'Unknown');

      const groupExpenses = (allExpenses ?? []).filter(
        (e: { group_id: string }) => e.group_id === group.id
      );

      const totalSpend = groupExpenses.reduce(
        (sum: number, e: { total_amount: number | string }) => sum + Number(e.total_amount || 0),
        0
      );

      const latest = groupExpenses[0];
      const latestExpense = latest
        ? {
            description: latest.description,
            amount: Number(latest.total_amount || 0),
            payer: userNameMap.get(latest.paid_by) ?? 'Someone',
            createdAt: latest.created_at,
          }
        : null;

      return {
        ...group,
        balance: Number(balance ?? 0),
        members: groupMembers,
        memberCount: groupMembers.length,
        expenseCount: groupExpenses.length,
        totalSpend,
        latestExpense,
      };
    }),
  );

  return NextResponse.json({ groups: groupsWithBalance });
}

/**
 * POST /api/split/groups
 * Creates a new group and adds the creator as first member.
 */
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { name, icon } = body as { name: string; icon?: string };

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return NextResponse.json({ error: 'Group name is required' }, { status: 400 });
  }

  // Create the group
  const { data: group, error: createError } = await supabase
    .from('split_groups')
    .insert({ name: name.trim(), icon: icon ?? null, created_by: user.id })
    .select('id, name, icon, created_at')
    .single();

  if (createError) {
    return NextResponse.json({ error: createError.message }, { status: 500 });
  }

  // Add creator as member
  const { error: memberError } = await supabase
    .from('split_group_members')
    .insert({ group_id: group.id, user_id: user.id });

  if (memberError) {
    await supabase.from('split_groups').delete().eq('id', group.id);
    return NextResponse.json({ error: memberError.message }, { status: 500 });
  }

  return NextResponse.json({ group }, { status: 201 });
}
