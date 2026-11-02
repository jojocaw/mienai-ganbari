// F2: the owner's answers become a yardstick skill. Claude writes the draft; plain code checks it.
// No API calls here: the model is replaced by small fakes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { QUESTIONS, validateAnswers } from "../src/lib/monosashi/questions.ts";
import { findCharacterWords, lintDraft, lintSkillText, type Draft } from "../src/lib/monosashi/lint.ts";
import { renderSkill } from "../src/lib/monosashi/render.ts";
import { buildPrompt } from "../src/lib/monosashi/prompt.ts";
import { characterWordsInAnswers, SkillWriteError, writeSkill, type Generate } from "../src/lib/monosashi/write-skill.ts";
import { SKILL_NAME } from "../src/lib/shop.ts";

const root = path.join(import.meta.dirname, "..");
const demo: Record<string, string> = JSON.parse(readFileSync(path.join(root, "data/seed/owner-answers.json"), "utf8")).answers;

const GOOD: Draft = {
  summary: "頼まれる前に動いたことと、ほかの人の記録に何度も出てくる手助けを一番に見る。",
  give: [
    { text: "急な休みの代わりにシフトに入った", from: ["q1", "q4"] },
    { text: "閉店後、頼まれずに床を拭いた", from: ["q1"] },
    { text: "新人にレジの打ち方を教えた", from: ["q1", "q3"] },
  ],
  dontGive: [
    { text: "自分の担当の仕事をしただけ", from: ["q5"] },
    { text: "休憩を削って働いた", from: ["q8"] },
  ],
  unsure: [{ text: "教わった側にもプラスを付けるか", from: ["q3"] }],
  examples: [
    { line: "Aさんが急に休んだBさんの代わりに入ってくれた。", verdict: "付ける", reason: "急な休みの代わりに入ったため。" },
    { line: "今日も自分の担当のレジをしっかりやりました。", verdict: "付けない", reason: "自分の担当の仕事だけのため。" },
    { line: "Aさんがお昼休みを取らずに働いていた。", verdict: "付けない", reason: "休憩を削って働いたため。" },
    { line: "Aさんに豆の挽き方を教わった。", verdict: "迷う", reason: "教わった側に付けるかは店長が決めるため。" },
  ],
};
const clone = (d: Draft): Draft => JSON.parse(JSON.stringify(d));

