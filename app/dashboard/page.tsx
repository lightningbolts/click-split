'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import Topbar from '@/components/Topbar';
import BalanceHero from '@/components/BalanceHero';
import GroupCard from '@/components/GroupCard';
import FAB from '@/components/FAB';
import JoinGroupModal from '@/components/JoinGroupModal';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/supabase/client';

interface GroupData {
  id: string;
  name: string;
  icon: string | null;
  balance: number;
  members: string[];
  memberCount: number;
  expenseCount: number;
  totalSpend?: number;
  latestExpense?: {
    description: string;
    amount: number;
    payer: string;
    createdAt: string;
  } | null;
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [groups, setGroups] = useState<GroupData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [isExpensePickerOpen, setIsExpensePickerOpen] = useState(false);

  const fetchGroups = useCallback(async () => {
    try {
      const res = await fetch('/api/split/groups', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setGroups(data.groups ?? []);
      }
    } catch (err) {
      console.error('Failed to fetch groups:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      window.location.href = '/signin';
      return;
    }

    void fetchGroups();
  }, [user, authLoading, fetchGroups]);

  useEffect(() => {
    if (!user) return;

    const supabase = getSupabaseClient();
    if (!supabase) return;

    const refresh = () => { void fetchGroups(); };
    const channel = supabase
      .channel(`split-dashboard-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'split_expenses' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'split_expense_items' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'split_expense_shares' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'split_settlements' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'split_group_members' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'split_groups' }, refresh)
      .subscribe();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', handleVisibility);
      void supabase.removeChannel(channel);
    };
  }, [user, fetchGroups]);

  if (authLoading || loading) {
    return (
      <div style={{ width: '100%', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Topbar />
        <div className="loading-screen">
          <div className="spinner" />
        </div>
      </div>
    );
  }

  // Compute overall balances
  const owedToUser = groups.reduce((sum, g) => sum + Math.max(0, g.balance), 0);
  const userOwes = groups.reduce((sum, g) => sum + Math.abs(Math.min(0, g.balance)), 0);
  const netBalance = owedToUser - userOwes;

  return (
    <div style={{ width: '100%', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Topbar />

      <main className="page-container" style={{ flex: 1 }}>
        <BalanceHero
          netBalance={netBalance}
          owedToUser={owedToUser}
          userOwes={userOwes}
        />

        <div className="section-head">
          <h2>Your groups</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              type="button"
              onClick={() => setIsJoinModalOpen(true)}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                fontSize: '13px',
                fontWeight: 800,
                color: 'var(--ink-soft)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontFamily: 'inherit',
              }}
            >
              Join group
            </button>
            <span style={{ color: 'var(--grey)', fontSize: '12px' }}>•</span>
            <Link
              href="/group/new"
              style={{
                fontSize: '13px',
                fontWeight: 800,
                color: 'var(--green)',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              + New group
            </Link>
          </div>
        </div>

        {groups.length === 0 ? (
          <div className="empty-state">
            <p>No groups yet. Create one or join an existing group to start splitting bills.</p>
            <div style={{ marginTop: '20px', display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link
                href="/group/new"
                className="btn btn-primary"
                style={{ display: 'inline-flex' }}
              >
                Create a group
              </Link>
              <button
                type="button"
                onClick={() => setIsJoinModalOpen(true)}
                className="btn btn-ghost"
                style={{ display: 'inline-flex' }}
              >
                Join a group
              </button>
            </div>
          </div>
        ) : (
          <div className="groups-grid">
            {groups.map((group) => (
              <GroupCard
                key={group.id}
                id={group.id}
                name={group.name}
                icon={group.icon ?? '👥'}
                members={group.members}
                memberCount={group.memberCount}
                expenseCount={group.expenseCount}
                totalSpend={group.totalSpend ?? 0}
                latestExpense={group.latestExpense}
                balance={group.balance}
              />
            ))}
          </div>
        )}

        <FAB
          ariaLabel={groups.length > 0 ? 'Add expense' : 'Create group'}
          onClick={() => {
            if (groups.length === 0) {
              window.location.href = '/group/new';
              return;
            }
            setIsExpensePickerOpen(true);
          }}
        />

        {isExpensePickerOpen && (
          <div
            className="modal-overlay"
            role="presentation"
            onClick={(event) => {
              if (event.target === event.currentTarget) setIsExpensePickerOpen(false);
            }}
          >
            <div
              className="modal-card expense-group-picker"
              role="dialog"
              aria-modal="true"
              aria-labelledby="expense-group-picker-title"
            >
              <div className="modal-head">
                <div>
                  <h3 id="expense-group-picker-title">Add expense</h3>
                  <p className="modal-subtitle">Choose which group this expense belongs to.</p>
                </div>
                <button
                  type="button"
                  className="modal-close-btn"
                  onClick={() => setIsExpensePickerOpen(false)}
                  aria-label="Close"
                >
                  ×
                </button>
              </div>

              <div className="expense-group-list">
                {groups.map((group) => (
                  <Link
                    key={group.id}
                    href={`/group/${group.id}/add`}
                    className="expense-group-option"
                    onClick={() => setIsExpensePickerOpen(false)}
                  >
                    <span className="expense-group-option-icon">{group.icon ?? '👥'}</span>
                    <span className="expense-group-option-body">
                      <strong>{group.name}</strong>
                      <span>
                        {group.memberCount} member{group.memberCount !== 1 ? 's' : ''} · {group.expenseCount} expense{group.expenseCount !== 1 ? 's' : ''}
                      </span>
                    </span>
                    <span className="expense-group-option-arrow" aria-hidden="true">→</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

        <JoinGroupModal
          isOpen={isJoinModalOpen}
          onClose={() => setIsJoinModalOpen(false)}
        />
      </main>
    </div>
  );
}
