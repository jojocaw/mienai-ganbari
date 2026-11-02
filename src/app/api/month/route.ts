import { live } from "@/lib/live";
import { loadMonth } from "@/lib/month/load";

// GET /api/month → the month-end view (F5), the fictional owner's decision (F6), the saved letters (F7) and whether Claude can be called here
export async function GET() {
  return Response.json({ ...(await loadMonth()), live: live() });
}
