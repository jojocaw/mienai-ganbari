// A real shop's month: which month to look at, and where its files are. Plain code.
// 本物のお店の1か月: どの月を見るか・ファイルの置き場 (ふつうのコード)。

import path from "node:path";
import { localDataDir, type Entry } from "../entries.ts";

/** data/local/month.json: the real shop's month-end result (`npm run month`). Never committed. */
export const localMonthFile = (): string => path.join(localDataDir(), "month.json");
/** data/local/decision.json: the owner's saved decision for the real shop (optional). */
export const localDecisionFile = (): string => path.join(localDataDir(), "decision.json");
/** data/local/letters.json: saved letters for the real shop (optional). */
export const localLettersFile = (): string => path.join(localDataDir(), "letters.json");

/** The month to look at (YYYY-MM): the one asked for, or the newest month that has lines. Returns that month's lines. */
export function pickMonth(entries: Entry[], asked?: string): { month: string; entries: Entry[] } {
  if (asked !== undefined && !/^\d{4}-(0[1-9]|1[0-2])$/.test(asked)) throw new Error(`月は YYYY-MM の形で書いてください (${asked})`);
  if (entries.length === 0) throw new Error("まだ1行もありません (毎日の1行の画面で書くと data/local/entries.json に入ります)");
  const month = asked ?? entries.map((e) => e.date.slice(0, 7)).sort().at(-1)!;
  return { month, entries: entries.filter((e) => e.date.startsWith(month)) };
}
