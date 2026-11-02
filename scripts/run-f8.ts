// npm run f8                 → the twenty scenes, scored against the owner's own answers (private files in data/local/f8/)
// npm run f8 -- --examples   → the same twenty scenes, plus a run whose skill also carries the owner's answers on the
//                              other half of the scenes as examples (two folds, see twoFolds in src/lib/f8/compare.ts)
// npm run f8 -- --round2     → twelve new scenes the owner answered later (data/f8/scenarios-round2.json): the skill alone,
//                              the skill plus the owner's twenty earlier answers as examples, the skill plus the owner's
//                              own one-line reason, and both
// npm run f8 -- --demo       → the fictional café's skill from this repo and no owner answers: checks that both runs work
//                              and shows on how many scenes the skill changed Claude's answer (no agreement score)
// Options: --runs N (1-5, default 3)
//
// F8 ②: the scenes go to the fact extractor (Sonnet) without the owner's yardstick skill and with each version of it,
// N times each, in batches of 5 like a normal day, in the same shuffled order for every version being compared.
// Plain code counts how often each gives the owner's answer. Apart from the skill's text, the runs are the same.
// Private inputs (data/local/ is ignored by git):
//   data/local/f8/owner-answers.json             the owner's answers to the ten yardstick questions → Claude writes the skill once (F2)
//   data/local/f8/scenario-answers.json          付ける / 付けない / 迷う for each of the twenty scenes
//   data/local/f8/scenario-answers-round2.json   the same for the twelve new scenes (--round2)
//   data/local/f8/owner-reason.json              { "notes": ["the owner's own short reason", …] } (--round2)
// Outputs: data/local/f8/result(-examples|-round2).json (everything, private) and data/derived/f8(…).json (numbers only).
// F8 ②: 場面を、物差しのスキルなし・ありの事実そろえ係に読ませ、店長と同じ答えの数をコードで数える。
// --examples は店長の例を「測る場面と別の半分」からだけ入れる。--round2 は後から答えた新しい場面で、例・理由・両方を測る。

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { agentDefinitions } from "../src/lib/agents.ts";
import { runStructured } from "../src/lib/claude.ts";
import { agreement, claudeAnswers, ownerAnswersError, scenarioEntries, scenariosError, twoFolds, type ClaudeAnswer, type Scenario } from "../src/lib/f8/compare.ts";
import type { Entry } from "../src/lib/entries.ts";
import { extractBatch, ExtractError, type Ask } from "../src/lib/facts/extract.ts";
import { EXTRACT_SCHEMA, quotesYardstick, SKILL_QUOTE_PROMPT, SKILL_QUOTE_SCHEMA, withYardstick } from "../src/lib/facts/prompt.ts";
import type { Dropped, Fact } from "../src/lib/facts/types.ts";
import { model } from "../src/lib/models.ts";
import { addOwnerExamples, type OwnerExample } from "../src/lib/monosashi/examples.ts";
import type { Verdict } from "../src/lib/monosashi/lint.ts";
import { SKILL_NAME } from "../src/lib/shop.ts";

const root = process.cwd();
const argv = process.argv.slice(2);
const demo = argv.includes("--demo");
const mode = argv.includes("--round2") ? "round2" : argv.includes("--examples") ? "examples" : "plain";
if (demo && mode !== "plain") throw new Error("--examples と --round2 は店長の答えがある時だけ使えます (--demo とは一緒に使えません)");
const runsAt = argv.indexOf("--runs");
const RUNS = runsAt >= 0 ? Number(argv[runsAt + 1]) : 3;
if (!Number.isInteger(RUNS) || RUNS < 1 || RUNS > 5) throw new Error("--runs は 1〜5 にしてください");
const BATCH = 5;

// The versions of the skill being compared ("without" = no skill at all).
type Arm = "without" | "with" | "examples" | "reason" | "both";
const ARMS: Arm[] = mode === "round2" ? ["without", "with", "examples", "reason", "both"] : mode === "examples" ? ["without", "with", "examples"] : ["without", "with"];

const readJson = (rel: string) => JSON.parse(readFileSync(path.join(root, rel), "utf8"));
const loadScenes = (rel: string): Scenario[] => {
  const { scenarios } = readJson(rel) as { scenarios: Scenario[] };
  const bad = scenariosError(scenarios);
  if (bad) throw new Error(`${rel}: ${bad}`);
  return scenarios;
};
const loadAnswers = (rel: string, scenes: Scenario[]): Record<string, Verdict> => {
  const raw = readJson(rel);
  const err = ownerAnswersError(raw, scenes);
  if (err) throw new Error(`${rel}: ${err}`);
  return raw as Record<string, Verdict>;
};

