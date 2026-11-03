// A real shop: the shop file (name + staff) switches the app from the fictional café to the real shop,
// and the real shop's things (yardstick skill, daily lines, month-end result) stay in local folders.
// 本物のお店: 名簿のファイルで架空のカフェから本物のお店に切り替わり、本物の物は手元のフォルダに置かれる。
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { listEntries, type Entry } from "../src/lib/entries.ts";
import { buildExtractPrompt } from "../src/lib/facts/prompt.ts";
import { planLetters, type Decision } from "../src/lib/letters/plan.ts";
import { actionWithoutActor } from "../src/lib/month/corrections.ts";
import { loadMonth } from "../src/lib/month/load.ts";
import { pickMonth } from "../src/lib/month/local.ts";
import { buildMonthView } from "../src/lib/month/summary.ts";
import { skillsRoot } from "../src/lib/monosashi/write-skill.ts";
import { historyRoot } from "../src/lib/monosashi/owner-loop.ts";
import { findPerson, parseShopFile, ShopFileError, shopConfig, staffList } from "../src/lib/shop-config.ts";
import { STAFF } from "../src/lib/staff.ts";

const KEYS = ["MIENAI_SHOP_FILE", "MIENAI_DATA_DIR", "MIENAI_SKILLS_DIR", "MIENAI_SKILL_HISTORY_DIR"] as const;
const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

const SHOP_JSON = {
  name: "テストの食堂",
  staff: [
    { id: "aoi", name: "あおい", lang: "ja" },
    { id: "tuan", name: "トゥアン (Tuan)", roman: "Tuan", ja: "トゥアン", lang: "vi" },
  ],
};

/** A temporary real shop: shop/shop.json and an empty data/local folder. */
function makeShop(json: unknown = SHOP_JSON): { dir: string; data: string; file: string } {
  const dir = mkdtempSync(path.join(tmpdir(), "mienai-shop-"));
  const shop = path.join(dir, "shop");
  const data = path.join(dir, "local");
  mkdirSync(shop, { recursive: true });
  mkdirSync(data, { recursive: true });
  const file = path.join(shop, "shop.json");
  writeFileSync(file, JSON.stringify(json));
  for (const k of KEYS) delete process.env[k];
  process.env.MIENAI_SHOP_FILE = file;
  process.env.MIENAI_DATA_DIR = data;
  return { dir, data, file };
}

const line = (id: string, date: string, authorId: string, text: string): Entry => ({
  id, date, authorId, lang: authorId === "tuan" ? "vi" : "ja", text, createdAt: `${date}T10:00:00.000Z`, source: "app",
});

test("without a shop file it is the fictional café, exactly as before", () => {
  for (const k of KEYS) delete process.env[k];
  const c = shopConfig();
  assert.equal(c.real, false);
  assert.equal(c.name, "架空のカフェ");
  assert.equal(c.staff, STAFF);
  assert.equal(findPerson("minh")?.name, "ミン (Minh)");
  assert.equal(skillsRoot(), path.join(process.cwd(), ".claude", "skills"));
  assert.equal(historyRoot(), path.join(process.cwd(), "data", "local", "skill-history"));
});

test("with a shop file, the real name and staff are used, and the optional names are filled", () => {
  makeShop();
  const c = shopConfig();
  assert.equal(c.real, true);
  assert.equal(c.name, "テストの食堂");
  assert.deepEqual(c.staff.map((s) => [s.id, s.ja, s.roman]), [["aoi", "あおい", ""], ["tuan", "トゥアン", "Tuan"]]);
  assert.equal(findPerson("minh"), undefined);
  assert.equal(findPerson("tuan")?.lang, "vi");
});

test("a changed shop file is read again", () => {
  const { file } = makeShop();
  assert.equal(staffList().length, 2);
  writeFileSync(file, JSON.stringify({ ...SHOP_JSON, staff: [...SHOP_JSON.staff, { id: "rin", name: "りん", lang: "ja" }] }));
  const later = new Date(Date.now() + 5000);
  utimesSync(file, later, later);
  assert.equal(staffList().length, 3);
});

