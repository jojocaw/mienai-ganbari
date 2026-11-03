// F3/F4: the real calls to the subagents (Claude Agent SDK). Kept apart so tests never call the API.
// F3/F4: 手伝い役を本当に呼ぶ所。テストが API を呼ばないよう分けておく。

import { agentDefinitions } from "../agents.ts";
import { runStructured } from "../claude.ts";
import type { Ask } from "./extract.ts";
import { SKILL_NAME } from "../shop.ts";
import { shopDir } from "../shop-config.ts";
import { CHECK_SCHEMA, EXTRACT_SCHEMA, SKILL_QUOTE_PROMPT, SKILL_QUOTE_SCHEMA, withYardstick } from "./prompt.ts";

/** The fact extractor with the owner's yardstick: the skill is turned on and invoked at the top of every prompt. */
export const askExtractor: Ask = async ({ prompt }) => {
  const { data, costUsd } = await runStructured<unknown>({
    prompt: withYardstick(prompt),
    schema: EXTRACT_SCHEMA,
    agent: "fact-extractor",
    agents: agentDefinitions(),
    settingSources: ["project"],
    skills: [SKILL_NAME],
    ...(shopDir() ? { cwd: shopDir()! } : {}),
    maxBudgetUsd: 0.5,
  });
  return { raw: data, costUsd };
};

/** Asks the fact extractor (with the yardstick, as in askExtractor) to quote the yardstick's first 付けない rule. */
export async function askYardstickQuote(opts: { cwd?: string } = {}): Promise<{ quote: string; costUsd: number }> {
  const { data, costUsd } = await runStructured<{ quote: string }>({
    prompt: withYardstick(SKILL_QUOTE_PROMPT),
    schema: SKILL_QUOTE_SCHEMA,
    agent: "fact-extractor",
    agents: agentDefinitions(),
    settingSources: ["project"],
    skills: [SKILL_NAME],
    ...(opts.cwd ?? shopDir() ? { cwd: (opts.cwd ?? shopDir())! } : {}),
    maxBudgetUsd: 0.2,
  });
  return { quote: data.quote, costUsd };
}

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
