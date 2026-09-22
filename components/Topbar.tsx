'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';

export default function Topbar() {
  const { user, displayName, signOut } = useAuth();

  const initials = displayName
    ? displayName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : user?.email?.slice(0, 2).toUpperCase() ?? '??';

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link href="/dashboard" className="brand">
          <span className="mark" />
          Click Split
        </Link>
        {user ? (
          <button
            className="avatar"
            onClick={() => void signOut()}
            title="Sign out"
            aria-label="Sign out"
          >
            {initials}
          </button>
        ) : (
          <Link href="/signin" className="btn btn-small">
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
