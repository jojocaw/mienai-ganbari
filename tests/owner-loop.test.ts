// F9: the owner corrects the month-end verdicts, and the corrections join the yardstick skill as examples.
// Plain code only (no Claude): the owner's decisions go in word for word, without people's names, and can be undone.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Entry } from "../src/lib/entries.ts";
import type { CheckedFact } from "../src/lib/facts/check.ts";
import type { Dropped } from "../src/lib/facts/types.ts";
import { actionWithoutActor, correctionsToExamples, MAX_CORRECTIONS, parseCorrections } from "../src/lib/month/corrections.ts";
import { buildMonthView } from "../src/lib/month/summary.ts";
import { addOwnerExamples, MAX_OWNER_EXAMPLES, mergeOwnerExamples, OWNER_EXAMPLES_HEADING, readOwnerExamples } from "../src/lib/monosashi/examples.ts";
import { lintSkillText } from "../src/lib/monosashi/lint.ts";
import { historyCount, ownerSection, saveOwnerExamples, undoOwnerExamples } from "../src/lib/monosashi/owner-loop.ts";
import { SKILL_NAME } from "../src/lib/shop.ts";

const root = path.join(import.meta.dirname, "..");
const skill = readFileSync(path.join(root, ".claude/skills/demo-cafe-monosashi/SKILL.md"), "utf8");
const entries: Entry[] = JSON.parse(readFileSync(path.join(root, "data/seed/entries.json"), "utf8"));
const month: { facts: CheckedFact[]; dropped: Dropped[] } = JSON.parse(readFileSync(path.join(root, "data/derived/month.json"), "utf8"));
const view = buildMonthView(month, entries);
const allEvents = view.persons.flatMap((p) => [...p.green, ...p.yellow]);

test("month after month the owner's decisions pile up in one section; a new decision on the same line replaces the old one", () => {
  const first = mergeOwnerExamples(skill, [{ line: "お客様の忘れ物を走って届けた", verdict: "付ける" }], SKILL_NAME);
  assert.equal(first.added.length, 1);
  assert.equal(lintSkillText(first.text, SKILL_NAME).ok, true);
  assert.ok(first.text.indexOf(`## ${OWNER_EXAMPLES_HEADING}`) < first.text.indexOf("## 読み方の決まり"));
  const second = mergeOwnerExamples(
    first.text,
    [
      { line: "閉店後にゴミをすべて捨てた", verdict: "付けない" },
      { line: "お客様の忘れ物を走って届けた", verdict: "迷う" },
      { line: "閉店後にゴミをすべて捨てた", verdict: "付けない" },
    ],
    SKILL_NAME,
  );
  assert.deepEqual(second.added, [{ line: "閉店後にゴミをすべて捨てた", verdict: "付けない" }]);
  assert.deepEqual(second.changed, [{ line: "お客様の忘れ物を走って届けた", from: "付ける", to: "迷う" }]);
  assert.equal(second.unchanged, 1);
  assert.deepEqual(readOwnerExamples(second.text).examples, [
    { line: "お客様の忘れ物を走って届けた", verdict: "迷う" },
    { line: "閉店後にゴミをすべて捨てた", verdict: "付けない" },
  ]);
  // still one section, and the rest of the skill is exactly what it was
  assert.equal(second.text.split(`## ${OWNER_EXAMPLES_HEADING}`).length, 2);
  const strip = (t: string) => t.replace(new RegExp(`## ${OWNER_EXAMPLES_HEADING}[\\s\\S]*?(?=## 読み方の決まり)`), "");
  assert.equal(strip(second.text), skill);
});

test("the owner's own words stay when new examples join, and the oldest examples leave first past the limit", () => {
  const withNote = addOwnerExamples(skill, { notes: ["小さなことと、基本的に仕事中に出来る事だから"] }, SKILL_NAME);
  const merged = mergeOwnerExamples(withNote, [{ line: "重い箱を半分持った", verdict: "付けない" }], SKILL_NAME);
  assert.deepEqual(readOwnerExamples(merged.text).notes, ["小さなことと、基本的に仕事中に出来る事だから"]);
  const many = Array.from({ length: MAX_OWNER_EXAMPLES + 5 }, (_, i) => ({ line: `${i + 1}番目の行動をした`, verdict: "付ける" as const }));
  const big = mergeOwnerExamples(merged.text, many, SKILL_NAME);
  assert.equal(big.total, MAX_OWNER_EXAMPLES);
  assert.equal(big.removed.length, 6);
  assert.deepEqual(big.removed[0], { line: "重い箱を半分持った", verdict: "付けない" });
  assert.equal(readOwnerExamples(big.text).examples.at(-1)?.line, `${MAX_OWNER_EXAMPLES + 5}番目の行動をした`);
  assert.equal(lintSkillText(big.text, SKILL_NAME).ok, true);
});

