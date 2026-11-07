// Who may use the API. Server code only (route handlers).
// 1. Every request: the Host must be this computer or the shop's own network, so a page on the internet cannot reach
//    the app through DNS rebinding (MIENAI_ALLOWED_HOSTS adds more names).
// 2. Every request that writes: it must come from this app's own page (Origin / Sec-Fetch-Site), and a POST must be
//    JSON. A page on another site therefore cannot make the browser write a line or spend the owner's Claude budget.
// 3. The owner's entrances (the month, the letters, the yardstick): with MIENAI_OWNER_PASS set, the owner types the
//    passcode once on a device (POST /api/owner/login). The app answers with a signed cookie (30 days, HttpOnly,
//    SameSite=Strict) and checks that cookie on every owner request. Wrong passcodes are counted for the whole app, but
//    they only make new sign-ins wait: a device that already signed in is never locked out by someone else's wrong
//    tries. A new passcode signs every device out. Without a passcode, a real shop's owner entrances stay closed, and
//    the fictional café only lets you read: writing and calling Claude (which costs money) need the passcode.
// API の守り (サーバーだけ): ①Host はこの PC か店のネットワークだけ ②書き込みは自分の画面からの JSON だけ
// ③店長の入口は合言葉 (MIENAI_OWNER_PASS)。端末ごとに1回入れると、署名つきのクッキー (30日) で通す。
//   まちがいの回数で待たせるのは、まだ通していない端末だけ (通した端末は、ほかの人のまちがいで止まらない)。
//   合言葉を変えると、全部の端末でもう一度聞く。決めていなければ、本物のお店の店長の入口は閉じ、架空のカフェは読むだけ。

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { shopConfig } from "./shop-config.ts";

export const OWNER_COOKIE = "mienai_owner";
export const OWNER_PASS_MIN = 8;
const OWNER_DAYS = 30;

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

/** Wrong passcodes in the last minute, for the whole app. More than OWNER_TRIES_PER_MINUTE and sign-in waits for the minute to pass. */
const OWNER_TRIES_PER_MINUTE = 10;
let wrong: number[] = [];

/** For tests: forget the wrong tries. */
export function resetOwnerTries() {
  wrong = [];
}

const ownerPass = () => process.env.MIENAI_OWNER_PASS ?? "";
const passDecided = (pass: string) => [...pass].length >= OWNER_PASS_MIN;
const unset = () =>
  refuse(403, `店長の入口を使うには、店長の合言葉 (MIENAI_OWNER_PASS・${OWNER_PASS_MIN}文字以上) を .env.local に決めて、アプリを動かし直してください`, { owner: "unset" });

// The owner's cookie: "<second it was given>.<random id>.<signature>". The signature is keyed with the passcode, so a
// new passcode makes every old cookie stop working.
const sign = (pass: string, body: string) => createHmac("sha256", pass).update(`mienai-owner:${body}`).digest("base64url");

function cookieOf(request: Request, name: string): string {
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return "";
}

/** True when the request carries a cookie this app gave for the current passcode, not older than OWNER_DAYS. */
function signedIn(request: Request, pass: string, now: number): boolean {
  const value = cookieOf(request, OWNER_COOKIE);
  const cut = value.lastIndexOf(".");
  if (cut <= 0) return false;
  const body = value.slice(0, cut);
  const age = now / 1000 - Number(body.split(".")[0]);
  if (!Number.isFinite(age) || age < -60 || age > OWNER_DAYS * 86_400) return false;
  const given = Buffer.from(value.slice(cut + 1));
  const want = Buffer.from(sign(pass, body));
  return given.length === want.length && timingSafeEqual(given, want);
}

/**
 * The owner's entrances. kind "read" = shows the owner's data; "write" = changes the yardstick or calls Claude.
 * Returns the refusal to send back (with owner: "unset" | "need" for the page), or null.
 */
export function ownerProblem(request: Request, kind: "read" | "write", now = Date.now()): Response | null {
  const pass = ownerPass();
  if (!passDecided(pass)) {
    if (kind === "read" && !shopConfig().real) return null;
    return unset();
  }
  if (signedIn(request, pass, now)) return null;
  return refuse(401, "店長の合言葉を入れてください", { owner: "need" });
}

/**
 * POST /api/owner/login with {"pass": "..."}: the right passcode gets the owner's cookie (owner: "wrong" | "wait" |
 * "unset" otherwise). After OWNER_TRIES_PER_MINUTE wrong ones in a minute, sign-in waits; devices already signed in
 * are not affected, because the owner's entrances only look at the cookie.
 */
export async function ownerLogin(request: Request, now = Date.now()): Promise<Response> {
  const pass = ownerPass();
  if (!passDecided(pass)) return unset();
  wrong = wrong.filter((t) => now - t < 60_000);
  if (wrong.length >= OWNER_TRIES_PER_MINUTE) return refuse(429, "合言葉のまちがいが続いたので、1分ほど待ってからもう一度どうぞ", { owner: "wait" });
  let given = "";
  try {
    const body = (await request.json()) as { pass?: unknown } | null;
    if (typeof body?.pass === "string") given = body.pass;
  } catch {
    given = "";
  }
  if (!given || !timingSafeEqual(digest(given), digest(pass))) {
    wrong.push(now);
    return refuse(401, "合言葉がちがいます", { owner: "wrong" });
  }
  const id = `${Math.floor(now / 1000)}.${randomBytes(16).toString("base64url")}`;
  const cookie = `${OWNER_COOKIE}=${id}.${sign(pass, id)}; Path=/; Max-Age=${OWNER_DAYS * 86_400}; HttpOnly; SameSite=Strict`;
  return Response.json({ ok: true }, { headers: { "set-cookie": cookie } });
}