const round1 = loadScenes("data/f8/scenarios.json");
const scenarios = mode === "round2" ? loadScenes("data/f8/scenarios-round2.json") : round1;
if (mode === "round2" && scenarios.some((s) => round1.some((r) => r.id === s.id || r.text === s.text))) throw new Error("新しい場面に前の場面と同じ物があります");

let owner: Record<string, Verdict> | null = null; // the owner's answers on the scenes being tested
let round1Answers: Record<string, Verdict> = {}; // the owner's answers on the twenty scenes (the source of examples)
let notes: string[] = [];
let skillSource = path.join(root, ".claude/skills", SKILL_NAME, "SKILL.md");
if (!demo) {
  round1Answers = loadAnswers("data/local/f8/scenario-answers.json", round1);
  owner = mode === "round2" ? loadAnswers("data/local/f8/scenario-answers-round2.json", scenarios) : round1Answers;
  if (mode === "round2") {
    notes = (readJson("data/local/f8/owner-reason.json") as { notes: string[] }).notes;
    if (!Array.isArray(notes) || notes.length === 0) throw new Error("data/local/f8/owner-reason.json に notes がありません");
  }
  skillSource = path.join(root, "data/local/f8/skills", SKILL_NAME, "SKILL.md");
  if (!existsSync(skillSource)) {
    // F2 once, the same path as the app: the owner's ten answers → a draft by Claude → checked by code → SKILL.md
    const { writeSkill } = await import("../src/lib/monosashi/write-skill.ts");
    const { generateWithClaude } = await import("../src/lib/monosashi/claude-writer.ts");
    const answers = readJson("data/local/f8/owner-answers.json");
    const written = await writeSkill(answers, { generate: generateWithClaude, root: path.join(root, "data/local/f8/skills") });
    console.log(`the owner's skill was written (attempts: ${written.attempts}, $${written.costUsd.toFixed(3)})`);
  }
}
const skillText = readFileSync(skillSource, "utf8");

// plain: one fold holding every scene. --examples: two folds, each fold's examples taken from the other half only, so a
// scene is never tested with its own answer in the skill. --round2: the new scenes, with examples from all twenty earlier
// scenes. Gossip scenes never become examples: their words must not enter the skill.
const folds: { test: Scenario[]; examples: Scenario[] }[] =
  mode === "examples" ? twoFolds(round1) : mode === "round2" ? [{ test: scenarios, examples: round1.filter((s) => s.category !== "gossip") }] : [{ test: scenarios, examples: [] }];
const examplesOf = (f: { examples: Scenario[] }): OwnerExample[] => f.examples.map((s) => ({ line: s.text, verdict: round1Answers[s.id] }));

