// npm run letters
// F5 → F6 → F7 on the fictional month: the fictional owner's decision (data/seed/owner-decision.json) is split
// to the yen by code, then the letter-writer subagent writes one letter per person in their language.
// Writes data/derived/letters.json (fictional, so it can be committed and shown without an API key).
// 架空の店長の決めを1円まで分け、手紙の係が一人ずつ母語で手紙を書く。結果は data/derived/letters.json に書く。

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { askLetterWriter } from "../src/lib/letters/claude-letter.ts";
import { runLetters } from "../src/lib/letters/run.ts";
import { loadMonth } from "../src/lib/month/load.ts";

const root = process.cwd();
const { view, decision } = await loadMonth(root);
const run = await runLetters(view, decision, askLetterWriter, 3);

const out = {
  _note: "Fictional data. Amounts are calculated by plain code (F6); letters are written by the letter-writer subagent and checked by plain code (F7).",
  generatedAt: new Date().toISOString(),
  ...run,
};
mkdirSync(path.join(root, "data/derived"), { recursive: true });
writeFileSync(path.join(root, "data/derived/letters.json"), JSON.stringify(out, null, 2) + "\n");
const passed = run.letters.filter((l) => l.letter).length;
console.log(JSON.stringify({ seconds: run.seconds, costUsd: run.costUsd, passed, of: run.letters.length, retried: run.letters.filter((l) => l.attempts > 1).map((l) => l.personId) }));
for (const l of run.letters) if (!l.letter) console.log(`FAILED ${l.personId}: ${l.problems.join(" / ")}`);
