// Who may use the API (src/lib/guard.ts): this computer and the shop's network only, writes only from the app's own
// page, and the owner's entrances behind the owner's passcode (typed once per device, then a signed cookie).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

delete process.env.MIENAI_SHOP_FILE;
delete process.env.MIENAI_OWNER_PASS;
delete process.env.MIENAI_ALLOWED_HOSTS;
const { hostAllowed, ownerLogin, ownerProblem, requestProblem, resetOwnerTries, OWNER_COOKIE } = await import("../src/lib/guard.ts");

const req = (method: string, headers: Record<string, string>) => new Request("http://localhost:3000/api/x", { method, headers });
const json = { "content-type": "application/json" };

test("only this computer and the shop's own network", () => {
  for (const h of ["localhost:3000", "127.0.0.1:3000", "[::1]:3000", "192.168.1.20:3000", "10.0.0.5", "172.20.1.1:3000", "shop-pc.local:3000"])
    assert.equal(hostAllowed(h), true, h);
  for (const h of ["evil.example:3000", "8.8.8.8:3000", "172.32.0.1", "", "localhost.evil.example"]) assert.equal(hostAllowed(h), false, h);
  assert.equal(hostAllowed(null), false);
  process.env.MIENAI_ALLOWED_HOSTS = "shop-pc, Office-PC";
  assert.equal(hostAllowed("office-pc:3000"), true);
  delete process.env.MIENAI_ALLOWED_HOSTS;
});

test("a write from another site is refused, the app's own page is not", () => {
  assert.equal(requestProblem(req("POST", { host: "localhost:3000", origin: "http://localhost:3000", "sec-fetch-site": "same-origin", ...json }), { write: true }), null);
  assert.equal(requestProblem(req("POST", { host: "localhost:3000", ...json }), { write: true }), null); // curl on the shop's computer
  assert.equal(requestProblem(req("POST", { host: "localhost:3000", origin: "https://evil.example", ...json }), { write: true })?.status, 403);
  assert.equal(requestProblem(req("POST", { host: "localhost:3000", "sec-fetch-site": "cross-site", ...json }), { write: true })?.status, 403);
  assert.equal(requestProblem(req("POST", { host: "localhost:3000", "sec-fetch-site": "same-site", ...json }), { write: true })?.status, 403);
  assert.equal(requestProblem(req("POST", { host: "localhost:3000", origin: "null", ...json }), { write: true })?.status, 403);
  // text/plain is what a page on another site can send without asking the browser first
  assert.equal(requestProblem(req("POST", { host: "localhost:3000", "content-type": "text/plain" }), { write: true })?.status, 415);
  assert.equal(requestProblem(req("DELETE", { host: "localhost:3000", "sec-fetch-site": "same-origin" }), { write: true }), null);
  // DNS rebinding: the browser thinks it talks to evil.example
  assert.equal(requestProblem(req("GET", { host: "evil.example:3000" }), { write: false })?.status, 403);
  assert.equal(requestProblem(req("GET", { host: "localhost:3000", origin: "https://evil.example" }), { write: false }), null);
});

test("no passcode decided: the fictional café can only be read, a real shop's owner entrances stay closed", async () => {
  const r = ownerProblem(req("GET", { host: "localhost:3000" }), "read");
  assert.equal(r, null);
  const w = ownerProblem(req("POST", { host: "localhost:3000" }), "write");
  assert.equal(w?.status, 403);
  assert.equal((await w!.json()).owner, "unset");
  process.env.MIENAI_OWNER_PASS = "short"; // shorter than 8 characters counts as not decided
  assert.equal(ownerProblem(req("POST", { host: "localhost:3000" }), "write")?.status, 403);
  delete process.env.MIENAI_OWNER_PASS;
});

test("a real shop without a passcode: even reading the month stays closed", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "mienai-guard-"));
  const file = path.join(dir, "shop.json");
  writeFileSync(file, JSON.stringify({ name: "テストの店", staff: [{ id: "aoi", name: "あおい", lang: "ja" }] }));
  process.env.MIENAI_SHOP_FILE = file;
  const r = ownerProblem(req("GET", { host: "localhost:3000" }), "read");
  assert.equal(r?.status, 403);
  assert.equal((await r!.json()).owner, "unset");
  delete process.env.MIENAI_SHOP_FILE;
});