// Folders outside this repository, each holding only the skill under test, so nothing else can be picked up.
function projectWith(name: string, text: string): string {
  const dir = path.join(os.tmpdir(), name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(path.join(dir, ".claude/skills", SKILL_NAME), { recursive: true });
  writeFileSync(path.join(dir, ".claude/skills", SKILL_NAME, "SKILL.md"), text);
  return dir;
}
const project = projectWith("mienai-ganbari-f8", skillText);
const skillOf = (arm: Arm, f: (typeof folds)[number]): string | null =>
  arm === "without" ? null
  : arm === "with" ? skillText
  : addOwnerExamples(skillText, { examples: arm === "reason" ? [] : examplesOf(f), notes: arm === "examples" ? [] : notes }, SKILL_NAME);
const projects = new Map<string, string>();
for (const arm of ARMS)
  folds.forEach((f, k) => {
    const text = skillOf(arm, f);
    projects.set(`${arm}/${k}`, text === null || text === skillText ? project : projectWith(`mienai-ganbari-f8-${arm}-fold${k + 1}`, text));
  });

const defs = agentDefinitions();
// Every arm with a skill turns it on and invokes it at the top of every prompt; "without" loads no settings at all.
const sessionFor = (arm: Arm, fold: number) =>
  arm === "without"
    ? { settingSources: [], skills: undefined, wrap: (p: string) => p, cwd: project }
    : { settingSources: ["project" as const], skills: [SKILL_NAME], wrap: withYardstick, cwd: projects.get(`${arm}/${fold}`)! };
const askFor = (arm: Arm, fold: number): Ask => async ({ prompt }) => {
  const s = sessionFor(arm, fold);
  const r = await runStructured<unknown>({
    prompt: s.wrap(prompt),
    schema: EXTRACT_SCHEMA,
    agent: "fact-extractor",
    agents: defs,
    settingSources: s.settingSources,
    ...(s.skills ? { skills: s.skills } : {}),
    cwd: s.cwd,
    maxBudgetUsd: 0.5,
  });
  return { raw: r.data, costUsd: r.costUsd };
};

// Proof before measuring: every arm with a skill must quote the yardstick's first 付けない rule word for word (in every
// fold), and "without" must not have it.
const checks = ARMS.flatMap((arm): { arm: Arm; fold: number }[] => (arm === "without" || arm === "with" ? [{ arm, fold: 0 }] : folds.map((_, k) => ({ arm, fold: k }))));
let quoteWithout = "";
for (const c of checks) {
  const s = sessionFor(c.arm, c.fold);
  const r = await runStructured<{ quote: string }>({
    prompt: s.wrap(SKILL_QUOTE_PROMPT),
    schema: SKILL_QUOTE_SCHEMA,
    agent: "fact-extractor",
    agents: defs,
    settingSources: s.settingSources,
    ...(s.skills ? { skills: s.skills } : {}),
    cwd: s.cwd,
    maxBudgetUsd: 0.2,
  });
  const quoted = quotesYardstick(r.data.quote, skillText);
  if (c.arm === "without" && quoted) throw new Error("「なし」の係が物差しを引用できました (スキルが入っています)");
  if (c.arm !== "without" && !quoted) throw new Error(`「${c.arm}」(fold ${c.fold + 1}) の係が物差しを引用できません (${r.data.quote})`);
  if (c.arm === "without") quoteWithout = r.data.quote;
}
console.log(`yardstick check: ${checks.length - 1} run(s) with a skill quoted it word for word / without = ${JSON.stringify(quoteWithout).slice(0, 40)}`);

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

// At most 8 model calls at a time: each one runs as its own Claude Code process.
async function inPool(tasks: (() => Promise<void>)[], size = 8): Promise<void> {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(size, tasks.length) }, async () => {
    while (next < tasks.length) await tasks[next++]();
  }));
}

const answers = Object.fromEntries(ARMS.map((a) => [a, []])) as unknown as Record<Arm, Record<string, ClaudeAnswer>[]>;
const reasons = Object.fromEntries(ARMS.map((a) => [a, []])) as unknown as Record<Arm, Record<string, string>[]>;
let costUsd = 0;
const failedBatches: { run: number; arm: Arm; scenes: string[]; problems: string[] }[] = [];
const t0 = Date.now();
for (let r = 0; r < RUNS; r++) {
  const got = Object.fromEntries(ARMS.map((a) => [a, { facts: [], dropped: [] }])) as unknown as Record<Arm, { facts: Fact[]; dropped: Dropped[] }>;
  for (const [k, fold] of folds.entries()) {
    // The same shuffled order and the same batches for every arm in this run and fold.
    const order = shuffled(scenarioEntries(fold.test), 20261120 + r + 100 * k + (mode === "round2" ? 1000 : 0));
    const batches: Entry[][] = [];
    for (let i = 0; i < order.length; i += BATCH) batches.push(order.slice(i, i + BATCH));
    await inPool(
      ARMS.flatMap((arm) =>
        batches.map((b) => async () => {
          // A batch that still fails the code checks after 3 tries is not dropped from the score: its scenes count as
          // not agreeing with the owner (claudeAnswers marks them 取り違え), so a failure can never help either side.
          try {
            const o = await extractBatch(b, askFor(arm, k), 3);
            got[arm].facts.push(...o.extraction.facts);
            got[arm].dropped.push(...o.extraction.dropped);
            costUsd += o.costUsd;
          } catch (e) {
            if (!(e instanceof ExtractError)) throw e;
            failedBatches.push({ run: r + 1, arm, scenes: b.map((x) => x.id), problems: e.problems });
          }
        }),
      ),
    );
  }
  for (const arm of ARMS) {
    answers[arm].push(claudeAnswers(got[arm], scenarios));
    reasons[arm].push(Object.fromEntries([...got[arm].facts.map((f) => [f.entryId, f.reason]), ...got[arm].dropped.map((d) => [d.entryId, `(捨てた: ${d.reason})`])]));
  }
  console.log(`run ${r + 1}/${RUNS}: done`);
}
const seconds = Math.round((Date.now() - t0) / 1000);

