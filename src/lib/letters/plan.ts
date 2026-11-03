// F5 → F6 → F7: from the owner's decision to the letters' inputs. Plain code only.
// 店長の決め → 1円までの計算 → 手紙に渡す物。ふつうのコードだけ。

import { allocate, UNITS, yen, type Allocation, type Unit } from "../pay/allocate.ts";
import type { MonthView } from "../month/summary.ts";
import { SHOP } from "../shop.ts";
import { STAFF, type Staff } from "../staff.ts";
import { pickReasons, type LetterInput } from "./letters.ts";

export interface Decision {
  month: string;
  total: number;
  unit: Unit;
  shares: Record<string, number>;
}

/** The name each person is called by in their own language. */
/** Who the letters are for and which shop they come from (default = the fictional café). */
export interface LetterShop {
  staff: readonly Staff[];
  shopName: string;
}

export const DEMO_SHOP: LetterShop = { staff: STAFF, shopName: SHOP.name };

export function nameFor(personId: string, staff: readonly Staff[] = STAFF): string {
  const s = staff.find((x) => x.id === personId)!;
  return s.lang === "ja" ? s.name : s.roman || s.name;
}

export function planLetters(view: MonthView, decision: Decision, shop: LetterShop = DEMO_SHOP): { allocation: Allocation; inputs: LetterInput[] } {
  const allocation = allocate(decision.total, decision.shares, decision.unit, shop.staff.map((s) => s.id));
  const [y, m] = decision.month.split("-");
  const inputs = view.persons
    .filter((p) => (allocation.amounts[p.id] ?? 0) > 0)
    .map((p) => ({
      personId: p.id,
      name: nameFor(p.id, shop.staff),
      lang: p.lang,
      amountText: yen(allocation.amounts[p.id]),
      month: `${y}年${Number(m)}月`,
      shopName: shop.shopName,
      reasons: pickReasons(p),
    }));
  return { allocation, inputs };
}

/** Reads a decision sent by the screen. Returns an error message, or null when the shape is right (amounts are checked by allocate). */
export function decisionShapeError(raw: unknown): string | null {
  const d = (raw ?? {}) as Record<string, unknown>;
  if (typeof d.month !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(d.month)) return "月の形がちがいます";
  if (typeof d.total !== "number") return "合計は数で送ってください";
  if (!UNITS.includes(d.unit as Unit)) return "単位は 1・10・100・1000 円のどれかです";
  if (!d.shares || typeof d.shares !== "object" || Array.isArray(d.shares)) return "割合の形がちがいます";
  for (const v of Object.values(d.shares)) if (typeof v !== "number") return "割合は数で送ってください";
  return null;
}

/** True when two decisions would give the same letters (missing shares count as 0). */
export function sameDecision(a: Decision, b: Decision): boolean {
  if (a.month !== b.month || a.total !== b.total || a.unit !== b.unit) return false;
  const ids = new Set([...Object.keys(a.shares), ...Object.keys(b.shares)]);
  for (const id of ids) if ((a.shares[id] ?? 0) !== (b.shares[id] ?? 0)) return false;
  return true;
}
