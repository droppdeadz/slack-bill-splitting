export function splitEqual(
  totalAmount: number,
  numberOfPeople: number
): number[] {
  if (numberOfPeople <= 0) {
    return [];
  }
  const base = Math.floor((totalAmount / numberOfPeople) * 100) / 100;
  const remainder =
    Math.round((totalAmount - base * numberOfPeople) * 100) / 100;

  const amounts = Array(numberOfPeople).fill(base);

  // Distribute remainder cents to the first few people
  if (remainder > 0) {
    const centsToDistribute = Math.round(remainder * 100);
    for (let i = 0; i < centsToDistribute; i++) {
      amounts[i] = Math.round((amounts[i] + 0.01) * 100) / 100;
    }
  }

  return amounts;
}

/**
 * Calculate per-person amounts from item selections.
 * Each item's cost is divided equally among all participants who selected it.
 * A participant's total is the sum of their shares across all selected items.
 */
export function calculateItemSplits(
  items: { id: string; amount: number }[],
  selections: { bill_item_id: string; participant_id: string }[]
): Map<string, number> {
  const participantTotals = new Map<string, number>();

  for (const item of items) {
    // Find all participants who selected this item
    const selectors = selections.filter(
      (s) => s.bill_item_id === item.id
    );
    if (selectors.length === 0) continue;

    const sharePerPerson =
      Math.round((item.amount / selectors.length) * 100) / 100;

    for (const selector of selectors) {
      const current = participantTotals.get(selector.participant_id) || 0;
      participantTotals.set(
        selector.participant_id,
        Math.round((current + sharePerPerson) * 100) / 100
      );
    }
  }

  return participantTotals;
}
