import { ownerProblem, requestProblem } from "@/lib/guard";
import { correctionsToExamples, parseCorrections } from "@/lib/month/corrections";
import { loadMonth } from "@/lib/month/load";
import { readOwnerExamples } from "@/lib/monosashi/examples";
import { historyCount, OwnerLoopError, ownerSection, saveOwnerExamples, undoOwnerExamples } from "@/lib/monosashi/owner-loop";
import { readSkill } from "@/lib/monosashi/write-skill";

// F9: the owner's corrections on /month join the yardstick skill as examples (plain code, no Claude).
// GET → the owner's examples now in the skill, and how many versions can be put back
export async function GET(request: Request) {
  const bad = requestProblem(request, { write: false }) ?? ownerProblem(request, "read");
  if (bad) return bad;
  const skill = await readSkill();
  return Response.json({
    examples: skill ? readOwnerExamples(skill.text).examples : [],
    section: skill ? ownerSection(skill.text) : "",
    canUndo: (await historyCount()) > 0,
  });
}

function failed(e: unknown) {
  if (e instanceof OwnerLoopError) return Response.json({ error: e.message }, { status: e.status });
  const code = (e as NodeJS.ErrnoException)?.code;
  if (code === "EROFS" || code === "EACCES" || code === "EPERM") return Response.json({ error: "この環境ではファイルに保存できません (手元で動かすと保存できます)" }, { status: 503 });
  return Response.json({ error: `保存できませんでした: ${e instanceof Error ? e.message : String(e)}` }, { status: 500 });
}

// POST { corrections: [{ eventId, verdict }] } → the examples are added to SKILL.md (the previous version is kept)
export async function POST(request: Request) {
  const bad = requestProblem(request, { write: true }) ?? ownerProblem(request, "write");
  if (bad) return bad;
  let body: { corrections?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "送る形がちがいます" }, { status: 400 });
  }
  const parsed = parseCorrections(body.corrections);
  if ("problem" in parsed) return Response.json({ error: parsed.problem }, { status: 400 });
  const { view, staff } = await loadMonth();
  const { examples, skipped, problems } = correctionsToExamples(view, parsed.corrections, staff);
  if (problems.length) return Response.json({ error: problems.join(" / ") }, { status: 400 });
  if (examples.length === 0) return Response.json({ error: "Claude の答えと同じなので、足す例はありません" }, { status: 400 });
  try {
    const result = await saveOwnerExamples(examples.map(({ line, verdict }) => ({ line, verdict })));
    return Response.json({ result: { ...result, skipped } }, { status: 201 });
  } catch (e) {
    return failed(e);
  }
}

// DELETE → puts back the skill from before the last save
export async function DELETE(request: Request) {
  const bad = requestProblem(request, { write: true }) ?? ownerProblem(request, "write");
  if (bad) return bad;
  try {
    const restored = await undoOwnerExamples();
    if (!restored) return Response.json({ error: "戻せる前の版がありません" }, { status: 404 });
    const skill = await readSkill();
    return Response.json({ restored, section: skill ? ownerSection(skill.text) : "", canUndo: (await historyCount()) > 0 });
  } catch (e) {
    return failed(e);
  }
}
