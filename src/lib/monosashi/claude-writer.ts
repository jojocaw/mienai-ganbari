// F2: the real draft writer (Claude via the Agent SDK). Kept apart from write-skill.ts so tests never call the API.
// F2: 本物の案の書き手 (Agent SDK 経由の Claude)。テストが API を呼ばないよう write-skill.ts と分けておく。

import { model, runStructured } from "../claude.ts";
import { DRAFT_SCHEMA } from "./prompt.ts";
import type { Generate } from "./write-skill.ts";

export const generateWithClaude: Generate = async ({ system, prompt }) => {
  const { data, costUsd } = await runStructured<unknown>({
    system,
    prompt,
    schema: DRAFT_SCHEMA,
    model: model("writer"),
    maxBudgetUsd: 1,
  });
  return { draft: data, costUsd };
};
