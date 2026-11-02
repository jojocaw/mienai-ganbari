// F7: letters in each person's language. The amount is F6's number, written exactly once; reasons point to real facts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Entry } from "../src/lib/entries.ts";
import { checkLetter, pickReasons, writeLetter, writeLetters, type AskLetter, type LetterInput } from "../src/lib/letters/letters.ts";
import { planLetters, type Decision } from "../src/lib/letters/plan.ts";
import { buildMonthView } from "../src/lib/month/summary.ts";

const root = path.join(import.meta.dirname, "..");
const entries: Entry[] = JSON.parse(readFileSync(path.join(root, "data/seed/entries.json"), "utf8"));
const month = JSON.parse(readFileSync(path.join(root, "data/derived/month.json"), "utf8"));
const decision: Decision = JSON.parse(readFileSync(path.join(root, "data/seed/owner-decision.json"), "utf8"));
const view = buildMonthView(month, entries);
const { allocation, inputs } = planLetters(view, decision);
const byId = (id: string) => inputs.find((i) => i.personId === id)!;

test("the fictional owner's decision is split to the yen by code, and only people with a plus get a letter", () => {
  assert.deepEqual(allocation.amounts, { haruka: 5900, sota: 2900, miyuki: 5900, kenji: 5900, ayane: 5900, lan: 5900, minh: 11700, putri: 5900 });
  assert.equal(allocation.distributed, 50000);
  assert.equal(inputs.length, 8);
  assert.equal(byId("minh").amountText, "11,700円");
  assert.equal(byId("minh").name, "Minh");
  assert.equal(byId("haruka").name, "はるか");
  assert.equal(byId("minh").lang, "vi");
});

test("reasons are facts other people wrote, best first, and each keeps its original line", () => {
  const minh = view.persons.find((p) => p.id === "minh")!;
  const reasons = pickReasons(minh);
  assert.equal(reasons.length, 5);
  for (const r of reasons) {
    const ev = minh.green.find((e) => e.id === r.entryId)!;
    assert.ok(ev, r.entryId);
    assert.equal(r.line, ev.lines[0].text);
    assert.equal(r.selfOnly, false);
  }
  assert.ok(reasons[0].writers >= reasons[reasons.length - 1].writers || reasons[0].date <= reasons[reasons.length - 1].date);
});

const goodFor = (input: LetterInput, letter: string, japanese: string) => ({ letter, japanese, usedEntryIds: [input.reasons[0].entryId, input.reasons[1].entryId] });

test("good letters pass in Japanese, Vietnamese and Indonesian", () => {
  const ja = byId("haruka");
  assert.deepEqual(checkLetter(goodFor(ja, `はるかさん、今月もありがとう。今月のプラスは${ja.amountText}です。`, `はるかさん、今月もありがとう。今月のプラスは${ja.amountText}です。`), ja).problems, []);
  const vi = byId("minh");
  assert.deepEqual(checkLetter(goodFor(vi, `Minh thân mến, cảm ơn em đã giúp mọi người tháng này. Khoản cộng thêm của em là ${vi.amountText}.`, `ミンさん、今月はみんなを助けてくれてありがとう。今月のプラスは${vi.amountText}です。`), vi).problems, []);
  const id = byId("putri");
  assert.deepEqual(checkLetter(goodFor(id, `Putri, terima kasih atas bantuanmu bulan ini. Tambahan bulan ini adalah ${id.amountText}.`, `プトリさん、今月の手助けをありがとう。今月のプラスは${id.amountText}です。`), id).problems, []);
});

test("letters with a wrong amount, extra money, made-up reasons, character words or the wrong language are refused", () => {
  const vi = byId("minh");
  const ok = (l: string, j: string) => goodFor(vi, l, j);
  const viText = `Minh thân mến, cảm ơn em. Khoản cộng thêm là ${vi.amountText}.`;
  const jaText = `ミンさん、ありがとう。今月のプラスは${vi.amountText}です。`;
  assert.ok(checkLetter(ok(viText.replace(vi.amountText, "12,000円"), jaText), vi).problems.some((p) => p.includes("ちょうど1回")));
  assert.ok(checkLetter(ok(viText + ` (${vi.amountText})`, jaText), vi).problems.some((p) => p.includes("ちょうど1回")));
  assert.ok(checkLetter(ok(viText, jaText + "来月は5,000円を足します。"), vi).problems.some((p) => p.includes("ほかのお金")));
  assert.ok(checkLetter({ ...ok(viText, jaText), usedEntryIds: ["seed-999"] }, vi).problems.some((p) => p.includes("seed-999")));
  assert.ok(checkLetter({ ...ok(viText, jaText), usedEntryIds: [] }, vi).problems.length > 0);
  assert.ok(checkLetter(ok(viText, jaText.replace("ありがとう", "やる気があってありがとう")), vi).problems.some((p) => p.includes("やる気")));
  assert.ok(checkLetter(ok(`ミンさん、今月のプラスは${vi.amountText}です。`, jaText), vi).problems.some((p) => p.includes("ベトナム語")));
  const id = byId("putri");
  assert.ok(checkLetter(goodFor(id, `Putri thân mến, cảm ơn em. ${id.amountText}`, `プトリさん ${id.amountText}`), id).problems.some((p) => p.includes("インドネシア語")));
});

