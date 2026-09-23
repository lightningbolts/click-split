'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';
import Topbar from '@/components/Topbar';
import { extractGroupId } from '@/lib/utils/invite';

interface GroupPreview {
  id: string;
  name: string;
  icon: string | null;
  memberCount: number;
  isMember: boolean;
}

function JoinGroupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialParam = searchParams.get('link') || searchParams.get('code') || searchParams.get('id') || '';

  const { user, loading: authLoading } = useAuth();
  const [input, setInput] = useState(initialParam);
  const [loading, setLoading] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<GroupPreview | null>(null);

  const fetchGroupPreview = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/split/groups/${id}`);
      if (!res.ok) {
        if (res.status === 404) {
          setError('Group not found. Please check the invite link or ID.');
        } else {
          setError('Could not fetch group information.');
        }
        setPreview(null);
        return;
      }
      const data = await res.json();
      setPreview({
        id: data.group.id,
        name: data.group.name,
        icon: data.group.icon,
        memberCount: data.memberCount ?? 0,
        isMember: Boolean(data.isMember),
      });
    } catch {
      setError('Network error while checking group.');
      setPreview(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialParam) {
      const id = extractGroupId(initialParam);
      if (id) {
        void fetchGroupPreview(id);
      }
    }
  }, [initialParam, fetchGroupPreview]);

  const handleInputChange = (val: string) => {
    setInput(val);
    setError(null);

    const detectedId = extractGroupId(val);
    if (detectedId) {
      void fetchGroupPreview(detectedId);
    } else {
      setPreview(null);
    }
  };

  const handlePasteClipboard = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          handleInputChange(text);
        }
      }
    } catch {
      // Clipboard access denied or unsupported
    }
  };

  const handleJoin = async () => {
    const groupId = preview?.id || extractGroupId(input);

    if (!groupId) {
      setError('Please paste a valid group invite link or group ID.');
      return;
    }

    if (preview?.isMember) {
      router.push(`/group/${groupId}`);
      return;
    }

    setJoining(true);
    setError(null);

    try {
      const res = await fetch(`/api/split/groups/${groupId}/join`, {
        method: 'POST',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Failed to join group');
      }

      router.push(`/group/${groupId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join group');
    } finally {
      setJoining(false);
    }
  };

  if (authLoading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
      </div>
    );
  }

  if (!user) {
    const groupId = preview?.id || extractGroupId(input);
    const joinPath = groupId
      ? `/group/${groupId}`
      : initialParam
        ? `/group/join?link=${encodeURIComponent(initialParam)}`
        : '/group/join';
    const signInHref = `/signin?next=${encodeURIComponent(joinPath)}`;

    return (
      <div className="empty-state">
        <p>Please sign in to join a group.</p>
        <Link href={signInHref} className="btn btn-primary" style={{ marginTop: '16px', display: 'inline-flex' }}>
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="form-card">
      <div className="sheet-head">
        <h2>Join a group</h2>
        <Link href="/dashboard" className="x" aria-label="Close">×</Link>
      </div>

      <div className="form-section">
        <p style={{ fontSize: '14px', color: 'var(--ink-soft)', lineHeight: 1.5, marginBottom: '20px' }}>
          Have an invite link from a friend or roommate? Paste it below to join and start splitting expenses together.
        </p>

        <div className="field" style={{ margin: 0, marginBottom: '20px' }}>
          <label htmlFor="group-invite-input">Invite link or Group ID</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              id="group-invite-input"
              type="text"
              placeholder="e.g. https://.../group/... or UUID"
              value={input}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleJoin();
                }
              }}
              style={{ flex: 1 }}
            />
            <button
              type="button"
              className="btn btn-ghost"
              onClick={handlePasteClipboard}
              style={{ padding: '8px 14px', fontSize: '13px', whiteSpace: 'nowrap' }}
            >
              Paste
            </button>
          </div>
        </div>

        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <div className="spinner" style={{ width: '20px', height: '20px', borderWidth: '2px', margin: 0 }} />
            <span style={{ fontSize: '14px', color: 'var(--ink-soft)' }}>Finding group…</span>
          </div>
        )}

        {preview && (
          <div className="join-preview-card" style={{ marginBottom: '20px' }}>
            <div className="join-preview-icon">
              {preview.icon ?? '👥'}
            </div>
            <div className="join-preview-info">
              <div className="join-preview-name">{preview.name}</div>
              <div className="join-preview-meta">
                {preview.memberCount} member{preview.memberCount !== 1 ? 's' : ''}
                {preview.isMember && (
                  <span
                    style={{
                      marginLeft: '8px',
                      display: 'inline-block',
                      background: 'var(--green-dim)',
                      color: 'var(--green)',
                      fontWeight: 700,
                      fontSize: '11px',
                      padding: '1px 6px',
                      border: '1px solid var(--green)',
                      borderRadius: '2px',
                    }}
                  >
                    Already a member
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {error && (
          <p style={{ color: 'var(--red)', fontSize: '13px', marginBottom: '20px' }}>
            {error}
          </p>
        )}

        <button
          type="button"
          className="btn btn-primary btn-block"
          onClick={handleJoin}
          disabled={loading || joining || (!preview && !extractGroupId(input))}
          style={{ fontSize: '15px', padding: '14px', marginBottom: '16px' }}
        >
          {joining
            ? 'Joining group…'
            : preview?.isMember
            ? 'Go to group'
            : 'Join group'}
        </button>

        <div style={{ textAlign: 'center' }}>
          <span style={{ fontSize: '13px', color: 'var(--grey)' }}>Want to start your own group? </span>
          <Link href="/group/new" style={{ fontSize: '13px', color: 'var(--green)', fontWeight: 700 }}>
            Create new group
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function JoinGroupPage() {
  return (
    <div style={{ width: '100%', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Topbar />
      <main className="form-container" style={{ flex: 1 }}>
        <Suspense
          fallback={
            <div className="loading-screen">
              <div className="spinner" />
            </div>
          }
        >
          <JoinGroupForm />
        </Suspense>
      </main>
    </div>
  );
}
