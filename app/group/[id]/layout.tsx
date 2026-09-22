import type { Metadata } from 'next';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const supabase = createSupabaseServiceRoleClient();
    const { data: group } = await supabase
      .from('split_groups')
      .select('name, icon')
      .eq('id', id)
      .maybeSingle();

    if (group) {
      const title = `${group.icon ? group.icon + ' ' : ''}${group.name} - Click Split`;
      const description = `Join ${group.name} on Click Split to split expenses, scan receipts, and settle up easily.`;

      return {
        title,
        description,
        openGraph: {
          title,
          description,
          siteName: 'Click Split',
          type: 'website',
        },
        twitter: {
          card: 'summary',
          title,
          description,
        },
      };
    }
  } catch {
    // Fall back to default metadata
  }

  return {
    title: 'Group - Click Split',
    description: 'Split bills and settle up on Click Split.',
  };
}

export default function GroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
