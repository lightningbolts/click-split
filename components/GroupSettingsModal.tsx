'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatMoney } from '@/lib/balance';

const EMOJI_CATEGORIES: Record<string, string[]> = {
  Living: ['🏠', '🏢', '🛋️', '🛏️', '🧹', '📦', '🪴', '🐶', '🐱', '🔑', '🚪', '🧺', '🛁'],
  Travel: ['✈️', '🚗', '🚆', '🏖️', '🏕️', '🏔️', '🗺️', '🚢', '⛽', '🏨', '🚕', '🧳', '🌴'],
  Food: ['🍕', '🍔', '🍣', '🌮', '🍜', '☕', '🍻', '🍷', '🛒', '🍩', '🥐', '🍦', '🥑'],
  Fun: ['🎉', '🎬', '🎮', '🎳', '🎟️', '⚽', '🏋️', '🎤', '🎁', '🎲', '🎸', '🎨', '🎯'],
  Bills: ['💡', '📱', '💻', '🛠️', '💼', '🎓', '📚', '🧾', '💸', '⚡', '💧', '📶', '🔥'],
};

const ALL_CATEGORIES = ['All', ...Object.keys(EMOJI_CATEGORIES)];

interface GroupSettingsModalProps {
  groupId: string;
  groupName: string;
  groupIcon: string | null;
  members: Array<{ userId: string; name: string; balance: number }>;
  isCreator: boolean;
  currentUserId: string;
  onClose: () => void;
  onUpdated: () => void;
}