test("a broken shop file stops with the problem in plain Japanese, never falls back to the demo", () => {
  const bad: [unknown, RegExp][] = [
    [{ staff: SHOP_JSON.staff }, /お店の名前/],
    [{ name: "x", staff: [] }, /1人以上/],
    [{ name: "x", staff: [{ id: "Aoi", name: "あおい", lang: "ja" }] }, /英小文字/],
    [{ name: "x", staff: [{ id: "a", name: "あ", lang: "ja" }, { id: "a", name: "い", lang: "ja" }] }, /2回/],
    [{ name: "x", staff: [{ id: "a", name: "あ", lang: "en" }] }, /ja \/ vi \/ id/],
    [{ name: "x", staff: [{ id: "a", name: "", lang: "ja" }] }, /名前/],
  ];
  for (const [raw, re] of bad) assert.throws(() => parseShopFile(raw), (e: unknown) => e instanceof ShopFileError && re.test(e.message), JSON.stringify(raw));
  const { file } = makeShop();
  writeFileSync(file, "{ not json");
  utimesSync(file, new Date(Date.now() + 9000), new Date(Date.now() + 9000));
  assert.throws(() => shopConfig(), /JSON として読めません/);
  process.env.MIENAI_SHOP_FILE = file + ".missing";
  assert.throws(() => shopConfig(), /見つかりません/);
});

test("the real shop's yardstick skill and its history live in the shop folder, not in the committed .claude folder", () => {
  const { file } = makeShop();
  assert.equal(skillsRoot(), path.join(path.dirname(file), ".claude", "skills"));
  assert.equal(historyRoot(), path.join(path.dirname(file), "skill-history"));
});

test("the fact extractor is given the real staff list", () => {
  makeShop();
  const p = buildExtractPrompt([line("e1", "2026-11-03", "aoi", "トゥアンさんが閉店後に床をふいてくれた")]);
  assert.ok(p.includes("- aoi: あおい, writes in ja"));
  assert.ok(p.includes("- tuan: トゥアン (Tuan) (Tuan), writes in vi"));
  assert.ok(!p.includes("- minh:"));
});

test("the month view, letters and examples use the real staff", () => {
  makeShop();
  const entries = [line("e1", "2026-11-03", "aoi", "トゥアンさんが閉店後に床をふいてくれた")];
  const fact = {
    entryId: "e1", date: "2026-11-03", authorId: "aoi", kind: "help" as const, actorId: "tuan", forIds: [], action: "トゥアンさんが閉店後に床をふいた",
    task: "床ふき", verdict: "付ける" as const, reason: "決まりに合う", status: "ok" as const, corroboratedBy: [], eventEntryIds: ["e1"],
  };
  const view = buildMonthView({ facts: [fact], dropped: [] }, entries, staffList());
  assert.deepEqual(view.persons.map((p) => p.id), ["tuan", "aoi"]);
  assert.equal(view.persons[0].green.length, 1);
  const decision: Decision = { month: "2026-11", total: 10000, unit: 100, shares: { aoi: 1, tuan: 1 } };
  const { inputs } = planLetters(view, decision, { staff: staffList(), shopName: shopConfig().name });
  assert.deepEqual(inputs.map((i) => [i.name, i.shopName, i.amountText]), [["Tuan", "テストの食堂", "5,000円"], ["あおい", "テストの食堂", "5,000円"]]);
  assert.equal(actionWithoutActor("トゥアンさんが閉店後に床をふいた", "tuan", staffList()), "閉店後に床をふいた");
});

