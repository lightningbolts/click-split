'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';
import Topbar from '@/components/Topbar';
import PaymentOption from '@/components/PaymentOption';
import SettleConfirm from '@/components/SettleConfirm';
import { formatMoney } from '@/lib/balance';
import {
  simplifyDebts,
  SimplifiedTransaction,
  roundToCent,
} from '@/lib/debtSimplification';
import {
  PAYMENT_RAILS,
  PaymentMethod,
  launchPaymentRail,
} from '@/lib/paymentIntegrations';

interface MemberData {
  userId: string;
  name: string;
  image: string | null;
  balance: number;
}

export default function SettleUpPage() {
  const params = useParams();
  const groupId = params.id as string;
  const { user, loading: authLoading } = useAuth();

  const [groupName, setGroupName] = useState('');
  const [members, setMembers] = useState<MemberData[]>([]);
  const [selectedTx, setSelectedTx] = useState<SimplifiedTransaction | null>(null);
  const [activeRail, setActiveRail] = useState<PaymentMethod | null>(null);
  const [handleInput, setHandleInput] = useState('');
  const [settled, setSettled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [settling, setSettling] = useState(false);
  const [pendingMethod, setPendingMethod] = useState<PaymentMethod | null>(null);
  const [paymentInstructions, setPaymentInstructions] = useState<string | null>(null);
  const [viewAllGroupDebts, setViewAllGroupDebts] = useState(false);

  useEffect(() => {
    if (authLoading || !user) return;

    const fetchData = async () => {
      try {
        const res = await fetch(`/api/split/groups/${groupId}`);
        if (res.ok) {
          const data = await res.json();
          setGroupName(data.group.name);
          setMembers(data.members ?? []);
        }
      } catch (err) {
        console.error('Failed to fetch group for settle up:', err);
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, [groupId, user, authLoading]);

  // Compute N-party minimum cash flow transactions
  const allTransactions = useMemo(() => {
    if (members.length === 0) return [];
    return simplifyDebts(
      members.map((m) => ({
        userId: m.userId,
        name: m.name,
        balance: m.balance,
      })),
    );
  }, [members]);

  // User's direct obligations
  const userToPay = useMemo(() => {
    if (!user) return [];
    return allTransactions.filter((t) => t.fromUserId === user.id);
  }, [allTransactions, user]);

  const userToReceive = useMemo(() => {
    if (!user) return [];
    return allTransactions.filter((t) => t.toUserId === user.id);
  }, [allTransactions, user]);

  const otherTransactions = useMemo(() => {
    if (!user) return [];
    return allTransactions.filter((t) => t.fromUserId !== user.id && t.toUserId !== user.id);
  }, [allTransactions, user]);

  // Select initial transaction
  useEffect(() => {
    if (!selectedTx) {
      if (userToPay.length > 0) {
        setSelectedTx(userToPay[0]);
      } else if (userToReceive.length > 0) {
        setSelectedTx(userToReceive[0]);
      } else if (allTransactions.length > 0) {
        setSelectedTx(allTransactions[0]);
      }
    }
  }, [selectedTx, userToPay, userToReceive, allTransactions]);

  // Load saved handle for selected recipient when active rail changes
  useEffect(() => {
    if (selectedTx && activeRail && activeRail !== 'cash') {
      const recipientId = selectedTx.toUserId;
      const key = `click_split_${recipientId}_${activeRail}`;
      const saved = typeof window !== 'undefined' ? localStorage.getItem(key) : null;
      if (saved) {
        setHandleInput(saved);
      } else {
        setHandleInput('');
      }
    }
  }, [selectedTx, activeRail]);

  const recordSettlement = async (method: PaymentMethod | 'manual') => {
    if (!selectedTx || !user) return;
    if (user.id !== selectedTx.fromUserId && user.id !== selectedTx.toUserId) return;

    setSettling(true);
    try {
      const res = await fetch('/api/split/settlements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId,
          fromUser: selectedTx.fromUserId,
          toUser: selectedTx.toUserId,
          amount: selectedTx.amount,
          method,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error ?? 'Failed to record settlement');
      }

      setSettled(true);
      setPendingMethod(null);
      setPaymentInstructions(null);

      const refreshed = await fetch(`/api/split/groups/${groupId}`);
      if (refreshed.ok) {
        const data = await refreshed.json();
        setMembers(data.members ?? []);
      }
    } catch (err) {
      console.error('Settlement error:', err);
    } finally {
      setSettling(false);
    }
  };

  const handlePaymentMethod = async (method: PaymentMethod) => {
    if (!selectedTx || !user) return;

    if (method === 'cash') {
      await recordSettlement('cash');
      return;
    }

    // Only the debtor should launch a payment rail. Opening an external app is
    // not proof that a transfer completed, so settlement is confirmed separately.
    if (user.id !== selectedTx.fromUserId) return;

    if (handleInput.trim()) {
      try {
        localStorage.setItem(`click_split_${selectedTx.toUserId}_${method}`, handleInput.trim());
      } catch {}
    }

    setSettling(true);
    try {
      const result = await launchPaymentRail({
        method,
        recipientHandle: handleInput.trim() || undefined,
        amount: selectedTx.amount,
        groupName,
        recipientName: selectedTx.toName,
      });
      if (result.launched) {
        setPendingMethod(method);
        setPaymentInstructions(result.instructions ?? null);
      }
    } finally {
      setSettling(false);
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

  if (allTransactions.length === 0) {
    return (
      <div style={{ width: '100%', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Topbar />
        <main className="form-container" style={{ flex: 1 }}>
          <div className="form-card">
            <div className="group-head" style={{ borderBottom: 'none', padding: '20px' }}>
              <Link href={`/group/${groupId}`} className="back">← {groupName}</Link>
            </div>
            <div className="empty-state">
              <p>Everyone is settled up! All balances are $0.00</p>
              <Link href={`/group/${groupId}`} className="btn btn-primary" style={{ marginTop: '16px', display: 'inline-flex' }}>
                Back to group
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const isCurrentUserPaying = selectedTx?.fromUserId === user?.id;
  const isCurrentUserReceiving = selectedTx?.toUserId === user?.id;

  const stampText = isCurrentUserPaying
    ? `YOU OWE ${selectedTx?.toName.toUpperCase()}`
    : isCurrentUserReceiving
    ? `${selectedTx?.fromName.toUpperCase()} OWES YOU`
    : `${selectedTx?.fromName.toUpperCase()} PAYS ${selectedTx?.toName.toUpperCase()}`;

  return (
    <div style={{ width: '100%', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Topbar />

      <main className="form-container" style={{ flex: 1 }}>
        <div className="form-card">
          <div className="group-head" style={{ borderBottom: 'none', padding: '20px 24px 0' }}>
            <Link href={`/group/${groupId}`} className="back">← {groupName}</Link>
          </div>

          {selectedTx && (
            <div className="settle-hero">
              <div className={`stamp ${settled ? 'settled' : ''}`}>{stampText}</div>
              <div className="amount tabular">{formatMoney(selectedTx.amount)}</div>
              <p>
                {isCurrentUserPaying
                  ? `Pay ${selectedTx.toName} to reduce your group debt.`
                  : isCurrentUserReceiving
                  ? `${selectedTx.fromName} owes you this amount.`
                  : `Group settlement between ${selectedTx.fromName} and ${selectedTx.toName}.`}
              </p>
            </div>
          )}

          {!settled && selectedTx && (
            <div style={{ paddingBottom: '24px' }}>
              {/* N-Party Transfer Selector */}
              <div style={{ padding: '0 24px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 800 }}>Choose payment to settle:</span>
                  {otherTransactions.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setViewAllGroupDebts((v) => !v)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--green)',
                        fontSize: '12px',
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}
                    >
                      {viewAllGroupDebts ? 'Show only mine' : `All group debts (${allTransactions.length})`}
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {userToPay.map((tx) => (
                    <button
                      key={tx.id}
                      type="button"
                      className="pay-opt"
                      onClick={() => { setSelectedTx(tx); setActiveRail(null); }}
                      style={{
                        border: tx.id === selectedTx.id ? '2px solid var(--ink)' : '1px solid var(--paper-dim)',
                        background: tx.id === selectedTx.id ? 'var(--green-dim)' : 'var(--white)',
                      }}
                    >
                      <div className="p-name">
                        <span className="p-icon" style={{ fontWeight: 800 }}>→</span>
                        <span>You pay <strong>{tx.toName}</strong></span>
                      </div>
                      <span className="tabular" style={{ fontWeight: 800 }}>{formatMoney(tx.amount)}</span>
                    </button>
                  ))}

                  {userToReceive.map((tx) => (
                    <button
                      key={tx.id}
                      type="button"
                      className="pay-opt"
                      onClick={() => { setSelectedTx(tx); setActiveRail(null); }}
                      style={{
                        border: tx.id === selectedTx.id ? '2px solid var(--ink)' : '1px solid var(--paper-dim)',
                        background: tx.id === selectedTx.id ? 'var(--green-dim)' : 'var(--white)',
                      }}
                    >
                      <div className="p-name">
                        <span className="p-icon" style={{ fontWeight: 800 }}>←</span>
                        <span><strong>{tx.fromName}</strong> pays you</span>
                      </div>
                      <span className="tabular" style={{ fontWeight: 800 }}>{formatMoney(tx.amount)}</span>
                    </button>
                  ))}

                  {viewAllGroupDebts &&
                    otherTransactions.map((tx) => (
                      <button
                        key={tx.id}
                        type="button"
                        className="pay-opt"
                        disabled
                        style={{
                          border: '1px solid var(--paper-dim)',
                          background: 'var(--white)',
                          cursor: 'default',
                          opacity: 0.75,
                        }}
                      >
                        <div className="p-name">
                          <span className="p-icon" style={{ fontWeight: 800 }}>•</span>
                          <span>{tx.fromName} pays <strong>{tx.toName}</strong></span>
                        </div>
                        <span className="tabular" style={{ fontWeight: 800 }}>{formatMoney(tx.amount)}</span>
                      </button>
                    ))}
                </div>
              </div>

              {isCurrentUserPaying && (
                <>
                  {/* Payment Rails Section */}
                  <div className="section-head" style={{ padding: '12px 24px 8px' }}>
                    <h2>Select Payment Method</h2>
                  </div>
                </>
              )}

              {/* Recipient Handle Prompt if active rail requires it */}
              {isCurrentUserPaying && activeRail && activeRail !== 'cash' && (
                <div
                  style={{
                    margin: '0 24px 16px',
                    padding: '12px',
                    background: 'var(--paper-dim)',
                    border: '2px solid var(--ink)',
                    borderRadius: '2px',
                  }}
                >
                  <label
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: 800,
                      marginBottom: '6px',
                    }}
                  >
                    {PAYMENT_RAILS[activeRail].handleLabel} for {selectedTx.toName}:
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      value={handleInput}
                      onChange={(e) => setHandleInput(e.target.value)}
                      placeholder={PAYMENT_RAILS[activeRail].handlePlaceholder}
                      style={{
                        flex: 1,
                        padding: '8px 10px',
                        border: '1.5px solid var(--ink)',
                        fontSize: '13px',
                        borderRadius: '2px',
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn-primary btn-small"
                      disabled={settling}
                      onClick={() => void handlePaymentMethod(activeRail)}
                    >
                      {settling ? 'Opening…' : `Open payment app`}
                    </button>
                  </div>
                </div>
              )}

              {/* Payment rails are only actionable for the payer. */}
              {isCurrentUserPaying && (
              <div style={{ padding: '0 24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <PaymentOption
                  icon="V"
                  label="Venmo"
                  subtitle="Open Venmo app / web with note pre-filled"
                  badgeColor="#008CFF"
                  onClick={() => {
                    setActiveRail('venmo');
                    if (handleInput) void handlePaymentMethod('venmo');
                  }}
                />
                <PaymentOption
                  icon="P"
                  label="PayPal"
                  subtitle="Instant transfer via PayPal.Me"
                  badgeColor="#003087"
                  onClick={() => {
                    setActiveRail('paypal');
                    if (handleInput) void handlePaymentMethod('paypal');
                  }}
                />
                <PaymentOption
                  icon="$"
                  label="Cash App"
                  subtitle="Pay directly with $Cashtag"
                  badgeColor="#00D632"
                  onClick={() => {
                    setActiveRail('cashapp');
                    if (handleInput) void handlePaymentMethod('cashapp');
                  }}
                />
                <PaymentOption
                  icon="Z"
                  label="Zelle"
                  subtitle="Bank-to-bank direct transfer"
                  badgeColor="#7414CA"
                  onClick={() => {
                    setActiveRail('zelle');
                    if (handleInput) void handlePaymentMethod('zelle');
                  }}
                />
                <PaymentOption
                  icon="A"
                  label="Apple Pay / Cash"
                  subtitle="Apple Cash message or native payment sheet"
                  badgeColor="#000000"
                  onClick={() => void handlePaymentMethod('applepay')}
                />
                <PaymentOption
                  icon="G"
                  label="Google Pay"
                  subtitle="Google Wallet & Web transfer"
                  badgeColor="#4285F4"
                  onClick={() => void handlePaymentMethod('googlepay')}
                />
                <PaymentOption
                  icon="✓"
                  label="Cash / Marked as Paid"
                  subtitle="Record settlement directly without opening external apps"
                  onClick={() => void handlePaymentMethod('cash')}
                />
              </div>
              )}

              {isCurrentUserReceiving && (
                <div style={{ padding: '12px 24px 0' }}>
                  <button
                    type="button"
                    className="btn btn-primary btn-block"
                    disabled={settling}
                    onClick={() => void recordSettlement('manual')}
                  >
                    {settling ? 'Recording…' : 'Mark payment as received'}
                  </button>
                  <p style={{ marginTop: '8px', fontSize: '12px', color: 'var(--grey)', lineHeight: 1.5 }}>
                    Only confirm this after you have actually received the payment.
                  </p>
                </div>
              )}

              {!isCurrentUserPaying && !isCurrentUserReceiving && (
                <div style={{ padding: '12px 24px 0', fontSize: '13px', color: 'var(--grey)' }}>
                  This debt is between other group members and is shown for reference only.
                </div>
              )}

              {pendingMethod && isCurrentUserPaying && (
                <div style={{ margin: '16px 24px 0', padding: '14px', border: '2px solid var(--ink)', background: 'var(--green-dim)' }}>
                  <div style={{ fontSize: '13px', fontWeight: 800 }}>Payment app opened</div>
                  <p style={{ marginTop: '6px', fontSize: '12px', lineHeight: 1.5, color: 'var(--ink-soft)' }}>
                    Returning to Click Split does not confirm that the transfer completed. Record it only after the payment succeeds.
                  </p>
                  {paymentInstructions && (
                    <p style={{ marginTop: '6px', fontSize: '12px', lineHeight: 1.5 }}>{paymentInstructions}</p>
                  )}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                    <button
                      type="button"
                      className="btn btn-primary btn-small"
                      disabled={settling}
                      onClick={() => void recordSettlement(pendingMethod)}
                    >
                      {settling ? 'Recording…' : 'Payment completed'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-small"
                      disabled={settling}
                      onClick={() => { setPendingMethod(null); setPaymentInstructions(null); }}
                    >
                      Not yet
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {settled && selectedTx && (
            <div style={{ paddingBottom: '24px' }}>
              <SettleConfirm
                counterpartyName={selectedTx.toName}
                groupName={groupName}
              />
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setSettled(false);
                    setSelectedTx(null);
                  }}
                >
                  Settle another
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