// How often one arm's answer differed from another's (same run, same batches)
const changed = (a: Arm, b: Arm) => answers[a].map((x, r) => scenarios.filter((s) => x[s.id] !== answers[b][r][s.id]).length);
const has = (a: Arm) => ARMS.includes(a);
const base = {
  generatedAt: new Date().toISOString(),
  model: model("extractor"),
  scenes: scenarios.length,
  runs: RUNS,
  seconds,
  costUsd: Number(costUsd.toFixed(4)),
  yardstickQuoted: Object.fromEntries(checks.map((c) => [`${c.arm}${folds.length > 1 && c.arm !== "without" && c.arm !== "with" ? ` (fold ${c.fold + 1})` : ""}`, c.arm !== "without"])),
  changedBySkill: changed("with", "without"),
  ...(has("examples") ? { changedByExamples: changed("examples", "with") } : {}),
  ...(has("reason") ? { changedByReason: changed("reason", "with") } : {}),
  ...(has("both") ? { changedByBoth: changed("both", "with") } : {}),
  ...(mode !== "plain" ? { folds: folds.map((f) => ({ tested: f.test.map((s) => s.id), [mode === "examples" ? "examplesFromOtherHalf" : "examplesFromFirstTwenty"]: f.examples.length })) } : {}),
  ...(mode === "round2" ? { ownerNotes: notes.length } : {}),
  failedBatches: failedBatches.map((f) => ({ run: f.run, arm: f.arm, scenes: f.scenes.length })),
};

mkdirSync(path.join(root, "data/local/f8"), { recursive: true });
if (!owner) {
  writeFileSync(path.join(root, "data/local/f8/demo.json"), JSON.stringify({ ...base, demo: true, answers, reasons }, null, 2) + "\n");
  console.log(JSON.stringify({ ...base, demo: true }));
  for (const s of scenarios) console.log(`${s.id} ${s.category.padEnd(6)} without: ${answers.without.map((a) => a[s.id]).join("/")}  with: ${answers.with.map((a) => a[s.id]).join("/")}`);
} else {
  const ownerAnswers = owner;
  const per = Object.fromEntries(ARMS.map((a) => [a, answers[a].map((x) => agreement(ownerAnswers, x, scenarios))])) as Record<Arm, ReturnType<typeof agreement>[]>;
  const numbers = Object.fromEntries(
    ARMS.map((a) => [
      a,
      {
        same: per[a].map((x) => x.same),
        mean: Number((per[a].reduce((n, x) => n + x.same, 0) / RUNS).toFixed(2)),
        byCategory: Object.fromEntries(Object.keys(per[a][0].byCategory).map((k) => [k, per[a].map((x) => x.byCategory[k as keyof typeof x.byCategory].same)])),
      },
    ]),
  );
  const suffix = mode === "plain" ? "" : `-${mode}`;
  writeFileSync(path.join(root, `data/local/f8/result${suffix}.json`), JSON.stringify({ ...base, owner, notes, answers, reasons, agreement: per, failedBatchDetails: failedBatches }, null, 2) + "\n");
  const note = {
    plain: "F8 ②: how often the fact extractor gave the owner's own answer on twenty made-up scenes, without and with the owner's yardstick skill. The owner's answers and the skill are private; only the counts are published.",
    examples: "F8 ②, second measurement: the same twenty scenes, also with the owner's skill plus the owner's own answers as examples. Two folds: odd-numbered scenes were tested with the even ones as examples and the other way round, so no scene was tested with its own answer in the skill; gossip scenes were tested but never used as examples. The owner's answers and the skill are private; only the counts are published.",
    round2: "F8 ② round 2: twelve new scenes the owner answered after the first twenty. Compared: no skill, the owner's skill, the skill plus the owner's twenty earlier answers as examples (gossip scenes left out), the skill plus the owner's own one-line reason for the scenes they did not reward, and both. The owner's answers, reason and skill are private; only the counts are published.",
  }[mode];
  writeFileSync(path.join(root, `data/derived/f8${suffix}.json`), JSON.stringify({ _note: note, ...base, ...numbers }, null, 2) + "\n");
  console.log(JSON.stringify({ seconds, costUsd: base.costUsd, ...Object.fromEntries(ARMS.map((a) => [a, numbers[a].same])), changedBySkill: base.changedBySkill, failedBatches: base.failedBatches }));
}
