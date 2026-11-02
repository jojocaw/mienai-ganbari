// npm run monosashi [answers.json]
// Writes .claude/skills/demo-cafe-monosashi/SKILL.md from the fictional owner's answers (needs ANTHROPIC_API_KEY in .env.local).
// 架空の店長の答えから物差しのスキルを書き出す (.env.local に ANTHROPIC_API_KEY が要る)。

import { readFileSync } from "node:fs";
import { generateWithClaude } from "../src/lib/monosashi/claude-writer.ts";
import { SkillWriteError, writeSkill } from "../src/lib/monosashi/write-skill.ts";

const file = process.argv[2] ?? "data/seed/owner-answers.json";
const { answers } = JSON.parse(readFileSync(file, "utf8"));

try {
  const r = await writeSkill(answers, { generate: generateWithClaude });
  console.log(`wrote ${r.relPath} (attempts: ${r.attempts}, estimated cost: $${r.costUsd.toFixed(4)})`);
  console.log(`character words: ${r.answerWords.length} in the answers -> ${r.lint.characterWords.length} in the skill`);
  console.log(`rules: give ${r.lint.counts.give} / dontGive ${r.lint.counts.dontGive} / unsure ${r.lint.counts.unsure} / examples ${r.lint.counts.examples}`);
} catch (e) {
  if (e instanceof SkillWriteError) {
    console.error(`${e.message} (attempts: ${e.attempts}, estimated cost: $${e.costUsd.toFixed(4)})`);
    for (const p of e.problems) console.error(`- ${p}`);
    process.exit(1);
  }
  throw e;
}
