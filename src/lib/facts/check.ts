// F4: the checker. Finds the same event written twice and claims nobody else saw.
// The grouping is plain code; the checker agent may only suggest extra groups, and code accepts a group only
// when it is safe (same day, same person, at least two different lines).
// F4: 確かめ係。同じ出来事の二重と、本人の申告だけ (ほかに書いた人がいない) を見つける。
// まとめるのはふつうのコード。確かめ係の Claude は「これも同じ出来事では」と言えるだけで、通すかはコードが決める。

import type { Dropped, Fact } from "./types.ts";

export type FactStatus = "ok" | "duplicate" | "self-only";

export interface CheckedFact extends Fact {
  status: FactStatus;
  /** The first line about the same event, when this one is a duplicate. */
  duplicateOf?: string;
  /** Other people who wrote about the same event (they make it stronger, not bigger). */
  corroboratedBy: string[];
  /** Every line about the same event, oldest first. */
  eventEntryIds: string[];
}

export interface CheckResult {
  facts: CheckedFact[];
  counts: { facts: number; events: number; duplicates: number; selfOnly: number; dropped: Record<Dropped["reason"], number> };
  /** Suggested groups from the checker agent that code refused, with the reason. */
  rejected: { group: string[]; why: string }[];
}

const normalize = (task: string) => task.replace(/[\s　]/g, "");

/**
 * Groups facts into events and marks duplicates and self-only claims.
 * `order` gives the position of each entry (oldest first) so "the first line" is well defined.
 * `suggested` are extra groups of entryIds from the checker agent (optional).
 */
export function checkFacts(facts: Fact[], dropped: Dropped[], order: Map<string, number>, suggested: string[][] = []): CheckResult {
  const byId = new Map(facts.map((f) => [f.entryId, f]));
  const parent = new Map(facts.map((f) => [f.entryId, f.entryId]));
  const find = (x: string): string => {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r)!;
    parent.set(x, r);
    return r;
  };
  const union = (a: string, b: string) => parent.set(find(a), find(b));

  // 1) Same day + same person + same job name → same event.
  const key = (f: Fact) => `${f.date}|${f.actorId}|${normalize(f.task)}`;
  const firstByKey = new Map<string, string>();
  for (const f of facts) {
    const k = key(f);
    if (firstByKey.has(k)) union(f.entryId, firstByKey.get(k)!);
    else firstByKey.set(k, f.entryId);
  }

  // 2) Extra groups from the checker agent, accepted only when safe.
  const rejected: CheckResult["rejected"] = [];
  for (const group of suggested) {
    const members = [...new Set(group)].map((id) => byId.get(id));
    if (members.length < 2) rejected.push({ group, why: "2つ以上の事実が要ります" });
    else if (members.some((m) => !m)) rejected.push({ group, why: "知らない entryId があります" });
    else if (new Set(members.map((m) => m!.date)).size > 1) rejected.push({ group, why: "日がちがいます" });
    else if (new Set(members.map((m) => m!.actorId)).size > 1) rejected.push({ group, why: "した人がちがいます" });
    else for (const m of members.slice(1)) union(m!.entryId, members[0]!.entryId);
  }

  const events = new Map<string, Fact[]>();
  for (const f of facts) {
    const root = find(f.entryId);
    events.set(root, [...(events.get(root) ?? []), f]);
  }

  const checked: CheckedFact[] = [];
  for (const members of events.values()) {
    members.sort((a, b) => (order.get(a.entryId) ?? 0) - (order.get(b.entryId) ?? 0));
    const first = members[0];
    const witnesses = [...new Set(members.map((m) => m.authorId).filter((a) => a !== first.actorId))];
    const eventEntryIds = members.map((m) => m.entryId);
    members.forEach((m, i) => {
      const status: FactStatus = i > 0 ? "duplicate" : m.kind === "self" && witnesses.length === 0 ? "self-only" : "ok";
      checked.push({
        ...m,
        status,
        duplicateOf: i > 0 ? first.entryId : undefined,
        corroboratedBy: witnesses.filter((w) => w !== m.authorId),
        eventEntryIds,
      });
    });
  }
  checked.sort((a, b) => (order.get(a.entryId) ?? 0) - (order.get(b.entryId) ?? 0));

  const droppedCounts = { gossip: 0, judgement: 0, vague: 0 };
  for (const d of dropped) droppedCounts[d.reason]++;
  return {
    facts: checked,
    counts: {
      facts: checked.length,
      events: events.size,
      duplicates: checked.filter((c) => c.status === "duplicate").length,
      selfOnly: checked.filter((c) => c.status === "self-only").length,
      dropped: droppedCounts,
    },
    rejected,
  };
}
