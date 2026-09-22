import { AuthProvider } from '@/lib/AuthContext';

/**
 * Group layout - wraps group pages with AuthProvider.
 */
export default function GroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthProvider>{children}</AuthProvider>;
}
