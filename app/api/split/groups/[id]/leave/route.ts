import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * POST /api/split/groups/[id]/leave
 * Allows current user to leave the group if their net balance is $0.00.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check user balance in group
  const { data: balance } = await supabase.rpc('calculate_split_group_balance', {
    p_group_id: id,
    p_user_id: user.id,
  });

  const numericBalance = Number(balance ?? 0);
  if (Math.abs(numericBalance) > 0.005) {
    return NextResponse.json(
      {
        error: `Cannot leave group: your balance is ${numericBalance > 0 ? '+' : ''}$${numericBalance.toFixed(2)}. Please settle all debts before leaving.`,
      },
      { status: 400 },
    );
  }

  // Remove member
  const { error: leaveError } = await supabase
    .from('split_group_members')
    .delete()
    .eq('group_id', id)
    .eq('user_id', user.id);

  if (leaveError) {
    return NextResponse.json({ error: leaveError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
