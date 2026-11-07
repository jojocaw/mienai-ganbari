// The owner's passcode for this tab (sessionStorage only, so it is gone when the tab is closed), sent with the owner's
// requests (/api/month, /api/letters, /api/monosashi). The server checks it (src/lib/guard.ts).
// 店長の合言葉は、このタブを閉じるまでだけ覚え、店長の入口への問い合わせに付ける。確かめるのはサーバー。

export const OWNER_HEADER = "x-mienai-owner";
const KEY = "mienai-ganbari-owner";

/** Why the server closed an owner entrance: no passcode decided yet, none sent, a wrong one, or too many wrong tries. */
export type OwnerGate = "unset" | "need" | "wrong" | "wait";

export function ownerFetch(url: string, init: RequestInit = {}): Promise<Response> {
  let pass = "";
  try {
    pass = sessionStorage.getItem(KEY) ?? "";
  } catch {
    pass = "";
  }
  const headers = new Headers(init.headers);
  // a passcode may be written in Japanese, and a header can only carry plain ASCII
  if (pass) headers.set(OWNER_HEADER, encodeURIComponent(pass));
  return fetch(url, { ...init, headers });
}

export function rememberOwnerPass(pass: string) {
  try {
    sessionStorage.setItem(KEY, pass);
  } catch {
    // private mode etc.: the passcode is asked again next time
  }
}

export function ownerGateOf(d: unknown): OwnerGate | null {
  const g = (d as { owner?: unknown } | null)?.owner;
  return g === "unset" || g === "need" || g === "wrong" || g === "wait" ? g : null;
}
