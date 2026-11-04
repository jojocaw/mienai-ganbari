// F10: one question back about a vague line, right after it is saved. The line never changes, gossip is never asked
// about, any problem means "no question", and the answer reaches the month-end fact extractor next to the line.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const dir = mkdtempSync(path.join(tmpdir(), "mienai-ask-"));
process.env.MIENAI_DATA_DIR = dir;
process.env.MIENAI_SEED_FILE = path.join(dir, "no-seed.json");
const { addEntry, addAnswer, EntryError, findLocalEntry } = await import("../src/lib/entries.ts");
const { askBack, readAskReply, buildAskPrompt, QUESTION_MAX } = await import("../src/lib/askback/ask.ts");
const { buildExtractPrompt, ANSWER_NOTE } = await import("../src/lib/facts/prompt.ts");

const vague = (question: string) => async () => ({ raw: { kind: "vague", question }, costUsd: 0.001 });
const NOW = new Date("2026-11-04T12:00:00Z");

test("a vague line gets one question in the writer's language; the line itself stays as written", async () => {
  const e = await addEntry("sota", "いろいろ手伝いました。", NOW);
  const r = await askBack(e.id, vague("だれの、どんな仕事を手伝いましたか？"), NOW);
  assert.equal(r.question, "だれの、どんな仕事を手伝いましたか？");
  const saved = await findLocalEntry(e.id);
  assert.equal(saved?.text, "いろいろ手伝いました。");
  assert.equal(saved?.clarification?.question, "だれの、どんな仕事を手伝いましたか？");
  assert.equal(saved?.clarification?.answer, undefined);
});

test("the answer is kept exactly as typed, next to the line, and only once", async () => {
  const e = await addEntry("lan", "Hôm nay bận nhưng mọi việc vẫn ổn.", NOW);
  await askBack(e.id, vague("Hôm nay ai đã làm việc gì vậy?"), NOW);
  const answered = await addAnswer(e.id, " Ayane đã giúp tôi rửa chén. ", NOW);
  assert.equal(answered.text, "Hôm nay bận nhưng mọi việc vẫn ổn.");
  assert.equal(answered.clarification?.answer, " Ayane đã giúp tôi rửa chén. ");
  await assert.rejects(addAnswer(e.id, "もう一度", NOW), EntryError);
  const onDisk = JSON.parse(readFileSync(path.join(dir, "entries.json"), "utf8"));
  assert.equal(onDisk.find((x: { id: string }) => x.id === e.id).text, "Hôm nay bận nhưng mọi việc vẫn ổn.");
});

test("answers follow the same rules as lines: one line, not empty, not too long", async () => {
  const e = await addEntry("putri", "Semua orang bekerja keras hari ini.", NOW);
  await askBack(e.id, vague("Siapa yang mengerjakan apa hari ini?"), NOW);
  await assert.rejects(addAnswer(e.id, "1行目\n2行目", NOW), EntryError);
  await assert.rejects(addAnswer(e.id, "   ", NOW), EntryError);
  await assert.rejects(addAnswer(e.id, "あ".repeat(201), NOW), EntryError);
  const ok = await addAnswer(e.id, "Minh membersihkan dapur setelah tutup.", NOW);
  assert.equal(ok.clarification?.answer, "Minh membersihkan dapur setelah tutup.");
});

test("no answer without a question, and a line is asked about at most once", async () => {
  const e = await addEntry("kenji", "今日は忙しかったけど、なんとか回った。", NOW);
  await assert.rejects(addAnswer(e.id, "ランさんが皿洗いをした", NOW), EntryError);
  await askBack(e.id, vague("だれが、どんな仕事をしていましたか？"), NOW);
  let called = false;
  const again = await askBack(e.id, async () => ((called = true), { raw: { kind: "vague", question: "もう一度？" }, costUsd: 0 }), NOW);
  assert.equal(again.question, null);
  assert.equal(called, false);
});

test("clear lines, gossip, judgements and feelings get no question", async () => {
  for (const kind of ["clear", "gossip", "judgement", "feeling"]) {
    const e = await addEntry("ayane", `${kind} の行`, NOW);
    const r = await askBack(e.id, async () => ({ raw: { kind, question: "だれが何をしましたか？" }, costUsd: 0 }), NOW);
    assert.equal(r.question, null, kind);
    assert.equal((await findLocalEntry(e.id))?.clarification, undefined, kind);
  }
});