test("ten questions with unique ids, numbered 1 to 10", () => {
  assert.equal(QUESTIONS.length, 10);
  assert.equal(new Set(QUESTIONS.map((q) => q.id)).size, 10);
  assert.deepEqual(QUESTIONS.map((q) => q.no), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});

test("the fictional owner answers every question and uses character words the skill must not keep", () => {
  assert.equal(validateAnswers(demo), null);
  for (const q of QUESTIONS) assert.ok(demo[q.id]?.trim(), q.id);
  const words = characterWordsInAnswers(demo).map((h) => h.word);
  for (const w of ["気が利", "明るい", "やる気"]) assert.ok(words.includes(w), w);
});

test("answers: known questions only, text only, not too long, at least five answered", () => {
  assert.notEqual(validateAnswers({ ...demo, q99: "?" }), null);
  assert.notEqual(validateAnswers({ ...demo, q1: 3 }), null);
  assert.notEqual(validateAnswers({ ...demo, q1: "あ".repeat(401) }), null);
  assert.notEqual(validateAnswers({ q1: "a", q2: "b", q3: "c", q4: "  " }), null);
  assert.notEqual(validateAnswers(null), null);
});

test("character words are found everywhere, including word stems", () => {
  const hits = findCharacterWords("やる気がある。気が利かない。やる気だけ。");
  assert.deepEqual(hits.map((h) => h.word), ["やる気", "気が利", "やる気"]);
  assert.deepEqual(findCharacterWords("閉店後、頼まれずに床を拭いた"), []);
});

test("a good draft passes the checks", () => {
  const r = lintDraft(GOOD);
  assert.deepEqual(r.problems, []);
  assert.equal(r.ok, true);
});

test("a draft with a character word, a made-up source or a missing example kind is rejected", () => {
  const withWord = clone(GOOD);
  withWord.give[0].text = "やる気があって代わりに入った";
  const r1 = lintDraft(withWord);
  assert.equal(r1.ok, false);
  assert.ok(r1.problems.some((p) => p.includes("やる気") && p.includes("give[0]")));

  const badSource = clone(GOOD);
  badSource.give[1].from = ["q42"];
  assert.ok(lintDraft(badSource).problems.some((p) => p.includes("q42")));

  const noSource = clone(GOOD);
  noSource.dontGive[0].from = [];
  assert.equal(lintDraft(noSource).ok, false);

  const noDont = clone(GOOD);
  noDont.examples = noDont.examples.map((e) => ({ ...e, verdict: e.verdict === "付けない" ? "迷う" : e.verdict }));
  assert.ok(lintDraft(noDont).problems.some((p) => p.includes("付けない")));

  const fewRules = clone(GOOD);
  fewRules.give = fewRules.give.slice(0, 2);
  assert.equal(lintDraft(fewRules).ok, false);

  const twoLines = clone(GOOD);
  twoLines.examples[0].line = "1行目\n2行目";
  assert.equal(lintDraft(twoLines).ok, false);
});

test("broken model output is reported, not thrown", () => {
  for (const raw of [null, "text", {}, { give: "x" }, { ...GOOD, examples: [{ line: "a", verdict: "たぶん", reason: "b" }] }]) {
    const r = lintDraft(raw);
    assert.equal(r.ok, false);
    assert.ok(r.problems.length > 0);
  }
});

test("the rendered SKILL.md has the skill header, every section, and where each rule came from", () => {
  const text = renderSkill(GOOD, { shopName: "架空のカフェ", skillName: SKILL_NAME, date: "2026-11-02" });
  const lint = lintSkillText(text, SKILL_NAME);
  assert.deepEqual(lint.problems, []);
  assert.equal(lint.name, SKILL_NAME);
  assert.ok(lint.description && lint.description.length <= 1024);
  assert.deepEqual(lint.counts, { give: 3, dontGive: 2, unsure: 1, examples: 4 });
  assert.ok(text.includes("急な休みの代わりにシフトに入った（答え 1・4）"));
  assert.ok(text.includes("決めるのは店長です。"));
});

test("hand edits that break the rules are caught in SKILL.md too", () => {
  const text = renderSkill(GOOD, { shopName: "架空のカフェ", skillName: SKILL_NAME, date: "2026-11-02" });
  assert.equal(lintSkillText(text.replace("床を拭いた", "真面目に床を拭いた"), SKILL_NAME).ok, false);
  assert.equal(lintSkillText(text.replace(/^---[\s\S]*?---\n/, ""), SKILL_NAME).ok, false);
  assert.equal(lintSkillText(text, "other-shop-monosashi").ok, false);
  assert.equal(lintSkillText(text.replace("## 付けない", "## だめ"), SKILL_NAME).ok, false);
});

test("the prompt carries every question, marks empty answers, and lists last round's problems", () => {
  const p = buildPrompt("架空のカフェ", { q1: "代わりに入ってくれた時" }, ["人柄・態度の言葉「やる気」が give[0] に入っています"]);
  for (const q of QUESTIONS) assert.ok(p.includes(q.text), q.id);
  assert.ok(p.includes("答え: 代わりに入ってくれた時"));
  assert.ok(p.includes("（答えなし）"));
  assert.ok(p.includes("「やる気」が give[0]"));
});

test("a draft that fails the checks is sent back once with the problems, then saved", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "monosashi-"));
  const bad = clone(GOOD);
  bad.give[0].text = "やる気があって代わりに入った";
  const prompts: string[] = [];
  const generate: Generate = async ({ prompt }) => {
    prompts.push(prompt);
    return { draft: prompts.length === 1 ? bad : GOOD, costUsd: 0.01 };
  };
  const r = await writeSkill(demo, { generate, root: dir, now: new Date("2026-11-02T03:00:00Z") });
  assert.equal(r.attempts, 2);
  assert.ok(prompts[1].includes("やる気"));
  assert.ok(!prompts[0].includes("前の案は"));
  assert.equal(r.costUsd, 0.02);
  assert.equal(readFileSync(path.join(dir, SKILL_NAME, "SKILL.md"), "utf8"), r.text);
  assert.equal(r.lint.characterWords.length, 0);
  assert.ok(r.answerWords.length >= 3);
  assert.ok(r.text.includes("2026-11-02"));
});

test("if the draft keeps failing, nothing is written and the problems are returned", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "monosashi-"));
  const bad = clone(GOOD);
  bad.summary = "明るい人を大事にする";
  await assert.rejects(writeSkill(demo, { generate: async () => ({ draft: bad, costUsd: 0 }), root: dir }), (e: unknown) => {
    assert.ok(e instanceof SkillWriteError);
    assert.equal(e.attempts, 2);
    assert.ok(e.problems.some((p) => p.includes("明るい")));
    return true;
  });
  assert.equal(existsSync(path.join(dir, SKILL_NAME, "SKILL.md")), false);
});

test("invalid answers stop before Claude is called", async () => {
  let called = false;
  const generate: Generate = async () => {
    called = true;
    return { draft: GOOD, costUsd: 0 };
  };
  await assert.rejects(writeSkill({ q1: "a" }, { generate, root: mkdtempSync(path.join(tmpdir(), "monosashi-")) }), SkillWriteError);
  assert.equal(called, false);
});
