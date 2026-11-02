// F4 acceptance: compare a month's result with the hidden answer key of the fictional data (data/seed/labels.json).
// Every planted duplicate, every self-report-only claim and every gossip/vague line must be found.
// F4 の合格の線: 1か月の結果を、架空のデータの答え (labels.json) と比べる。わざと入れた二重・申告だけ・捨てる1行を全部見つけること。

import type { CheckedFact } from "./check.ts";
import type { Dropped } from "./types.ts";

export interface Label {
  id: string;
  kind: "help" | "self" | "gossip" | "dup" | "vague";
  authorId: string;
  subjectIds: string[];
  task?: string;
  eventKey?: string;
  dupOf?: string;
}

export interface Part {
  expected: number;
  found: number;
  missed: string[];
  wrong: string[];
}

export interface Score {
  duplicates: Part;
  selfOnly: Part;
  dropped: Part;
  /** For kept lines: is the person who did it the right one? */
  actor: { checked: number; correct: number; wrong: string[] };
  allFound: boolean;
}

export function scoreAgainstLabels(run: { facts: CheckedFact[]; dropped: Dropped[] }, labels: Label[]): Score {
  const fact = new Map(run.facts.map((f) => [f.entryId, f]));
  const droppedIds = new Set(run.dropped.map((d) => d.entryId));
  const label = new Map(labels.map((l) => [l.id, l]));

  const part = (expectedIds: string[], isFound: (id: string) => boolean, flagged: string[]): Part => {
    const missed = expectedIds.filter((id) => !isFound(id));
    const expected = new Set(expectedIds);
    return { expected: expectedIds.length, found: expectedIds.length - missed.length, missed, wrong: flagged.filter((id) => !expected.has(id)) };
  };

  const dupIds = labels.filter((l) => l.kind === "dup").map((l) => l.id);
  const duplicates = part(
    dupIds,
    (id) => {
      const f = fact.get(id);
      return Boolean(f && f.status === "duplicate" && f.eventEntryIds.includes(label.get(id)!.dupOf!));
    },
    run.facts.filter((f) => f.status === "duplicate").map((f) => f.entryId),
  );
  const selfOnly = part(
    labels.filter((l) => l.kind === "self").map((l) => l.id),
    (id) => fact.get(id)?.status === "self-only",
    run.facts.filter((f) => f.status === "self-only").map((f) => f.entryId),
  );
  const dropped = part(
    labels.filter((l) => l.kind === "gossip" || l.kind === "vague").map((l) => l.id),
    (id) => droppedIds.has(id),
    [...droppedIds],
  );

  const kept = labels.filter((l) => l.kind === "help" || l.kind === "dup" || l.kind === "self");
  const wrongActor = kept.filter((l) => {
    const f = fact.get(l.id);
    const want = l.kind === "self" ? l.authorId : l.subjectIds[0];
    return !f || f.actorId !== want;
  });
  const actor = { checked: kept.length, correct: kept.length - wrongActor.length, wrong: wrongActor.map((l) => l.id) };

  const clean = (p: Part) => p.missed.length === 0 && p.wrong.length === 0;
  return { duplicates, selfOnly, dropped, actor, allFound: clean(duplicates) && clean(selfOnly) && clean(dropped) && actor.wrong.length === 0 };
}
