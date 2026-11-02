// npm run facts [--days N]
// F3 + F4 on the fictional month with the real subagents, then the score against the hidden answer key.
// Writes data/derived/month.json (fictional, so it can be committed and shown without an API key).
// 架空の1か月を本物の手伝い役で通し、答えと比べる。結果は data/derived/month.json に書く。

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Entry } from "../src/lib/entries.ts";
import { askChecker, askExtractor } from "../src/lib/facts/claude-ask.ts";
import { runMonth } from "../src/lib/facts/extract.ts";
import { scoreAgainstLabels, type Label } from "../src/lib/facts/score.ts";
import { model } from "../src/lib/models.ts";

const root = process.cwd();
const all: Entry[] = JSON.parse(readFileSync(path.join(root, "data/seed/entries.json"), "utf8"));
const labels: Label[] = JSON.parse(readFileSync(path.join(root, "data/seed/labels.json"), "utf8"));
const daysArg = process.argv.indexOf("--days");
const limit = daysArg > 0 ? Number(process.argv[daysArg + 1]) : Infinity;
const days = [...new Set(all.map((e) => e.date))].sort().slice(0, limit);
const entries = all.filter((e) => days.includes(e.date));

const t0 = Date.now();
const run = await runMonth(entries, {
  extract: askExtractor,
  check: askChecker,
  concurrency: 3,
  onDay: (date, done, total) => console.log(`${date} done (${done}/${total}, ${Math.round((Date.now() - t0) / 1000)} s)`),
});
const seconds = Math.round((Date.now() - t0) / 1000);
const score = scoreAgainstLabels(run, labels.filter((l) => entries.some((e) => e.id === l.id)));

const out = {
  _note: "Fictional data. Facts extracted by the fact-extractor subagent and checked by plain code.",
  generatedAt: new Date().toISOString(),
  models: { extractor: model("extractor"), checker: model("checker") },
  seconds,
  costUsd: Number(run.costUsd.toFixed(4)),
  counts: run.counts,
  score,
  retries: Object.entries(run.attempts).filter(([, n]) => n > 1).map(([d]) => d),
  rejected: run.rejected,
  facts: run.facts,
  dropped: run.dropped,
};
mkdirSync(path.join(root, "data/derived"), { recursive: true });
writeFileSync(path.join(root, "data/derived/month.json"), JSON.stringify(out, null, 2) + "\n");
console.log(JSON.stringify({ seconds, costUsd: out.costUsd, counts: run.counts, retries: out.retries, rejected: run.rejected.length }, null, 1));
const part = (n: string, p: { expected: number; found: number; missed: string[]; wrong: string[] }) =>
  console.log(`${n}: found ${p.found}/${p.expected}, missed ${p.missed.length} [${p.missed.join(" ")}], wrong ${p.wrong.length} [${p.wrong.join(" ")}]`);
part("duplicates", score.duplicates);
part("self-only", score.selfOnly);
part("dropped", score.dropped);
console.log(`actor: ${score.actor.correct}/${score.actor.checked} correct, wrong [${score.actor.wrong.join(" ")}]`);
console.log(`for whom: ${score.forWhom.correct}/${score.forWhom.checked} correct, wrong [${score.forWhom.wrong.join(" ")}]`);
console.log(`all found: ${score.allFound}`);
