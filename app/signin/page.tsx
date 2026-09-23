'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';

function normalizeNextPath(candidate: string | null): string {
  if (!candidate || !candidate.startsWith('/') || candidate.startsWith('//')) {
    return '/dashboard';
  }
  return candidate;
}

/**
 * Sign-in page supporting Supabase Email/Password and OAuth (Google / Apple).
 */
export default function SignInPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [origin, setOrigin] = useState<string>('');
  const [nextPath, setNextPath] = useState('/dashboard');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
      const params = new URLSearchParams(window.location.search);
      setNextPath(normalizeNextPath(params.get('next')));
    }
  }, []);

  const handlePasswordAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setError('Please enter both email and password.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (mode === 'signup' && !fullName.trim()) {
      setError('Please enter your full name.');
      return;
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      setError('Authentication service is not configured.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (mode === 'signin') {
        const { data, error: signInErr } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (signInErr) {
          setError(signInErr.message);
          setIsSubmitting(false);
          return;
        }

        if (data.session) {
          router.push(nextPath);
          router.refresh();
        }
      } else {
        const { data, error: signUpErr } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              full_name: fullName.trim(),
            },
            emailRedirectTo: `${origin || window.location.origin}/api/auth/callback?next=${encodeURIComponent(nextPath)}`,
          },
        });

        if (signUpErr) {
          setError(signUpErr.message);
          setIsSubmitting(false);
          return;
        }

        if (data.session) {
          // If session returned immediately (email confirmation disabled)
          router.push(nextPath);
          router.refresh();
        } else {
          setMessage('Account created! Please check your email to confirm your account, then sign in.');
          setMode('signin');
          setPassword('');
          setIsSubmitting(false);
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
      setIsSubmitting(false);
    }
  };

  const handleOAuthSignIn = async (provider: 'google' | 'apple') => {
    setLoadingProvider(provider);
    setError(null);
    setMessage(null);

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
        redirectTo: `${currentOrigin}/api/auth/callback?next=${encodeURIComponent(nextPath)}`,
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
            <h1>{mode === 'signin' ? 'Sign in to Click Split' : 'Create an Account'}</h1>
            <p>
              {mode === 'signin'
                ? 'Sign in with your email or social accounts.'
                : 'Join Click Split to track shared expenses and scan receipts.'}
            </p>

            {/* Mode Switcher Tabs */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '0',
                border: 'var(--border)',
                marginBottom: '20px',
                background: 'var(--paper-dim)',
                borderRadius: 'var(--radius)',
              }}
            >
              <button
                type="button"
                onClick={() => { setMode('signin'); setError(null); setMessage(null); }}
                style={{
                  padding: '10px 14px',
                  fontWeight: 800,
                  fontSize: '13px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  cursor: 'pointer',
                  border: 'none',
                  background: mode === 'signin' ? 'var(--ink)' : 'transparent',
                  color: mode === 'signin' ? 'var(--white)' : 'var(--ink)',
                  transition: 'background 0.15s ease',
                }}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setMode('signup'); setError(null); setMessage(null); }}
                style={{
                  padding: '10px 14px',
                  fontWeight: 800,
                  fontSize: '13px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  cursor: 'pointer',
                  border: 'none',
                  background: mode === 'signup' ? 'var(--ink)' : 'transparent',
                  color: mode === 'signup' ? 'var(--white)' : 'var(--ink)',
                  transition: 'background 0.15s ease',
                }}
              >
                Sign Up
              </button>
            </div>

            {/* Email + Password Form */}
            <form onSubmit={handlePasswordAuth} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {mode === 'signup' && (
                <div className="field" style={{ margin: 0 }}>
                  <label htmlFor="full-name" style={{ textAlign: 'left', display: 'block' }}>Full Name</label>
                  <input
                    id="full-name"
                    type="text"
                    placeholder="e.g. Alex Morgan"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>
              )}

              <div className="field" style={{ margin: 0 }}>
                <label htmlFor="email" style={{ textAlign: 'left', display: 'block' }}>Email Address</label>
                <input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  disabled={isSubmitting}
                />
              </div>

              <div className="field" style={{ margin: 0 }}>
                <label htmlFor="password" style={{ textAlign: 'left', display: 'block' }}>Password</label>
                <input
                  id="password"
                  type="password"
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  disabled={isSubmitting}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-block"
                disabled={isSubmitting || loadingProvider !== null}
                style={{ marginTop: '4px' }}
              >
                {isSubmitting
                  ? (mode === 'signin' ? 'Signing in…' : 'Creating Account…')
                  : (mode === 'signin' ? 'Sign In with Email' : 'Create Account')}
              </button>
            </form>

            {/* Brutalist Divider */}
            <div
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                margin: '22px 0 16px',
              }}
            >
              <div style={{ flex: 1, height: '2px', background: 'var(--line)' }} />
              <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--grey)' }}>
                OR
              </span>
              <div style={{ flex: 1, height: '2px', background: 'var(--line)' }} />
            </div>

            {/* OAuth Buttons */}
            <div className="auth-actions">
              <button
                className="btn btn-block"
                onClick={() => handleOAuthSignIn('google')}
                disabled={loadingProvider !== null || isSubmitting}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  background: 'var(--white)',
                  color: 'var(--ink)',
                  border: 'var(--border)',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    background: '#4285F4',
                    color: '#fff',
                    fontWeight: 900,
                    fontSize: '13px',
                  }}
                >
                  G
                </span>
                {loadingProvider === 'google' ? 'Redirecting…' : 'Continue with Google'}
              </button>

              <button
                className="btn btn-ghost btn-block"
                onClick={() => handleOAuthSignIn('apple')}
                disabled={loadingProvider !== null || isSubmitting}
              >
                {loadingProvider === 'apple' ? 'Redirecting…' : 'Continue with Apple'}
              </button>

              <Link href="/" className="btn btn-ghost btn-block">
                Cancel
              </Link>
            </div>

            {/* Success Message */}
            {message && (
              <div
                style={{
                  color: 'var(--green)',
                  fontSize: '13px',
                  marginTop: '16px',
                  background: 'var(--green-dim)',
                  border: '1.5px solid var(--green)',
                  padding: '10px 14px',
                  width: '100%',
                  textAlign: 'left',
                  lineHeight: 1.5,
                }}
              >
                {message}
              </div>
            )}

            {/* Error Message */}
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
                  textAlign: 'left',
                  lineHeight: 1.5,
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
