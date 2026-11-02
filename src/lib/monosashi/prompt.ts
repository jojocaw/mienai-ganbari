// F2: what we ask Claude when it turns the owner's answers into a yardstick draft.
// F2: 店長の答えを物差しの案にする時に、Claude へ渡す指示。

import { QUESTIONS, type OwnerAnswers } from "./questions.ts";

export const SYSTEM_PROMPT = `You write a small shop's "yardstick" (物差し): the owner's rules for which everyday actions deserve a month-end plus (a small bonus, allowance or thank-you). Staff write one line a day; later, other Claude agents will use your yardstick to sort those lines.

Write in short, plain Japanese that a busy owner understands at a glance.

Hard rules:
1. Describe observable actions only: who did what, for whom. Never describe character, attitude or personality, and never use such words, not even to say they are ignored (for example 「やる気」「性格」「人柄」「真面目」「明るい」「態度」「気が利く」). When the owner used such a word, write the action they most likely meant (「やる気がある」→「頼まれる前に自分から片づけを始めた」) or leave it out.
2. Use only what the owner said. Do not add values of your own. If an answer is unclear or pulls both ways, put it in "unsure"; the owner decides those.
3. Every rule lists the question ids it came from in "from" (for example ["q1","q4"]).
4. Sizes: "give" 3-8 rules, "dontGive" 2-6 rules, "unsure" 0-4 rules, "examples" 4-8. A rule is one line of at most 100 characters. An example is a one-line daily note as a staff member would write it (at most 80 characters; write 「Aさん」「Bさん」 instead of names), a verdict (付ける / 付けない / 迷う) and a one-sentence reason (at most 100 characters) that points to a rule. Include at least one 付ける and one 付けない example.
5. "summary": one or two sentences (at most 150 characters) on what this owner values most, in action words.
6. The yardstick never decides amounts or who gets how much. The owner decides.`;

const ruleList = {
  type: "array",
  items: {
    type: "object",
    additionalProperties: false,
    required: ["text", "from"],
    properties: {
      text: { type: "string" },
      from: { type: "array", items: { type: "string" } },
    },
  },
};

/** JSON schema for the structured output. Sizes and wording are checked afterwards by lint.ts. */
export const DRAFT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "give", "dontGive", "unsure", "examples"],
  properties: {
    summary: { type: "string" },
    give: ruleList,
    dontGive: ruleList,
    unsure: ruleList,
    examples: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["line", "verdict", "reason"],
        properties: {
          line: { type: "string" },
          verdict: { type: "string", enum: ["付ける", "付けない", "迷う"] },
          reason: { type: "string" },
        },
      },
    },
  },
};

/** The user turn: the shop, every question with its answer, and (on a retry) what was wrong last time. */
export function buildPrompt(shopName: string, answers: OwnerAnswers, problems: string[] = []): string {
  const qa = QUESTIONS.map((q) => {
    const a = (answers[q.id] ?? "").trim();
    return `${q.id}. ${q.text}\n答え: ${a === "" ? "（答えなし）" : a}`;
  }).join("\n\n");
  let prompt = `お店: ${shopName}\n\n店長の10問の答え:\n\n${qa}\n\nこの答えから、お店の物差しの案を書いてください。`;
  if (problems.length) {
    prompt += `\n\n前の案は、次の確かめに通りませんでした。全部を書き直してください:\n${problems.map((p) => `- ${p}`).join("\n")}`;
  }
  return prompt;
}