test("a real shop's list of lines never mixes in the fictional café's lines", async () => {
  const { data } = makeShop();
  assert.deepEqual(await listEntries(), []);
  writeFileSync(path.join(data, "entries.json"), JSON.stringify([line("e1", "2026-11-03", "aoi", "トゥアンさんが閉店後に床をふいてくれた")]));
  assert.deepEqual((await listEntries()).map((e) => e.id), ["e1"]);
  for (const k of KEYS) delete process.env[k];
  assert.ok((await listEntries()).length >= 180);
});

test("the month to look at is the newest month with lines, or the one asked for", () => {
  const entries = [line("a", "2026-10-30", "aoi", "x"), line("b", "2026-11-01", "aoi", "y"), line("c", "2026-11-02", "tuan", "z")];
  assert.deepEqual(pickMonth(entries), { month: "2026-11", entries: [entries[1], entries[2]] });
  assert.deepEqual(pickMonth(entries, "2026-10"), { month: "2026-10", entries: [entries[0]] });
  assert.throws(() => pickMonth(entries, "2026-9"), /YYYY-MM/);
  assert.throws(() => pickMonth([], undefined), /まだ1行もありません/);
});

test("before `npm run month`, the real /month shows the real staff with nothing counted yet", async () => {
  const { data } = makeShop();
  writeFileSync(path.join(data, "entries.json"), JSON.stringify([line("e1", "2026-11-03", "aoi", "トゥアンさんが閉店後に床をふいてくれた")]));
  const m = await loadMonth();
  assert.equal(m.real, true);
  assert.equal(m.pending, true);
  assert.equal(m.shopName, "テストの食堂");
  assert.deepEqual(m.staff.map((s) => s.id), ["aoi", "tuan"]);
  assert.equal(m.run.score, null);
  assert.deepEqual(m.decision, { month: "2026-11", total: 0, unit: 100, shares: { aoi: 0, tuan: 0 } });
  assert.equal(m.view.totals.lines, 1);
  assert.equal(m.letters, null);
});

test("after `npm run month`, the real /month reads the shop's own month and lines, never the fictional ones", async () => {
  const { data } = makeShop();
  const entries = [line("e1", "2026-11-03", "aoi", "トゥアンさんが閉店後に床をふいてくれた"), line("old", "2026-10-31", "aoi", "先月の1行")];
  writeFileSync(path.join(data, "entries.json"), JSON.stringify(entries));
  const fact = {
    entryId: "e1", date: "2026-11-03", authorId: "aoi", kind: "help", actorId: "tuan", forIds: [], action: "トゥアンさんが閉店後に床をふいた",
    task: "床ふき", verdict: "付ける", reason: "決まりに合う", status: "ok", corroboratedBy: [], eventEntryIds: ["e1"],
  };
  writeFileSync(path.join(data, "month.json"), JSON.stringify({ month: "2026-11", models: { extractor: "x", checker: "y" }, seconds: 12, costUsd: 0.01, score: null, retries: [], facts: [fact], dropped: [] }));
  const m = await loadMonth();
  assert.equal(m.pending, false);
  assert.equal(m.view.totals.lines, 1);
  assert.equal(m.view.persons[0].id, "tuan");
  assert.equal(m.view.persons[0].green[0].lines[0].text, "トゥアンさんが閉店後に床をふいてくれた");
  assert.equal(m.decision.month, "2026-11");
  writeFileSync(path.join(data, "decision.json"), JSON.stringify({ month: "2026-11", total: 30000, unit: 100, shares: { aoi: 1, tuan: 2 } }));
  assert.equal((await loadMonth()).decision.total, 30000);
});

test("the fictional month still loads as before when no shop file is set", async () => {
  for (const k of KEYS) delete process.env[k];
  const m = await loadMonth();
  assert.equal(m.real, false);
  assert.equal(m.pending, false);
  assert.equal(m.shopName, "架空のカフェ");
  assert.equal(m.view.persons.length, 8);
  assert.ok(m.run.score && m.run.score.allFound);
  assert.equal(m.decision.total, 50000);
});
