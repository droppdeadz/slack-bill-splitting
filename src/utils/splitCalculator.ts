/**
 * Share calculation. All math is done in integer satang so that the Shares of
 * all Participants always add up exactly to the Bill total: every non-Creator
 * Share is rounded down, and whatever is left over falls to the Creator.
 */

const toSatang = (baht: number): number => Math.round(baht * 100);
const toBaht = (satang: number): number => satang / 100;

/**
 * Split a total evenly. Returns participantKey → Share (baht).
 * `creatorKey` must be one of `participantKeys`; it absorbs the rounding remainder.
 */
export function splitEqual(
  totalAmount: number,
  participantKeys: string[],
  creatorKey: string
): Map<string, number> {
  if (!participantKeys.includes(creatorKey)) {
    throw new Error("splitEqual: the Creator must be one of the Participants");
  }

  const totalSatang = toSatang(totalAmount);
  const base = Math.floor(totalSatang / participantKeys.length);
  const creatorShare = totalSatang - base * (participantKeys.length - 1);

  const shares = new Map<string, number>();
  for (const key of participantKeys) {
    shares.set(key, toBaht(key === creatorKey ? creatorShare : base));
  }
  return shares;
}

export interface ShareLine {
  name: string;
  amount: number;
  /** "selected": the Participant's part of an Item they selected.
   *  "unselected": an Unselected Item absorbed by the Creator.
   *  "rounding": leftover satang from Items the Creator did not select. */
  kind: "selected" | "unselected" | "rounding";
}

export interface ItemSplitResult {
  /** participantId → Share (baht) */
  shares: Map<string, number>;
  /** participantId → lines that make up their Share */
  breakdowns: Map<string, ShareLine[]>;
  /** Items no Participant selected (absorbed by the Creator) */
  unselectedItems: { name: string; amount: number }[];
}

/**
 * Calculate Shares from Selections. Each Item's cost is divided equally among
 * the Participants who selected it (rounded down); the Creator absorbs every
 * Unselected Item and every rounding remainder.
 */
export function calculateItemSplits(
  items: { id: string; name: string; amount: number }[],
  selections: { bill_item_id: string; participant_id: string }[],
  creatorParticipantId: string
): ItemSplitResult {
  const sharesSatang = new Map<string, number>([[creatorParticipantId, 0]]);
  const lines = new Map<string, { name: string; satang: number; kind: ShareLine["kind"] }[]>();
  const unselectedItems: { name: string; amount: number }[] = [];
  let roundingSatang = 0;

  const credit = (participantId: string, name: string, satang: number, kind: ShareLine["kind"]): void => {
    sharesSatang.set(participantId, (sharesSatang.get(participantId) ?? 0) + satang);
    const list = lines.get(participantId) ?? [];
    list.push({ name, satang, kind });
    lines.set(participantId, list);
  };

  for (const item of items) {
    const itemSatang = toSatang(item.amount);
    const selectors = selections
      .filter((s) => s.bill_item_id === item.id)
      .map((s) => s.participant_id);

    if (selectors.length === 0) {
      unselectedItems.push({ name: item.name, amount: item.amount });
      credit(creatorParticipantId, item.name, itemSatang, "unselected");
      continue;
    }

    const perPerson = Math.floor(itemSatang / selectors.length);
    const remainder = itemSatang - perPerson * selectors.length;
    for (const participantId of selectors) {
      const extra = participantId === creatorParticipantId ? remainder : 0;
      credit(participantId, item.name, perPerson + extra, "selected");
    }
    if (!selectors.includes(creatorParticipantId)) {
      roundingSatang += remainder;
    }
  }

  if (roundingSatang > 0) {
    credit(creatorParticipantId, "Rounding", roundingSatang, "rounding");
  }

  const shares = new Map<string, number>();
  for (const [id, satang] of sharesSatang) shares.set(id, toBaht(satang));

  const breakdowns = new Map<string, ShareLine[]>();
  for (const [id, list] of lines) {
    breakdowns.set(
      id,
      list.map((l) => ({ name: l.name, amount: toBaht(l.satang), kind: l.kind }))
    );
  }

  return { shares, breakdowns, unselectedItems };
}
