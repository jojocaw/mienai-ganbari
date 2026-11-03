import { readFile } from "node:fs/promises";
import path from "node:path";
import { live } from "@/lib/live";
import { validateAnswers } from "@/lib/monosashi/questions";
import { readSkill, SkillWriteError, writeSkill } from "@/lib/monosashi/write-skill";
import { shopConfig } from "@/lib/shop-config";

async function demoAnswers(): Promise<Record<string, string>> {
  const raw = await readFile(path.join(process.cwd(), "data", "seed", "owner-answers.json"), "utf8");
  return JSON.parse(raw).answers;
}

// GET /api/monosashi → the fictional owner's answers (none for a real shop), the skill on disk (with its check result), and whether Claude can be called here
export async function GET() {
  const { real } = shopConfig();
  return Response.json({ demoAnswers: real ? {} : await demoAnswers(), skill: await readSkill(), live: live(), real });
}

// POST /api/monosashi { answers } → Claude writes a draft, plain code checks it, SKILL.md is saved
export async function POST(request: Request) {
  if (!live()) return Response.json({ error: "この環境では Claude を呼ばない設定です (ANTHROPIC_API_KEY がありません)" }, { status: 503 });
  let body: { answers?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "送る形がちがいます" }, { status: 400 });
  }
  const invalid = validateAnswers(body.answers);
  if (invalid) return Response.json({ error: invalid }, { status: 400 });
  try {
    const { generateWithClaude } = await import("@/lib/monosashi/claude-writer");
    const result = await writeSkill(body.answers as Record<string, string>, { generate: generateWithClaude });
    return Response.json({ result }, { status: 201 });
  } catch (e) {
    if (e instanceof SkillWriteError) return Response.json({ error: e.message, problems: e.problems, attempts: e.attempts }, { status: 422 });
    const message = e instanceof Error ? e.message : String(e);
    return Response.json({ error: `Claude を呼べませんでした: ${message}` }, { status: 502 });
  }
}
