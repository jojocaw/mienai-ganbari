// The owner's own decisions on real lines (and, if the owner gave one, their own short reason), added to the yardstick
// skill. Plain code, no Claude: the lines, the answers and the owner's words go in word for word. The ten answers give
// the written rules, but an owner's real decisions can differ from them (small everyday help they would not pay extra
// for, for example); this section carries that over. Nothing that judges a person (character or attitude words) enters.
// 店長が実際の行に出した答え (と、店長が書いたわけ) を、物差しのスキルに足す (ふつうのコード・Claude は使わない)。
// 10問の答えから書いた決まりと、店長の実際の判断がずれることがある。そのずれを伝える。人を評価する言葉は入れない。

import { findCharacterWords, lintSkillText, type Verdict } from "./lint.ts";
// (mergeOwnerExamples below is the month-to-month version: the owner corrects the month-end verdicts on /month and
//  those decisions join the section, so next month's extractor gives the owner's answer on similar lines.)
// (下の mergeOwnerExamples は月ごとの版: 店長が /month で直した答えを足していく。)

export const OWNER_EXAMPLES_HEADING = "店長が実際に決めた例";

export interface OwnerExample {
  line: string;
  verdict: Verdict;
}

function checkLine(kind: string, text: string): void {
  if (!text.trim() || /[\r\n]/.test(text)) throw new Error(`${kind}は1行にしてください: ${text}`);
  const words = findCharacterWords(text);
  if (words.length) throw new Error(`人柄・態度の言葉「${words[0].word}」が入った${kind}は足せません`);
}

/**
 * Returns the skill text with a section of the owner's decisions and words just before 「読み方の決まり」.
 * Throws if there is nothing to add, if the section is already there, or if the result would break the skill's rules.
 */
export function addOwnerExamples(skillText: string, add: { examples?: OwnerExample[]; notes?: string[] }, skillName: string): string {
  const examples = add.examples ?? [];
  const notes = add.notes ?? [];
  if (examples.length === 0 && notes.length === 0) throw new Error("足す例も店長のことばもありません");
  if (skillText.includes(`## ${OWNER_EXAMPLES_HEADING}`)) throw new Error("店長の例はもう入っています");
  for (const ex of examples) checkLine("例", ex.line);
  for (const n of notes) checkLine("店長のことば", n);
  const what = examples.length && notes.length ? "店長が実際の行を読んで決めた答えと、店長のことばです。" : examples.length ? "店長が実際の行を読んで決めた答えです。" : "店長のことばです。";
  const parts = [
    `## ${OWNER_EXAMPLES_HEADING}`,
    `${what}上の決まりと合わない時は、こちらを先に見て、似た行動には同じ答えを出します。`,
    ...notes.map((n) => `店長のことば: 「${n}」`),
    ...(examples.length ? [examples.map((ex) => `- 「${ex.line}」→ **${ex.verdict}**`).join("\n")] : []),
  ];
  const section = `${parts.join("\n\n")}\n\n`;
  const at = skillText.indexOf("\n## 読み方の決まり");
  const text = at >= 0 ? `${skillText.slice(0, at + 1)}${section}${skillText.slice(at + 1)}` : `${skillText.trimEnd()}\n\n${section}`;
  const lint = lintSkillText(text, skillName);
  if (!lint.ok) throw new Error(lint.problems.join(" / "));
  return text;
}

const EXAMPLE_LINE = /^- 「(.+)」→ \*\*(付ける|付けない|迷う)\*\*$/;
const NOTE_LINE = /^店長のことば: 「(.+)」$/;

/** Where the owner's section starts and ends in the skill text (end = the start of the next heading), or null. */
function sectionBounds(skillText: string): { start: number; end: number } | null {
  const start = skillText.indexOf(`## ${OWNER_EXAMPLES_HEADING}`);
  if (start < 0) return null;
  const next = skillText.indexOf("\n## ", start + 1);
  return { start, end: next >= 0 ? next + 1 : skillText.length };
}

/** The owner's decisions and words already in the skill (empty lists when the section is not there). */
export function readOwnerExamples(skillText: string): { examples: OwnerExample[]; notes: string[] } {
  const b = sectionBounds(skillText);
  if (!b) return { examples: [], notes: [] };
  const examples: OwnerExample[] = [];
  const notes: string[] = [];
  for (const l of skillText.slice(b.start, b.end).split("\n")) {
    const ex = EXAMPLE_LINE.exec(l);
    if (ex) examples.push({ line: ex[1], verdict: ex[2] as Verdict });
    const note = NOTE_LINE.exec(l);
    if (note) notes.push(note[1]);
  }
  return { examples, notes };
}

/** The most owner examples the skill keeps. Past this, the oldest ones leave first (the newest decisions count most). */
export const MAX_OWNER_EXAMPLES = 60;

export interface MergeResult {
  text: string;
  added: OwnerExample[];
  changed: { line: string; from: Verdict; to: Verdict }[];
  unchanged: number;
  /** Oldest examples taken out to stay within MAX_OWNER_EXAMPLES. */
  removed: OwnerExample[];
  total: number;
}

/**
 * Month after month: adds the owner's new decisions to the section, keeping the earlier ones and the owner's words.
 * A new decision on a line already in the section replaces the old verdict. Plain code, no Claude.
 * Throws if there is nothing to add or a line judges a person (nothing is written then).
 */
export function mergeOwnerExamples(skillText: string, examples: OwnerExample[], skillName: string): MergeResult {
  if (examples.length === 0) throw new Error("足す例がありません");
  for (const ex of examples) checkLine("例", ex.line);
  const current = readOwnerExamples(skillText);
  const list = [...current.examples];
  const added: OwnerExample[] = [];
  const changed: MergeResult["changed"] = [];
  let unchanged = 0;
  for (const ex of examples) {
    const i = list.findIndex((e) => e.line === ex.line);
    if (i < 0) {
      list.push(ex);
      added.push(ex);
    } else if (list[i].verdict !== ex.verdict) {
      changed.push({ line: ex.line, from: list[i].verdict, to: ex.verdict });
      list[i] = ex;
    } else unchanged++;
  }
  const removed = list.length > MAX_OWNER_EXAMPLES ? list.splice(0, list.length - MAX_OWNER_EXAMPLES) : [];
  const b = sectionBounds(skillText);
  const base = b ? skillText.slice(0, b.start) + skillText.slice(b.end) : skillText;
  const text = addOwnerExamples(base, { examples: list, notes: current.notes }, skillName);
  return { text, added, changed, unchanged, removed, total: list.length };
}
