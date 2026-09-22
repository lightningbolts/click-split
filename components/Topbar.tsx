'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';

export default function Topbar() {
  const { user, displayName, profileImageUrl, signOut } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const avatarSrc =
    profileImageUrl ||
    (typeof user?.user_metadata?.avatar_url === 'string'
      ? user.user_metadata.avatar_url
      : null) ||
    (typeof user?.user_metadata?.picture === 'string'
      ? user.user_metadata.picture
      : null);

  const initials = displayName
    ? displayName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : user?.email?.slice(0, 2).toUpperCase() ?? '??';

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setDropdownOpen(false);
      }
    }

    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [dropdownOpen]);

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link href="/dashboard" className="brand">
          <span className="mark" />
          Click Split
        </Link>
        {user ? (
          <div className="profile-menu-container" ref={menuRef}>
            <button
              className="avatar"
              onClick={() => setDropdownOpen((prev) => !prev)}
              aria-label="User menu"
              aria-expanded={dropdownOpen}
            >
              {avatarSrc && !imgError ? (
                <img
                  src={avatarSrc}
                  alt={displayName ?? 'Profile'}
                  className="avatar-img"
                  onError={() => setImgError(true)}
                />
              ) : (
                <span>{initials}</span>
              )}
            </button>

            {dropdownOpen && (
              <div className="profile-dropdown" role="menu">
                <div className="dropdown-user-header">
                  <span className="dropdown-user-name">
                    {displayName || user.email?.split('@')[0] || 'Account'}
                  </span>
                  <span className="dropdown-user-email">{user.email}</span>
                </div>

                <div className="dropdown-items">
                  <Link
                    href="/dashboard"
                    className="dropdown-item"
                    role="menuitem"
                    onClick={() => setDropdownOpen(false)}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect width="7" height="9" x="3" y="3" rx="1" />
                      <rect width="7" height="5" x="14" y="3" rx="1" />
                      <rect width="7" height="9" x="14" y="12" rx="1" />
                      <rect width="7" height="5" x="3" y="16" rx="1" />
                    </svg>
                    Dashboard
                  </Link>

                  <Link
                    href="/group/join"
                    className="dropdown-item"
                    role="menuitem"
                    onClick={() => setDropdownOpen(false)}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                    </svg>
                    Join Group
                  </Link>

                  <Link
                    href="/group/new"
                    className="dropdown-item"
                    role="menuitem"
                    onClick={() => setDropdownOpen(false)}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M5 12h14" />
                      <path d="M12 5v14" />
                    </svg>
                    New Group
                  </Link>

                  <div className="dropdown-divider" />

                  <button
                    type="button"
                    className="dropdown-item danger"
                    role="menuitem"
                    onClick={() => {
                      setDropdownOpen(false);
                      void signOut();
                    }}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" x2="9" y1="12" y2="12" />
                    </svg>
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <Link href="/signin" className="btn btn-small">
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
