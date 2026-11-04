// F10: right after a line is saved, Claude reads it once. Only when the line is too vague to say who did what
// (「いろいろ手伝いました。」), it asks the writer ONE short question back, in the writer's own language.
// Gossip, judgements and feelings are never asked about. The line is saved first and never changed; the answer is kept
// next to it and the month-end fact extractor reads the two together. Any problem (no API key, an error, a reply that
// fails the plain-code checks below) simply means "no question", so writing a line works exactly as before.
// F10: 保存した直後に1回だけ読み、だれが何をしたか分からない1行の時だけ、その人の言葉で1つだけ聞き返す。
// うわさ・人柄・気持ちには聞き返さない。元の1行は変えない。うまくいかない時は「聞き返さない」= 今までと同じ。

import { findLocalEntry, setQuestion, type Entry } from "../entries.ts";
import { findCharacterWords } from "../monosashi/lint.ts";
import { staffList } from "../shop-config.ts";
import type { Lang } from "../staff.ts";

export const ASK_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["kind", "question"],
  properties: {
    kind: { type: "string", enum: ["vague", "clear", "gossip", "judgement", "feeling"] },
    question: { type: "string" },
  },
};

/** The longest question shown, in characters (about 40 Japanese characters or 15 words). */
export const QUESTION_MAX: Record<Lang, number> = { ja: 40, vi: 100, id: 100 };

/** Only lines written in the last 30 minutes are asked about: the writer is still on the page. */
export const ASK_WINDOW_MS = 30 * 60 * 1000;

const LANG_NAME: Record<Lang, string> = { ja: "Japanese", vi: "Vietnamese", id: "Indonesian" };
const HAS_JAPANESE = /[\u3040-\u30ff\u3400-\u9fff]/;

export type AskReply = { ask: true; question: string } | { ask: false; why: string };

/** Plain-code checks on Claude's reply. Anything unexpected means "do not ask". */
export function readAskReply(raw: unknown, lang: Lang): AskReply {
  const r = (raw ?? {}) as { kind?: unknown; question?: unknown };
  if (r.kind !== "vague") return { ask: false, why: typeof r.kind === "string" ? r.kind : "no kind" };
  const q = typeof r.question === "string" ? r.question.trim() : "";
  if (!q) return { ask: false, why: "empty question" };
  if (/[\r\n\u2028\u2029]/.test(q)) return { ask: false, why: "not one line" };
  if ([...q].length > QUESTION_MAX[lang]) return { ask: false, why: "too long" };
  if (!/[?？]$/.test(q)) return { ask: false, why: "not a question" };
  if (findCharacterWords(q).length) return { ask: false, why: "character word" };
  if ((lang === "ja") !== HAS_JAPANESE.test(q)) return { ask: false, why: "wrong language" };
  return { ask: true, question: q };
}

/** What the asker reads: the staff names (so it can tell when a person is named), the writer's language and the line. */
export function buildAskPrompt(entry: Pick<Entry, "authorId" | "lang" | "text">): string {
  const names = staffList()
    .map((s) => `- ${s.id}: ${s.name}${s.roman ? ` (${s.roman})` : ""}`)
    .join("\n");
  return `Staff names:\n${names}\n\nWriter: ${entry.authorId}\nWriter's language: ${LANG_NAME[entry.lang]}\nNote: ${entry.text}`;
}

export type AskFn = (input: { prompt: string }) => Promise<{ raw: unknown; costUsd: number }>;

/**
 * Asks once about a line just written in the app. Returns the question to show, or null.
 * Never throws: a missing line, an old line, a line already asked about or any error all mean "no question".
 */
export async function askBack(entryId: unknown, ask: AskFn, now: Date = new Date()): Promise<{ question: string | null; why?: string; costUsd: number }> {
  const entry = await findLocalEntry(entryId);
  if (!entry) return { question: null, why: "not found", costUsd: 0 };
  if (entry.clarification) return { question: null, why: "already asked", costUsd: 0 };
  const age = now.getTime() - new Date(entry.createdAt).getTime();
  if (!(age >= 0 && age <= ASK_WINDOW_MS)) return { question: null, why: "too old", costUsd: 0 };
  let costUsd = 0;
  try {
    const out = await ask({ prompt: buildAskPrompt(entry) });
    costUsd = out.costUsd;
    const r = readAskReply(out.raw, entry.lang);
    if (!r.ask) return { question: null, why: r.why, costUsd };
    await setQuestion(entry.id, r.question, now);
    return { question: r.question, costUsd };
  } catch {
    return { question: null, why: "error", costUsd };
  }
}
