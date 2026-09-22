import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy | Click Split',
  description: 'Privacy Policy for Click Split by Click Platforms.',
};

export default function PrivacyPolicyPage() {
  return (
    <div style={{ width: '100%', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="topbar">
        <div className="topbar-inner">
          <Link href="/" className="brand">
            <span className="mark" />
            Click Split
          </Link>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Link href="/support" className="btn btn-ghost btn-small">
              Support
            </Link>
            <Link href="/" className="btn btn-small">
              Home
            </Link>
          </div>
        </div>
      </header>

      <main style={{ flex: 1, padding: '40px 20px 80px' }}>
        <div className="page-container" style={{ maxWidth: '800px' }}>
          <article className="legal-doc" style={{ background: 'var(--white)', border: 'var(--border)', boxShadow: 'var(--shadow-md)', padding: '36px 32px' }}>
            <div className="eyebrow" style={{ color: 'var(--green)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', fontSize: '12px' }}>
              Click Platforms · Legal
            </div>
            <h1 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '8px', letterSpacing: '-0.02em' }}>Privacy Policy</h1>
            <p style={{ color: 'var(--grey)', fontSize: '14px', marginBottom: '32px' }}>Last updated: September 21, 2026</p>

            <section style={{ marginBottom: '28px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '12px' }}>1. Overview</h2>
              <p style={{ lineHeight: 1.6, color: 'var(--ink-soft)', marginBottom: '12px' }}>
                Click Split (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) is a group expense tracking service developed by Click Platforms. This Privacy Policy describes how your information is collected, used, and protected when you use the Click Split iOS application and web application.
              </p>
              <p style={{ lineHeight: 1.6, color: 'var(--ink-soft)' }}>
                Click Split integrates with your Click account identity, allowing seamless authentication without managing multiple credentials.
              </p>
            </section>

            <section style={{ marginBottom: '28px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '12px' }}>2. Information We Collect</h2>
              <ul style={{ paddingLeft: '20px', lineHeight: 1.7, color: 'var(--ink-soft)' }}>
                <li><strong>Account Identity:</strong> Your user ID, name, email address, and avatar image provided through your Click account (via Google OAuth or Sign in with Apple).</li>
                <li><strong>Expense & Group Data:</strong> Group names, member lists, item descriptions, split amounts, item assignments, and payment settlement records you create.</li>
                <li><strong>Receipt Images:</strong> Photographs or images of physical receipts you choose to upload for OCR item extraction.</li>
                <li><strong>Technical Diagnostics:</strong> Crash logs and performance diagnostics necessary to maintain app stability.</li>
              </ul>
            </section>

            <section style={{ marginBottom: '28px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '12px' }}>3. How We Use Information</h2>
              <ul style={{ paddingLeft: '20px', lineHeight: 1.7, color: 'var(--ink-soft)' }}>
                <li>To calculate running balances and simplify debt settlements between group members.</li>
                <li>To extract line items and prices from receipts via optical character recognition.</li>
                <li>To synchronize shared group records in real time across iOS and web clients.</li>
                <li>We <strong>never sell</strong> your personal information or use your expense records for targeted advertising.</li>
              </ul>
            </section>

            <section style={{ marginBottom: '28px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '12px' }}>4. Data Storage & Security</h2>
              <p style={{ lineHeight: 1.6, color: 'var(--ink-soft)' }}>
                All user and expense data is encrypted in transit (TLS 1.3) and stored in secure cloud infrastructure provided by Supabase with Row Level Security (RLS) enforcing strict access controls. Only members of a group can view that group&apos;s expenses and balances.
              </p>
            </section>

            <section style={{ marginBottom: '28px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '12px' }}>5. Account Deletion & Data Rights</h2>
              <p style={{ lineHeight: 1.6, color: 'var(--ink-soft)' }}>
                You have the right to request deletion of your account and associated expense records at any time. You can request account deletion directly within the app under Profile, or by emailing <a href="mailto:support@joinclick.co" style={{ color: 'var(--green)', textDecoration: 'underline' }}>support@joinclick.co</a>.
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '12px' }}>6. Contact Us</h2>
              <p style={{ lineHeight: 1.6, color: 'var(--ink-soft)' }}>
                For questions or privacy inquiries regarding Click Split, please contact us at:
              </p>
              <p style={{ marginTop: '8px', color: 'var(--ink)' }}>
                <strong>Click Platforms Support</strong><br />
                Email: <a href="mailto:support@joinclick.co" style={{ color: 'var(--green)', textDecoration: 'underline' }}>support@joinclick.co</a><br />
                Website: <a href="https://joinclick.co" style={{ color: 'var(--green)', textDecoration: 'underline' }}>joinclick.co</a>
              </p>
            </section>
          </article>
        </div>
      </main>
    </div>
  );
}
