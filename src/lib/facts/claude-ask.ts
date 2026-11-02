// F3/F4: the real calls to the subagents (Claude Agent SDK). Kept apart so tests never call the API.
// F3/F4: 手伝い役を本当に呼ぶ所。テストが API を呼ばないよう分けておく。

import { agentDefinitions } from "../agents.ts";
import { runStructured } from "../claude.ts";
import type { Ask } from "./extract.ts";
import { CHECK_SCHEMA, EXTRACT_SCHEMA } from "./prompt.ts";

export const askExtractor: Ask = async ({ prompt }) => {
  const { data, costUsd } = await runStructured<unknown>({
    prompt,
    schema: EXTRACT_SCHEMA,
    agent: "fact-extractor",
    agents: agentDefinitions(),
    settingSources: ["project"],
    maxBudgetUsd: 0.5,
  });
  return { raw: data, costUsd };
};

export const askChecker: Ask = async ({ prompt }) => {
  const { data, costUsd } = await runStructured<unknown>({
    prompt,
    schema: CHECK_SCHEMA,
    agent: "checker",
    agents: agentDefinitions(),
    maxBudgetUsd: 0.2,
  });
  return { raw: data, costUsd };
};
