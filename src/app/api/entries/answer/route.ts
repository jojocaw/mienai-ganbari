import { addAnswer, EntryError } from "@/lib/entries";
import { requestProblem } from "@/lib/guard";

// POST /api/entries/answer { entryId, answer } → saves the writer's answer next to the line, exactly as typed (F10)
export async function POST(request: Request) {
  const bad = requestProblem(request, { write: true });
  if (bad) return bad;
  let body: { entryId?: unknown; answer?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "送る形がちがいます" }, { status: 400 });
  }
  try {
    const entry = await addAnswer(body.entryId, body.answer);
    return Response.json({ entry });
  } catch (e) {
    if (e instanceof EntryError) return Response.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
