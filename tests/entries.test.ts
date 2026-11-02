// F1: a daily line is saved exactly as written (Japanese, Vietnamese, Indonesian), and only names from the list are accepted.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const dir = mkdtempSync(path.join(tmpdir(), "mienai-"));
process.env.MIENAI_DATA_DIR = dir;
process.env.MIENAI_SEED_FILE = path.join(dir, "no-seed.json");
const { addEntry, listEntries, validateEntry, todayJst, EntryError } = await import("../src/lib/entries.ts");

const LINES: [string, string][] = [
  ["haruka", "ミンさんが閉店後に一人で床を拭いてくれていた。"],
  ["minh", "Hôm nay Lan đã chỉ cho tôi cách pha cà phê sữa đá."],
  ["putri", "Kenji membantu saya mengangkat kotak susu yang berat."],
  ["kenji", "  前後の空白も　全角スペースも そのまま。 "],
];

test("lines are stored byte-for-byte as typed", async () => {
  for (const [who, text] of LINES) {
    const e = await addEntry(who, text, new Date("2026-11-02T03:00:00Z"));
    assert.equal(e.text, text);
  }
  const onDisk = JSON.parse(readFileSync(path.join(dir, "entries.json"), "utf8"));
  assert.deepEqual(
    onDisk.map((e: { authorId: string; text: string }) => [e.authorId, e.text]),
    LINES,
  );
  const listed = await listEntries();
  assert.equal(listed.length, LINES.length);
});

test("the language comes from the staff member, not from guessing", async () => {
  const e = await addEntry("lan", "Cảm ơn mọi người.");
  assert.equal(e.lang, "vi");
});

test("names must come from the list", async () => {
  await assert.rejects(addEntry("someone-else", "テスト"), EntryError);
  assert.notEqual(validateEntry("", "テスト"), null);
});

test("one line only, not empty, not too long", () => {
  assert.notEqual(validateEntry("haruka", "1行目\n2行目"), null);
  assert.notEqual(validateEntry("haruka", "   "), null);
  assert.notEqual(validateEntry("haruka", "あ".repeat(201)), null);
  assert.equal(validateEntry("haruka", "あ".repeat(200)), null);
});

test("dates are in Japan time", () => {
  assert.equal(todayJst(new Date("2026-11-01T15:30:00Z")), "2026-11-02");
  assert.equal(todayJst(new Date("2026-11-01T14:59:00Z")), "2026-11-01");
});