export default function GroupSettingsModal({
  groupId,
  groupName,
  groupIcon,
  members,
  isCreator,
  currentUserId,
  onClose,
  onUpdated,
}: GroupSettingsModalProps) {
  const router = useRouter();
  const [name, setName] = useState(groupName);
  const [icon, setIcon] = useState(groupIcon ?? '👥');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [customEmoji, setCustomEmoji] = useState('');
  const [saving, setSaving] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayedEmojis =
    selectedCategory === 'All'
      ? Object.values(EMOJI_CATEGORIES).flat()
      : EMOJI_CATEGORIES[selectedCategory] ?? [];

  const currentUserMember = members.find((m) => m.userId === currentUserId);
  const currentUserBalance = currentUserMember?.balance ?? 0;
  const canLeave = Math.abs(currentUserBalance) < 0.01;

  const allSettled = members.every((m) => Math.abs(m.balance) < 0.01);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/split/groups/${groupId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), icon }),
      });
      if (res.ok) {
        onUpdated();
        onClose();
      } else {
        const d = await res.json();
        setError(d.error ?? 'Failed to update group');
      }
    } catch {
      setError('Error saving settings');
    } finally {
      setSaving(false);
    }
  };

  const handleLeave = async () => {
    if (!canLeave) {
      setError(`Cannot leave: your balance is ${formatMoney(currentUserBalance)}. Settle up first.`);
      return;
    }
    if (!confirm('Are you sure you want to leave this group?')) return;

    setLeaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/split/groups/${groupId}/leave`, {
        method: 'POST',
      });
      if (res.ok) {
        router.push('/dashboard');
      } else {
        const d = await res.json();
        setError(d.error ?? 'Failed to leave group');
      }
    } catch {
      setError('Error leaving group');
    } finally {
      setLeaving(false);
    }
  };

  const handleDelete = async () => {
    if (!allSettled) {
      setError('Cannot delete group: some members still have unsettled balances.');
      return;
    }
    if (!confirm('Are you sure you want to permanently delete this group? All history will be lost.')) {
      return;
    }

    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/split/groups/${groupId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        router.push('/dashboard');
      } else {
        const d = await res.json();
        setError(d.error ?? 'Failed to delete group');
      }
    } catch {
      setError('Error deleting group');
    } finally {
      setDeleting(false);
    }
  };

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
          maxWidth: '500px',
          maxHeight: '90vh',
          overflowY: 'auto',
          margin: 0,
        }}
      >
        <div className="sheet-head">
          <h2>Group settings</h2>
          <button type="button" className="x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {error && (
            <div
              style={{
                padding: '10px 12px',
                background: 'var(--red-dim)',
                color: 'var(--red)',
                border: '1.5px solid var(--red)',
                fontSize: '13px',
                fontWeight: 700,
              }}
            >
              {error}
            </div>
          )}

          {/* Group Name */}
          <div className="field" style={{ margin: 0 }}>
            <label>Group name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Categorized Icon Picker */}
          <div className="field" style={{ margin: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ margin: 0 }}>Icon</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--ink-soft)' }}>
                <span>Selected:</span>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '28px',
                    height: '28px',
                    border: '2px solid var(--ink)',
                    background: 'var(--green-dim)',
                    fontSize: '16px',
                    boxShadow: '1px 1px 0 var(--ink)',
                  }}
                >
                  {icon}
                </span>
              </div>
            </div>

            {/* Category Filter Pills */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
              {ALL_CATEGORIES.map((cat) => {
                const isActive = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    style={{
                      padding: '4px 10px',
                      fontSize: '12px',
                      fontWeight: 700,
                      border: '1.5px solid var(--ink)',
                      borderRadius: '2px',
                      background: isActive ? 'var(--ink)' : 'var(--white)',
                      color: isActive ? 'var(--white)' : 'var(--ink)',
                      cursor: 'pointer',
                    }}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>

            {/* Emoji Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(40px, 1fr))',
                gap: '6px',
                maxHeight: '140px',
                overflowY: 'auto',
                padding: '8px',
                border: '2px solid var(--ink)',
                background: 'var(--paper-dim)',
                borderRadius: '2px',
              }}
            >
              {displayedEmojis.map((e, index) => {
                const isSelected = icon === e;
                return (
                  <button
                    key={`${e}-${index}`}
                    type="button"
                    onClick={() => { setIcon(e); setCustomEmoji(''); }}
                    style={{
                      width: '100%',
                      aspectRatio: '1 / 1',
                      fontSize: '18px',
                      border: isSelected ? '2px solid var(--ink)' : '1px solid #dcd7cc',
                      background: isSelected ? 'var(--green-dim)' : 'var(--white)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: isSelected ? '2px 2px 0 var(--ink)' : 'none',
                      borderRadius: '2px',
                    }}
                  >
                    {e}
                  </button>
                );
              })}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-soft)' }}>
                Or enter any custom emoji:
              </span>
              <input
                type="text"
                placeholder="e.g. 🏄 or ⚡"
                value={customEmoji}
                maxLength={4}
                onChange={(e) => {
                  setCustomEmoji(e.target.value);
                  if (e.target.value.trim()) setIcon(Array.from(e.target.value.trim())[0]);
                }}
                style={{
                  width: '140px',
                  padding: '6px 8px',
                  fontSize: '13px',
                  border: '1.5px solid var(--ink)',
                  background: 'var(--white)',
                  borderRadius: '2px',
                }}
              />
            </div>
          </div>

          {/* Members Breakdown */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, marginBottom: '6px' }}>
              Group members ({members.length})
            </label>
            <div
              style={{
                border: '1.5px solid var(--paper-dim)',
                borderRadius: '2px',
                maxHeight: '130px',
                overflowY: 'auto',
              }}
            >
              {members.map((m) => (
                <div
                  key={m.userId}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px',
                    borderBottom: '1px solid var(--paper-dim)',
                    fontSize: '13px',
                  }}
                >
                  <span style={{ fontWeight: 700 }}>
                    {m.name} {m.userId === currentUserId && '(You)'}
                  </span>
                  <span className="tabular" style={{ fontWeight: 800 }}>
                    {formatMoney(m.balance)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Save Button */}
          <button
            type="button"
            className="btn btn-primary"
            disabled={saving || !name.trim()}
            onClick={handleSave}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>

          {/* Destructive Zone - No extraneous emojis */}
          <div
            style={{
              marginTop: '10px',
              paddingTop: '14px',
              borderTop: '2px solid var(--paper-dim)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <button
              type="button"
              className="btn"
              disabled={leaving}
              onClick={handleLeave}
              style={{ color: 'var(--ink)' }}
            >
              {leaving ? 'Leaving…' : 'Leave group'}
            </button>

            {isCreator && (
              <button
                type="button"
                className="btn btn-danger"
                disabled={deleting}
                onClick={handleDelete}
                style={{ color: 'var(--red)', borderColor: 'var(--red)' }}
              >
                {deleting ? 'Deleting…' : 'Delete group'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
