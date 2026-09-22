'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import Topbar from '@/components/Topbar';
import BalanceHero from '@/components/BalanceHero';
import GroupCard from '@/components/GroupCard';
import FAB from '@/components/FAB';
import JoinGroupModal from '@/components/JoinGroupModal';
import Link from 'next/link';

interface GroupData {
  id: string;
  name: string;
  icon: string | null;
  balance: number;
  members: string[];
  memberCount: number;
  expenseCount: number;
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [groups, setGroups] = useState<GroupData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      window.location.href = '/signin';
      return;
    }

    const fetchGroups = async () => {
      try {
        const res = await fetch('/api/split/groups');
        if (res.ok) {
          const data = await res.json();
          setGroups(data.groups ?? []);
        }
      } catch (err) {
        console.error('Failed to fetch groups:', err);
      } finally {
        setLoading(false);
      }
    };

    void fetchGroups();
  }, [user, authLoading]);

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

  // Determine which group FAB should link to (most recent, or new group if none)
  const fabHref = groups.length > 0 ? `/group/${groups[0].id}/add` : '/group/new';

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
                memberSummary={`${group.members.join(', ')} · ${group.expenseCount} expense${group.expenseCount !== 1 ? 's' : ''}`}
                balance={group.balance}
              />
            ))}
          </div>
        )}

        <FAB href={fabHref} />

        <JoinGroupModal
          isOpen={isJoinModalOpen}
          onClose={() => setIsJoinModalOpen(false)}
        />
      </main>
    </div>
  );
}
