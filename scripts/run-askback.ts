// npm run askback — F10 measured on the fictional month with the real asker subagent (Haiku):
// ① does it ask only about the vague lines? (the 9 vague lines vs 18 gossip lines and 18 clear lines)
// ② when the writers answer (fictional answers, written beforehand in each writer's language), do the vague lines
//    become facts? The fact extractor (with the owner's yardstick skill, as in npm run facts) reads line + answer.
// Writes data/derived/askback.json (fictional, so it can be committed).
// 架空の月で F10 を測る: ① あいまいな9行にだけ聞き返すか (うわさ18行・はっきりした18行と比べる)
// ② 架空の答えを足すと、あいまいな9行が事実になるか (物差しのスキルつきの事実そろえ係で読む)。

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Entry } from "../src/lib/entries.ts";
import { buildAskPrompt, readAskReply } from "../src/lib/askback/ask.ts";
import { askAsker } from "../src/lib/askback/claude-ask.ts";
import { askExtractor, askYardstickQuote } from "../src/lib/facts/claude-ask.ts";
import { extractBatch } from "../src/lib/facts/extract.ts";
import { quotesYardstick } from "../src/lib/facts/prompt.ts";
import type { Label } from "../src/lib/facts/score.ts";
import { model } from "../src/lib/models.ts";
import { SKILL_NAME } from "../src/lib/shop.ts";

const root = process.cwd();
const all: Entry[] = JSON.parse(readFileSync(path.join(root, "data/seed/entries.json"), "utf8"));
const labels: Label[] = JSON.parse(readFileSync(path.join(root, "data/seed/labels.json"), "utf8"));
const kindOf = new Map(labels.map((l) => [l.id, l.kind]));
const pickKind = (k: string, n: number) => all.filter((e) => kindOf.get(e.id) === k).slice(0, n);
const groups: Record<string, Entry[]> = {
  vague: pickKind("vague", 9),
  gossip: pickKind("gossip", 18),
  clear: [...pickKind("help", 9), ...pickKind("self", 9)],
};

// The fictional writers' answers to the question back (written beforehand, in each writer's language).
const ANSWERS: Record<string, string> = {
  "seed-053": "ミンさんの、倉庫の片付けです。",
  "seed-105": "ランさんが、ランチの時に皿洗いを全部やってくれた。",
  "seed-119": "プトリさんが、開店前に窓をふいてくれた。",
  "seed-131": "ミンさんが、レジが混んだ時に袋づめを手伝ってくれた。",
  "seed-135": "Haruka đã dạy Lan cách pha cà phê.",
  "seed-147": "けんじさんが、冷蔵庫の中を整理していた。",
  "seed-157": "Minh membersihkan dapur setelah tutup.",
  "seed-161": "Ayane đã giúp tôi rửa chén.",
  "seed-168": "そうたさんの、床のモップがけです。",
};

const t0 = Date.now();
let cost = 0;
type Row = { id: string; group: string; lang: string; text: string; asked: boolean; question: string; why: string };
const rows: Row[] = [];
const queue = Object.entries(groups).flatMap(([group, list]) => list.map((e) => ({ group, e })));
let next = 0;
async function worker() {
  while (next < queue.length) {
    const { group, e } = queue[next++];
    try {
      const out = await askAsker({ prompt: buildAskPrompt(e) });
      cost += out.costUsd;
      const r = readAskReply(out.raw, e.lang);
      rows.push({ id: e.id, group, lang: e.lang, text: e.text, asked: r.ask, question: r.ask ? r.question : "", why: r.ask ? "" : r.why });
    } catch (err) {
      rows.push({ id: e.id, group, lang: e.lang, text: e.text, asked: false, question: "", why: `error: ${String(err).slice(0, 80)}` });
    }
    console.log(`${rows.length}/${queue.length} ${group} ${e.id}`);
  }
}
await Promise.all(Array.from({ length: 4 }, worker));
const askSeconds = Math.round((Date.now() - t0) / 1000);
rows.sort((a, b) => a.id.localeCompare(b.id));
const askCost = cost;
const count = (g: string) => ({ lines: groups[g].length, asked: rows.filter((r) => r.group === g && r.asked).length });

// ② the vague lines with the fictional answers, read by the fact extractor with the yardstick (proof first)
const skillText = readFileSync(path.join(root, ".claude/skills", SKILL_NAME, "SKILL.md"), "utf8");
const quote = await askYardstickQuote();
if (!quotesYardstick(quote.quote, skillText)) throw new Error(`the fact extractor could not quote the yardstick skill (${quote.quote})`);
cost += quote.costUsd;
const now = new Date().toISOString();
const answered: Entry[] = groups.vague.map((e) => {
  const asked = rows.find((r) => r.id === e.id);
  const question = asked?.asked ? asked.question : "(not asked)";
  return { ...e, clarification: { question, askedAt: now, answer: ANSWERS[e.id], answeredAt: now } };
});
const before = await extractBatch(groups.vague, askExtractor);
const after = await extractBatch(answered, askExtractor);
cost += before.costUsd + after.costUsd;
const kinds = (x: typeof before) => ({ facts: x.extraction.facts.length, dropped: x.extraction.dropped.length });

const out = {
  measuredAt: new Date().toISOString(),
  models: { asker: model("asker"), extractor: model("extractor") },
  askedBack: { vague: count("vague"), gossip: count("gossip"), clear: count("clear"), seconds: askSeconds, costUsd: +askCost.toFixed(4), costPerLineUsd: +(askCost / queue.length).toFixed(5) },
  vagueLines: {
    withoutAnswers: kinds(before),
    withFictionalAnswers: kinds(after),
    facts: after.extraction.facts.map((f) => ({ entryId: f.entryId, kind: f.kind, actorId: f.actorId, forIds: f.forIds, action: f.action, verdict: f.verdict })),
  },
  questions: rows.filter((r) => r.asked).map(({ id, lang, text, question }) => ({ id, lang, line: text, question, answer: ANSWERS[id] ?? "" })),
  notAsked: rows.filter((r) => !r.asked).map(({ id, group, why }) => ({ id, group, why })),
  totalCostUsd: +cost.toFixed(4),
};
mkdirSync(path.join(root, "data/derived"), { recursive: true });
writeFileSync(path.join(root, "data/derived/askback.json"), JSON.stringify(out, null, 2) + "\n");
console.log(JSON.stringify({ askedBack: out.askedBack, vagueLines: { withoutAnswers: out.vagueLines.withoutAnswers, withFictionalAnswers: out.vagueLines.withFictionalAnswers }, totalCostUsd: out.totalCostUsd }, null, 1));
