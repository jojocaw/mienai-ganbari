// F2: the owner's answers → Claude's draft → plain-code checks (one retry with the problems) → SKILL.md on disk.
// The model call is passed in, so tests run without an API key and the checks stay in charge.
// F2: 店長の答え → Claude の案 → コードの確かめ (通らなければ問題を伝えて1回だけ書き直し) → SKILL.md を保存。
// Claude を呼ぶ所は外から渡す (テストは鍵なしで動き、通すかどうかは確かめのコードが決める)。

import { promises as fs } from "node:fs";
import path from "node:path";
import { todayJst } from "../entries.ts";
import { SKILL_NAME } from "../shop.ts";
import { shopConfig, shopDir } from "../shop-config.ts";
import { findCharacterWords, lintDraft, lintSkillText, type Draft, type SkillLint, type WordHit } from "./lint.ts";
import { buildPrompt, SYSTEM_PROMPT } from "./prompt.ts";
import { QUESTIONS, validateAnswers, type OwnerAnswers } from "./questions.ts";
import { renderSkill } from "./render.ts";

export interface Generated {
  draft: unknown;
  costUsd: number;
}
export type Generate = (input: { system: string; prompt: string }) => Promise<Generated>;

export const SKILL_REL_PATH = `.claude/skills/${SKILL_NAME}/SKILL.md`;

/** Where the yardstick skill lives: the committed .claude/skills for the fictional café, the shop folder for a real shop. */
export function skillsRoot(): string {
  const shop = shopDir();
  return process.env.MIENAI_SKILLS_DIR || path.join(shop ?? process.cwd(), ".claude", "skills");
}

export function skillFile(root: string = skillsRoot()): string {
  return path.join(root, SKILL_NAME, "SKILL.md");
}

export interface WriteSkillResult {
  relPath: string;
  text: string;
  draft: Draft;
  attempts: number;
  costUsd: number;
  /** Character words found in the owner's answers (they must not reach the skill). */
  answerWords: (WordHit & { questionId: string })[];
  lint: SkillLint;
}

export class SkillWriteError extends Error {
  readonly problems: string[];
  readonly attempts: number;
  readonly costUsd: number;
  constructor(message: string, problems: string[], attempts: number, costUsd: number) {
    super(message);
    this.problems = problems;
    this.attempts = attempts;
    this.costUsd = costUsd;
  }
}

export function characterWordsInAnswers(answers: OwnerAnswers): WriteSkillResult["answerWords"] {
  return QUESTIONS.flatMap((q) => findCharacterWords(answers[q.id] ?? "").map((h) => ({ ...h, questionId: q.id })));
}

export async function writeSkill(
  answers: OwnerAnswers,
  opts: { generate: Generate; root?: string; now?: Date; maxAttempts?: number },
): Promise<WriteSkillResult> {
  const invalid = validateAnswers(answers);
  if (invalid) throw new SkillWriteError(invalid, [invalid], 0, 0);
  const maxAttempts = opts.maxAttempts ?? 2;
  let problems: string[] = [];
  let costUsd = 0;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const out = await opts.generate({ system: SYSTEM_PROMPT, prompt: buildPrompt(shopConfig().name, answers, problems) });
    costUsd += out.costUsd;
    const checked = lintDraft(out.draft);
    if (!checked.ok || !checked.draft) {
      problems = checked.problems;
      continue;
    }
    const text = renderSkill(checked.draft, { shopName: shopConfig().name, skillName: SKILL_NAME, date: todayJst(opts.now) });
    const lint = lintSkillText(text, SKILL_NAME);
    if (!lint.ok) {
      problems = lint.problems;
      continue;
    }
    const file = skillFile(opts.root);
    await fs.mkdir(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    await fs.writeFile(tmp, text, "utf8");
    await fs.rename(tmp, file);
    return { relPath: SKILL_REL_PATH, text, draft: checked.draft, attempts: attempt, costUsd, answerWords: characterWordsInAnswers(answers), lint };
  }
  throw new SkillWriteError("物差しの案が確かめに通りませんでした", problems, maxAttempts, costUsd);
}

/** The skill currently on disk, with its check result (null when it has not been written yet). */
export async function readSkill(root: string = skillsRoot()): Promise<{ relPath: string; text: string; lint: SkillLint } | null> {
  try {
    const text = await fs.readFile(skillFile(root), "utf8");
    return { relPath: SKILL_REL_PATH, text, lint: lintSkillText(text, SKILL_NAME) };
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}
