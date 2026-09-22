'use client';

import { useState, useEffect } from 'react';
import { formatMoney } from '@/lib/balance';
import { useAuth } from '@/lib/AuthContext';

interface ExpenseItem {
  id: string;
  label: string;
  price: number;
  assigned_to: string | null;
}

interface ExpenseShare {
  user_id: string;
  share_amount: number;
}

interface ExpenseDetailModalProps {
  expenseId: string;
  members: Array<{ userId: string; name: string }>;
  onClose: () => void;
  onUpdated: () => void;
}

export default function ExpenseDetailModal({
  expenseId,
  members,
  onClose,
  onUpdated,
}: ExpenseDetailModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [expense, setExpense] = useState<{
    id: string;
    description: string;
    total_amount: number;
    paid_by: string;
    split_method: string;
    source: string;
    receipt_image_url: string | null;
    created_at: string;
  } | null>(null);
  const [items, setItems] = useState<ExpenseItem[]>([]);
  const [shares, setShares] = useState<ExpenseShare[]>([]);
  const [lightbox, setLightbox] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);

  // Edit fields
  const [editDesc, setEditDesc] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editPayer, setEditPayer] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const res = await fetch(`/api/split/expenses/${expenseId}`, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          setExpense(data.expense);
          setItems(data.items ?? []);
          setShares(data.shares ?? []);
          setEditDesc(data.expense.description);
          setEditAmount(String(data.expense.total_amount));
          setEditPayer(data.expense.paid_by);
        }
      } catch (err) {
        console.error('Failed to load expense detail:', err);
      } finally {
        setLoading(false);
      }
    };

    void fetchDetail();
  }, [expenseId]);

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this expense? This cannot be undone.')) {
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/split/expenses/${expenseId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        onUpdated();
        onClose();
      } else {
        alert('Failed to delete expense');
      }
    } catch {
      alert('Error deleting expense');
    } finally {
      setDeleting(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editDesc.trim() || !editAmount || !editPayer) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/split/expenses/${expenseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: editDesc.trim(),
          totalAmount: parseFloat(editAmount),
          paidBy: editPayer,
          splitMethod: expense?.split_method ?? 'even',
          customPercentages: expense?.split_method === 'custom_percent' && Number(expense.total_amount) > 0
            ? Object.fromEntries(
                shares.map((share) => [
                  share.user_id,
                  (Number(share.share_amount) / Number(expense.total_amount)) * 100,
                ]),
              )
            : undefined,
          items: items.map((i) => ({
            label: i.label,
            price: Number(i.price),
            assignedTo: i.assigned_to,
          })),
        }),
      });

      if (res.ok) {
        setEditing(false);
        onUpdated();
        // Refresh detail, including line items that may have changed.
        const detailRes = await fetch(`/api/split/expenses/${expenseId}`, { cache: 'no-store' });
        if (detailRes.ok) {
          const data = await detailRes.json();
          setExpense(data.expense);
          setItems(data.items ?? []);
          setShares(data.shares ?? []);
          setEditDesc(data.expense.description);
          setEditAmount(String(data.expense.total_amount));
          setEditPayer(data.expense.paid_by);
        }
      } else {
        alert('Failed to update expense');
      }
    } catch {
      alert('Error updating expense');
    } finally {
      setSaving(false);
    }
  };

  const updateItem = (index: number, patch: Partial<ExpenseItem>) => {
    setItems((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    );
  };

  const removeItem = (index: number) => {
    setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const addItem = () => {
    setItems((current) => [
      ...current,
      {
        id: `draft-${crypto.randomUUID()}`,
        label: '',
        price: 0,
        assigned_to: null,
      },
    ]);
  };

  const payerName = members.find((m) => m.userId === expense?.paid_by)?.name ?? 'Unknown';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(20, 20, 20, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        padding: '16px',
        backdropFilter: 'blur(3px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="form-card"
        style={{
          width: '100%',
          maxWidth: '520px',
          maxHeight: '90vh',
          overflowY: 'auto',
          margin: '0',
          position: 'relative',
        }}
      >
        <div className="sheet-head">
          <h2>{editing ? 'Edit expense' : 'Expense detail'}</h2>
          <button
            type="button"
            className="x"
            onClick={onClose}
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '40px', display: 'flex', justifyContent: 'center' }}>
            <div className="spinner" />
          </div>
        ) : expense ? (
          <div style={{ padding: '20px 24px' }}>
            {editing ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div className="field" style={{ margin: 0 }}>
                  <label>Description</label>
                  <input
                    type="text"
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                  />
                </div>
                <div className="field" style={{ margin: 0 }}>
                  <label>Total amount ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                  />
                </div>
                <div className="field" style={{ margin: 0 }}>
                  <label>Paid by</label>
                  <select
                    value={editPayer}
                    onChange={(e) => setEditPayer(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '2px solid var(--ink)',
                      borderRadius: 'var(--radius)',
                      fontFamily: 'inherit',
                      fontWeight: 700,
                    }}
                  >
                    {members.map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field" style={{ margin: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <label style={{ margin: 0 }}>Receipt / line items</label>
                    <button type="button" className="btn btn-small" onClick={addItem}>
                      + Add item
                    </button>
                  </div>

                  {items.length === 0 ? (
                    <p style={{ margin: 0, color: 'var(--ink-soft)', fontSize: '12px' }}>
                      No saved line items. Add them here to restore an itemized receipt.
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {items.map((item, index) => (
                        <div
                          key={item.id}
                          style={{
                            border: '1.5px solid var(--ink)',
                            background: 'var(--paper-dim)',
                            padding: '10px',
                            display: 'grid',
                            gridTemplateColumns: 'minmax(0, 1fr) 92px auto',
                            gap: '8px',
                            alignItems: 'center',
                          }}
                        >
                          <input
                            type="text"
                            value={item.label}
                            placeholder="Item description"
                            onChange={(event) => updateItem(index, { label: event.target.value })}
                            aria-label={`Line item ${index + 1} description`}
                          />
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={Number.isFinite(Number(item.price)) ? item.price : 0}
                            onChange={(event) =>
                              updateItem(index, { price: Number.parseFloat(event.target.value) || 0 })
                            }
                            aria-label={`Line item ${index + 1} price`}
                          />
                          <button
                            type="button"
                            className="btn btn-small"
                            onClick={() => removeItem(index)}
                            aria-label={`Remove line item ${index + 1}`}
                          >
                            ×
                          </button>

                          <select
                            value={item.assigned_to ?? ''}
                            onChange={(event) =>
                              updateItem(index, { assigned_to: event.target.value || null })
                            }
                            aria-label={`Line item ${index + 1} assignee`}
                            style={{
                              gridColumn: '1 / -1',
                              width: '100%',
                              padding: '9px',
                              border: '1.5px solid var(--ink)',
                              borderRadius: 'var(--radius)',
                              fontFamily: 'inherit',
                              fontWeight: 700,
                              background: 'var(--paper)',
                              color: 'var(--ink)',
                            }}
                          >
                            <option value="">Split evenly</option>
                            {members.map((member) => (
                              <option key={member.userId} value={member.userId}>
                                {member.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                    disabled={saving}
                    onClick={handleSaveEdit}
                  >
                    {saving ? 'Saving…' : 'Save changes'}
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setEditing(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Hero Header */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '16px',
                    borderBottom: '2px solid var(--paper-dim)',
                    paddingBottom: '16px',
                  }}
                >
                  <div>
                    <h3 style={{ fontSize: '20px', fontWeight: 800 }}>{expense.description}</h3>
                    <p style={{ fontSize: '13px', color: 'var(--grey)', marginTop: '4px' }}>
                      Paid by <strong>{payerName}</strong> on{' '}
                      {new Date(expense.created_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="tabular" style={{ fontSize: '24px', fontWeight: 800 }}>
                      {formatMoney(Number(expense.total_amount))}
                    </div>
                    <span className="chip chip-dim" style={{ marginTop: '4px' }}>
                      {expense.split_method === 'by_item'
                        ? 'Itemized'
                        : expense.split_method === 'custom_percent'
                        ? 'Custom split'
                        : 'Split equally'}
                    </span>
                  </div>
                </div>

                {/* Receipt Image if available */}
                {expense.receipt_image_url && (
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, marginBottom: '6px' }}>
                      Receipt photo
                    </label>
                    <div
                      style={{
                        position: 'relative',
                        width: '100%',
                        height: '140px',
                        border: '2px solid var(--ink)',
                        borderRadius: '2px',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        background: '#000',
                      }}
                      onClick={() => setLightbox(true)}
                    >
                      <img
                        src={expense.receipt_image_url}
                        alt="Receipt"
                        style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.9 }}
                      />
                      <span
                        style={{
                          position: 'absolute',
                          bottom: '8px',
                          right: '8px',
                          background: 'rgba(0,0,0,0.7)',
                          color: '#fff',
                          fontSize: '11px',
                          padding: '3px 8px',
                          borderRadius: '2px',
                          fontWeight: 700,
                        }}
                      >
                        Click to view photo
                      </span>
                    </div>
                  </div>
                )}

                {/* Scanned / Line Items */}
                {items.length > 0 && (
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, marginBottom: '6px' }}>
                      Line items ({items.length})
                    </label>
                    <div
                      style={{
                        border: '1.5px solid var(--paper-dim)',
                        borderRadius: '2px',
                        maxHeight: '150px',
                        overflowY: 'auto',
                      }}
                    >
                      {items.map((item) => {
                        const assignedMember = members.find((m) => m.userId === item.assigned_to);
                        return (
                          <div
                            key={item.id}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '8px 12px',
                              borderBottom: '1px solid var(--paper-dim)',
                              fontSize: '13px',
                            }}
                          >
                            <span style={{ fontWeight: 600 }}>{item.label}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span className="chip chip-dim" style={{ fontSize: '11px' }}>
                                {assignedMember ? assignedMember.name : 'Split'}
                              </span>
                              <span className="tabular" style={{ fontWeight: 800 }}>
                                ${Number(item.price).toFixed(2)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Member Shares */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, marginBottom: '6px' }}>
                    Split breakdown
                  </label>
                  <div
                    style={{
                      border: '2px solid var(--ink)',
                      borderRadius: '2px',
                      background: 'var(--paper-dim)',
                      padding: '10px 14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                    }}
                  >
                    {shares.map((share) => {
                      const m = members.find((mem) => mem.userId === share.user_id);
                      const isPayer = share.user_id === expense.paid_by;
                      return (
                        <div
                          key={share.user_id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '13px',
                          }}
                        >
                          <span style={{ fontWeight: 700 }}>
                            {m?.name ?? 'Member'} {isPayer && ' (Paid)'}
                          </span>
                          <span className="tabular" style={{ fontWeight: 800 }}>
                            {formatMoney(Number(share.share_amount))}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn"
                    style={{ flex: 1 }}
                    onClick={() => setEditing(true)}
                  >
                    Edit expense
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    style={{ color: 'var(--red)', borderColor: 'var(--red)' }}
                    disabled={deleting}
                    onClick={handleDelete}
                  >
                    {deleting ? 'Deleting…' : 'Delete expense'}
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div style={{ padding: '24px' }}>
            <p>Expense not found.</p>
          </div>
        )}
      </div>

      {/* Lightbox for receipt photo */}
      {lightbox && expense?.receipt_image_url && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.92)',
            zIndex: 3000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setLightbox(false)}
        >
          <img
            src={expense.receipt_image_url}
            alt="Receipt Full"
            style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain' }}
          />
          <button
            type="button"
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              background: '#fff',
              border: '2px solid #000',
              fontSize: '24px',
              width: '40px',
              height: '40px',
              cursor: 'pointer',
              fontWeight: 800,
            }}
            onClick={() => setLightbox(false)}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
