// Reads the month to show on /month.
// Fictional café (no shop file): the daily lines, the checked facts (F3/F4 real run), the fictional owner's decision and the letters (F7 real run).
// Real shop (MIENAI_SHOP_FILE): the shop's own lines and its month-end result from `npm run month`, all in data/local (never committed).
// /month に出す1か月を読む。架空のカフェ = 毎日の1行・確かめた事実・架空の店長の決め・手紙。
// 本物のお店 = お店の1行と `npm run month` の結果 (どれも data/local・公開しない)。

import { readFile } from "node:fs/promises";
import path from "node:path";
import { readLocalEntries, todayJst, type Entry } from "../entries.ts";
import type { CheckedFact } from "../facts/check.ts";
import type { Score } from "../facts/score.ts";
import type { Dropped } from "../facts/types.ts";
import type { Decision } from "../letters/plan.ts";
import type { LettersRun } from "../letters/run.ts";
import { shopConfig } from "../shop-config.ts";
import type { Staff } from "../staff.ts";
import { localDecisionFile, localLettersFile, localMonthFile } from "./local.ts";
import { buildMonthView, type MonthView } from "./summary.ts";

export interface FactsRun {
  models: Record<string, string>;
  seconds: number;
  costUsd: number;
  /** The score against the hidden answer key: only the fictional month has one. */
  score: Score | null;
  retries: string[];
}

export interface LoadedMonth {
  view: MonthView;
  run: FactsRun;
  decision: Decision;
  letters: LettersRun | null;
  /** true for a real shop (a shop file is set). */
  real: boolean;
  /** true for a real shop before `npm run month` has made this month's result. */
  pending: boolean;
  shopName: string;
  staff: readonly Staff[];
}

type MonthFile = FactsRun & { month?: string; facts: CheckedFact[]; dropped: Dropped[] };

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

async function readOptional<T>(file: string): Promise<T | null> {
  try {
    return await readJson<T>(file);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}

const pickDecision = ({ month, total, unit, shares }: Decision): Decision => ({ month, total, unit, shares });

async function loadFictional(root: string): Promise<LoadedMonth> {
  const [entries, month, decision, letters] = await Promise.all([
    readJson<Entry[]>(path.join(root, "data/seed/entries.json")),
    readJson<MonthFile>(path.join(root, "data/derived/month.json")),
    readJson<Decision & { _note?: string }>(path.join(root, "data/seed/owner-decision.json")),
    readJson<LettersRun>(path.join(root, "data/derived/letters.json")).catch(() => null),
  ]);
  const shop = shopConfig();
  return {
    view: buildMonthView(month, entries),
    run: { models: month.models, seconds: month.seconds, costUsd: month.costUsd, score: month.score, retries: month.retries },
    decision: pickDecision(decision),
    letters,
    real: false,
    pending: false,
    shopName: shop.name,
    staff: shop.staff,
  };
}

async function loadRealShop(): Promise<LoadedMonth> {
  const shop = shopConfig();
  const [all, month, saved, letters] = await Promise.all([
    readLocalEntries(),
    readOptional<MonthFile>(localMonthFile()),
    readOptional<Decision>(localDecisionFile()),
    readOptional<LettersRun>(localLettersFile()),
  ]);
  const newest = all.map((e) => e.date.slice(0, 7)).sort().at(-1);
  const ym = month?.month ?? newest ?? todayJst().slice(0, 7);
  const entries = all.filter((e) => e.date.startsWith(ym));
  const decision: Decision =
    saved && saved.month === ym ? pickDecision(saved) : { month: ym, total: 0, unit: 100, shares: Object.fromEntries(shop.staff.map((s) => [s.id, 0])) };
  return {
    view: buildMonthView(month ?? { facts: [], dropped: [] }, entries, shop.staff),
    run: month
      ? { models: month.models, seconds: month.seconds, costUsd: month.costUsd, score: null, retries: month.retries }
      : { models: {}, seconds: 0, costUsd: 0, score: null, retries: [] },
    decision,
    letters: letters && letters.decision.month === ym ? letters : null,
    real: true,
    pending: !month,
    shopName: shop.name,
    staff: shop.staff,
  };
}

export async function loadMonth(root = process.cwd()): Promise<LoadedMonth> {
  return shopConfig().real ? loadRealShop() : loadFictional(root);
}
