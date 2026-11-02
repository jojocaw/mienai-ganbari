// F3/F4: the shapes of facts taken from the daily lines.
// F3/F4: 毎日の1行から取り出した「事実」の形。

import type { Verdict } from "../monosashi/lint.ts";

export type DropReason = "gossip" | "judgement" | "vague";
export const DROP_REASONS: DropReason[] = ["gossip", "judgement", "vague"];

/** One fact: who did what for whom, always tied to the original line (entryId). */
export interface Fact {
  entryId: string;
  date: string;
  authorId: string;
  /** "help" = the writer saw someone else do it, "self" = the writer reports their own action. */
  kind: "help" | "self";
  actorId: string;
  forIds: string[];
  /** What was done, in short plain Japanese. */
  action: string;
  /** A short name for the job, used to find the same event written twice. */
  task: string;
  /** The owner's yardstick (the skill) applied to this fact. */
  verdict: Verdict;
  reason: string;
}

/** A line that was not kept. Only the reason is kept, never the words. */
export interface Dropped {
  entryId: string;
  date: string;
  authorId: string;
  reason: DropReason;
}

export interface Extraction {
  facts: Fact[];
  dropped: Dropped[];
}
