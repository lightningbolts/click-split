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
