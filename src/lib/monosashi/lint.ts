// F2: plain-code checks for the yardstick. Claude writes the draft; this code decides whether it is acceptable.
// The most important check: no words about character or attitude ("やる気がある" etc.) may enter the skill.
// F2: 物差しの確かめ (ふつうのコード)。案は Claude が書き、通すかどうかはこのコードが決める。
// 一番大事な確かめ: 人柄・態度の言葉 (やる気がある 等) をスキルに入れない。

import { QUESTIONS } from "./questions.ts";

export type Verdict = "付ける" | "付けない" | "迷う";
export const VERDICTS: Verdict[] = ["付ける", "付けない", "迷う"];

export interface Rule {
  text: string;
  /** Question ids this rule came from, e.g. ["q1", "q4"]. */
  from: string[];
}

export interface Example {
  line: string;
  verdict: Verdict;
  reason: string;
}

export interface Draft {
  summary: string;
  give: Rule[];
  dontGive: Rule[];
  unsure: Rule[];
  examples: Example[];
}

/**
 * Words that judge a person's character or attitude instead of describing an action.
 * Matching is by substring, so stems like "気が利" also catch "気が利く" and "気が利かない".
 */
export const CHARACTER_WORDS = [
  "やる気", "人柄", "性格", "真面目", "まじめ", "明るい", "明るさ", "根性", "誠実", "素直",
  "協調性", "積極性", "積極的", "消極的", "責任感", "態度", "気が利", "気配り上手", "優しい", "やさしい",
  "熱心", "努力家", "頑張り屋", "働き者", "怠け", "だらしな", "生意気", "愛想", "感じがいい", "感じが悪い",
  "向上心", "意識が高い", "意欲", "前向き", "人当たり", "センス",
];

/** How a word stem is shown to the owner ("気が利" is matched, "気が利く" is shown). */
export const WORD_LABEL: Record<string, string> = { 気が利: "気が利く", だらしな: "だらしない", 怠け: "怠ける" };
export const wordLabel = (word: string) => WORD_LABEL[word] ?? word;

export interface WordHit {
  word: string;
  index: number;
  /** A few characters around the hit, for showing the owner where it was. */
  context: string;
}

export function findCharacterWords(text: string): WordHit[] {
  const hits: WordHit[] = [];
  for (const word of CHARACTER_WORDS) {
    let i = text.indexOf(word);
    while (i !== -1) {
      hits.push({ word, index: i, context: text.slice(Math.max(0, i - 8), i + word.length + 8) });
      i = text.indexOf(word, i + word.length);
    }
  }
  return hits.sort((a, b) => a.index - b.index);
}

export const LIMITS = {
  give: [3, 8],
  dontGive: [2, 6],
  unsure: [0, 4],
  examples: [4, 8],
  ruleChars: 100,
  lineChars: 80,
  reasonChars: 100,
  summaryChars: 150,
} as const;

const isString = (v: unknown): v is string => typeof v === "string";
const chars = (s: string) => [...s].length;

/** Turns the model's raw output into a Draft, listing every shape problem instead of throwing. */
export function parseDraft(raw: unknown): { draft: Draft | null; problems: string[] } {
  const problems: string[] = [];
  if (typeof raw !== "object" || raw === null) return { draft: null, problems: ["案が JSON の形になっていません"] };
  const r = raw as Record<string, unknown>;
  const rules = (key: "give" | "dontGive" | "unsure"): Rule[] => {
    const v = r[key];
    if (!Array.isArray(v)) {
      problems.push(`${key} がありません`);
      return [];
    }
    return v.flatMap((item, i) => {
      const it = item as Record<string, unknown> | null;
      if (!it || !isString(it.text) || !Array.isArray(it.from) || !it.from.every(isString)) {
        problems.push(`${key}[${i}] の形が正しくありません`);
        return [];
      }
      return [{ text: it.text, from: it.from as string[] }];
    });
  };
  const give = rules("give");
  const dontGive = rules("dontGive");
  const unsure = rules("unsure");
  let examples: Example[] = [];
  if (!Array.isArray(r.examples)) problems.push("examples がありません");
  else
    examples = r.examples.flatMap((item, i) => {
      const it = item as Record<string, unknown> | null;
      if (!it || !isString(it.line) || !isString(it.reason) || !VERDICTS.includes(it.verdict as Verdict)) {
        problems.push(`examples[${i}] の形が正しくありません`);
        return [];
      }
      return [{ line: it.line, verdict: it.verdict as Verdict, reason: it.reason }];
    });
  if (!isString(r.summary)) problems.push("summary がありません");
  const draft = { summary: isString(r.summary) ? r.summary : "", give, dontGive, unsure, examples };
  return { draft, problems };
}

