// F6: the month-end plus, split to the yen by plain code. Claude never calculates money.
// On the screen the owner sets each person's yen with + and − (splitFromAmounts turns that into shares that
// split back to exactly those amounts). A decision kept as shares (like the fictional owner's file) splits by:
//   1. The owner decides the total and each person's share (a whole number, 0 = no plus this month).
//   2. Everyone first gets total × share ÷ (sum of shares), rounded down to the unit (1, 10, 100 or 1000 yen).
//   3. The units left over go one by one to the largest remainders; on a tie, the larger share first,
//      then the order of the staff list.
//   4. Anything smaller than one unit stays with the shop (shown as "left over").
// F6: 月末のプラスを、ふつうのコードで1円まで分ける。Claude には計算させない。

export const UNITS = [1, 10, 100, 1000] as const;
export type Unit = (typeof UNITS)[number];

export const MAX_TOTAL = 10_000_000;
// A share can be a count of units: when the owner sets each person's yen directly, 7,900 yen = 79 shares of 100 yen.
export const MAX_SHARE = MAX_TOTAL;

// The rule as the owner sees it on the month-end screen (the owner sets each person's yen with + and −).
export const RULE_TEXT = [
  "店長が一人ずつ金額を決めます (＋−は1回で選んだ金額ずつ・0円の人は今月はなし)。",
  "配る合計は、プログラムが一人ずつの金額を足して出します。",
  "手紙の金額は、プログラムがこの金額をそのまま入れ、1通ずつ確かめます。",
  "計算はプログラムが行い、Claude には計算させていません。",
];

export class AllocationError extends Error {}

export interface Allocation {
  total: number;
  unit: Unit;
  amounts: Record<string, number>;
  distributed: number;
  leftover: number;
}

/** Splits `total` yen by whole-number `shares`, in multiples of `unit`. `order` breaks ties (the staff list order). */
export function allocate(total: number, shares: Record<string, number>, unit: Unit, order: string[]): Allocation {
  if (!Number.isSafeInteger(total) || total < 0 || total > MAX_TOTAL) throw new AllocationError(`合計は 0〜${MAX_TOTAL.toLocaleString()} 円の整数にしてください`);
  if (!UNITS.includes(unit)) throw new AllocationError("単位は 1・10・100・1000 円のどれかです");
  const ids = order.filter((id) => id in shares);
  for (const id of Object.keys(shares)) if (!order.includes(id)) throw new AllocationError(`名簿にいない人の割合があります (${id})`);
  for (const id of ids) {
    const s = shares[id];
    if (!Number.isInteger(s) || s < 0 || s > MAX_SHARE) throw new AllocationError(`割合は 0〜${MAX_SHARE} の整数にしてください (${id})`);
  }
  const sum = ids.reduce((n, id) => n + shares[id], 0);
  if (sum === 0) throw new AllocationError("少なくとも1人に割合を付けてください");

  const units = Math.floor(total / unit);
  const base = new Map<string, number>();
  const rest = new Map<string, number>();
  for (const id of ids) {
    base.set(id, Math.floor((units * shares[id]) / sum));
    rest.set(id, (units * shares[id]) % sum);
  }
  let left = units - [...base.values()].reduce((a, b) => a + b, 0);
  const queue = ids
    .filter((id) => shares[id] > 0)
    .sort((a, b) => rest.get(b)! - rest.get(a)! || shares[b] - shares[a] || order.indexOf(a) - order.indexOf(b));
  for (const id of queue) {
    if (left === 0) break;
    base.set(id, base.get(id)! + 1);
    left--;
  }

  const amounts: Record<string, number> = {};
  for (const id of ids) amounts[id] = base.get(id)! * unit;
  const distributed = Object.values(amounts).reduce((a, b) => a + b, 0);
  return { total, unit, amounts, distributed, leftover: total - distributed };
}

/**
 * The owner's own yen per person → the same decision in shares: the largest unit that divides every amount,
 * one share per unit. allocate() on the result gives back exactly these amounts, with nothing left over.
 */
export function splitFromAmounts(amounts: Record<string, number>): { total: number; unit: Unit; shares: Record<string, number> } {
  for (const [id, a] of Object.entries(amounts)) if (!Number.isSafeInteger(a) || a < 0) throw new AllocationError(`金額は 0 以上の整数にしてください (${id})`);
  const values = Object.values(amounts);
  const unit = [...UNITS].reverse().find((u) => values.every((a) => a % u === 0)) ?? 1;
  const shares = Object.fromEntries(Object.entries(amounts).map(([id, a]) => [id, a / unit]));
  return { total: values.reduce((n, a) => n + a, 0), unit, shares };
}

/** "12,500円" — the exact text the letters must use. */
export function yen(n: number): string {
  return `${n.toLocaleString("ja-JP")}円`;
}
