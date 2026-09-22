'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';
import { getSupabaseClient } from '@/lib/supabase/client';
import Topbar from '@/components/Topbar';
import ExpenseRow from '@/components/ExpenseRow';
import ExpenseDetailModal from '@/components/ExpenseDetailModal';
import GroupSettingsModal from '@/components/GroupSettingsModal';
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
  group: { id: string; name: string; icon: string | null; created_by?: string };
  isMember?: boolean;
  memberCount?: number;
  members: Member[];
  expenses: Expense[];
  userBalance: number;
}

export default function GroupDetailPage() {
  const params = useParams();
  const groupId = params.id as string;
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<GroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  // Modals
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const fetchGroup = useCallback(async () => {
    try {
      const res = await fetch(`/api/split/groups/${groupId}`, { cache: 'no-store' });
      if (res.ok) {
        setData(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch group:', err);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      window.location.href = '/signin';
      return;
    }

    void fetchGroup();
  }, [user, authLoading, fetchGroup]);

  // Supabase Realtime synchronization
  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase || !groupId) return;

    const channel = supabase
      .channel(`group-realtime-${groupId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'split_expenses', filter: `group_id=eq.${groupId}` },
        () => { void fetchGroup(); },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'split_settlements', filter: `group_id=eq.${groupId}` },
        () => { void fetchGroup(); },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'split_group_members', filter: `group_id=eq.${groupId}` },
        () => { void fetchGroup(); },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'split_expense_items' },
        () => { void fetchGroup(); },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'split_expense_shares' },
        () => { void fetchGroup(); },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'split_groups', filter: `id=eq.${groupId}` },
        () => { void fetchGroup(); },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [groupId, fetchGroup]);

  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      void navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleExportCSV = () => {
    if (!data?.expenses || data.expenses.length === 0) return;
    const headers = ['Date', 'Description', 'Payer', 'Total Amount', 'Split Method', 'Your Share', 'Net Impact'];
    const rows = data.expenses.map((e) => [
      new Date(e.created_at).toLocaleDateString(),
      `"${e.description.replace(/"/g, '""')}"`,
      `"${e.payerName.replace(/"/g, '""')}"`,
      e.total_amount.toFixed(2),
      e.split_method,
      e.userShare.toFixed(2),
      e.userNet.toFixed(2),
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `${data.group.name.toLowerCase().replace(/\s+/g, '-')}-expenses.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleJoin = async () => {
    setJoining(true);
    setJoinError(null);
    try {
      const res = await fetch(`/api/split/groups/${groupId}/join`, {
        method: 'POST',
      });
      if (res.ok) {
        await fetchGroup();
      } else {
        const d = await res.json();
        setJoinError(d.error ?? 'Failed to join group');
      }
    } catch {
      setJoinError('Network error joining group');
    } finally {
      setJoining(false);
    }
  };

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

  const { group, isMember, members, expenses, userBalance } = data;

  // Invite acceptance screen if user is not a member yet
  if (isMember === false) {
    return (
      <div style={{ width: '100%', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Topbar />
        <main className="form-container" style={{ flex: 1 }}>
          <div className="form-card" style={{ textAlign: 'center', padding: '36px 24px' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>
              {group.icon ?? '👥'}
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '8px' }}>
              Join {group.name}
            </h1>
            <p style={{ color: 'var(--ink-soft)', fontSize: '14px', lineHeight: 1.6, marginBottom: '24px' }}>
              You have been invited to join this group. Become a member to split expenses, track balances, and settle up easily.
            </p>

            {joinError && (
              <p style={{ color: 'var(--red)', fontSize: '13px', marginBottom: '16px' }}>
                {joinError}
              </p>
            )}

            <button
              type="button"
              className="btn btn-primary btn-block"
              onClick={handleJoin}
              disabled={joining}
              style={{ fontSize: '15px', padding: '14px' }}
            >
              {joining ? 'Joining group…' : 'Join group'}
            </button>

            <div style={{ marginTop: '16px' }}>
              <Link href="/dashboard" style={{ fontSize: '13px', color: 'var(--grey)', textDecoration: 'underline' }}>
                Back to dashboard
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <Link href="/dashboard" className="back" style={{ margin: 0 }}>← All groups</Link>
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--ink)',
                  }}
                  title="Group Settings"
                  aria-label="Group Settings"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                </button>
              </div>

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
              <button
                type="button"
                onClick={handleCopyLink}
                className="btn btn-ghost btn-block"
                style={{ fontSize: '13px' }}
              >
                {copied ? 'Invite link copied' : 'Copy invite link'}
              </button>
              <button
                type="button"
                onClick={handleExportCSV}
                className="btn btn-ghost btn-block"
                style={{ fontSize: '13px' }}
                disabled={expenses.length === 0}
              >
                Export CSV
              </button>
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
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                      <span
                        aria-hidden="true"
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          overflow: 'hidden',
                          border: '1.5px solid var(--ink)',
                          background: 'var(--paper-dim)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flex: '0 0 auto',
                          fontSize: '11px',
                          fontWeight: 800,
                        }}
                      >
                        {m.image ? (
                          <img
                            src={m.image}
                            alt=""
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          m.name.trim().slice(0, 1).toUpperCase()
                        )}
                      </span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {m.userId === user?.id ? `${m.name} (You)` : m.name}
                      </span>
                    </span>
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
              <span style={{ fontSize: '12px', color: 'var(--grey)', fontWeight: 600 }}>
                Click any expense to view details
              </span>
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
                      title={expense.description}
                      subtitle={`Paid by ${expense.paid_by === user?.id ? 'you' : expense.payerName} · split ${expense.memberCount} way${expense.memberCount !== 1 ? 's' : ''}`}
                      totalAmount={expense.total_amount}
                      userShare={expense.userNet}
                      onClick={() => setSelectedExpenseId(expense.id)}
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

      {/* Expense Detail Modal */}
      {selectedExpenseId && (
        <ExpenseDetailModal
          expenseId={selectedExpenseId}
          members={members.map((m) => ({ userId: m.userId, name: m.name }))}
          onClose={() => setSelectedExpenseId(null)}
          onUpdated={() => {
            void fetchGroup();
          }}
        />
      )}

      {/* Group Settings Modal */}
      {settingsOpen && (
        <GroupSettingsModal
          groupId={groupId}
          groupName={group.name}
          groupIcon={group.icon}
          members={members}
          isCreator={group.created_by === user?.id}
          currentUserId={user?.id ?? ''}
          onClose={() => setSettingsOpen(false)}
          onUpdated={() => {
            void fetchGroup();
          }}
        />
      )}
    </div>
  );
}
