'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';

/**
 * Sign-in page - triggers Supabase OAuth (Google or Apple).
 */
export default function SignInPage() {
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [origin, setOrigin] = useState<string>('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);

  const handleOAuthSignIn = async (provider: 'google' | 'apple') => {
    setLoadingProvider(provider);
    setError(null);

    const supabase = getSupabaseClient();
    if (!supabase) {
      setError('Authentication service is not configured.');
      setLoadingProvider(null);
      return;
    }

    const currentOrigin = origin || window.location.origin;
    const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${currentOrigin}/api/auth/callback?next=/dashboard`,
        scopes: provider === 'google' ? 'openid profile email' : 'name email',
      },
    });

    if (oauthError) {
      setError(oauthError.message);
      setLoadingProvider(null);
      return;
    }

    if (data?.url) {
      window.location.href = data.url;
    }
  };

  return (
    <div style={{ width: '100%', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="topbar">
        <div className="topbar-inner">
          <Link href="/" className="brand">
            <span className="mark" />
            Click Split
          </Link>
          <Link href="/" className="btn btn-small">
            Home
          </Link>
        </div>
      </header>

      <main className="form-container" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="form-card" style={{ width: '100%', maxWidth: '440px' }}>
          <div className="auth-wrap">
            <div className="auth-mark" />
            <h1>Sign in to Click Split</h1>
            <p>
              Use your existing Click account. No new profile to set up.
            </p>

            <div className="auth-actions">
              <button
                className="btn btn-primary btn-block"
                onClick={() => handleOAuthSignIn('google')}
                disabled={loadingProvider !== null}
              >
                {loadingProvider === 'google' ? 'Redirecting…' : 'Continue with Google'}
              </button>

              <button
                className="btn btn-ghost btn-block"
                onClick={() => handleOAuthSignIn('apple')}
                disabled={loadingProvider !== null}
              >
                {loadingProvider === 'apple' ? 'Redirecting…' : 'Continue with Apple'}
              </button>

              <Link href="/" className="btn btn-ghost btn-block">
                Cancel
              </Link>
            </div>

            {error && (
              <div
                style={{
                  color: 'var(--red)',
                  fontSize: '13px',
                  marginTop: '16px',
                  background: 'var(--red-dim)',
                  border: '1.5px solid var(--red)',
                  padding: '10px 14px',
                  width: '100%',
                }}
              >
                {error}
              </div>
            )}

            <div className="auth-note">
              <span className="dot" />
              Uses your Click identity: same login, same profile
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
