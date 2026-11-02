import { addEntry, EntryError, listEntries } from "@/lib/entries";

// GET /api/entries?limit=20 → the newest lines (fictional seed + lines written in the app)
export async function GET(request: Request) {
  const limit = Math.min(Math.max(Number(new URL(request.url).searchParams.get("limit")) || 20, 1), 500);
  const all = await listEntries();
  return Response.json({ total: all.length, entries: all.slice(-limit).reverse() });
}

// POST /api/entries { authorId, text } → saves the line exactly as written
export async function POST(request: Request) {
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
