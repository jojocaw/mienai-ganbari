// F3 + F4: lines → facts → checked month. Claude is replaced by fakes built from the answer key,
// so these tests prove the plain-code parts: checks, grouping, duplicates, self-only claims and scoring.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Entry } from "../src/lib/entries.ts";
import { agentDefinitions } from "../src/lib/agents.ts";
import { model } from "../src/lib/models.ts";
import { SKILL_NAME } from "../src/lib/shop.ts";
import { STAFF } from "../src/lib/staff.ts";
import { checkFacts } from "../src/lib/facts/check.ts";
import { extractBatch, ExtractError, runMonth, suggestGroups, type Ask } from "../src/lib/facts/extract.ts";
import { buildExtractPrompt } from "../src/lib/facts/prompt.ts";
import { scoreAgainstLabels, type Label } from "../src/lib/facts/score.ts";
import { validateExtraction } from "../src/lib/facts/validate.ts";

const root = path.join(import.meta.dirname, "..");
const entries: Entry[] = JSON.parse(readFileSync(path.join(root, "data/seed/entries.json"), "utf8"));
const labels: Label[] = JSON.parse(readFileSync(path.join(root, "data/seed/labels.json"), "utf8"));
const L = new Map(labels.map((l) => [l.id, l]));

/** What a perfect fact extractor would answer for one line (built from the hidden answer key). */
function ideal(id: string, rename = false) {
  const l = L.get(id)!;
  const empty = { actorId: "", forIds: [], action: "", task: "", verdict: "", reason: "" };
  if (l.kind === "gossip" || l.kind === "vague") return { entryId: id, kind: "drop", dropReason: l.kind, ...empty };
  const actorId = l.kind === "self" ? l.authorId : l.subjectIds[0];
  const task = rename && l.kind === "dup" ? `${l.task}-again` : l.task!;
  return { entryId: id, kind: l.kind === "self" ? "self" : "help", dropReason: "", actorId, forIds: [], action: `${actorId} did ${l.task}`, task, verdict: "付ける", reason: "答え1の決まりに合う" };
}
const idsIn = (prompt: string) => [...prompt.matchAll(/entryId: (\S+) \|/g)].map((m) => m[1]);
const idealAsk = (rename = false): Ask => async ({ prompt }) => ({ raw: { items: idsIn(prompt).map((id) => ideal(id, rename)) }, costUsd: 0.001 });

test("a perfect extractor run finds every planted duplicate, self-report-only claim and dropped line", async () => {
  const run = await runMonth(entries, { extract: idealAsk() });
  const score = scoreAgainstLabels(run, labels);
  assert.equal(score.allFound, true, JSON.stringify(score));
  assert.deepEqual(run.counts, { facts: 153, events: 144, duplicates: 9, selfOnly: 36, dropped: { gossip: 18, judgement: 0, vague: 9 } });
  assert.equal(Object.keys(run.attempts).length, 30);
});

test("the quiet person's help is counted once per event and stays tied to every line about it", async () => {
  const run = await runMonth(entries, { extract: idealAsk() });
  const minh = run.facts.filter((f) => f.actorId === "minh" && f.kind === "help");
  const events = new Set(minh.map((f) => f.eventEntryIds[0]));
  assert.equal(minh.length, 30);
  assert.equal(events.size, 26);
  for (const f of minh.filter((x) => x.status === "duplicate")) assert.ok(f.corroboratedBy.length >= 1);
});

test("the same event under a different job name is caught only through a safe checker suggestion", async () => {
  const without = scoreAgainstLabels(await runMonth(entries, { extract: idealAsk(true) }), labels);
  assert.equal(without.duplicates.found, 0);

  const checker: Ask = async ({ prompt }) => {
    const ids = new Set(idsIn(prompt));
    const groups = labels.filter((l) => l.kind === "dup" && ids.has(l.id)).map((l) => [l.dupOf!, l.id]);
    // one unsafe suggestion per day: two facts by different people must be refused
    const actors = [...prompt.matchAll(/entryId: (\S+) \| writer: \S+ \| actorId: (\S+)/g)].map((m) => ({ id: m[1], actor: m[2] }));
    const other = actors.find((a) => a.actor !== actors[0]?.actor);
    if (other) groups.push([actors[0].id, other.id]);
    return { raw: { groups }, costUsd: 0.0005 };
  };
  const run = await runMonth(entries, { extract: idealAsk(true), check: checker });
  const score = scoreAgainstLabels(run, labels);
  assert.equal(score.duplicates.found, 9);
  assert.deepEqual(score.duplicates.wrong, []);
  assert.ok(run.rejected.some((r) => r.why === "した人がちがいます"));
});

const day = entries.filter((e) => e.date === entries[0].date);