export interface DraftLint {
  ok: boolean;
  problems: string[];
  characterWords: (WordHit & { where: string })[];
}

/** Checks a draft against the rules of a good yardstick. */
export function lintDraft(raw: unknown): DraftLint & { draft: Draft | null } {
  const { draft, problems } = parseDraft(raw);
  const characterWords: DraftLint["characterWords"] = [];
  if (!draft) return { ok: false, problems, characterWords, draft };

  const ids = new Set(QUESTIONS.map((q) => q.id));
  const check = (where: string, text: string, max: number) => {
    if (text.trim() === "") problems.push(`${where} が空です`);
    if (/[\r\n]/.test(text)) problems.push(`${where} は1行で書いてください`);
    if (chars(text) > max) problems.push(`${where} が長すぎます (${chars(text)} > ${max} 文字)`);
    for (const h of findCharacterWords(text)) characterWords.push({ ...h, where });
  };

  check("summary", draft.summary, LIMITS.summaryChars);
  for (const key of ["give", "dontGive", "unsure"] as const) {
    const [min, max] = LIMITS[key];
    if (draft[key].length < min || draft[key].length > max) problems.push(`${key} は ${min}〜${max} 個にしてください (今は ${draft[key].length} 個)`);
    const seen = new Set<string>();
    draft[key].forEach((rule, i) => {
      check(`${key}[${i}]`, rule.text, LIMITS.ruleChars);
      if (seen.has(rule.text)) problems.push(`${key}[${i}] が同じ決まりの繰り返しです`);
      seen.add(rule.text);
      if (rule.from.length === 0) problems.push(`${key}[${i}] にどの答えから来たか (from) がありません`);
      for (const id of rule.from) if (!ids.has(id)) problems.push(`${key}[${i}] の from に知らない質問 (${id}) があります`);
    });
  }
  const [emin, emax] = LIMITS.examples;
  if (draft.examples.length < emin || draft.examples.length > emax) problems.push(`examples は ${emin}〜${emax} 個にしてください (今は ${draft.examples.length} 個)`);
  draft.examples.forEach((ex, i) => {
    check(`examples[${i}].line`, ex.line, LIMITS.lineChars);
    check(`examples[${i}].reason`, ex.reason, LIMITS.reasonChars);
  });
  for (const v of ["付ける", "付けない"] as const)
    if (!draft.examples.some((ex) => ex.verdict === v)) problems.push(`examples に「${v}」の例がありません`);

  for (const h of characterWords) problems.push(`人柄・態度の言葉「${h.word}」が ${h.where} に入っています (行動の言葉にするか、消してください)`);
  return { ok: problems.length === 0, problems, characterWords, draft };
}

export interface SkillLint {
  ok: boolean;
  problems: string[];
  name: string | null;
  description: string | null;
  characterWords: WordHit[];
  counts: { give: number; dontGive: number; unsure: number; examples: number };
}

/** Checks a SKILL.md file (also catches hand edits that broke the rules). */
export function lintSkillText(text: string, expectedName: string): SkillLint {
  const problems: string[] = [];
  const fm = /^---\n([\s\S]*?)\n---\n/.exec(text);
  let name: string | null = null;
  let description: string | null = null;
  if (!fm) problems.push("先頭の --- で囲んだ部分 (name と description) がありません");
  else {
    name = /^name:\s*(.+)$/m.exec(fm[1])?.[1].trim() ?? null;
    description = /^description:\s*(.+)$/m.exec(fm[1])?.[1].trim() ?? null;
    if (name !== expectedName) problems.push(`name が ${expectedName} ではありません (${name ?? "なし"})`);
    if (name && !/^[a-z0-9-]{1,64}$/.test(name)) problems.push("name は英小文字・数字・ハイフンで64文字までです");
    if (!description) problems.push("description がありません");
    else if (description.length > 1024) problems.push("description は1024文字までです");
  }
  const section = (heading: string) => {
    const m = new RegExp(`^## ${heading}\\s*$([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, "m").exec(text);
    if (!m) problems.push(`「## ${heading}」の見出しがありません`);
    return m ? m[1].split("\n").filter((l) => l.startsWith("- ")).length : 0;
  };
  const counts = { give: section("付ける"), dontGive: section("付けない"), unsure: section("迷う"), examples: section("例") };
  const characterWords = findCharacterWords(text);
  for (const h of characterWords) problems.push(`人柄・態度の言葉「${h.word}」が入っています: …${h.context}…`);
  return { ok: problems.length === 0, problems, name, description, characterWords, counts };
}
