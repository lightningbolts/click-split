import Link from 'next/link';

export const metadata = {
  title: 'Terms of Service | Click Split',
  description: 'Terms of Service for Click Split by Click Platforms.',
};

export default function TermsPage() {
  return (
    <div style={{ width: '100%', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="topbar">
        <div className="topbar-inner">
          <Link href="/" className="brand">
            <span className="mark" />
            Click Split
          </Link>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Link href="/privacy" className="btn btn-ghost btn-small">
              Privacy
            </Link>
            <Link href="/support" className="btn btn-ghost btn-small">
              Support
            </Link>
          </div>
        </div>
      </header>

      <main style={{ flex: 1, padding: '40px 20px 80px' }}>
        <div className="page-container" style={{ maxWidth: '800px' }}>
          <article style={{ background: 'var(--white)', border: 'var(--border)', boxShadow: 'var(--shadow-md)', padding: '36px 32px' }}>
            <div className="eyebrow" style={{ color: 'var(--green)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', fontSize: '12px' }}>
              Click Platforms · Legal
            </div>
            <h1 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '8px', letterSpacing: '-0.02em' }}>Terms of Service</h1>
            <p style={{ color: 'var(--grey)', fontSize: '14px', marginBottom: '32px' }}>Last updated: September 21, 2026</p>

            <section style={{ marginBottom: '28px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '12px' }}>1. Acceptance of Terms</h2>
              <p style={{ lineHeight: 1.6, color: 'var(--ink-soft)' }}>
                By accessing or using Click Split (via iOS app or website), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the service.
              </p>
            </section>

            <section style={{ marginBottom: '28px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '12px' }}>2. Nature of the Service</h2>
              <p style={{ lineHeight: 1.6, color: 'var(--ink-soft)' }}>
                Click Split provides collaborative tools for tracking group expenses and calculating net debt balances. Click Split is an informational calculator and record-keeping tool. Click Split does not act as a bank, money transmitter, or escrow agent.
              </p>
            </section>

            <section style={{ marginBottom: '28px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '12px' }}>3. User Conduct</h2>
              <p style={{ lineHeight: 1.6, color: 'var(--ink-soft)' }}>
                You agree not to upload fraudulent receipts, impersonate other individuals, or use the service for illegal financial activities or harassment.
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '12px' }}>4. Contact</h2>
              <p style={{ lineHeight: 1.6, color: 'var(--ink-soft)' }}>
                Questions regarding these Terms should be directed to <a href="mailto:click.us.platforms@gmail.com" style={{ color: 'var(--green)', textDecoration: 'underline' }}>click.us.platforms@gmail.com</a>.
              </p>
            </section>
          </article>
        </div>
      </main>
    </div>
  );
}
