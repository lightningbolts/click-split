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
  const { groupId, fromUser, toUser, amount, method } = body as {
    groupId: string;
    fromUser?: string;
    toUser: string;
    amount: number;
    method: string;
  };

  const actualFrom = fromUser || user.id;
  const actualTo = toUser;

  const allowedMethods = new Set(['venmo', 'paypal', 'cashapp', 'zelle', 'applepay', 'googlepay', 'cash', 'manual']);

  if (!groupId || !actualFrom || !actualTo || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'Missing or invalid required fields' }, { status: 400 });
  }
  if (!allowedMethods.has(method ?? 'cash')) {
    return NextResponse.json({ error: 'Unsupported settlement method' }, { status: 400 });
  }

  if (actualFrom === actualTo) {
    return NextResponse.json({ error: 'Cannot settle with yourself' }, { status: 400 });
  }

  // The authenticated user must be either the payer or the recipient
  if (user.id !== actualFrom && user.id !== actualTo) {
    return NextResponse.json({ error: 'You must be a party to this settlement' }, { status: 403 });
  }

  // Verify both users are group members
  const { data: members } = await supabase
    .from('split_group_members')
    .select('user_id')
    .eq('group_id', groupId)
    .in('user_id', [actualFrom, actualTo]);

  if (!members || members.length < 2) {
    return NextResponse.json({ error: 'Both users must be members of this group' }, { status: 400 });
  }

  // Verify the payment cannot over-settle either side of the current group balance.
  const [{ data: fromBalance, error: fromBalanceError }, { data: toBalance, error: toBalanceError }] = await Promise.all([
    supabase.rpc('calculate_split_group_balance', { p_group_id: groupId, p_user_id: actualFrom }),
    supabase.rpc('calculate_split_group_balance', { p_group_id: groupId, p_user_id: actualTo }),
  ]);

  if (fromBalanceError || toBalanceError) {
    return NextResponse.json({ error: 'Could not validate current balances' }, { status: 500 });
  }

  const payerBalance = Number(fromBalance ?? 0);
  const recipientBalance = Number(toBalance ?? 0);
  const amountCents = Math.round(amount * 100);
  const payerOwesCents = Math.max(0, Math.round(-payerBalance * 100));
  const recipientIsOwedCents = Math.max(0, Math.round(recipientBalance * 100));

  if (payerOwesCents === 0 || recipientIsOwedCents === 0) {
    return NextResponse.json({ error: 'This settlement no longer matches the current balances' }, { status: 409 });
  }

  if (amountCents > payerOwesCents || amountCents > recipientIsOwedCents) {
    return NextResponse.json({ error: 'Settlement amount exceeds the current outstanding balance' }, { status: 409 });
  }

  // Create settlement
  const { data: settlement, error: settleError } = await supabase
    .from('split_settlements')
    .insert({
      group_id: groupId,
      from_user: actualFrom,
      to_user: actualTo,
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
