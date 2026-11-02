// npm run f8             → scored against the owner's own answers (private files in data/local/f8/)
// npm run f8 -- --demo   → the fictional café's skill from this repo and no owner answers: checks that both runs work
//                          and shows on how many scenes the skill changed Claude's answer (no agreement score)
// Options: --runs N (1-5, default 3)
//
// F8 ②: the twenty scenes (data/f8/scenarios.json) go to the fact extractor (Sonnet) twice — without the owner's
// yardstick skill and with it — N times each, in batches of 5 like a normal day, in the same shuffled order for both.
// Plain code counts how often each gives the owner's answer. The only difference between the two runs is the skill.
// Private inputs (data/local/ is ignored by git):
//   data/local/f8/owner-answers.json     the owner's answers to the ten yardstick questions → Claude writes the skill once (F2)
//   data/local/f8/scenario-answers.json  付ける / 付けない / 迷う for each of the twenty scenes
// Outputs: data/local/f8/result.json (everything, private) and data/derived/f8.json (numbers only, can be published).
// F8 ②: 20の場面を、物差しのスキルなし・ありの事実そろえ係に読ませ、店長と同じ答えの数をコードで数える。

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { agentDefinitions } from "../src/lib/agents.ts";
import { runStructured } from "../src/lib/claude.ts";
import { agreement, claudeAnswers, ownerAnswersError, scenarioEntries, scenariosError, type ClaudeAnswer, type Scenario } from "../src/lib/f8/compare.ts";
import type { Entry } from "../src/lib/entries.ts";
import { extractBatch, ExtractError, type Ask } from "../src/lib/facts/extract.ts";
import { EXTRACT_SCHEMA, quotesYardstick, SKILL_QUOTE_PROMPT, SKILL_QUOTE_SCHEMA, withYardstick } from "../src/lib/facts/prompt.ts";
import { model } from "../src/lib/models.ts";
import type { Verdict } from "../src/lib/monosashi/lint.ts";
import { SKILL_NAME } from "../src/lib/shop.ts";

const root = process.cwd();
const argv = process.argv.slice(2);
const demo = argv.includes("--demo");
const runsAt = argv.indexOf("--runs");
const RUNS = runsAt >= 0 ? Number(argv[runsAt + 1]) : 3;
if (!Number.isInteger(RUNS) || RUNS < 1 || RUNS > 5) throw new Error("--runs は 1〜5 にしてください");
const BATCH = 5;
const CONDS = ["without", "with"] as const;
type Cond = (typeof CONDS)[number];

const { scenarios } = JSON.parse(readFileSync(path.join(root, "data/f8/scenarios.json"), "utf8")) as { scenarios: Scenario[] };
const bad = scenariosError(scenarios);
if (bad) throw new Error(bad);

const local = path.join(root, "data/local/f8");
let owner: Record<string, Verdict> | null = null;
let skillSource = path.join(root, ".claude/skills", SKILL_NAME, "SKILL.md");
if (!demo) {
  const raw = JSON.parse(readFileSync(path.join(local, "scenario-answers.json"), "utf8"));
  const err = ownerAnswersError(raw, scenarios);
  if (err) throw new Error(err);
  owner = raw as Record<string, Verdict>;
  skillSource = path.join(local, "skills", SKILL_NAME, "SKILL.md");
  if (!existsSync(skillSource)) {
    // F2 once, the same path as the app: the owner's ten answers → a draft by Claude → checked by code → SKILL.md
    const { writeSkill } = await import("../src/lib/monosashi/write-skill.ts");
    const { generateWithClaude } = await import("../src/lib/monosashi/claude-writer.ts");
    const answers = JSON.parse(readFileSync(path.join(local, "owner-answers.json"), "utf8"));
    const written = await writeSkill(answers, { generate: generateWithClaude, root: path.join(local, "skills") });
    console.log(`the owner's skill was written (attempts: ${written.attempts}, $${written.costUsd.toFixed(3)})`);
  }
}

// A folder outside this repository, holding only the skill under test, so nothing else can be picked up.
const project = path.join(os.tmpdir(), "mienai-ganbari-f8");
rmSync(project, { recursive: true, force: true });
mkdirSync(path.join(project, ".claude/skills", SKILL_NAME), { recursive: true });
cpSync(skillSource, path.join(project, ".claude/skills", SKILL_NAME, "SKILL.md"));

const defs = agentDefinitions();
const skillText = readFileSync(skillSource, "utf8");
// The only difference between the two runs: "with" turns the skill on and invokes it at the top of every prompt.
const sessionFor = (cond: Cond) =>
  cond === "with"
    ? { settingSources: ["project" as const], skills: [SKILL_NAME], wrap: withYardstick }
    : { settingSources: [], skills: undefined, wrap: (p: string) => p };
const askFor = (cond: Cond): Ask => async ({ prompt }) => {
  const s = sessionFor(cond);
  const r = await runStructured<unknown>({
    prompt: s.wrap(prompt),
    schema: EXTRACT_SCHEMA,
    agent: "fact-extractor",
    agents: defs,
    settingSources: s.settingSources,
    ...(s.skills ? { skills: s.skills } : {}),
    cwd: project,
    maxBudgetUsd: 0.5,
  });
  return { raw: r.data, costUsd: r.costUsd };
};