test("every line must come back exactly once, with people from the list and no character words", () => {
  const good = { items: day.map((e) => ideal(e.id)) };
  assert.deepEqual(validateExtraction(good, day).problems, []);

  const missing = { items: good.items.slice(1) };
  assert.ok(validateExtraction(missing, day).problems.some((p) => p.includes(day[0].id)));

  const twice = { items: [...good.items, good.items[0]] };
  assert.ok(validateExtraction(twice, day).problems.some((p) => p.includes("2回")));

  const stranger = { items: [...good.items, { ...good.items[0], entryId: "seed-999" }] };
  assert.equal(validateExtraction(stranger, day).extraction, null);

  const firstFact = good.items.findIndex((i) => i.kind !== "drop");
  const edit = (patch: Record<string, unknown>) => ({ items: good.items.map((it, i) => (i === firstFact ? { ...it, ...patch } : it)) });
  assert.equal(validateExtraction(edit({ actorId: "nobody" }), day).extraction, null);
  assert.equal(validateExtraction(edit({ action: "やる気があって床を拭いた" }), day).extraction, null);
  assert.equal(validateExtraction(edit({ task: "あ".repeat(21) }), day).extraction, null);
  assert.equal(validateExtraction(edit({ verdict: "たぶん" }), day).extraction, null);
  const f = good.items[firstFact];
  if (f.kind === "help") assert.equal(validateExtraction(edit({ actorId: day[firstFact].authorId }), day).extraction, null);

  const dropIdx = good.items.findIndex((i) => i.kind === "drop");
  if (dropIdx >= 0) {
    const badDrop = { items: good.items.map((it, i) => (i === dropIdx ? { ...it, dropReason: "boring" } : it)) };
    assert.equal(validateExtraction(badDrop, day).extraction, null);
  }
});

test("a batch that fails the checks is asked once more with the problems, then gives up", async () => {
  const prompts: string[] = [];
  const flaky: Ask = async ({ prompt }) => {
    prompts.push(prompt);
    const items = idsIn(prompt).map((id) => ideal(id));
    return { raw: { items: prompts.length === 1 ? items.slice(1) : items }, costUsd: 0.01 };
  };
  const r = await extractBatch(day, flaky);
  assert.equal(r.attempts, 2);
  assert.ok(prompts[1].includes("did not pass"));
  assert.ok(prompts[1].includes(day[0].id));

  await assert.rejects(extractBatch(day, async () => ({ raw: { items: [] }, costUsd: 0 })), ExtractError);
});

test("a broken checker answer means no suggestions, never a crash", async () => {
  const facts = (await extractBatch(day, idealAsk())).extraction.facts;
  for (const raw of [null, "x", { groups: "no" }, { groups: [[1, 2]] }]) {
    const r = await suggestGroups(facts, async () => ({ raw, costUsd: 0 }));
    assert.deepEqual(r.groups, []);
  }
});

test("checkFacts refuses unsafe groups: one fact, unknown ids, different days", () => {
  const order = new Map(entries.map((e, i) => [e.id, i]));
  const facts = entries.slice(0, 20).map((e) => ideal(e.id)).filter((i) => i.kind !== "drop");
  const asFacts = facts.map((i) => {
    const e = entries.find((x) => x.id === i.entryId)!;
    return { entryId: i.entryId, date: e.date, authorId: e.authorId, kind: i.kind as "help" | "self", actorId: i.actorId, forIds: [], action: i.action, task: i.task, verdict: "付ける" as const, reason: i.reason };
  });
  const otherDay = asFacts.find((f) => f.date !== asFacts[0].date)!;
  const r = checkFacts(asFacts, [], order, [[asFacts[0].entryId], [asFacts[0].entryId, "seed-999"], [asFacts[0].entryId, otherDay.entryId]]);
  assert.deepEqual(r.rejected.map((x) => x.why), ["2つ以上の事実が要ります", "知らない entryId があります", "日がちがいます"]);
});

test("the extractor's prompt lists every staff member and every line, as written", () => {
  const p = buildExtractPrompt(day);
  for (const s of STAFF) assert.ok(p.includes(`- ${s.id}:`), s.id);
  for (const e of day) assert.ok(p.includes(e.text) && p.includes(e.id));
});

test("each subagent has a narrow job: no tools of its own, its own model, and the extractor preloads the owner's skill", () => {
  const a = agentDefinitions();
  // No tools are granted here; the session turns all built-in tools off and the agents inherit that.
  assert.equal(a["fact-extractor"].tools, undefined);
  assert.equal(a.checker.tools, undefined);
  assert.deepEqual(a["fact-extractor"].skills, [SKILL_NAME]);
  assert.equal(a["fact-extractor"].model, model("extractor"));
  assert.equal(a.checker.model, model("checker"));
  assert.equal(new Set([model("writer"), model("extractor"), model("checker")]).size, 3);
});
