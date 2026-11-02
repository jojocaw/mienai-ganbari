// F3 + F4 orchestration in plain code: day by day, the fact extractor reads the lines (one retry with the problems),
// the checker suggests same-event groups, and checkFacts() decides. The model calls are passed in, so tests need no API key.
// F3 + F4 の流れ (ふつうのコード)。1日ずつ事実そろえ係が読み (通らなければ問題を伝えて1回だけ書き直し)、
// 確かめ係が「同じ出来事」の組を出し、checkFacts() が決める。Claude を呼ぶ所は外から渡す。

import type { Entry } from "../entries.ts";
import { checkFacts, type CheckResult } from "./check.ts";
import { buildCheckPrompt, buildExtractPrompt } from "./prompt.ts";
import type { Dropped, Extraction, Fact } from "./types.ts";
import { validateExtraction } from "./validate.ts";

export interface ModelOut {
  raw: unknown;
  costUsd: number;
}
export type Ask = (input: { prompt: string }) => Promise<ModelOut>;

export class ExtractError extends Error {
  readonly problems: string[];
  readonly date: string;
  constructor(message: string, date: string, problems: string[]) {
    super(message);
    this.date = date;
    this.problems = problems;
  }
}

export async function extractBatch(entries: Entry[], ask: Ask, maxAttempts = 2): Promise<{ extraction: Extraction; attempts: number; costUsd: number }> {
  let problems: string[] = [];
  let costUsd = 0;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const out = await ask({ prompt: buildExtractPrompt(entries, problems) });
    costUsd += out.costUsd;
    const v = validateExtraction(out.raw, entries);
    if (v.extraction) return { extraction: v.extraction, attempts: attempt, costUsd };
    problems = v.problems;
  }
  throw new ExtractError("事実そろえ係の答えが確かめに通りませんでした", entries[0]?.date ?? "", problems);
}

/** Asks the checker for same-event groups. A broken answer only means "no suggestions"; code still groups by itself. */
export async function suggestGroups(facts: Fact[], ask: Ask): Promise<{ groups: string[][]; costUsd: number }> {
  if (facts.length < 2) return { groups: [], costUsd: 0 };
  const out = await ask({ prompt: buildCheckPrompt(facts) });
  const groups = (out.raw as { groups?: unknown } | null)?.groups;
  const ok = Array.isArray(groups) ? groups.filter((g): g is string[] => Array.isArray(g) && g.every((x) => typeof x === "string")) : [];
  return { groups: ok, costUsd: out.costUsd };
}

export interface MonthRun extends CheckResult {
  dropped: Dropped[];
  costUsd: number;
  attempts: Record<string, number>;
}

/** Runs the whole month, a few days at a time. */
export async function runMonth(
  entries: Entry[],
  opts: { extract: Ask; check?: Ask; concurrency?: number; onDay?: (date: string, done: number, total: number) => void },
): Promise<MonthRun> {
  const days = [...new Set(entries.map((e) => e.date))].sort();
  const order = new Map(entries.map((e, i) => [e.id, i]));
  const facts: Fact[] = [];
  const dropped: Dropped[] = [];
  const suggested: string[][] = [];
  const attempts: Record<string, number> = {};
  let costUsd = 0;
  let next = 0;
  let done = 0;

  async function worker() {
    while (next < days.length) {
      const date = days[next++];
      const dayEntries = entries.filter((e) => e.date === date);
      const r = await extractBatch(dayEntries, opts.extract);
      attempts[date] = r.attempts;
      costUsd += r.costUsd;
      facts.push(...r.extraction.facts);
      dropped.push(...r.extraction.dropped);
      if (opts.check) {
        const s = await suggestGroups(r.extraction.facts, opts.check);
        costUsd += s.costUsd;
        suggested.push(...s.groups);
      }
      opts.onDay?.(date, ++done, days.length);
    }
  }
  await Promise.all(Array.from({ length: Math.min(opts.concurrency ?? 3, days.length) }, worker));

  facts.sort((a, b) => (order.get(a.entryId) ?? 0) - (order.get(b.entryId) ?? 0));
  dropped.sort((a, b) => (order.get(a.entryId) ?? 0) - (order.get(b.entryId) ?? 0));
  return { ...checkFacts(facts, dropped, order, suggested), dropped, costUsd, attempts };
}
