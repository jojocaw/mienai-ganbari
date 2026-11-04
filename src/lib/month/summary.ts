// F5: the month-end view, built by plain code from the checked facts.
// Green = someone else wrote about it (a quiet effort others noticed). Yellow = only the person wrote it (self-report only).
// Every event keeps all of its original lines. Dropped lines (gossip, judgements, vague) are only counted, never shown per person.
// F5: 月末の画面のもと (ふつうのコード)。緑 = ほかの人が書いた頑張り・黄 = 本人の申告だけ。
// どの出来事にも元の1行が全部つながる。捨てた1行は数だけで、人ごとには出さない。

import type { Entry } from "../entries.ts";
import type { CheckedFact } from "../facts/check.ts";
import type { Dropped } from "../facts/types.ts";
import type { Verdict } from "../monosashi/lint.ts";
import { STAFF, type Lang, type Staff } from "../staff.ts";

export interface LineRef {
  entryId: string;
  authorId: string;
  date: string;
  lang: Lang;
  text: string;
  /** F10: the question asked right after the line was saved, and the writer's answer (only when answered). */
  asked?: { question: string; answer: string };
}

export interface EventView {
  id: string;
  date: string;
  actorId: string;
  task: string;
  action: string;
  verdict: Verdict;
  reason: string;
  color: "green" | "yellow";
  /** Everyone who wrote a line about this event. */
  writers: string[];
  lines: LineRef[];
}

export interface PersonView {
  id: string;
  name: string;
  lang: Lang;
  green: EventView[];
  yellow: EventView[];
  /** Lines this person wrote this month (any kind). */
  wrote: number;
}

export interface MonthView {
  persons: PersonView[];
  totals: {
    lines: number;
    facts: number;
    events: number;
    duplicates: number;
    selfOnly: number;
    dropped: Record<Dropped["reason"], number>;
  };
}

export function buildMonthView(month: { facts: CheckedFact[]; dropped: Dropped[] }, entries: Entry[], staff: readonly Staff[] = STAFF): MonthView {
  const entryById = new Map(entries.map((e) => [e.id, e]));
  const order = new Map(entries.map((e, i) => [e.id, i]));
  const byEvent = new Map<string, CheckedFact[]>();
  for (const f of month.facts) {
    const key = f.eventEntryIds[0] ?? f.entryId;
    byEvent.set(key, [...(byEvent.get(key) ?? []), f]);
  }

  const events: EventView[] = [];
  for (const [id, members] of byEvent) {
    members.sort((a, b) => (order.get(a.entryId) ?? 0) - (order.get(b.entryId) ?? 0));
    const first = members[0];
    const witness = members.find((m) => m.authorId !== first.actorId);
    const view = witness ?? first;
    const lines = members.flatMap((m) => {
      const e = entryById.get(m.entryId);
      if (!e) return [];
      const c = e.clarification;
      return [{ entryId: e.id, authorId: e.authorId, date: e.date, lang: e.lang, text: e.text, ...(c?.answer !== undefined ? { asked: { question: c.question, answer: c.answer } } : {}) }];
    });
    events.push({
      id,
      date: first.date,
      actorId: first.actorId,
      task: first.task,
      action: view.action,
      verdict: view.verdict,
      reason: view.reason,
      color: witness ? "green" : "yellow",
      writers: [...new Set(members.map((m) => m.authorId))],
      lines,
    });
  }
  events.sort((a, b) => a.date.localeCompare(b.date) || (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

  const persons: PersonView[] = staff.map((s) => ({
    id: s.id,
    name: s.name,
    lang: s.lang,
    green: events.filter((e) => e.actorId === s.id && e.color === "green"),
    yellow: events.filter((e) => e.actorId === s.id && e.color === "yellow"),
    wrote: entries.filter((e) => e.authorId === s.id).length,
  }));
  const staffOrder = staff.map((s) => s.id);
  persons.sort((a, b) => b.green.length - a.green.length || staffOrder.indexOf(a.id) - staffOrder.indexOf(b.id));

  const dropped = { gossip: 0, judgement: 0, vague: 0 };
  for (const d of month.dropped) dropped[d.reason]++;
  return {
    persons,
    totals: {
      lines: entries.length,
      facts: month.facts.length,
      events: events.length,
      duplicates: month.facts.filter((f) => f.status === "duplicate").length,
      selfOnly: month.facts.filter((f) => f.status === "self-only").length,
      dropped,
    },
  };
}
