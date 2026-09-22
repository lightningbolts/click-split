import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Landing page - static marketing. Redirects to /dashboard if authenticated.
 */
export default async function LandingPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    redirect('/dashboard');
  }

  return (
    <div style={{ width: '100%', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <span className="mark" />
            Click Split
          </div>
          <Link href="/signin" className="btn btn-small">
            Sign in
          </Link>
        </div>
      </header>

      <main style={{ flex: 1 }}>
        <div className="land-hero-wrap">
          <div className="page-container" style={{ paddingBottom: 0 }}>
            <div className="land-hero-grid">
              <div className="land-hero">
                <div className="eyebrow">Part of Click Platforms</div>
                <h1>
                  Split bills without <span>waiting around.</span>
                </h1>
                <p className="sub">
                  No 10-second timers, no paywalled features. Snap a receipt, split it your way,
                  settle up - same Click account you already have.
                </p>
                <div className="ctas">
                  <Link href="/signin" className="btn btn-primary">
                    Continue with Click
                  </Link>
                  <Link href="/signin" className="btn btn-ghost">
                    See how it works
                  </Link>
                </div>
              </div>

              <div>
                <div className="receipt-demo">
                  <div className="rd-head">
                    <span>Trader Joe&apos;s</span>
                    <span>Tonight, 7:42 PM</span>
                  </div>
                  <div className="rd-item">
                    <span>
                      Groceries
                      <span className="who">Split with Maya, Dev</span>
                    </span>
                    <span className="tabular">$61.20</span>
                  </div>
                  <div className="rd-item">
                    <span>
                      Paper towels
                      <span className="who">Split with Maya, Dev</span>
                    </span>
                    <span className="tabular">$8.40</span>
                  </div>
                  <div className="rd-item">
                    <span>
                      Dev&apos;s protein bars
                      <span className="who">Dev only</span>
                    </span>
                    <span className="tabular">$12.00</span>
                  </div>
                  <div className="rd-total">
                    <span>You&apos;re owed</span>
                    <span className="tabular" style={{ color: 'var(--green)' }}>
                      $41.30
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="page-container">
          <section className="land-features">
            <h2>Built to actually be free</h2>
            <div className="features-grid">
              <div className="feat-card">
                <div className="feat-num">01</div>
                <h3>Scan the receipt, done</h3>
                <p>
                  Photograph any receipt (groceries, dinner, a shared Costco run) and every
                  line item comes in pre-filled, ready to assign.
                </p>
              </div>

              <div className="feat-card">
                <div className="feat-num">02</div>
                <h3>No artificial limits</h3>
                <p>
                  Add as many expenses as you want, back to back. Nothing gated behind a timer
                  or a premium tier.
                </p>
              </div>

              <div className="feat-card">
                <div className="feat-num">03</div>
                <h3>Running balances per group</h3>
                <p>
                  Apartment, trip, weekly groceries: keep separate groups with their own running
                  totals and settle-up history.
                </p>
              </div>
            </div>
          </section>

          <section className="land-account">
            <div className="box">
              <p>
                <strong>One account, both apps.</strong> Signing in uses your existing Click
                account with no new password or separate profile. Your name and photo carry over
                automatically.
              </p>
            </div>
          </section>
        </div>
      </main>

      <footer style={{ borderTop: 'var(--border)', background: 'var(--paper-dim)', padding: '24px 20px', marginTop: 'auto' }}>
        <div className="page-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', padding: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 800 }}>
            <span className="mark" style={{ width: '18px', height: '18px' }} />
            Click Split · Click Platforms
          </div>
          <div style={{ display: 'flex', gap: '20px', fontSize: '13px', fontWeight: 700, color: 'var(--ink-soft)' }}>
            <Link href="/privacy" style={{ textDecoration: 'none' }}>Privacy Policy</Link>
            <Link href="/terms" style={{ textDecoration: 'none' }}>Terms of Service</Link>
            <Link href="/support" style={{ textDecoration: 'none' }}>Support</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
