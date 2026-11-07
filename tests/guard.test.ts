// Who may use the API (src/lib/guard.ts): this computer and the shop's network only, writes only from the app's own
// page, and the owner's entrances behind the owner's passcode.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

delete process.env.MIENAI_SHOP_FILE;
delete process.env.MIENAI_OWNER_PASS;
delete process.env.MIENAI_ALLOWED_HOSTS;
const { hostAllowed, ownerProblem, requestProblem, resetOwnerTries, OWNER_HEADER } = await import("../src/lib/guard.ts");

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

test("with a passcode, every owner entrance needs it; wrong tries are counted", async () => {
  process.env.MIENAI_OWNER_PASS = "あいことば-2026";
  resetOwnerTries();
  const need = ownerProblem(req("GET", { host: "localhost:3000" }), "read");
  assert.equal(need?.status, 401);
  assert.equal((await need!.json()).owner, "need");
  assert.equal(ownerProblem(req("GET", { host: "localhost:3000", [OWNER_HEADER]: encodeURIComponent("あいことば-2026") }), "read"), null);
  assert.equal(ownerProblem(req("POST", { host: "localhost:3000", [OWNER_HEADER]: encodeURIComponent("あいことば-2026") }), "write"), null);
  const t0 = 1_000_000;
  for (let i = 0; i < 10; i++) assert.equal(ownerProblem(req("GET", { host: "localhost:3000", [OWNER_HEADER]: "wrong" }), "read", t0 + i)?.status, 401);
  // the eleventh try within the minute waits, even with the right passcode
  const wait = ownerProblem(req("GET", { host: "localhost:3000", [OWNER_HEADER]: encodeURIComponent("あいことば-2026") }), "read", t0 + 20);
  assert.equal(wait?.status, 429);
  assert.equal(ownerProblem(req("GET", { host: "localhost:3000", [OWNER_HEADER]: encodeURIComponent("あいことば-2026") }), "read", t0 + 61_000), null);
  resetOwnerTries();
  delete process.env.MIENAI_OWNER_PASS;
});
