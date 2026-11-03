// F6 → F7 in one call: the owner's decision is split to the yen by code, then one letter per person is written and checked.
// Used by `npm run letters` and by POST /api/letters, so both give the same shape.
// 店長の決め → 1円までの計算 (コード) → 一人ずつ手紙を書いて確かめる。スクリプトと画面の両方から使う。

import { model } from "../models.ts";
import type { MonthView } from "../month/summary.ts";
import type { Allocation } from "../pay/allocate.ts";
import type { Lang } from "../staff.ts";
import { writeLetters, type AskLetter, type LetterReason } from "./letters.ts";
import { DEMO_SHOP, nameFor, planLetters, type Decision, type LetterShop } from "./plan.ts";

export interface LetterRow {
  personId: string;
  name: string;
  lang: Lang;
  amountText: string;
  reasons: LetterReason[];
  attempts: number;
  /** Why the letter was not accepted (empty when it passed). */
  problems: string[];
  letter: string | null;
  japanese: string | null;
  usedEntryIds: string[];
}

export interface LettersRun {
  model: string;
  seconds: number;
  costUsd: number;
  decision: Decision;
  allocation: Allocation;
  letters: LetterRow[];
}

export async function runLetters(view: MonthView, decision: Decision, ask: AskLetter, concurrency = 3, shop: LetterShop = DEMO_SHOP): Promise<LettersRun> {
  const { allocation, inputs } = planLetters(view, decision, shop);
  const t0 = Date.now();
  const results = await writeLetters(inputs, ask, concurrency);
  return {
    model: model("letter"),
    seconds: Math.round((Date.now() - t0) / 1000),
    costUsd: Number(results.reduce((n, r) => n + r.costUsd, 0).toFixed(4)),
    decision,
    allocation,
    letters: results.map((r, i) => ({
      personId: r.personId,
      name: nameFor(r.personId, shop.staff),
      lang: inputs[i].lang,
      amountText: inputs[i].amountText,
      reasons: inputs[i].reasons,
      attempts: r.attempts,
      problems: r.problems,
      letter: r.letter?.letter ?? null,
      japanese: r.letter?.japanese ?? null,
      usedEntryIds: r.letter?.usedEntryIds ?? [],
    })),
  };
}
