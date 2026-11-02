// The fictional month: 180 lines with a known mix, one "loud" person and one "quiet" person.
// These numbers are the answer key the fact checker (F4) will be tested against later.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.join(import.meta.dirname, "..");
const entries = JSON.parse(readFileSync(path.join(root, "data/seed/entries.json"), "utf8"));
const labels = JSON.parse(readFileSync(path.join(root, "data/seed/labels.json"), "utf8"));
const count = (f: (l: { kind: string; authorId: string; subjectIds: string[] }) => boolean) => labels.filter(f).length;

test("180 lines over 30 days, every line has a label", () => {
  assert.equal(entries.length, 180);
  assert.equal(new Set(entries.map((e: { date: string }) => e.date)).size, 30);
  assert.deepEqual(
    entries.map((e: { id: string }) => e.id),
    labels.map((l: { id: string }) => l.id),
  );
});

test("the mix: help 60% / self-report 20% / gossip 10% / duplicate 5% / vague 5%", () => {
  assert.equal(count((l) => l.kind === "help"), 108);
  assert.equal(count((l) => l.kind === "self"), 36);
  assert.equal(count((l) => l.kind === "gossip"), 18);
  assert.equal(count((l) => l.kind === "dup"), 9);
  assert.equal(count((l) => l.kind === "vague"), 9);
});

test("Japanese, Vietnamese and Indonesian lines are all present", () => {
  const langs = new Set(entries.map((e: { lang: string }) => e.lang));
  assert.deepEqual([...langs].sort(), ["id", "ja", "vi"]);
});

test("the loud person reports themselves a lot but is rarely mentioned", () => {
  assert.equal(count((l) => l.kind === "self" && l.authorId === "sota"), 20);
  assert.ok(count((l) => (l.kind === "help" || l.kind === "dup") && l.subjectIds[0] === "sota") <= 3);
});

test("the quiet person rarely writes but is mentioned by others again and again", () => {
  assert.ok(entries.filter((e: { authorId: string }) => e.authorId === "minh").length <= 3);
  assert.equal(count((l) => l.kind === "self" && l.authorId === "minh"), 0);
  assert.ok(count((l) => l.kind === "help" && l.subjectIds[0] === "minh") >= 26);
});

test("every duplicate points at an earlier line about the same person, task and day", () => {
  const byId = new Map(labels.map((l: { id: string }) => [l.id, l]));
  const entryById = new Map(entries.map((e: { id: string }) => [e.id, e]));
  for (const d of labels.filter((l: { kind: string }) => l.kind === "dup")) {
    const orig = byId.get(d.dupOf) as { kind: string; subjectIds: string[]; task: string; eventKey: string; authorId: string };
    assert.ok(orig, `${d.id} has no original`);
    assert.equal(orig.kind, "help");
    assert.equal(orig.eventKey, d.eventKey);
    assert.notEqual(orig.authorId, d.authorId);
    const [a, b] = [entryById.get(d.dupOf) as { date: string; createdAt: string }, entryById.get(d.id) as { date: string; createdAt: string }];
    assert.equal(a.date, b.date);
    assert.ok(a.createdAt < b.createdAt);
  }
});

test("no template placeholder is left in any line, and nobody writes about themselves as someone else", () => {
  for (const e of entries) assert.ok(!/[{}]/.test(e.text), e.text);
  for (const l of labels) if (l.kind === "help" || l.kind === "gossip" || l.kind === "dup") assert.notEqual(l.authorId, l.subjectIds[0]);
});

test("only the planted duplicates repeat an event: help lines and self-reports are each a different event", () => {
  const keys = labels.filter((l: { kind: string }) => l.kind === "help" || l.kind === "self").map((l: { eventKey: string }) => l.eventKey);
  assert.equal(new Set(keys).size, keys.length);
});
