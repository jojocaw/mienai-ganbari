// F3: plain-code checks on what the fact extractor returned for a batch of lines.
// Every line must come back exactly once, people must come from the staff list, and no character words may be kept.
// F3: 事実そろえ係の答えを、ふつうのコードで確かめる。どの1行もちょうど1回返ること・人は一覧から・人柄の言葉は残さない。

import type { Entry } from "../entries.ts";
import { findCharacterWords, VERDICTS, type Verdict } from "../monosashi/lint.ts";
import { findPerson } from "../shop-config.ts";
import { DROP_REASONS, type DropReason, type Extraction } from "./types.ts";

export const FACT_LIMITS = { actionChars: 60, taskChars: 20, reasonChars: 80 } as const;

const chars = (s: string) => [...s].length;
const isStr = (v: unknown): v is string => typeof v === "string";

/** Checks the raw model output for these entries. Returns the extraction (only when there are no problems) and every problem found. */
export function validateExtraction(raw: unknown, entries: Entry[]): { extraction: Extraction | null; problems: string[] } {
  const problems: string[] = [];
  const items = (raw as { items?: unknown } | null)?.items;
  if (!Array.isArray(items)) return { extraction: null, problems: ["items がありません"] };

  const byId = new Map(entries.map((e) => [e.id, e]));
  const seen = new Set<string>();
  const out: Extraction = { facts: [], dropped: [] };

  items.forEach((it: unknown, i) => {
    const r = (it ?? {}) as Record<string, unknown>;
    const where = `items[${i}]`;
    const entry = isStr(r.entryId) ? byId.get(r.entryId) : undefined;
    if (!entry) {
      problems.push(`${where} の entryId (${String(r.entryId)}) は渡した1行にありません`);
      return;
    }
    if (seen.has(entry.id)) {
      problems.push(`${where}: ${entry.id} が2回出ています`);
      return;
    }
    seen.add(entry.id);

    if (r.kind === "drop") {
      if (!DROP_REASONS.includes(r.dropReason as DropReason)) problems.push(`${where} (${entry.id}) の dropReason は gossip / judgement / vague のどれかです`);
      else out.dropped.push({ entryId: entry.id, date: entry.date, authorId: entry.authorId, reason: r.dropReason as DropReason });
      return;
    }
    if (r.kind !== "help" && r.kind !== "self") {
      problems.push(`${where} (${entry.id}) の kind は help / self / drop のどれかです`);
      return;
    }
    const actorId = isStr(r.actorId) ? r.actorId : "";
    if (!findPerson(actorId)) problems.push(`${where} (${entry.id}) の actorId (${actorId}) はスタッフの一覧にいません`);
    if (r.kind === "help" && actorId === entry.authorId) problems.push(`${where} (${entry.id}) は help なのに、した人が書いた本人です (self にしてください)`);
    if (r.kind === "self" && actorId !== entry.authorId) problems.push(`${where} (${entry.id}) は self なのに、した人が書いた本人ではありません`);
    const forIds = Array.isArray(r.forIds) ? r.forIds.filter(isStr) : [];
    for (const id of forIds) if (!findPerson(id)) problems.push(`${where} (${entry.id}) の forIds に一覧にいない人 (${id}) がいます`);

    const text = (key: "action" | "task" | "reason", max: number): string => {
      const v = r[key];
      if (!isStr(v) || v.trim() === "") {
        problems.push(`${where} (${entry.id}) の ${key} が空です`);
        return "";
      }
      if (/[\r\n]/.test(v)) problems.push(`${where} (${entry.id}) の ${key} は1行で書いてください`);
      if (chars(v) > max) problems.push(`${where} (${entry.id}) の ${key} が長すぎます (${chars(v)} > ${max} 文字)`);
      for (const h of findCharacterWords(v)) problems.push(`${where} (${entry.id}) の ${key} に人柄・態度の言葉「${h.word}」が入っています`);
      return v;
    };
    const action = text("action", FACT_LIMITS.actionChars);
    const task = text("task", FACT_LIMITS.taskChars);
    const reason = text("reason", FACT_LIMITS.reasonChars);
    if (!VERDICTS.includes(r.verdict as Verdict)) problems.push(`${where} (${entry.id}) の verdict は 付ける / 付けない / 迷う のどれかです`);

    out.facts.push({
      entryId: entry.id,
      date: entry.date,
      authorId: entry.authorId,
      kind: r.kind,
      actorId,
      forIds,
      action,
      task,
      verdict: r.verdict as Verdict,
      reason,
    });
  });

  for (const e of entries) if (!seen.has(e.id)) problems.push(`${e.id} の答えがありません (どの1行も1回ずつ返してください)`);
  return { extraction: problems.length ? null : out, problems };
}
