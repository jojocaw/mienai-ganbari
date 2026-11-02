// F6: the month-end plus, split to the yen by plain code. Claude never calculates money.
// Rule (shown to the owner as written here):
//   1. The owner decides the total and each person's share (a whole number, 0 = no plus this month).
//   2. Everyone first gets total × share ÷ (sum of shares), rounded down to the unit (1, 10, 100 or 1000 yen).
//   3. The units left over go one by one to the largest remainders; on a tie, the larger share first,
//      then the order of the staff list.
//   4. Anything smaller than one unit stays with the shop (shown as "left over").
// F6: 月末のプラスを、ふつうのコードで1円まで分ける。Claude には計算させない。

export const UNITS = [1, 10, 100, 1000] as const;
export type Unit = (typeof UNITS)[number];

export const MAX_TOTAL = 10_000_000;
export const MAX_SHARE = 10;

export const RULE_TEXT = [
  "店長が決めた割合 (0〜10 の整数・0 は今月はなし) で分けます。",
  "まず一人ずつ「合計 × その人の割合 ÷ 割合の合計」を、えらんだ単位で切り捨てます。",
  "余った分は、切り捨てた端数の大きい人から1単位ずつ足します (同じなら割合の大きい人、それも同じなら名簿の順)。",
  "1単位に満たない残りは、お店に残します。",
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

/** "12,500円" — the exact text the letters must use. */
export function yen(n: number): string {
  return `${n.toLocaleString("ja-JP")}円`;
}
