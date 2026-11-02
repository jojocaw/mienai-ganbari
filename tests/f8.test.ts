// F8 ②: the twenty scenes, the owner's answers and the counting are checked by code; no API calls here.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { agreement, CATEGORIES, claudeAnswers, ownerAnswersError, scenarioEntries, scenariosError, twoFolds, type Scenario } from "../src/lib/f8/compare.ts";
import { validateExtraction } from "../src/lib/facts/validate.ts";
import { findCharacterWords } from "../src/lib/monosashi/lint.ts";

const root = path.join(import.meta.dirname, "..");
const { scenarios } = JSON.parse(readFileSync(path.join(root, "data/f8/scenarios.json"), "utf8")) as { scenarios: Scenario[] };

test("twenty fictional scenes in the planned mix, each a single line by someone on the staff list", () => {
  assert.equal(scenarios.length, 20);
  assert.equal(scenariosError(scenarios), null);
  const count = (c: string) => scenarios.filter((s) => s.category === c).length;
  assert.deepEqual(Object.keys(CATEGORIES).map(count), [5, 4, 4, 3, 2, 2]);
  // the gossip and judgement scenes really contain a word the yardstick must not use
  for (const s of scenarios.filter((x) => x.category === "gossip")) assert.ok(/サボ/.test(s.text) || findCharacterWords(s.text).length > 0, s.id);
});

test("the owner's answers must cover every scene with 付ける / 付けない / 迷う", () => {
  const all = Object.fromEntries(scenarios.map((s) => [s.id, "付ける"]));
  assert.equal(ownerAnswersError(all, scenarios), null);
  assert.ok(ownerAnswersError({ ...all, s05: "たぶん" }, scenarios));
  const { s20: _x, ...missing } = all;
  void _x;
  assert.ok(ownerAnswersError(missing, scenarios));
  assert.ok(ownerAnswersError({ ...all, s99: "付ける" }, scenarios));
  assert.ok(ownerAnswersError([], scenarios));
});

test("Claude's answers: a kept fact gives its verdict, a dropped line gets no plus, a wrong person never counts as agreeing", () => {
  const entries = scenarioEntries(scenarios.slice(0, 3));
  const raw = {
    items: [
      { entryId: "s01", kind: "help", dropReason: "", actorId: "lan", forIds: [], action: "ランさんが急な休みの代わりにシフトに入った", task: "代わりのシフト", verdict: "付ける", reason: "代わりに入った" },
      { entryId: "s02", kind: "drop", dropReason: "vague", actorId: "", forIds: [], action: "", task: "", verdict: "", reason: "" },
      { entryId: "s03", kind: "help", dropReason: "", actorId: "kenji", forIds: [], action: "けんじさんが手順を教えた", task: "手順を教える", verdict: "付ける", reason: "教えた" },
    ],
  };
  const v = validateExtraction(raw, entries);
  assert.ok(v.extraction, v.problems.join(" / "));
  const claude = claudeAnswers(v.extraction!, scenarios.slice(0, 3));
  assert.deepEqual(claude, { s01: "付ける", s02: "付けない", s03: "取り違え" });
  const a = agreement({ s01: "付ける", s02: "付けない", s03: "付ける" }, claude, scenarios.slice(0, 3));
  assert.equal(a.same, 2);
  assert.deepEqual(a.differ, ["s03"]);
  assert.equal(a.matrix["付ける"]["取り違え"], 1);
  assert.deepEqual(a.byCategory.help, { total: 3, same: 2 });
});

test("two folds: every scene is tested exactly once, never with its own answer in the skill, and gossip never becomes an example", () => {
  const folds = twoFolds(scenarios);
  assert.equal(folds.length, 2);
  assert.deepEqual(folds.flatMap((f) => f.test.map((s) => s.id)).sort(), scenarios.map((s) => s.id).sort());
  for (const f of folds) {
    assert.equal(f.test.length, 10);
    for (const ex of f.examples) assert.ok(!f.test.some((t) => t.id === ex.id), ex.id);
    assert.ok(f.examples.every((s) => s.category !== "gossip"));
    assert.equal(f.examples.length, 9);
  }
});
