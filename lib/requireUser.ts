import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { User } from '@supabase/supabase-js';

/**
 * Server-side auth guard. Call at the top of protected Server Components.
 * Redirects to /signin if no session. Returns the authenticated user.
 */
export async function requireUser(): Promise<User> {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect('/signin');
  }

  return user;
}
