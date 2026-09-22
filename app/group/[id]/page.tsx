'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';
import Topbar from '@/components/Topbar';
import ExpenseRow from '@/components/ExpenseRow';
import { formatMoney } from '@/lib/balance';
import { groupByDate } from '@/lib/dates';

interface Member {
  userId: string;
  name: string;
  image: string | null;
  balance: number;
}

interface Expense {
  id: string;
  description: string;
  total_amount: number;
  paid_by: string;
  payerName: string;
  split_method: string;
  source: string;
  created_at: string;
  userShare: number;
  userNet: number;
  memberCount: number;
}

interface GroupDetail {
  group: { id: string; name: string; icon: string | null };
  members: Member[];
  expenses: Expense[];
  userBalance: number;
}

const EXPENSE_ICONS: Record<string, string> = {
  groceries: '🛒', food: '🍕', electric: '💡', supplies: '🧻',
  gas: '⛽', rent: '🏠', water: '💧', internet: '📶',
};

function guessIcon(description: string): string {
  const lower = description.toLowerCase();
  for (const [key, icon] of Object.entries(EXPENSE_ICONS)) {
    if (lower.includes(key)) return icon;
  }
  return '💳';
}

export default function GroupDetailPage() {
  const params = useParams();
  const groupId = params.id as string;
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<GroupDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      window.location.href = '/signin';
      return;
    }

    const fetchGroup = async () => {
      try {
        const res = await fetch(`/api/split/groups/${groupId}`);
        if (res.ok) {
          setData(await res.json());
        }
      } catch (err) {
        console.error('Failed to fetch group:', err);
      } finally {
        setLoading(false);
      }
    };

    void fetchGroup();
  }, [groupId, user, authLoading]);

  if (authLoading || loading) {
    return (
      <div style={{ width: '100%', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Topbar />
        <div className="loading-screen"><div className="spinner" /></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ width: '100%', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Topbar />
        <div className="empty-state"><p>Group not found.</p></div>
      </div>
    );
  }

  const { group, members, expenses, userBalance } = data;

  const memberNames = members
    .map((m) => (m.userId === user?.id ? 'You' : m.name))
    .join(', ');

  const balanceColor = userBalance >= 0 ? 'var(--green)' : 'var(--red)';
  const balancePrefix = userBalance >= 0 ? "You're owed" : 'You owe';

  // Group expenses by date
  const grouped = groupByDate(expenses, (e) => new Date(e.created_at));

  return (
    <div style={{ width: '100%', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Topbar />

      <main className="page-container" style={{ flex: 1 }}>
        <div className="group-layout">
          {/* Left Sidebar (Sticky on Desktop) */}
          <aside className="group-sidebar">
            <div className="group-head">
              <Link href="/dashboard" className="back">← All groups</Link>
              <h1>{group.icon ? `${group.icon} ` : ''}{group.name}</h1>
              <p className="members">{memberNames}</p>
            </div>

            <div
              style={{
                border: '1.5px solid var(--ink)',
                background: userBalance >= 0 ? 'var(--green-dim)' : 'var(--red-dim)',
                padding: '16px',
              }}
            >
              <div style={{ fontSize: '11.5px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--ink-soft)' }}>
                Your Group Balance
              </div>
              <div
                className="tabular"
                style={{
                  fontSize: '28px',
                  fontWeight: 800,
                  color: balanceColor,
                  marginTop: '4px',
                }}
              >
                {balancePrefix} {formatMoney(Math.abs(userBalance))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <Link href={`/group/${groupId}/add`} className="btn btn-primary btn-block">
                + Add expense
              </Link>
              <Link href={`/group/${groupId}/settle`} className="btn btn-ghost btn-block">
                Settle up
              </Link>
            </div>

            <div>
              <div style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--grey)', marginBottom: '8px' }}>
                Group Members ({members.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {members.map((m) => (
                  <div
                    key={m.userId}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '13.5px',
                    }}
                  >
                    <span>{m.userId === user?.id ? `${m.name} (You)` : m.name}</span>
                    <span
                      className="tabular"
                      style={{
                        fontWeight: 700,
                        color: m.balance > 0 ? 'var(--green)' : m.balance < 0 ? 'var(--red)' : 'var(--grey)',
                      }}
                    >
                      {m.balance > 0 ? `+${formatMoney(m.balance)}` : m.balance < 0 ? `-${formatMoney(Math.abs(m.balance))}` : '$0.00'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          {/* Right Main Content (Expenses Feed) */}
          <section className="group-feed">
            <div
              style={{
                padding: '16px 20px',
                borderBottom: 'var(--border)',
                background: 'var(--paper-dim)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <h2 style={{ fontSize: '14px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Expense Activity ({expenses.length})
              </h2>
            </div>

            {expenses.length === 0 ? (
              <div className="empty-state">
                <p>No expenses yet. Add one to get started.</p>
                <Link
                  href={`/group/${groupId}/add`}
                  className="btn btn-primary"
                  style={{ marginTop: '16px', display: 'inline-flex' }}
                >
                  Add the first expense
                </Link>
              </div>
            ) : (
              grouped.map(([label, items]) => (
                <div key={label}>
                  <div className="date-divider">{label}</div>
                  {items.map((expense) => (
                    <ExpenseRow
                      key={expense.id}
                      icon={guessIcon(expense.description)}
                      title={expense.description}
                      subtitle={`Paid by ${expense.paid_by === user?.id ? 'you' : expense.payerName} · split ${expense.memberCount} way${expense.memberCount !== 1 ? 's' : ''}`}
                      totalAmount={expense.total_amount}
                      userShare={expense.userNet}
                    />
                  ))}
                </div>
              ))
            )}
          </section>
        </div>
      </main>

      {/* Mobile Sticky Settle Bar */}
      <div className="settle-bar settle-bar-mobile">
        <Link href={`/group/${groupId}/add`} className="btn btn-ghost" style={{ flex: 1 }}>
          + Add expense
        </Link>
        <Link href={`/group/${groupId}/settle`} className="btn btn-primary" style={{ flex: 1 }}>
          Settle up
        </Link>
      </div>
    </div>
  );
}
