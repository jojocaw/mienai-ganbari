// F9: the owner corrects the month-end verdicts. Each correction (Claude said 迷う, the owner says 付ける, for example)
// becomes an example line for the yardstick skill, so next month the extractor gives the owner's answer on similar lines.
// Plain code: no Claude. The example is the fact's action without the person's name (the skill is about actions, not people).
// F9: 店長が月末の答えを直す。直した1件ずつが、物差しのスキルの「店長が実際に決めた例」の1行になる (ふつうのコード)。
// 例の行は、事実の「何をしたか」から人の名前を外したもの (物差しは人ではなく行動の決まり)。

import type { OwnerExample } from "../monosashi/examples.ts";
import { VERDICTS, type Verdict } from "../monosashi/lint.ts";
import { STAFF } from "../staff.ts";
import type { EventView, MonthView } from "./summary.ts";

export interface OwnerCorrection {
  eventId: string;
  verdict: Verdict;
}

/** At most this many corrections in one save (a month of a small shop has about 150 events; this keeps a save small). */
export const MAX_CORRECTIONS = 40;

/** "ミンさんが閉店後に床をふいた" → "閉店後に床をふいた". The person's card (or the skill) does not need the name. */
export function actionWithoutActor(action: string, actorId: string): string {
  const ja = STAFF.find((s) => s.id === actorId)?.ja;
  return ja ? action.replace(new RegExp(`^${ja}(さん)?(が|は)、?`), "") : action;
}

/** Checks the request body. Returns the corrections, or a problem in plain Japanese. */
export function parseCorrections(raw: unknown): { corrections: OwnerCorrection[] } | { problem: string } {
  if (!Array.isArray(raw) || raw.length === 0) return { problem: "直した答えがありません" };
  if (raw.length > MAX_CORRECTIONS) return { problem: `一度に送れるのは ${MAX_CORRECTIONS}件までです` };
  const corrections: OwnerCorrection[] = [];
  for (const c of raw) {
    const eventId = (c as { eventId?: unknown })?.eventId;
    const verdict = (c as { verdict?: unknown })?.verdict;
    if (typeof eventId !== "string" || !eventId || eventId.length > 40) return { problem: "出来事の番号の形がちがいます" };
    if (!VERDICTS.includes(verdict as Verdict)) return { problem: "答えは 付ける・付けない・迷う のどれかです" };
    corrections.push({ eventId, verdict: verdict as Verdict });
  }
  return { corrections };
}

export interface CorrectionExample extends OwnerExample {
  eventId: string;
  /** What the yardstick (Claude) said before the owner corrected it. */
  from: Verdict;
}

/**
 * Turns the owner's corrections into example lines. A "correction" that repeats Claude's own verdict is skipped
 * (it teaches nothing new); an unknown event is reported, not guessed.
 */
export function correctionsToExamples(view: MonthView, corrections: OwnerCorrection[]): { examples: CorrectionExample[]; skipped: number; problems: string[] } {
  const events = new Map<string, EventView>();
  for (const p of view.persons) for (const e of [...p.green, ...p.yellow]) events.set(e.id, e);
  const examples: CorrectionExample[] = [];
  const problems: string[] = [];
  let skipped = 0;
  for (const c of corrections) {
    const e = events.get(c.eventId);
    if (!e) {
      problems.push(`今月の出来事に ${c.eventId} がありません`);
      continue;
    }
    if (c.verdict === e.verdict) {
      skipped++;
      continue;
    }
    const line = actionWithoutActor(e.action, e.actorId).trim();
    if (!line) {
      problems.push(`${c.eventId} の「何をしたか」が空です`);
      continue;
    }
    examples.push({ eventId: e.id, line, verdict: c.verdict, from: e.verdict });
  }
  return { examples, skipped, problems };
}
