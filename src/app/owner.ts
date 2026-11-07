// The owner's screens ask the server first. When it answers "need", OwnerPass asks for the passcode once and sends it
// to /api/owner/login, which gives this browser a signed cookie for 30 days (HttpOnly: the page's own code cannot read
// it). The server checks the cookie (src/lib/guard.ts).
// 店長の合言葉は端末ごとに1回だけ。サーバーが署名つきのクッキー (30日) を渡し、ページのコードからは読めない。確かめるのはサーバー。

/** Why the server closed an owner entrance: no passcode decided yet, not signed in, a wrong one, or too many wrong tries. */
export type OwnerGate = "unset" | "need" | "wrong" | "wait";

/** The owner's requests: fetch on this app's own address, so the browser adds the owner's cookie. */
export function ownerFetch(url: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url, { ...init, credentials: "same-origin" });
}

export function ownerGateOf(d: unknown): OwnerGate | null {
  const g = (d as { owner?: unknown } | null)?.owner;
  return g === "unset" || g === "need" || g === "wrong" || g === "wait" ? g : null;
}
