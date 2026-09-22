/**
 * Format a number as a dollar amount.
 * Always shows two decimal places. Negative amounts get a leading minus.
 */
export function formatMoney(amount: number): string {
  const abs = Math.abs(amount);
  const formatted = `$${abs.toFixed(2)}`;
  return amount < 0 ? `-${formatted}` : formatted;
}

/**
 * Format as a signed balance string: "+$41.30" or "-$28.15"
 */
export function formatSignedMoney(amount: number): string {
  const abs = Math.abs(amount);
  const formatted = `$${abs.toFixed(2)}`;
  if (amount > 0) return `+${formatted}`;
  if (amount < 0) return `-${formatted}`;
  return formatted;
}

/**
 * Returns the CSS class for balance coloring: 'pos' for positive, 'neg' for negative.
 */
export function balanceClass(amount: number): string {
  if (amount > 0) return 'pos';
  if (amount < 0) return 'neg';
  return '';
}

/**
 * Returns the balance label: "owed to you" or "you owe".
 */
export function balanceLabel(amount: number): string {
  if (amount > 0) return 'owed to you';
  if (amount < 0) return 'you owe';
  return 'settled up';
}
