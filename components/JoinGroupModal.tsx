'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { extractGroupId } from '@/lib/utils/invite';

interface JoinGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialValue?: string;
}

interface GroupPreview {
  id: string;
  name: string;
  icon: string | null;
  memberCount: number;
  isMember: boolean;
}

export default function JoinGroupModal({
  isOpen,
  onClose,
  initialValue = '',
}: JoinGroupModalProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [input, setInput] = useState(initialValue);
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
          setError('Group not found. Please check the link or ID.');
        } else {
          setError('Could not load group info.');
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

  // When modal opens or initialValue changes, reset or initialize
  useEffect(() => {
    if (isOpen) {
      setInput(initialValue);
      setError(null);
      setPreview(null);
      setLoading(false);
      setJoining(false);

      const detectedId = extractGroupId(initialValue);
      if (detectedId) {
        void fetchGroupPreview(detectedId);
      }

      // Focus input after render
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, initialValue, fetchGroupPreview]);

  // Handle ESC key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

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
      // Clipboard permissions may be denied in some browsers
    }
  };

  const handleJoinOrNavigate = async () => {
    const groupId = preview?.id || extractGroupId(input);

    if (!groupId) {
      setError('Please paste a valid group link or group ID.');
      return;
    }

    if (preview?.isMember) {
      onClose();
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

      onClose();
      router.push(`/group/${groupId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join group');
    } finally {
      setJoining(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="join-modal-title"
    >
      <div className="modal-card">
        <div className="modal-head">
          <h3 id="join-modal-title">Join a Group</h3>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close dialog"
          >
            ×
          </button>
        </div>

        <div className="modal-body">
          <p style={{ fontSize: '13px', color: 'var(--ink-soft)', lineHeight: 1.5 }}>
            Paste a group invite link or group ID below to become a member.
          </p>

          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              ref={inputRef}
              type="text"
              placeholder="e.g. https://.../group/... or group ID"
              value={input}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleJoinOrNavigate();
                }
              }}
              style={{
                flex: 1,
                padding: '10px 12px',
                fontSize: '14px',
                border: '2px solid var(--ink)',
                borderRadius: '2px',
                background: 'var(--white)',
                fontFamily: 'inherit',
              }}
            />
            <button
              type="button"
              className="btn btn-ghost"
              onClick={handlePasteClipboard}
              style={{ padding: '8px 12px', fontSize: '12px', whiteSpace: 'nowrap' }}
              title="Paste from clipboard"
            >
              Paste
            </button>
          </div>

          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 0' }}>
              <div className="spinner" style={{ width: '18px', height: '18px', borderWidth: '2px', margin: 0 }} />
              <span style={{ fontSize: '13px', color: 'var(--ink-soft)' }}>Checking group…</span>
            </div>
          )}

          {preview && (
            <div className="join-preview-card">
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
            <p style={{ color: 'var(--red)', fontSize: '13px', margin: 0 }}>
              {error}
            </p>
          )}

          <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onClose}
              style={{ flex: 1 }}
              disabled={joining}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleJoinOrNavigate}
              disabled={loading || joining || (!preview && !extractGroupId(input))}
              style={{ flex: 1.5 }}
            >
              {joining
                ? 'Joining…'
                : preview?.isMember
                ? 'Go to group'
                : 'Join group'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
