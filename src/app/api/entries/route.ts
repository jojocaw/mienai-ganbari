import { addEntry, EntryError, listEntries } from "@/lib/entries";
import { requestProblem } from "@/lib/guard";

// GET /api/entries → how many lines there are (fictional seed + lines written in the app). Only the count: the lines
// themselves (who wrote what about whom) are never handed out here; the owner sees them on /month, behind the passcode.
export async function GET(request: Request) {
  const bad = requestProblem(request, { write: false });
  if (bad) return bad;
  const all = await listEntries();
  return Response.json({ total: all.length });
}

// POST /api/entries { authorId, text } → saves the line exactly as written
export async function POST(request: Request) {
  const bad = requestProblem(request, { write: true });
  if (bad) return bad;
  let body: { authorId?: unknown; text?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "送る形がちがいます" }, { status: 400 });
  }
  try {
    const entry = await addEntry(body.authorId, body.text);
    return Response.json({ entry }, { status: 201 });
  } catch (e) {
    if (e instanceof EntryError) return Response.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
