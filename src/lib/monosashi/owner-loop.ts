// F9 on disk: the owner's corrections join the yardstick skill (SKILL.md), and the version before each save is kept,
// so one tap can put the skill back. Plain code, no Claude: the owner's decisions go in word for word.
// F9 の保存: 店長が直した答えを物差しのスキル (SKILL.md) に足す。足す前の版を控えに残し、1回で元に戻せる。

import { promises as fs } from "node:fs";
import path from "node:path";
import { SKILL_NAME } from "../shop.ts";
import { mergeOwnerExamples, OWNER_EXAMPLES_HEADING, type MergeResult, type OwnerExample } from "./examples.ts";
import { lintSkillText } from "./lint.ts";
import { SKILL_REL_PATH, skillFile, skillsRoot } from "./write-skill.ts";

export function historyRoot(): string {
  return process.env.MIENAI_SKILL_HISTORY_DIR || path.join(process.cwd(), "data", "local", "skill-history");
}

export class OwnerLoopError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function writeAtomic(file: string, text: string): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, text, "utf8");
  await fs.rename(tmp, file);
}

/** The owner's section as it now stands in the skill text (empty string when there is none). */
export function ownerSection(text: string): string {
  const start = text.indexOf(`## ${OWNER_EXAMPLES_HEADING}`);
  if (start < 0) return "";
  const next = text.indexOf("\n## ", start + 1);
  return text.slice(start, next >= 0 ? next : text.length).trim();
}

export interface SaveResult extends Omit<MergeResult, "text"> {
  relPath: string;
  section: string;
}

/** Adds the examples to SKILL.md. The previous version goes to the history folder first. */
export async function saveOwnerExamples(examples: OwnerExample[], opts: { root?: string; history?: string; now?: Date } = {}): Promise<SaveResult> {
  const file = skillFile(opts.root ?? skillsRoot());
  let before: string;
  try {
    before = await fs.readFile(file, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") throw new OwnerLoopError("物差しのスキルがまだありません (先に /monosashi で10問に答えます)", 404);
    throw e;
  }
  let merged: MergeResult;
  try {
    merged = mergeOwnerExamples(before, examples, SKILL_NAME);
  } catch (e) {
    throw new OwnerLoopError(e instanceof Error ? e.message : String(e), 422);
  }
  const stamp = (opts.now ?? new Date()).toISOString().replace(/[:.]/g, "-");
  const history = opts.history ?? historyRoot();
  await fs.mkdir(history, { recursive: true });
  await fs.writeFile(path.join(history, `SKILL.${stamp}.md`), before, "utf8");
  await writeAtomic(file, merged.text);
  const { text, ...rest } = merged;
  return { ...rest, relPath: SKILL_REL_PATH, section: ownerSection(text) };
}

/** How many saved versions there are to go back to. */
export async function historyCount(history: string = historyRoot()): Promise<number> {
  try {
    return (await fs.readdir(history)).filter((f) => /^SKILL\..+\.md$/.test(f)).length;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return 0;
    throw e;
  }
}

/** Puts back the version from before the last save. Returns false when there is nothing to go back to. */
export async function undoOwnerExamples(opts: { root?: string; history?: string } = {}): Promise<boolean> {
  const history = opts.history ?? historyRoot();
  let names: string[];
  try {
    names = (await fs.readdir(history)).filter((f) => /^SKILL\..+\.md$/.test(f)).sort();
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw e;
  }
  const last = names.at(-1);
  if (!last) return false;
  const text = await fs.readFile(path.join(history, last), "utf8");
  const lint = lintSkillText(text, SKILL_NAME);
  if (!lint.ok) throw new OwnerLoopError(`控えの版が確かめに通りません: ${lint.problems.join(" / ")}`, 500);
  await writeAtomic(skillFile(opts.root ?? skillsRoot()), text);
  await fs.unlink(path.join(history, last));
  return true;
}
