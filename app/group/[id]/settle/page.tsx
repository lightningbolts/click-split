'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';
import Topbar from '@/components/Topbar';
import PaymentOption from '@/components/PaymentOption';
import SettleConfirm from '@/components/SettleConfirm';
import { formatMoney } from '@/lib/balance';

interface MemberBalance {
  userId: string;
  name: string;
  balance: number;
}

export default function SettleUpPage() {
  const params = useParams();
  const groupId = params.id as string;
  const { user, loading: authLoading } = useAuth();

  const [groupName, setGroupName] = useState('');
  const [memberBalances, setMemberBalances] = useState<MemberBalance[]>([]);
  const [selectedMember, setSelectedMember] = useState<MemberBalance | null>(null);
  const [settled, setSettled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !user) return;

    const fetchData = async () => {
      try {
        const res = await fetch(`/api/split/groups/${groupId}`);
        if (res.ok) {
          const data = await res.json();
          setGroupName(data.group.name);

          // Find members who owe/are owed by the current user
          // We need pairwise balances - for now, approximate from the global balance
          const otherMembers = (data.members ?? [])
            .filter((m: MemberBalance) => m.userId !== user.id)
            .map((m: MemberBalance) => ({
              ...m,
              // The balance from the API is that member's own net balance in the group.
              // A negative balance for them can mean they owe money overall.
              // For the settle-up view we need pairwise - this is an approximation.
              balance: -m.balance, // If they're negative, they owe the group
            }));

          setMemberBalances(otherMembers);

          // Auto-select the first member who owes
          const owesUser = otherMembers.find((m: MemberBalance) => m.balance > 0);
          if (owesUser) {
            setSelectedMember(owesUser);
          } else if (otherMembers.length > 0) {
            setSelectedMember(otherMembers[0]);
          }
        }
      } catch (err) {
        console.error('Failed to fetch group for settle up:', err);
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, [groupId, user, authLoading]);

  const handleSettle = async (method: string) => {
    if (!selectedMember || !user) return;

    const amount = Math.abs(selectedMember.balance);
    if (amount <= 0) return;

    // Determine direction: who pays whom
    const fromUser = selectedMember.balance > 0 ? selectedMember.userId : user.id;
    const toUser = selectedMember.balance > 0 ? user.id : selectedMember.userId;

    if (method === 'venmo') {
      // Open Venmo deep link
      window.open(`https://venmo.com/?txn=pay&amount=${amount.toFixed(2)}`, '_blank');
    } else if (method === 'zelle') {
      // Open Zelle - no universal deep link, open web
      window.open('https://www.zellepay.com/send-money', '_blank');
    }

    // Record the settlement
    try {
      const res = await fetch('/api/split/settlements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId,
          fromUser,
          toUser,
          amount,
          method,
        }),
      });

      if (res.ok) {
        setSettled(true);
      } else {
        const errData = await res.json().catch(() => ({}));
        console.error('Settlement error:', errData);
      }
    } catch (err) {
      console.error('Settlement error:', err);
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

  if (!selectedMember) {
    return (
      <div style={{ width: '100%', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Topbar />
        <main className="form-container" style={{ flex: 1 }}>
          <div className="form-card">
            <div className="group-head" style={{ borderBottom: 'none', padding: '20px' }}>
              <Link href={`/group/${groupId}`} className="back">← {groupName}</Link>
            </div>
            <div className="empty-state">
              <p>Everyone is settled up! 🎉</p>
              <Link href={`/group/${groupId}`} className="btn btn-primary" style={{ marginTop: '16px', display: 'inline-flex' }}>
                Back to group
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const amount = Math.abs(selectedMember.balance);
  const owesUser = selectedMember.balance > 0;
  const stampText = owesUser
    ? `${selectedMember.name.toUpperCase()} OWES YOU`
    : `YOU OWE ${selectedMember.name.toUpperCase()}`;

  return (
    <div style={{ width: '100%', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Topbar />

      <main className="form-container" style={{ flex: 1 }}>
        <div className="form-card">
          <div className="group-head" style={{ borderBottom: 'none', padding: '20px 24px 0' }}>
            <Link href={`/group/${groupId}`} className="back">← {groupName}</Link>
          </div>

          <div className="settle-hero">
            <div className={`stamp ${settled ? 'settled' : ''}`}>{stampText}</div>
            <div className="amount tabular">{formatMoney(amount)}</div>
            <p>
              Settle this and {selectedMember.name}&apos;s balance with you goes to $0.00
            </p>
          </div>

          {!settled && (
            <div style={{ paddingBottom: '24px' }}>
              {memberBalances.length > 1 && (
                <div className="section-head" style={{ padding: '16px 24px 8px' }}>
                  <h2>Settle with</h2>
                </div>
              )}
              {memberBalances.length > 1 &&
                memberBalances.map((m) => (
                  <button
                    key={m.userId}
                    className="pay-opt"
                    onClick={() => { setSelectedMember(m); setSettled(false); }}
                    style={m.userId === selectedMember.userId ? { background: 'var(--paper-dim)' } : undefined}
                  >
                    <div className="p-name">
                      <span className="p-icon">{m.name[0]}</span>
                      {m.name} · {formatMoney(Math.abs(m.balance))}
                    </div>
                    <span className="arrow">→</span>
                  </button>
                ))
              }

              <div className="section-head" style={{ padding: '16px 24px 8px' }}>
                <h2>Mark as paid via</h2>
              </div>
              <PaymentOption icon="$" label="Venmo" onClick={() => handleSettle('venmo')} />
              <PaymentOption icon="Z" label="Zelle" onClick={() => handleSettle('zelle')} />
              <PaymentOption icon="✓" label="Cash / already paid" onClick={() => handleSettle('cash')} />
            </div>
          )}

          {settled && (
            <div style={{ paddingBottom: '24px' }}>
              <SettleConfirm
                counterpartyName={selectedMember.name}
                groupName={groupName}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