const login = (pass: string, now: number) =>
  ownerLogin(new Request("http://localhost:3000/api/owner/login", { method: "POST", headers: { host: "localhost:3000", ...json }, body: JSON.stringify({ pass }) }), now);
const cookieOf = (r: Response) => (r.headers.get("set-cookie") ?? "").split(";")[0]; // "mienai_owner=..."
const PASS = "あいことば-2026";
const t0 = 1_800_000_000_000;

test("with a passcode: typed once on a device, then its cookie opens every owner entrance", async () => {
  process.env.MIENAI_OWNER_PASS = PASS;
  resetOwnerTries();
  const need = ownerProblem(req("GET", { host: "localhost:3000" }), "read", t0);
  assert.equal(need?.status, 401);
  assert.equal((await need!.json()).owner, "need");
  const no = await login("ちがう合言葉", t0);
  assert.equal(no.status, 401);
  assert.equal((await no.json()).owner, "wrong");
  assert.equal(no.headers.get("set-cookie"), null);
  const ok = await login(PASS, t0);
  assert.equal(ok.status, 200);
  const set = ok.headers.get("set-cookie") ?? "";
  for (const part of ["HttpOnly", "SameSite=Strict", "Path=/", `Max-Age=${30 * 86_400}`]) assert.ok(set.includes(part), part);
  const cookie = cookieOf(ok);
  assert.ok(cookie.startsWith(`${OWNER_COOKIE}=`));
  assert.equal(ownerProblem(req("GET", { host: "localhost:3000", cookie }), "read", t0 + 1000), null);
  assert.equal(ownerProblem(req("POST", { host: "localhost:3000", cookie }), "write", t0 + 1000), null);
  // a changed cookie, an old one and one from before a new passcode open nothing
  const forged = cookie.slice(0, -1) + (cookie.endsWith("A") ? "B" : "A");
  assert.equal(ownerProblem(req("GET", { host: "localhost:3000", cookie: forged }), "read", t0)?.status, 401);
  assert.equal(ownerProblem(req("GET", { host: "localhost:3000", cookie: `${OWNER_COOKIE}=1.2.3` }), "read", t0)?.status, 401);
  assert.equal(ownerProblem(req("GET", { host: "localhost:3000", cookie }), "read", t0 + 31 * 86_400_000)?.status, 401);
  process.env.MIENAI_OWNER_PASS = "あたらしい合言葉-2026";
  assert.equal(ownerProblem(req("GET", { host: "localhost:3000", cookie }), "read", t0)?.status, 401);
  // the passcode in a header (the first version) opens nothing any more
  process.env.MIENAI_OWNER_PASS = PASS;
  assert.equal(ownerProblem(req("GET", { host: "localhost:3000", "x-mienai-owner": encodeURIComponent(PASS) }), "read", t0)?.status, 401);
  resetOwnerTries();
  delete process.env.MIENAI_OWNER_PASS;
});

test("someone else's wrong passcodes make new sign-ins wait, but never lock out a device that signed in", async () => {
  process.env.MIENAI_OWNER_PASS = PASS;
  resetOwnerTries();
  const cookie = cookieOf(await login(PASS, t0));
  for (let i = 0; i < 10; i++) assert.equal((await login("wrong", t0 + i)).status, 401);
  // the eleventh sign-in within the minute waits, even with the right passcode
  const wait = await login(PASS, t0 + 20);
  assert.equal(wait.status, 429);
  assert.equal((await wait.json()).owner, "wait");
  // the owner's device that signed in before keeps working the whole time
  assert.equal(ownerProblem(req("GET", { host: "localhost:3000", cookie }), "read", t0 + 30), null);
  assert.equal(ownerProblem(req("POST", { host: "localhost:3000", cookie }), "write", t0 + 30), null);
  // and after the minute, sign-in works again
  assert.equal((await login(PASS, t0 + 61_000)).status, 200);
  resetOwnerTries();
  delete process.env.MIENAI_OWNER_PASS;
});
