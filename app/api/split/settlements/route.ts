import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * POST /api/split/settlements
 * Records a settle-up payment between two users in a group.
 */
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { groupId, toUser, amount, method } = body as {
    groupId: string;
    toUser: string;
    amount: number;
    method: string;
  };

  if (!groupId || !toUser || !amount || amount <= 0) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Verify user is a group member
  const { data: membership } = await supabase
    .from('split_group_members')
    .select('user_id')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json({ error: 'Not a member of this group' }, { status: 403 });
  }

  // Create settlement
  const { data: settlement, error: settleError } = await supabase
    .from('split_settlements')
    .insert({
      group_id: groupId,
      from_user: user.id,
      to_user: toUser,
      amount,
      method: method ?? 'cash',
    })
    .select('id, settled_at')
    .single();

  if (settleError) {
    return NextResponse.json({ error: settleError.message }, { status: 500 });
  }

  return NextResponse.json({ settlement }, { status: 201 });
}
