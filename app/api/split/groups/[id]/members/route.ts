import { NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

async function getCreatorContext(id: string) {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) } as const;
  }

  const { data: group } = await supabase
    .from('split_groups')
    .select('created_by')
    .eq('id', id)
    .maybeSingle();

  if (!group) {
    return { response: NextResponse.json({ error: 'Group not found' }, { status: 404 }) } as const;
  }

  if (group.created_by !== user.id) {
    return {
      response: NextResponse.json(
        { error: 'Only the group creator can manage members' },
        { status: 403 },
      ),
    } as const;
  }

  return { user } as const;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const creator = await getCreatorContext(id);
  if ('response' in creator) return creator.response;

  const body = (await request.json()) as { email?: string };
  const email = body.email?.trim().toLowerCase();
  if (!email || email.length > 254 || !email.includes('@')) {
    return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 });
  }

  const serviceRole = createSupabaseServiceRoleClient();
  const { data: target, error: userError } = await serviceRole
    .from('users')
    .select('id, name, full_name, email, image')
    .eq('email', email)
    .maybeSingle();

  if (userError) {
    return NextResponse.json({ error: userError.message }, { status: 500 });
  }
  if (!target) {
    return NextResponse.json({ error: 'No Click account was found with that email' }, { status: 404 });
  }

  const { data: existing } = await serviceRole
    .from('split_group_members')
    .select('user_id')
    .eq('group_id', id)
    .eq('user_id', target.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: 'That user is already in this group' }, { status: 409 });
  }

  const { error: insertError } = await serviceRole
    .from('split_group_members')
    .insert({ group_id: id, user_id: target.id });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    member: {
      userId: target.id,
      name: target.name || target.full_name || target.email?.split('@')[0] || 'Member',
      image: target.image ?? null,
      balance: 0,
    },
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const creator = await getCreatorContext(id);
  if ('response' in creator) return creator.response;

  const body = (await request.json()) as { userId?: string };
  const userId = body.userId?.trim();
  if (!userId) {
    return NextResponse.json({ error: 'Member is required' }, { status: 400 });
  }
  if (userId === creator.user.id) {
    return NextResponse.json(
      { error: 'The group creator cannot remove themselves. Delete the group instead.' },
      { status: 400 },
    );
  }

  const serviceRole = createSupabaseServiceRoleClient();
  const { data: membership } = await serviceRole
    .from('split_group_members')
    .select('user_id')
    .eq('group_id', id)
    .eq('user_id', userId)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json({ error: 'Member not found in this group' }, { status: 404 });
  }

  const { data: balance, error: balanceError } = await serviceRole.rpc('calculate_split_group_balance', {
    p_group_id: id,
    p_user_id: userId,
  });
  if (balanceError) {
    return NextResponse.json({ error: balanceError.message }, { status: 500 });
  }

  if (Math.abs(Number(balance ?? 0)) >= 0.01) {
    return NextResponse.json(
      { error: 'This member has an outstanding balance. Settle up before removing them.' },
      { status: 409 },
    );
  }

  const { error: deleteError } = await serviceRole
    .from('split_group_members')
    .delete()
    .eq('group_id', id)
    .eq('user_id', userId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
