/**
 * Click Split - N-Party Debt Simplification Engine
 *
 * Implements the general minimum cash flow algorithm to simplify
 * cross-debts among N members into at most N-1 pairwise transfers.
 */

export interface MemberBalanceInput {
  userId: string;
  name: string;
  balance: number; // positive = owed money, negative = owes money
}

export interface SimplifiedTransaction {
  id: string;
  fromUserId: string;
  fromName: string;
  toUserId: string;
  toName: string;
  amount: number;
}

/**
 * Rounds a number to 2 decimal places to avoid floating point cent drift.
 */
export function roundToCent(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

/**
 * Simplifies arbitrary multi-party debts among N members into the minimal
 * set of direct transfers (minimum cash flow algorithm).
 *
 * Guaranteed to generate at most N - 1 transactions for N members.
 */
export function simplifyDebts(members: MemberBalanceInput[]): SimplifiedTransaction[] {
  // Separate into debtors (owe money) and creditors (owed money)
  // Values are stored in cents as integers to ensure exact arithmetic.
  const debtors: Array<{ userId: string; name: string; amountCents: number }> = [];
  const creditors: Array<{ userId: string; name: string; amountCents: number }> = [];

  for (const m of members) {
    const cents = Math.round(m.balance * 100);
    if (cents < -0.5) {
      debtors.push({ userId: m.userId, name: m.name, amountCents: -cents });
    } else if (cents > 0.5) {
      creditors.push({ userId: m.userId, name: m.name, amountCents: cents });
    }
  }

  // Sort descending by amount to optimize largest settlements first
  debtors.sort((a, b) => b.amountCents - a.amountCents);
  creditors.sort((a, b) => b.amountCents - a.amountCents);

  const transactions: SimplifiedTransaction[] = [];
  let dIdx = 0;
  let cIdx = 0;
  let counter = 1;

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];

    // Settle the minimum of what debtor owes and creditor is owed
    const settledCents = Math.min(debtor.amountCents, creditor.amountCents);
    const settledDollars = settledCents / 100;

    if (settledDollars >= 0.01) {
      transactions.push({
        id: `tx-${debtor.userId}-${creditor.userId}-${counter++}`,
        fromUserId: debtor.userId,
        fromName: debtor.name,
        toUserId: creditor.userId,
        toName: creditor.name,
        amount: roundToCent(settledDollars),
      });
    }

    debtor.amountCents -= settledCents;
    creditor.amountCents -= settledCents;

    if (debtor.amountCents === 0) {
      dIdx++;
    }
    if (creditor.amountCents === 0) {
      cIdx++;
    }
  }

  return transactions;
}

/**
 * Filters the global transactions to only those involving a specific user.
 */
export function getUserObligations(
  currentUserId: string,
  transactions: SimplifiedTransaction[],
): {
  toPay: SimplifiedTransaction[];
  toReceive: SimplifiedTransaction[];
  totalToPay: number;
  totalToReceive: number;
} {
  const toPay = transactions.filter((t) => t.fromUserId === currentUserId);
  const toReceive = transactions.filter((t) => t.toUserId === currentUserId);

  const totalToPay = roundToCent(toPay.reduce((sum, t) => sum + t.amount, 0));
  const totalToReceive = roundToCent(toReceive.reduce((sum, t) => sum + t.amount, 0));

  return { toPay, toReceive, totalToPay, totalToReceive };
}
