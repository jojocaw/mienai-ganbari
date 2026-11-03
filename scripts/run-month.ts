// npm run month [--month YYYY-MM]
// A real shop's month: the shop's own daily lines (data/local/entries.json) → facts by the fact-extractor subagent,
// checked by plain code → data/local/month.json, which /month reads. Real data, so it stays in data/local and is
// never committed. There is no hidden answer key for a real shop, so there is no score.
// 本物のお店の1か月: 手元の1行 → 事実の係 → プログラムの確かめ → data/local/month.json (/month が読む)。
// 本物のデータなので data/local に置き、公開しない。答え合わせの答えは無いので、点数は出さない。

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { localDataDir, readLocalEntries } from "../src/lib/entries.ts";
import { askChecker, askExtractor, askYardstickQuote } from "../src/lib/facts/claude-ask.ts";
import { runMonth } from "../src/lib/facts/extract.ts";
import { quotesYardstick } from "../src/lib/facts/prompt.ts";
import { model } from "../src/lib/models.ts";
import { localMonthFile, pickMonth } from "../src/lib/month/local.ts";
import { skillFile } from "../src/lib/monosashi/write-skill.ts";
import { shopConfig } from "../src/lib/shop-config.ts";

function stop(message: string): never {
  console.error(message);
  process.exit(1);
}

const shop = shopConfig();
if (!shop.real) stop("お店の名簿のファイル (MIENAI_SHOP_FILE) がありません。架空のカフェは npm run facts で通します。README の「自分のお店で使う」を見てください。");

const monthArg = process.argv.indexOf("--month");
const { month, entries } = pickMonth(await readLocalEntries(), monthArg > 0 ? process.argv[monthArg + 1] : undefined);
if (entries.length === 0) stop(`${month} の1行はまだありません。`);
console.log(`${shop.name} ${month}: ${entries.length} 行`);

// Proof first: the extractor must quote the shop's own yardstick skill word for word.
let skillText = "";
try {
  skillText = readFileSync(skillFile(), "utf8");
} catch {
  stop("物差しのスキルがまだありません。先に /monosashi で10問に答えてください。");
}
const quote = await askYardstickQuote();
if (!quotesYardstick(quote.quote, skillText)) throw new Error(`the fact extractor could not quote the yardstick skill (${quote.quote})`);
console.log("yardstick check: quoted word for word");

const t0 = Date.now();
const run = await runMonth(entries, {
  extract: askExtractor,
  check: askChecker,
  concurrency: 3,
  onDay: (date, done, total) => console.log(`${date} done (${done}/${total}, ${Math.round((Date.now() - t0) / 1000)} s)`),
});
const seconds = Math.round((Date.now() - t0) / 1000);

const out = {
  _note: "Real shop data. Kept in data/local and never committed. No answer key, so no score.",
  generatedAt: new Date().toISOString(),
  month,
  models: { extractor: model("extractor"), checker: model("checker") },
  yardstickQuoted: true,
  seconds,
  costUsd: Number(run.costUsd.toFixed(4)),
  counts: run.counts,
  score: null,
  retries: Object.entries(run.attempts).filter(([, n]) => n > 1).map(([d]) => d),
  rejected: run.rejected,
  facts: run.facts,
  dropped: run.dropped,
};
mkdirSync(localDataDir(), { recursive: true });
writeFileSync(localMonthFile(), JSON.stringify(out, null, 2) + "\n");
console.log(JSON.stringify({ month, seconds, costUsd: out.costUsd, counts: run.counts, retries: out.retries, rejected: run.rejected.length }, null, 1));
console.log(`wrote ${localMonthFile()} — open /month to see it`);
