import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * POST /api/split/groups/[id]/join
 * Adds the currently authenticated user to the group as a member.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Insert user into split_group_members
  const { error: insertError } = await supabase
    .from('split_group_members')
    .insert({ group_id: id, user_id: user.id });

  if (insertError) {
    // If already a member (unique violation), treat as success
    if (insertError.code === '23505') {
      return NextResponse.json({ success: true, message: 'Already a member' }, { status: 200 });
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
