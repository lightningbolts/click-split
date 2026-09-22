/**
 * Returns a human-readable relative date label for grouping expenses.
 */
export function relativeDateBucket(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays <= 7) return 'This week';
  if (diffDays <= 30) return 'This month';
  return 'Earlier';
}

/**
 * Groups items by their relative date bucket.
 * Returns an array of [label, items[]] pairs in chronological order (newest first).
 */
export function groupByDate<T>(
  items: T[],
  getDate: (item: T) => Date,
): Array<[string, T[]]> {
  const buckets = new Map<string, T[]>();
  const order = ['Today', 'Yesterday', 'This week', 'This month', 'Earlier'];

  for (const item of items) {
    const label = relativeDateBucket(getDate(item));
    const existing = buckets.get(label);
    if (existing) {
      existing.push(item);
    } else {
      buckets.set(label, [item]);
    }
  }

  return order
    .filter((label) => buckets.has(label))
    .map((label) => [label, buckets.get(label)!]);
}

/**
 * Formats a date into a short relative timestamp (e.g. 'Just now', '2h ago', '3d ago', 'May 12').
 */
export function formatRelativeTime(input: Date | string): string {
  const date = typeof input === 'string' ? new Date(input) : input;
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

