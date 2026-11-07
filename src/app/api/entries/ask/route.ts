import { askBack } from "@/lib/askback/ask";
import { askAsker } from "@/lib/askback/claude-ask";
import { requestProblem } from "@/lib/guard";
import { live } from "@/lib/live";

// POST /api/entries/ask { entryId } → { question } (F10). Called right after a line is saved; the line is already safe.
// No API key, or any problem, answers { question: null } and the page simply shows nothing more.
export async function POST(request: Request) {
  const bad = requestProblem(request, { write: true });
  if (bad) return bad;
  let body: { entryId?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ question: null });
  }
  if (!live()) return Response.json({ question: null });
  const r = await askBack(body.entryId, askAsker);
  return Response.json({ question: r.question });
}
