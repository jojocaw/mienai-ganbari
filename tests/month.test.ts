// F5: the month-end view. Green = others wrote about it, yellow = self-report only, every event keeps its original lines.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Entry } from "../src/lib/entries.ts";
import { runMonth, type Ask } from "../src/lib/facts/extract.ts";
import type { Label } from "../src/lib/facts/score.ts";
import { buildMonthView } from "../src/lib/month/summary.ts";

const root = path.join(import.meta.dirname, "..");
const entries: Entry[] = JSON.parse(readFileSync(path.join(root, "data/seed/entries.json"), "utf8"));
const labels: Label[] = JSON.parse(readFileSync(path.join(root, "data/seed/labels.json"), "utf8"));
const L = new Map(labels.map((l) => [l.id, l]));

// a perfect extractor built from the answer key (the real run in data/derived/month.json matched it 100%)
const ideal: Ask = async ({ prompt }) => ({
  raw: {
    items: [...prompt.matchAll(/entryId: (\S+) \|/g)].map((m) => {
      const l = L.get(m[1])!;
      const empty = { actorId: "", forIds: [], action: "", task: "", verdict: "", reason: "" };
      if (l.kind === "gossip" || l.kind === "vague") return { entryId: l.id, kind: "drop", dropReason: l.kind, ...empty };
      const actorId = l.kind === "self" ? l.authorId : l.subjectIds[0];
      return { entryId: l.id, kind: l.kind === "self" ? "self" : "help", dropReason: "", actorId, forIds: l.helpedId ? [l.helpedId] : [], action: `${actorId}: ${l.task}`, task: l.task!, verdict: "付ける", reason: "決まりに合う" };
    }),
  },
  costUsd: 0,
});

test("the quiet person is green, the loud person is mostly yellow", async () => {
  const view = buildMonthView(await runMonth(entries, { extract: ideal }), entries);
  const minh = view.persons.find((p) => p.id === "minh")!;
  const sota = view.persons.find((p) => p.id === "sota")!;
  assert.equal(minh.green.length, 26);
  assert.equal(minh.yellow.length, 0);
  assert.equal(minh.wrote, 3);
  assert.equal(sota.green.length, 3);
  assert.equal(sota.yellow.length, 20);
  assert.equal(view.persons[0].id, "minh");
});

test("every event keeps all of its original lines, and duplicates count once", async () => {
  const view = buildMonthView(await runMonth(entries, { extract: ideal }), entries);
  const all = view.persons.flatMap((p) => [...p.green, ...p.yellow]);
  assert.equal(all.length, 144);
  assert.equal(all.reduce((n, e) => n + e.lines.length, 0), 153);
  for (const dup of labels.filter((l) => l.kind === "dup")) {
    const ev = all.find((e) => e.lines.some((x) => x.entryId === dup.id))!;
    assert.ok(ev.lines.some((x) => x.entryId === dup.dupOf), dup.id);
    assert.equal(ev.writers.length, 2);
  }
  for (const e of all) for (const line of e.lines) assert.equal(line.text, entries.find((x) => x.id === line.entryId)!.text);
});

test("dropped lines are only counted, never shown on anyone's page", async () => {
  const view = buildMonthView(await runMonth(entries, { extract: ideal }), entries);
  const shown = new Set(view.persons.flatMap((p) => [...p.green, ...p.yellow]).flatMap((e) => e.lines.map((l) => l.entryId)));
  for (const l of labels.filter((x) => x.kind === "gossip" || x.kind === "vague")) assert.equal(shown.has(l.id), false, l.id);
  assert.deepEqual(view.totals, { lines: 180, facts: 153, events: 144, duplicates: 9, selfOnly: 36, dropped: { gossip: 18, judgement: 0, vague: 9 } });
});

test("the committed real run gives the same picture", () => {
  const month = JSON.parse(readFileSync(path.join(root, "data/derived/month.json"), "utf8"));
  const view = buildMonthView(month, entries);
  const get = (id: string) => view.persons.find((p) => p.id === id)!;
  assert.equal(get("minh").green.length, 26);
  assert.equal(get("sota").yellow.length, 20);
  assert.equal(view.totals.events, 144);
});