test("an error, a broken reply or an old line means no question, and the line is untouched", async () => {
  const e1 = await addEntry("miyuki", "今日もみんなよく頑張っていた。", NOW);
  const r1 = await askBack(e1.id, async () => {
    throw new Error("network");
  }, NOW);
  assert.equal(r1.question, null);
  assert.equal((await findLocalEntry(e1.id))?.clarification, undefined);
  const e2 = await addEntry("miyuki", "今日もみんなよく頑張っていた。", NOW);
  assert.equal((await askBack(e2.id, async () => ({ raw: null, costUsd: 0 }), NOW)).question, null);
  const later = new Date(NOW.getTime() + 31 * 60 * 1000);
  assert.equal((await askBack(e2.id, vague("だれが、どんなことをしていましたか？"), later)).question, null);
  assert.equal((await askBack("no-such-id", vague("だれが？"), NOW)).question, null);
});

test("plain-code checks on the question: one line, short, a question, no character words, the writer's language", () => {
  assert.deepEqual(readAskReply({ kind: "vague", question: "だれの、どんな仕事を手伝いましたか？" }, "ja"), { ask: true, question: "だれの、どんな仕事を手伝いましたか？" });
  assert.equal(readAskReply({ kind: "vague", question: "だれが？\n何を？" }, "ja").ask, false);
  assert.equal(readAskReply({ kind: "vague", question: "あ".repeat(QUESTION_MAX.ja) + "？" }, "ja").ask, false);
  assert.equal(readAskReply({ kind: "vague", question: "だれが何をしましたか" }, "ja").ask, false);
  assert.equal(readAskReply({ kind: "vague", question: "やる気があったのはだれですか？" }, "ja").ask, false);
  assert.equal(readAskReply({ kind: "vague", question: "Who did what?" }, "ja").ask, false);
  assert.equal(readAskReply({ kind: "vague", question: "だれが何をしましたか？" }, "vi").ask, false);
  assert.equal(readAskReply({ kind: "vague", question: "Ai đã làm việc gì vậy?" }, "vi").ask, true);
  assert.equal(readAskReply({ kind: "vague", question: "" }, "id").ask, false);
  assert.equal(readAskReply({ question: "Siapa?" }, "id").ask, false);
});

test("the asker reads the staff names, the writer's language and the line", () => {
  const p = buildAskPrompt({ authorId: "minh", lang: "vi", text: "Hôm nay mọi người đều cố gắng." });
  assert.match(p, /- minh: ミン \(Minh\) \(Minh\)|- minh: /);
  assert.match(p, /Writer's language: Vietnamese/);
  assert.match(p, /Note: Hôm nay mọi người đều cố gắng\.$/);
});

test("month end: a line without an answer is sent exactly as before; an answered line carries the question and the answer", () => {
  const plain = { id: "a1", date: "2026-11-04", authorId: "haruka", lang: "ja" as const, text: "ミンさんが床をふいてくれた。", createdAt: NOW.toISOString(), source: "app" as const };
  const p1 = buildExtractPrompt([plain]);
  assert.match(p1, /- entryId: a1 \| date: 2026-11-04 \| writer: haruka\n  line: ミンさんが床をふいてくれた。\n\nReturn one item for every line\.$/);
  assert.equal(p1.includes(ANSWER_NOTE), false);
  const askedOnly = { ...plain, id: "a2", clarification: { question: "だれが？", askedAt: NOW.toISOString() } };
  assert.equal(buildExtractPrompt([askedOnly]).includes("asked back"), false);
  const answered = { ...plain, id: "a3", text: "いろいろ手伝いました。", clarification: { question: "だれの、どんな仕事を手伝いましたか？", askedAt: NOW.toISOString(), answer: "ミンさんの、倉庫の片付け", answeredAt: NOW.toISOString() } };
  const p3 = buildExtractPrompt([plain, answered]);
  assert.match(p3, /line: いろいろ手伝いました。\n  asked back: だれの、どんな仕事を手伝いましたか？\n  writer's answer: ミンさんの、倉庫の片付け/);
  assert.equal(p3.includes(ANSWER_NOTE), true);
});
