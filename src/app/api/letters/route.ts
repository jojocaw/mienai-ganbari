import { decisionShapeError, type Decision } from "@/lib/letters/plan";
import { runLetters } from "@/lib/letters/run";
import { live } from "@/lib/live";
import { loadMonth } from "@/lib/month/load";
import { AllocationError } from "@/lib/pay/allocate";

// POST /api/letters { decision } → code splits the amount to the yen, the letter-writer subagent writes one letter per person, code checks each one
export async function POST(request: Request) {
  if (!live()) return Response.json({ error: "この環境では Claude を呼ばない設定です (ANTHROPIC_API_KEY がありません)" }, { status: 503 });
  let body: { decision?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "送る形がちがいます" }, { status: 400 });
  }
  const invalid = decisionShapeError(body.decision);
  if (invalid) return Response.json({ error: invalid }, { status: 400 });
  const { view, staff, shopName } = await loadMonth();
  try {
    const { askLetterWriter } = await import("@/lib/letters/claude-letter");
    const run = await runLetters(view, body.decision as Decision, askLetterWriter, 3, { staff, shopName });
    return Response.json({ run }, { status: 201 });
  } catch (e) {
    if (e instanceof AllocationError) return Response.json({ error: e.message }, { status: 400 });
    const message = e instanceof Error ? e.message : String(e);
    return Response.json({ error: `Claude を呼べませんでした: ${message}` }, { status: 502 });
  }
}
