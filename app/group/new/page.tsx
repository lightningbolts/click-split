'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';
import Topbar from '@/components/Topbar';

const EMOJI_CATEGORIES: Record<string, string[]> = {
  Living: ['🏠', '🏢', '🛋️', '🛏️', '🧹', '📦', '🪴', '🐶', '🐱', '🔑', '🚪', '🧺', '🛁'],
  Travel: ['✈️', '🚗', '🚆', '🏖️', '🏕️', '🏔️', '🗺️', '🚢', '⛽', '🏨', '🚕', '🧳', '🌴'],
  Food: ['🍕', '🍔', '🍣', '🌮', '🍜', '☕', '🍻', '🍷', '🛒', '🍩', '🥐', '🍦', '🥑'],
  Fun: ['🎉', '🎬', '🎮', '🎳', '🎟️', '⚽', '🏋️', '🎤', '🎁', '🎲', '🎸', '🎨', '🎯'],
  Bills: ['💡', '📱', '💻', '🛠️', '💼', '🎓', '📚', '🧾', '💸', '⚡', '💧', '📶', '🔥'],
};

const ALL_CATEGORIES = ['All', ...Object.keys(EMOJI_CATEGORIES)];

export default function NewGroupPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🏠');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [customEmoji, setCustomEmoji] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayedEmojis =
    selectedCategory === 'All'
      ? Object.values(EMOJI_CATEGORIES).flat()
      : EMOJI_CATEGORIES[selectedCategory] ?? [];

  const handleSelectEmoji = (emoji: string) => {
    setIcon(emoji);
    setCustomEmoji('');
  };

  const handleCustomEmojiChange = (val: string) => {
    setCustomEmoji(val);
    if (val.trim()) {
      // Pick the first character / emoji cluster
      const chars = Array.from(val.trim());
      if (chars.length > 0) {
        setIcon(chars[0]);
      }
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Group name is required.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/split/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), icon }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Failed to create group');
      }

      const data = await res.json();
      router.push(`/group/${data.group.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create group');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div style={{ width: '100%', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Topbar />
        <div className="loading-screen"><div className="spinner" /></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ width: '100%', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Topbar />
        <div className="empty-state">
          <p>Please sign in to create a group.</p>
          <Link href="/signin" className="btn btn-primary" style={{ marginTop: '16px', display: 'inline-flex' }}>
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Topbar />

      <main className="form-container" style={{ flex: 1 }}>
        <div className="form-card">
          <div className="sheet-head">
            <h2>New group</h2>
            <Link href="/dashboard" className="x" aria-label="Close">×</Link>
          </div>

          <div className="form-section">
            <div className="field" style={{ margin: 0, marginBottom: '18px' }}>
              <label htmlFor="group-name">Group name</label>
              <input
                id="group-name"
                type="text"
                placeholder="e.g. The Apartment"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="field" style={{ margin: 0, marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
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
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
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
                        transition: 'all 0.1s ease',
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
                  maxHeight: '168px',
                  overflowY: 'auto',
                  padding: '8px',
                  border: '2px solid var(--ink)',
                  background: 'var(--paper-dim)',
                  borderRadius: '2px',
                }}
              >
                {displayedEmojis.map((emoji, index) => {
                  const isSelected = icon === emoji;
                  return (
                    <button
                      key={`${emoji}-${index}`}
                      type="button"
                      onClick={() => handleSelectEmoji(emoji)}
                      style={{
                        width: '100%',
                        aspectRatio: '1 / 1',
                        border: isSelected ? '2px solid var(--ink)' : '1px solid #dcd7cc',
                        background: isSelected ? 'var(--green-dim)' : 'var(--white)',
                        fontSize: '20px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: isSelected ? '2px 2px 0 var(--ink)' : 'none',
                        transform: isSelected ? 'scale(1.05)' : 'none',
                        transition: 'transform 0.08s ease, box-shadow 0.08s ease',
                        borderRadius: '2px',
                      }}
                      aria-label={`Select ${emoji} icon`}
                    >
                      {emoji}
                    </button>
                  );
                })}
              </div>

              {/* Custom Emoji Entry */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-soft)' }}>
                  Or enter any custom emoji:
                </span>
                <input
                  type="text"
                  placeholder="e.g. 🏄 or ⚡"
                  value={customEmoji}
                  onChange={(e) => handleCustomEmojiChange(e.target.value)}
                  style={{
                    width: '140px',
                    padding: '6px 8px',
                    fontSize: '13px',
                    border: '1.5px solid var(--ink)',
                    borderRadius: '2px',
                    background: 'var(--white)',
                  }}
                  maxLength={4}
                />
              </div>
            </div>

            {error && (
              <p style={{ color: 'var(--red)', fontSize: '13px', marginBottom: '14px' }}>
                {error}
              </p>
            )}

            <button
              className="btn btn-primary btn-block"
              onClick={handleCreate}
              disabled={submitting || !name.trim()}
            >
              {submitting ? 'Creating…' : 'Create group'}
            </button>

            <p style={{ fontSize: '12px', color: 'var(--grey)', marginTop: '18px', lineHeight: 1.5 }}>
              After creating the group, you can invite members by sharing the group link
              or adding expenses immediately.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
