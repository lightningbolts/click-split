'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';
import Topbar from '@/components/Topbar';

const EMOJI_OPTIONS = ['🏠', '✈️', '🛒', '🍕', '🎉', '🏖️', '🎬', '🏋️', '☕', '🎮'];

export default function NewGroupPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🏠');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
              <label>Icon</label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {EMOJI_OPTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setIcon(emoji)}
                    style={{
                      width: '42px',
                      height: '42px',
                      border: icon === emoji ? '2px solid var(--ink)' : '1.5px solid var(--grey)',
                      background: icon === emoji ? 'var(--green-dim)' : 'var(--white)',
                      fontSize: '20px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: icon === emoji ? '2px 2px 0 var(--ink)' : 'none',
                    }}
                    aria-label={`Select ${emoji} icon`}
                  >
                    {emoji}
                  </button>
                ))}
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
