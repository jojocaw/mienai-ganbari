// F7: the real call to the letter-writer subagent. Kept apart so tests never call the API.
// F7: 手紙の係を本当に呼ぶ所。テストが API を呼ばないよう分けておく。

import { agentDefinitions } from "../agents.ts";
import { runStructured } from "../claude.ts";
import { LETTER_SCHEMA, type AskLetter } from "./letters.ts";

export const askLetterWriter: AskLetter = async ({ prompt }) => {
  const { data, costUsd } = await runStructured<unknown>({
    prompt,
    schema: LETTER_SCHEMA,
    agent: "letter-writer",
    agents: agentDefinitions(),
    maxBudgetUsd: 0.5,
  });
  return { raw: data, costUsd };
};
