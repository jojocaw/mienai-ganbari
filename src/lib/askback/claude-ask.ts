// F10: the real call to the asker subagent (Claude Agent SDK, Haiku). Kept apart so tests never call the API.
// F10: 聞き返し係を本当に呼ぶ所。テストが API を呼ばないよう分けておく。

import { agentDefinitions } from "../agents.ts";
import { runStructured } from "../claude.ts";
import { ASK_SCHEMA, type AskFn } from "./ask.ts";

export const askAsker: AskFn = async ({ prompt }) => {
  const { data, costUsd } = await runStructured<unknown>({
    prompt,
    schema: ASK_SCHEMA,
    agent: "asker",
    agents: agentDefinitions(),
    maxBudgetUsd: 0.05,
  });
  return { raw: data, costUsd };
};