test("nothing that judges a person enters, and an empty save is refused", () => {
  assert.throws(() => mergeOwnerExamples(skill, [{ line: "やる気がある", verdict: "付ける" }], SKILL_NAME), /やる気/);
  assert.throws(() => mergeOwnerExamples(skill, [], SKILL_NAME));
  assert.throws(() => mergeOwnerExamples(skill, [{ line: "1行目\n2行目", verdict: "付ける" }], SKILL_NAME));
});

test("a correction on the real fictional month becomes an example without the person's name; repeating Claude's answer teaches nothing", () => {
  const e = allEvents.find((x) => x.verdict === "迷う" && /^ミンさんが/.test(x.action))!;
  assert.ok(e, "there is a 迷う event for ミン");
  const { examples, skipped, problems } = correctionsToExamples(view, [
    { eventId: e.id, verdict: "付ける" },
    { eventId: allEvents[0].id, verdict: allEvents[0].verdict },
    { eventId: "no-such-event", verdict: "付ける" },
  ]);
  assert.equal(examples.length, 1);
  assert.equal(examples[0].from, "迷う");
  assert.equal(examples[0].verdict, "付ける");
  assert.equal(examples[0].line, actionWithoutActor(e.action, "minh"));
  assert.ok(!examples[0].line.includes("ミン"));
  assert.equal(skipped, 1);
  assert.equal(problems.length, 1);
  assert.equal(actionWithoutActor("ミンさんが閉店後に床をふいた", "minh"), "閉店後に床をふいた");
  assert.equal(actionWithoutActor("閉店後に床をふいた", "minh"), "閉店後に床をふいた");
});

test("the request body is checked before anything is read or written", () => {
  assert.ok("problem" in parseCorrections(undefined));
  assert.ok("problem" in parseCorrections([]));
  assert.ok("problem" in parseCorrections([{ eventId: "e1", verdict: "あげる" }]));
  assert.ok("problem" in parseCorrections([{ eventId: 3, verdict: "付ける" }]));
  assert.ok("problem" in parseCorrections(Array.from({ length: MAX_CORRECTIONS + 1 }, (_, i) => ({ eventId: `e${i}`, verdict: "付ける" }))));
  assert.deepEqual(parseCorrections([{ eventId: "e1", verdict: "付けない" }]), { corrections: [{ eventId: "e1", verdict: "付けない" }] });
});

test("saving keeps the previous version, and one undo puts the skill back exactly", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "owner-loop-"));
  const skills = path.join(dir, "skills");
  const history = path.join(dir, "history");
  mkdirSync(path.join(skills, SKILL_NAME), { recursive: true });
  const file = path.join(skills, SKILL_NAME, "SKILL.md");
  writeFileSync(file, skill, "utf8");
  const r1 = await saveOwnerExamples([{ line: "お客様の忘れ物を走って届けた", verdict: "付ける" }], { root: skills, history, now: new Date("2026-11-03T01:00:00Z") });
  assert.equal(r1.added.length, 1);
  assert.ok(r1.section.startsWith(`## ${OWNER_EXAMPLES_HEADING}`));
  assert.ok(r1.section.includes("- 「お客様の忘れ物を走って届けた」→ **付ける**"));
  const afterFirst = readFileSync(file, "utf8");
  await saveOwnerExamples([{ line: "閉店後にゴミをすべて捨てた", verdict: "付けない" }], { root: skills, history, now: new Date("2026-11-03T01:01:00Z") });
  assert.equal(await historyCount(history), 2);
  assert.equal(await undoOwnerExamples({ root: skills, history }), true);
  assert.equal(readFileSync(file, "utf8"), afterFirst);
  assert.equal(await undoOwnerExamples({ root: skills, history }), true);
  assert.equal(readFileSync(file, "utf8"), skill);
  assert.equal(ownerSection(skill), "");
  assert.equal(await undoOwnerExamples({ root: skills, history }), false);
  assert.deepEqual(readdirSync(history), []);
  // no skill yet → a clear error, nothing written
  await assert.rejects(saveOwnerExamples([{ line: "床をふいた", verdict: "付ける" }], { root: path.join(dir, "none"), history }), /まだありません/);
});