test("a letter that fails is sent back once with the problems; one that keeps failing is never shown as passed", async () => {
  const ja = byId("kenji");
  const prompts: string[] = [];
  const flaky: AskLetter = async ({ prompt }) => {
    prompts.push(prompt);
    const text = prompts.length === 1 ? "けんじさん、ありがとう。" : `けんじさん、ありがとう。今月のプラスは${ja.amountText}です。`;
    return { raw: goodFor(ja, text, text), costUsd: 0.01 };
  };
  const r = await writeLetter(ja, flaky);
  assert.equal(r.attempts, 2);
  assert.ok(r.letter);
  assert.ok(prompts[1].includes("did not pass"));

  const results = await writeLetters([ja, byId("ayane")], async () => ({ raw: { letter: "", japanese: "", usedEntryIds: [] }, costUsd: 0 }));
  assert.equal(results.length, 2);
  for (const x of results) {
    assert.equal(x.letter, null);
    assert.ok(x.problems.length > 0);
  }
});

test("the screen's decision is checked for shape, and the same decision finds the saved letters", async () => {
  const { decisionShapeError, sameDecision } = await import("../src/lib/letters/plan.ts");
  assert.equal(decisionShapeError(decision), null);
  assert.ok(decisionShapeError({ ...decision, month: "2026-13" }));
  assert.ok(decisionShapeError({ ...decision, unit: 5 }));
  assert.ok(decisionShapeError({ ...decision, total: "50000" }));
  assert.ok(decisionShapeError({ ...decision, shares: { minh: "4" } }));
  assert.ok(decisionShapeError(null));
  const saved = JSON.parse(readFileSync(path.join(root, "data/derived/letters.json"), "utf8"));
  assert.ok(sameDecision(saved.decision, decision), "the committed letters match the committed decision");
  assert.ok(sameDecision(decision, { ...decision, shares: { ...decision.shares, extra: 0 } }));
  assert.equal(sameDecision(decision, { ...decision, shares: { ...decision.shares, minh: 3 } }), false);
  assert.equal(sameDecision(decision, { ...decision, total: 50100 }), false);
});

test("runLetters gives the screen and the script the same shape, and the committed letters all passed", async () => {
  const { runLetters } = await import("../src/lib/letters/run.ts");
  const fake: AskLetter = async ({ prompt }) => {
    const input = inputs.find((i) => prompt.includes(`Amount (write it exactly once, exactly like this): ${i.amountText}`) && prompt.includes(`Staff member: ${i.name} `))!;
    const text = input.lang === "ja" ? `${input.name}さん、ありがとう。今月のプラスは${input.amountText}です。` : input.lang === "vi" ? `${input.name} thân mến, cảm ơn em. Khoản cộng thêm là ${input.amountText}.` : `${input.name}, terima kasih. Tambahan bulan ini adalah ${input.amountText}.`;
    return { raw: { letter: text, japanese: `${input.name}さん、ありがとう。今月のプラスは${input.amountText}です。`, usedEntryIds: [input.reasons[0].entryId] }, costUsd: 0.01 };
  };
  const run = await runLetters(view, decision, fake, 2);
  assert.equal(run.letters.length, 8);
  assert.equal(run.allocation.distributed, 50000);
  for (const l of run.letters) {
    assert.ok(l.letter, l.personId);
    assert.equal(l.attempts, 1);
    assert.equal(l.amountText, byId(l.personId).amountText);
  }
  const saved = JSON.parse(readFileSync(path.join(root, "data/derived/letters.json"), "utf8"));
  assert.equal(saved.letters.length, 8);
  for (const l of saved.letters) {
    assert.ok(l.letter, l.personId);
    assert.deepEqual(checkLetter({ letter: l.letter, japanese: l.japanese, usedEntryIds: l.usedEntryIds }, byId(l.personId)).problems, [], l.personId);
  }
});
