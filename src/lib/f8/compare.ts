// F8 ②: does the owner's yardstick skill make Claude answer like the owner?
// Twenty made-up scenes. The owner answers 付ける / 付けない / 迷う for each (kept private). The same scenes go to the
// fact extractor without the skill and with it, and plain code counts how often each one gives the owner's answer.
// F8 ②: 店長の物差しのスキルで、Claude の答えは店長に近づくか。架空の場面20個に店長が答え、同じ場面を
// スキルなし・ありの事実そろえ係に読ませ、店長と同じ答えになった数をふつうのコードで数える。

import type { Entry } from "../entries.ts";
import type { Extraction } from "../facts/types.ts";
import type { Verdict } from "../monosashi/lint.ts";
import { findStaff } from "../staff.ts";

export const VERDICTS: readonly Verdict[] = ["付ける", "付けない", "迷う"];

export const CATEGORIES = {
  help: "人を助けた",
  quiet: "目立たない片づけ・準備",
  self: "本人の申告だけ",
  loud: "声は大きいが中身が薄い",
  edge: "決まりすれすれの頑張り",
  gossip: "悪口が混ざった報告",
} as const;
export type Category = keyof typeof CATEGORIES;

export interface Scenario {
  id: string;
  category: Category;
  writerId: string;
  /** Whose plus the owner decides for this scene. */
  actorId: string;
  text: string;
}

/** What Claude's answer for one scene means: a verdict, or "取り違え" when it named a different person. */
export type ClaudeAnswer = Verdict | "取り違え";

/** Returns an error message, or null when the scenes are usable. */
export function scenariosError(scenarios: Scenario[]): string | null {
  const ids = new Set<string>();
  for (const s of scenarios) {
    if (ids.has(s.id)) return `場面の番号が重なっています (${s.id})`;
    ids.add(s.id);
    if (!(s.category in CATEGORIES)) return `場面の種類が分かりません (${s.id})`;
    if (!findStaff(s.writerId) || !findStaff(s.actorId)) return `名簿にいない人がいます (${s.id})`;
    if ((s.category === "self") !== (s.writerId === s.actorId) && s.category !== "loud") return `本人の申告かどうかと書いた人が合いません (${s.id})`;
    if (!s.text.trim() || /[\r\n]/.test(s.text)) return `1行になっていません (${s.id})`;
  }
  return null;
}

/** The owner's answers must cover every scene with 付ける / 付けない / 迷う. */
export function ownerAnswersError(raw: unknown, scenarios: Scenario[]): string | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return "答えの形がちがいます";
  const a = raw as Record<string, unknown>;
  for (const s of scenarios) if (!VERDICTS.includes(a[s.id] as Verdict)) return `${s.id} に「付ける・付けない・迷う」のどれかがありません`;
  for (const id of Object.keys(a)) if (!scenarios.some((s) => s.id === id)) return `知らない場面の答えがあります (${id})`;
  return null;
}

/** The scenes as daily lines, so they go through exactly the same extractor and checks as a real month. */
export function scenarioEntries(scenarios: Scenario[]): Entry[] {
  return scenarios.map((s) => ({
    id: s.id,
    date: "2026-11-20",
    authorId: s.writerId,
    lang: findStaff(s.writerId)!.lang,
    text: s.text,
    createdAt: "2026-11-20T21:00:00+09:00",
    source: "seed" as const,
  }));
}

/** Claude's answer per scene: a kept fact gives its verdict (if it names the right person); a dropped line gets no plus. */
export function claudeAnswers(extraction: Extraction, scenarios: Scenario[]): Record<string, ClaudeAnswer> {
  const out: Record<string, ClaudeAnswer> = {};
  for (const s of scenarios) {
    const fact = extraction.facts.find((f) => f.entryId === s.id);
    if (fact) out[s.id] = fact.actorId === s.actorId ? fact.verdict : "取り違え";
    else if (extraction.dropped.some((d) => d.entryId === s.id)) out[s.id] = "付けない";
    else out[s.id] = "取り違え";
  }
  return out;
}

export interface Agreement {
  total: number;
  same: number;
  byCategory: Record<Category, { total: number; same: number }>;
  /** owner answer → Claude answer → count */
  matrix: Record<Verdict, Record<ClaudeAnswer, number>>;
  /** Scenes where Claude did not give the owner's answer. */
  differ: string[];
}

export function agreement(owner: Record<string, Verdict>, claude: Record<string, ClaudeAnswer>, scenarios: Scenario[]): Agreement {
  const byCategory = Object.fromEntries(Object.keys(CATEGORIES).map((c) => [c, { total: 0, same: 0 }])) as Agreement["byCategory"];
  const row = () => ({ 付ける: 0, 付けない: 0, 迷う: 0, 取り違え: 0 });
  const matrix = { 付ける: row(), 付けない: row(), 迷う: row() };
  const differ: string[] = [];
  let same = 0;
  for (const s of scenarios) {
    const o = owner[s.id];
    const c = claude[s.id] ?? "取り違え";
    byCategory[s.category].total++;
    matrix[o][c]++;
    if (o === c) {
      same++;
      byCategory[s.category].same++;
    } else differ.push(s.id);
  }
  return { total: scenarios.length, same, byCategory, matrix, differ };
}
