// F3/F4: what the fact extractor and the checker receive, and the JSON they must return.
// F3/F4: 事実そろえ係と確かめ係に渡す物と、返してほしい JSON の形。

import type { Entry } from "../entries.ts";
import { STAFF } from "../staff.ts";
import type { Fact } from "./types.ts";

export const EXTRACT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["entryId", "kind", "dropReason", "actorId", "forIds", "action", "task", "verdict", "reason"],
        properties: {
          entryId: { type: "string" },
          kind: { type: "string", enum: ["help", "self", "drop"] },
          dropReason: { type: "string", enum: ["gossip", "judgement", "vague", ""] },
          actorId: { type: "string" },
          forIds: { type: "array", items: { type: "string" } },
          action: { type: "string" },
          task: { type: "string" },
          verdict: { type: "string", enum: ["付ける", "付けない", "迷う", ""] },
          reason: { type: "string" },
        },
      },
    },
  },
};

export const CHECK_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["groups"],
  properties: {
    groups: { type: "array", items: { type: "array", items: { type: "string" } } },
  },
};

const staffList = () => STAFF.map((s) => `- ${s.id}: ${s.name}${s.roman ? ` (${s.roman})` : ""}, writes in ${s.lang}`).join("\n");

/** One batch (usually one day) of lines for the fact extractor. */
export function buildExtractPrompt(entries: Entry[], problems: string[] = []): string {
  const lines = entries.map((e) => `- entryId: ${e.id} | date: ${e.date} | writer: ${e.authorId}\n  line: ${e.text}`).join("\n");
  let prompt = `Staff:\n${staffList()}\n\nLines (${entries.length}):\n${lines}\n\nReturn one item for every line.`;
  if (problems.length) prompt += `\n\nYour previous answer did not pass these checks. Answer again for every line:\n${problems.map((p) => `- ${p}`).join("\n")}`;
  return prompt;
}

/** One day of facts for the checker. Only the extracted facts are sent, not the original lines. */
export function buildCheckPrompt(facts: Fact[]): string {
  const rows = facts.map((f) => `- entryId: ${f.entryId} | writer: ${f.authorId} | actorId: ${f.actorId} | kind: ${f.kind} | task: ${f.task} | action: ${f.action}`).join("\n");
  return `Facts of ${facts[0]?.date ?? "one day"} (${facts.length}):\n${rows}\n\nReturn the groups of entryIds that describe the same event (an empty list when there are none).`;
}
