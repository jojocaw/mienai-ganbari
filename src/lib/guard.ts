// Who may use the API. Server code only (route handlers).
// 1. Every request: the Host must be this computer or the shop's own network, so a page on the internet cannot reach
//    the app through DNS rebinding (MIENAI_ALLOWED_HOSTS adds more names).
// 2. Every request that writes: it must come from this app's own page (Origin / Sec-Fetch-Site), and a POST must be
//    JSON. A page on another site therefore cannot make the browser write a line or spend the owner's Claude budget.
// 3. The owner's entrances (the month, the letters, the yardstick): with MIENAI_OWNER_PASS set, the owner's passcode
//    must come with the request (header x-mienai-owner). Without it, a real shop's owner entrances stay closed, and
//    the fictional café only lets you read: writing and calling Claude (which costs money) need the passcode.
// API の守り (サーバーだけ): ①Host はこの PC か店のネットワークだけ ②書き込みは自分の画面からの JSON だけ
// ③店長の入口は合言葉 (MIENAI_OWNER_PASS)。決めていなければ、本物のお店の店長の入口は閉じ、架空のカフェは読むだけ。

import { createHash, timingSafeEqual } from "node:crypto";
import { shopConfig } from "./shop-config.ts";

export const OWNER_HEADER = "x-mienai-owner";
export const OWNER_PASS_MIN = 8;

const PRIVATE_V4 = [/^127\./, /^10\./, /^192\.168\./, /^172\.(1[6-9]|2\d|3[01])\./, /^169\.254\./];

/** The host name of a Host header, without the port (and without the brackets of an IPv6 address). */
export function hostName(host: string): string {
  const h = host.trim().toLowerCase();
  if (h.startsWith("[")) return h.slice(1, h.indexOf("]") > 0 ? h.indexOf("]") : undefined);
  return h.replace(/:\d+$/, "");
}

/** This computer, an address of the shop's own network, a .local name, or a name in MIENAI_ALLOWED_HOSTS. */
export function hostAllowed(host: string | null): boolean {
  if (!host) return false;
  const name = hostName(host);
  if (!name) return false;
  if (name === "localhost" || name.endsWith(".localhost") || name.endsWith(".local")) return true;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(name)) return PRIVATE_V4.some((r) => r.test(name));
  if (name.includes(":")) return name === "::1" || /^fe[89ab]/.test(name) || /^f[cd]/.test(name);
  const extra = (process.env.MIENAI_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return extra.includes(name);
}

const refuse = (status: number, error: string, extra: Record<string, unknown> = {}) => Response.json({ error, ...extra }, { status });

/** Checks where a request comes from. Returns the refusal to send back, or null when the request may go on. */
export function requestProblem(request: Request, { write }: { write: boolean }): Response | null {
  const host = request.headers.get("host");
  if (!hostAllowed(host)) return refuse(403, "この住所からは使えません (MIENAI_ALLOWED_HOSTS で足せます)");
  if (!write) return null;
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return refuse(403, "別のサイトからの書き込みは受け付けません");
  const origin = request.headers.get("origin");
  if (origin !== null) {
    let from = "";
    try {
      from = new URL(origin).host.toLowerCase();
    } catch {
      from = "";
    }
    if (from !== (host ?? "").trim().toLowerCase()) return refuse(403, "別のサイトからの書き込みは受け付けません");
  }
  if (request.method === "POST" && !(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json"))
    return refuse(415, "送る形がちがいます (JSON だけ)");
  return null;
}

const digest = (s: string) => createHash("sha256").update(s, "utf8").digest();

/** Wrong passcodes in the last minute. More than OWNER_TRIES_PER_MINUTE and every try waits for the minute to pass. */
const OWNER_TRIES_PER_MINUTE = 10;
let wrong: number[] = [];

/** For tests: forget the wrong tries. */
export function resetOwnerTries() {
  wrong = [];
}

/**
 * The owner's entrances. kind "read" = shows the owner's data; "write" = changes the yardstick or calls Claude.
 * Returns the refusal to send back (with owner: "unset" | "need" | "wrong" | "wait" for the page), or null.
 */
export function ownerProblem(request: Request, kind: "read" | "write", now = Date.now()): Response | null {
  const pass = process.env.MIENAI_OWNER_PASS ?? "";
  if ([...pass].length < OWNER_PASS_MIN) {
    if (kind === "read" && !shopConfig().real) return null;
    return refuse(403, `店長の入口を使うには、店長の合言葉 (MIENAI_OWNER_PASS・${OWNER_PASS_MIN}文字以上) を .env.local に決めて、アプリを動かし直してください`, { owner: "unset" });
  }
  wrong = wrong.filter((t) => now - t < 60_000);
  if (wrong.length >= OWNER_TRIES_PER_MINUTE) return refuse(429, "合言葉のまちがいが続いたので、1分ほど待ってからもう一度どうぞ", { owner: "wait" });
  const raw = request.headers.get(OWNER_HEADER);
  if (!raw) return refuse(401, "店長の合言葉を入れてください", { owner: "need" });
  let given = "";
  try {
    given = decodeURIComponent(raw);
  } catch {
    given = "";
  }
  if (!timingSafeEqual(digest(given), digest(pass))) {
    wrong.push(now);
    return refuse(401, "合言葉がちがいます", { owner: "wrong" });
  }
  return null;
}
