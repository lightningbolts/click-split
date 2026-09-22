export type SplitMethod = 'even' | 'by_item' | 'custom_percent';

export interface ShareInputItem {
  price: number;
  assignedTo: string | null;
}

export interface ComputedShare {
  userId: string;
  amount: number;
}

function toCents(amount: number): number {
  return Math.round(amount * 100);
}

function fromCents(cents: number): number {
  return cents / 100;
}

function allocateWeighted(totalCents: number, weights: number[]): number[] {
  if (weights.length === 0) return [];
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  if (weightSum <= 0) throw new Error('Split weights must be greater than zero');

  const raw = weights.map((weight) => (totalCents * weight) / weightSum);
  const allocations = raw.map((value) => Math.floor(value));
  let remainder = totalCents - allocations.reduce((sum, value) => sum + value, 0);

  const order = raw
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);

  for (let i = 0; i < remainder; i += 1) {
    allocations[order[i % order.length].index] += 1;
  }

  return allocations;
}

export function computeExpenseShares({
  totalAmount,
  memberIds,
  splitMethod,
  items = [],
  customPercentages,
}: {
  totalAmount: number;
  memberIds: string[];
  splitMethod: SplitMethod;
  items?: ShareInputItem[];
  customPercentages?: Record<string, number>;
}): ComputedShare[] {
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    throw new Error('Total amount must be greater than zero');
  }
  if (memberIds.length === 0) {
    throw new Error('Expense must have at least one group member');
  }

  const totalCents = toCents(totalAmount);

  if (splitMethod === 'custom_percent') {
    if (!customPercentages) {
      throw new Error('Custom percentages are required');
    }

    const percentages = memberIds.map((id) => {
      const value = Number(customPercentages[id] ?? 0);
      if (!Number.isFinite(value) || value < 0 || value > 100) {
        throw new Error('Each custom percentage must be between 0 and 100');
      }
      return value;
    });

    const totalPercent = percentages.reduce((sum, value) => sum + value, 0);
    if (Math.abs(totalPercent - 100) > 0.01) {
      throw new Error('Custom percentages must add up to 100%');
    }

    const cents = allocateWeighted(totalCents, percentages);
    return memberIds.map((userId, index) => ({
      userId,
      amount: fromCents(cents[index]),
    }));
  }

  if (splitMethod === 'by_item' && items.length > 0) {
    const memberIndex = new Map(memberIds.map((id, index) => [id, index]));
    const cents = new Array(memberIds.length).fill(0) as number[];
    let sharedCents = 0;

    for (const item of items) {
      const itemCents = toCents(Number(item.price));
      if (!Number.isFinite(itemCents) || itemCents < 0) {
        throw new Error('Item prices must be valid non-negative amounts');
      }

      if (item.assignedTo && memberIndex.has(item.assignedTo)) {
        cents[memberIndex.get(item.assignedTo)!] += itemCents;
      } else {
        sharedCents += itemCents;
      }
    }

    const sharedAllocations = allocateWeighted(sharedCents, memberIds.map(() => 1));
    for (let i = 0; i < cents.length; i += 1) {
      cents[i] += sharedAllocations[i];
    }

    // Keep shares authoritative to the entered total. Any tax, tip, OCR drift,
    // or manual difference not represented by items is shared evenly.
    const itemizedCents = cents.reduce((sum, value) => sum + value, 0);
    const adjustment = totalCents - itemizedCents;
    if (adjustment !== 0) {
      const sign = adjustment > 0 ? 1 : -1;
      const adjustmentAllocations = allocateWeighted(Math.abs(adjustment), memberIds.map(() => 1));
      for (let i = 0; i < cents.length; i += 1) {
        cents[i] += sign * adjustmentAllocations[i];
        if (cents[i] < 0) {
          throw new Error('Itemized split cannot produce a negative share');
        }
      }
    }

    return memberIds.map((userId, index) => ({
      userId,
      amount: fromCents(cents[index]),
    }));
  }

  const cents = allocateWeighted(totalCents, memberIds.map(() => 1));
  return memberIds.map((userId, index) => ({
    userId,
    amount: fromCents(cents[index]),
  }));
}
