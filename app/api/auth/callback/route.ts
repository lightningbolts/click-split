import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

function normalizeNextPath(candidate: string | null): string {
  if (!candidate || !candidate.startsWith('/') || candidate.startsWith('//')) {
    return '/dashboard';
  }
  return candidate;
}

/**
 * GET /api/auth/callback
 * Handles PKCE code exchange and OTP token verification after OAuth redirect.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type');
  const next = normalizeNextPath(searchParams.get('next'));

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Can be safely ignored if middleware handles refresh
          }
        },
      },
    },
  );

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error('Auth callback PKCE exchange error:', error.message);
      return NextResponse.redirect(
        new URL(`/signin?error=${encodeURIComponent(error.message)}`, origin),
      );
    }

    return NextResponse.redirect(new URL(next, origin));
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as 'signup' | 'recovery' | 'email',
    });
    if (error) {
      console.error('Auth callback OTP error:', error.message);
      return NextResponse.redirect(
        new URL(`/signin?error=${encodeURIComponent(error.message)}`, origin),
      );
    }

    return NextResponse.redirect(new URL(next, origin));
  }

  return NextResponse.redirect(new URL('/signin', origin));
}