// Proof before measuring: "with" must quote the yardstick's first 付けない rule word for word, "without" must not have it.
const quotes = {} as Record<Cond, string>;
for (const cond of ["without", "with"] as const) {
  const s = sessionFor(cond);
  const r = await runStructured<{ quote: string }>({
    prompt: s.wrap(SKILL_QUOTE_PROMPT),
    schema: SKILL_QUOTE_SCHEMA,
    agent: "fact-extractor",
    agents: defs,
    settingSources: s.settingSources,
    ...(s.skills ? { skills: s.skills } : {}),
    cwd: project,
    maxBudgetUsd: 0.2,
  });
  quotes[cond] = r.data.quote;
}
if (!quotesYardstick(quotes.with, skillText)) throw new Error(`「あり」の係が物差しを引用できません (${quotes.with})`);
if (quotesYardstick(quotes.without, skillText)) throw new Error("「なし」の係が物差しを引用できました (スキルが入っています)");
console.log(`yardstick check: with = quoted word for word / without = ${JSON.stringify(quotes.without).slice(0, 40)}`);

function shuffled<T>(items: T[], seed: number): T[] {
  let a = seed >>> 0;
  const rand = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const entries = scenarioEntries(scenarios);
const answers: Record<Cond, Record<string, ClaudeAnswer>[]> = { without: [], with: [] };
const reasons: Record<Cond, Record<string, string>[]> = { without: [], with: [] };
let costUsd = 0;
const failedBatches: { run: number; cond: Cond; scenes: string[]; problems: string[] }[] = [];
const t0 = Date.now();
for (let r = 0; r < RUNS; r++) {
  const order = shuffled(entries, 20261120 + r);
  const batches: Entry[][] = [];
  for (let i = 0; i < order.length; i += BATCH) batches.push(order.slice(i, i + BATCH));
  for (const cond of CONDS) {
    // A batch that still fails the code checks after 3 tries is not dropped from the score: its scenes count as
    // not agreeing with the owner (claudeAnswers marks them 取り違え), so a failure can never help either side.
    const outs = await Promise.all(
      batches.map(async (b) => {
        try {
          return await extractBatch(b, askFor(cond), 3);
        } catch (e) {
          if (!(e instanceof ExtractError)) throw e;
          failedBatches.push({ run: r + 1, cond, scenes: b.map((x) => x.id), problems: e.problems });
          return null;
        }
      }),
    );
    const ok = outs.filter((o) => o !== null);
    const facts = ok.flatMap((o) => o.extraction.facts);
    const dropped = ok.flatMap((o) => o.extraction.dropped);
    costUsd += ok.reduce((n, o) => n + o.costUsd, 0);
    answers[cond].push(claudeAnswers({ facts, dropped }, scenarios));
    reasons[cond].push(Object.fromEntries([...facts.map((f) => [f.entryId, f.reason]), ...dropped.map((d) => [d.entryId, `(捨てた: ${d.reason})`])]));
    console.log(`run ${r + 1}/${RUNS} ${cond}: done`);
  }
}
const seconds = Math.round((Date.now() - t0) / 1000);


// How often the skill changed Claude's answer (same run, same order)
const changed = answers.with.map((w, r) => scenarios.filter((s) => w[s.id] !== answers.without[r][s.id]).length);
const base = { generatedAt: new Date().toISOString(), model: model("extractor"), scenes: scenarios.length, runs: RUNS, seconds, costUsd: Number(costUsd.toFixed(4)), yardstickQuoted: { with: true, without: false }, changedBySkill: changed, failedBatches: failedBatches.map((f) => ({ run: f.run, cond: f.cond, scenes: f.scenes.length })) };

mkdirSync(local, { recursive: true });
if (!owner) {
  writeFileSync(path.join(local, "demo.json"), JSON.stringify({ ...base, demo: true, answers, reasons }, null, 2) + "\n");
  console.log(JSON.stringify({ ...base, demo: true }));
  for (const s of scenarios) console.log(`${s.id} ${s.category.padEnd(6)} without: ${answers.without.map((a) => a[s.id]).join("/")}  with: ${answers.with.map((a) => a[s.id]).join("/")}`);
} else {
  const ownerAnswers = owner;
  const per = Object.fromEntries(CONDS.map((c) => [c, answers[c].map((a) => agreement(ownerAnswers, a, scenarios))])) as Record<Cond, ReturnType<typeof agreement>[]>;
  const numbers = Object.fromEntries(
    CONDS.map((c) => [
      c,
      {
        same: per[c].map((a) => a.same),
        mean: Number((per[c].reduce((n, a) => n + a.same, 0) / RUNS).toFixed(2)),
        byCategory: Object.fromEntries(Object.keys(per[c][0].byCategory).map((k) => [k, per[c].map((a) => a.byCategory[k as keyof typeof a.byCategory].same)])),
      },
    ]),
  );
  writeFileSync(path.join(local, "result.json"), JSON.stringify({ ...base, owner, answers, reasons, agreement: per, failedBatchDetails: failedBatches }, null, 2) + "\n");
  const pub = { _note: "F8 ②: how often the fact extractor gave the owner's own answer on twenty made-up scenes, without and with the owner's yardstick skill. The owner's answers and the skill are private; only the counts are published.", ...base, ...numbers };
  writeFileSync(path.join(root, "data/derived/f8.json"), JSON.stringify(pub, null, 2) + "\n");
  console.log(JSON.stringify({ seconds, costUsd: base.costUsd, without: numbers.without.same, with: numbers.with.same, changedBySkill: changed, failedBatches: base.failedBatches }));
}
