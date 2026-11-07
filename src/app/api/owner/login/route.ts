import { ownerLogin, requestProblem } from "@/lib/guard";

// POST /api/owner/login {"pass": "..."} → the owner's passcode, once per device; the answer sets the owner's cookie (30 days)
export async function POST(request: Request) {
  const bad = requestProblem(request, { write: true });
  if (bad) return bad;
  return ownerLogin(request);
}
