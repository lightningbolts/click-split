import Link from 'next/link';

export const metadata = {
  title: 'Support & Help | Click Split',
  description: 'Help, FAQ, and Support for Click Split by Click Platforms.',
};

export default function SupportPage() {
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
            <Link href="/" className="btn btn-small">
              Home
            </Link>
          </div>
        </div>
      </header>

      <main style={{ flex: 1, padding: '40px 20px 80px' }}>
        <div className="page-container" style={{ maxWidth: '800px' }}>
          <article style={{ background: 'var(--white)', border: 'var(--border)', boxShadow: 'var(--shadow-md)', padding: '36px 32px' }}>
            <div className="eyebrow" style={{ color: 'var(--green)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', fontSize: '12px' }}>
              Click Platforms · Customer Support
            </div>
            <h1 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '8px', letterSpacing: '-0.02em' }}>Click Split Support</h1>
            <p style={{ color: 'var(--grey)', fontSize: '14px', marginBottom: '32px' }}>
              We&apos;re here to help you get the most out of Click Split on iOS and Web.
            </p>

            <section style={{ marginBottom: '32px', padding: '20px', background: 'var(--paper)', border: '1.5px solid var(--ink)' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '8px' }}>Contact Support</h2>
              <p style={{ lineHeight: 1.6, color: 'var(--ink-soft)', marginBottom: '12px' }}>
                Need help with a group balance, receipt scan, or your account? Email our dedicated support team:
              </p>
              <div style={{ fontSize: '16px', fontWeight: 800 }}>
                Email:{' '}
                <a href="mailto:support@joinclick.co" style={{ color: 'var(--green)', textDecoration: 'underline' }}>
                  support@joinclick.co
                </a>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--grey)', marginTop: '6px' }}>
                Typical response time: within 24 hours.
              </p>
            </section>

            <section style={{ marginBottom: '32px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '16px' }}>Frequently Asked Questions</h2>

              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 800, marginBottom: '6px' }}>How do I invite friends to a group?</h3>
                <p style={{ lineHeight: 1.6, color: 'var(--ink-soft)' }}>
                  Inside any group in Click Split, tap &quot;Invite Members&quot; or copy the 6-character group invite code. Friends can enter the code on the mobile app or web app to join immediately.
                </p>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 800, marginBottom: '6px' }}>How does receipt scanning work?</h3>
                <p style={{ lineHeight: 1.6, color: 'var(--ink-soft)' }}>
                  Take a photo of any receipt or upload one from your camera roll. Click Split automatically extracts each item and price. You can then assign specific items to individual people or split them evenly.
                </p>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 800, marginBottom: '6px' }}>Does Click Split process bank transfers directly?</h3>
                <p style={{ lineHeight: 1.6, color: 'var(--ink-soft)' }}>
                  Click Split calculates mathematical net balances and launches external payment apps (Venmo, Cash App, Zelle, or Apple Pay) with pre-filled amounts and recipients. We do not hold your money.
                </p>
              </div>

              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 800, marginBottom: '6px' }}>How do I delete my account?</h3>
                <p style={{ lineHeight: 1.6, color: 'var(--ink-soft)' }}>
                  You can delete your account and associated data by emailing <a href="mailto:support@joinclick.co" style={{ color: 'var(--green)', textDecoration: 'underline' }}>support@joinclick.co</a> with the subject line &quot;Delete Account&quot;. All personal identifying data will be permanently wiped.
                </p>
              </div>
            </section>
          </article>
        </div>
      </main>
    </div>
  );
}
