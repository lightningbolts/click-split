import { AuthProvider } from '@/lib/AuthContext';

/**
 * Dashboard layout - wraps all authenticated pages with AuthProvider.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthProvider>{children}</AuthProvider>;
}
