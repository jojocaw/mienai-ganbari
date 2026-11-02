// Reads the fictional month from disk: the daily lines, the checked facts (F3/F4 real run), the owner's decision and the letters (F7 real run).
// 架空の1か月をファイルから読む: 毎日の1行・確かめた事実・架空の店長の決め・手紙。

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Entry } from "../entries.ts";
import type { CheckedFact } from "../facts/check.ts";
import type { Score } from "../facts/score.ts";
import type { Dropped } from "../facts/types.ts";
import type { Decision } from "../letters/plan.ts";
import type { LettersRun } from "../letters/run.ts";
import { buildMonthView, type MonthView } from "./summary.ts";

export interface FactsRun {
  models: Record<string, string>;
  seconds: number;
  costUsd: number;
  score: Score;
  retries: string[];
}

export interface LoadedMonth {
  view: MonthView;
  run: FactsRun;
  decision: Decision;
  letters: LettersRun | null;
}

async function readJson<T>(root: string, rel: string): Promise<T> {
  return JSON.parse(await readFile(path.join(root, rel), "utf8")) as T;
}

export async function loadMonth(root = process.cwd()): Promise<LoadedMonth> {
  const [entries, month, decision, letters] = await Promise.all([
    readJson<Entry[]>(root, "data/seed/entries.json"),
    readJson<FactsRun & { facts: CheckedFact[]; dropped: Dropped[] }>(root, "data/derived/month.json"),
    readJson<Decision & { _note?: string }>(root, "data/seed/owner-decision.json"),
    readJson<LettersRun>(root, "data/derived/letters.json").catch(() => null),
  ]);
  const { month: m, total, unit, shares } = decision;
  return {
    view: buildMonthView(month, entries),
    run: { models: month.models, seconds: month.seconds, costUsd: month.costUsd, score: month.score, retries: month.retries },
    decision: { month: m, total, unit, shares },
    letters,
  };
}
