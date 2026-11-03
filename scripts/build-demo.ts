// npm run demo:build — the static demo for GitHub Pages.
// `MIENAI_DEMO_EXPORT=1 next build` has written the pages to out/; this script adds what the browser shim answers
// instead of the API routes (from the committed fictional month only), the shim itself and .nojekyll, then checks
// that nothing private reached out/ (the API key, or anything only in data/local).
// 試し版 (GitHub Pages) の仕上げ: out/ に、API の代わりの答え (コミット済みの架空の1か月だけ)・shim・.nojekyll を足し、
// 鍵や data/local だけにある物が out/ に入っていないかを確かめる。

import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const root = process.cwd();
const out = path.join(root, "out");
if (!existsSync(path.join(out, "index.html"))) throw new Error("out/index.html がありません (先に MIENAI_DEMO_EXPORT=1 next build)");
if (process.env.MIENAI_SHOP_FILE) throw new Error("MIENAI_SHOP_FILE を外してください (試し版は架空のカフェだけ)");

// Only committed (public) data goes into the demo.
const dirty = execFileSync("git", ["status", "--porcelain", "--", "data/seed", "data/derived", ".claude/skills"], { encoding: "utf8" }).trim();
if (dirty) throw new Error(`コミットしていない変更があります (試し版は公開済みのデータだけで作ります):\n${dirty}`);

// Nothing from data/local: lines written in the app and the skill's history stay out.
const empty = mkdtempSync(path.join(os.tmpdir(), "mienai-demo-"));
process.env.MIENAI_DATA_DIR = empty;
process.env.MIENAI_SKILL_HISTORY_DIR = empty;
process.env.MIENAI_ALLOW_LIVE = "0";

const { listEntries } = await import("../src/lib/entries.ts");
const { loadMonth } = await import("../src/lib/month/load.ts");
const { shopConfig } = await import("../src/lib/shop-config.ts");
const { readSkill } = await import("../src/lib/monosashi/write-skill.ts");
const { readOwnerExamples } = await import("../src/lib/monosashi/examples.ts");
const { ownerSection } = await import("../src/lib/monosashi/owner-loop.ts");

const shop = shopConfig();
if (shop.real) throw new Error("試し版は架空のカフェだけです");
const skill = await readSkill();
const answers = JSON.parse(readFileSync(path.join(root, "data", "seed", "owner-answers.json"), "utf8")).answers;

// The same shapes the API routes return (src/app/api/*/route.ts), with Claude switched off.
const files: Record<string, unknown> = {
  entries: await listEntries(),
  staff: shop.staff.map(({ id, lang }) => ({ id, lang })),
  month: { ...(await loadMonth()), live: false },
  monosashi: { demoAnswers: answers, skill, live: false, real: false },
  examples: { examples: skill ? readOwnerExamples(skill.text).examples : [], section: skill ? ownerSection(skill.text) : "", canUndo: false },
};
const demoDir = path.join(out, "demo");
mkdirSync(demoDir, { recursive: true });
for (const [name, body] of Object.entries(files)) writeFileSync(path.join(demoDir, `${name}.json`), JSON.stringify(body));
copyFileSync(path.join(root, "scripts", "demo", "shim.js"), path.join(demoDir, "shim.js"));
writeFileSync(path.join(out, ".nojekyll"), "");

// --- privacy check: nothing private may be in out/ (prints counts only, never the values) ---
function walk(dir: string, keep: (f: string) => boolean, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const f = path.join(dir, name);
    if (statSync(f).isDirectory()) walk(f, keep, acc);
    else if (keep(f)) acc.push(f);
  }
  return acc;
}
function strings(v: unknown, acc: Set<string>): Set<string> {
  if (typeof v === "string") {
    if ([...v].length >= 12) acc.add(v);
  } else if (Array.isArray(v)) v.forEach((x) => strings(x, acc));
  else if (v && typeof v === "object") Object.values(v).forEach((x) => strings(x, acc));
  return acc;
}
const outText = walk(out, () => true)
  .map((f) => readFileSync(f, "utf8"))
  .join("\n");
const publicText = execFileSync("git", ["ls-files", "data", ".claude/skills"], { encoding: "utf8" })
  .split("\n")
  .filter(Boolean)
  .map((f) => readFileSync(path.join(root, f), "utf8"))
  .join("\n");
const local = path.join(root, "data", "local");
const privateOnly = new Set<string>();
if (existsSync(local)) {
  for (const f of walk(local, (f) => f.endsWith(".json") && !f.includes(`${path.sep}claude-config${path.sep}`))) {
    try {
      for (const s of strings(JSON.parse(readFileSync(f, "utf8")), new Set())) if (!publicText.includes(s)) privateOnly.add(s);
    } catch {
      // not JSON: skip
    }
  }
}
const leaked = [...privateOnly].filter((s) => outText.includes(s)).length;
const envFile = path.join(root, ".env.local");
const key = existsSync(envFile) ? (/^\s*ANTHROPIC_API_KEY\s*=\s*"?([^"\s]+)/m.exec(readFileSync(envFile, "utf8"))?.[1] ?? "") : "";
const keyLeaked = key.length > 10 && outText.includes(key);
console.log(`demo: ${Object.keys(files).length} files + shim in out/demo · private-only strings checked: ${privateOnly.size} · found in out/: ${leaked} · API key in out/: ${keyLeaked ? "YES" : "no"}`);
if (leaked || keyLeaked) {
  console.error("止めました: 手元だけの物が out/ に入っています。公開しないでください。");
  process.exit(1);
}
