# mienai-ganbari — 見えない頑張りを拾う

> **All data in this repository is fictional.** The café, the staff, and every daily line were made up for this demo.
> **このリポジトリのデータはすべて架空です。** お店・スタッフ・毎日の1行は、このデモのために作ったものです。

**Built with Claude: Japan 2026** — Theme 1: *"The depth only you have" (あなたにしかない深さを。)*

Small shops hand out a little extra at the end of the month — a bonus, an allowance, a thank-you.
Too often it goes to the person who talks the most, while the person who quietly mopped the floor, covered a shift,
or taught the new hire goes unnoticed — especially when Japanese is not their first language.

**mienai-ganbari** helps the owner see those quiet efforts:

1. Each staff member writes **one line a day**, in their own language (Japanese, Vietnamese, Indonesian…).
2. Claude turns each line into **plain facts** — who did what for whom — and drops gossip and judgements about character.
3. At the end of the month the owner sees **who was named by others again and again (green)** versus **who mostly reported themselves (yellow)** — every colour links back to the original lines.
4. **The owner decides.** The AI never decides who gets what. Amounts are calculated by plain code to the last yen.
5. Each person receives a short thank-you in their own language, with the concrete reasons.

The builder has run a small business for 18 years and has had to make these month-end calls by hand.
By hand it takes the builder about 30 minutes per person; with this tool, the fictional month for 8 people took 18 minutes from start to the finished letters — about 2 min 15 s per person (F8 ①).

### How it works

```mermaid
flowchart TB
  subgraph once["Once per shop"]
    direction LR
    Q["The owner answers<br/>ten questions"] --> W["Yardstick writer<br/>Opus"] --> K[("The owner's yardstick<br/>Claude Skill: SKILL.md<br/>grows with the owner's<br/>month-end corrections (F9)")]
  end
  subgraph daily["Every day"]
    S["Each staff member writes one line<br/>in their own language"]
  end
  subgraph facts["End of the month"]
    direction LR
    X["Fact extractor<br/>Sonnet subagent<br/>with the yardstick skill"] --> C["Checks<br/>plain code;<br/>Haiku only suggests"] --> M["Month-end view<br/>green: named by others<br/>yellow: self-report only"]
  end
  subgraph decide["The owner decides"]
    direction LR
    O{"Shares<br/>0 to 10"} --> A["Amounts to the yen<br/>plain code"] --> L["Thank-you letters<br/>Opus, in each<br/>person's language"]
  end
  once --> facts
  daily --> facts
  facts --> decide
```

Claude reads and writes; plain code checks every answer and does every calculation; the owner makes every decision.

---

## Status (2026-11-03)

| | Feature | Status |
|---|---|---|
| F1 | Staff write one line a day (phone width, name picked from a list, line saved exactly as written) | ✅ working |
| — | Fictional month: 180 lines over 30 days with a known mix and an answer key | ✅ generated + tested |
| F2 | The owner's yardstick → a Claude **Skill** (`.claude/skills/<shop>-monosashi/SKILL.md`): ten questions, Claude writes a draft, plain code checks it (no character words, every rule points back to an answer), one retry, then the file is written | ✅ first real run: 6 give / 5 don't give / 3 unsure / 7 examples, 3 character words in the answers → 0 in the skill (Opus, ~$0.08) |
| F3 | Fact extractor (subagent; every prompt starts with the owner's Skill as a slash command, so the full yardstick is in its context): line → who did what for whom + the yardstick's verdict; gossip, judgements and vague lines are dropped and only counted. Plain code checks every answer (each line exactly once, people from the list, no character words) | ✅ real run on the fictional month, with the yardstick really in context (the run starts by making the extractor quote it word for word): who did it right for 153/153 lines in Japanese, Vietnamese and Indonesian |
| F4 | Checker: plain code groups the same event (same day, same person, same job) and finds self-report-only claims; a small checker subagent may suggest extra groups, accepted only when safe. Scored against the hidden answer key | ✅ real run: 9/9 duplicates (each written in two different languages), 36/36 self-report-only claims, 27/27 dropped lines, who did it 153/153, for whom 153/153, 0 false alarms · 30 days in 150 s for about $0.70 |
| F5 | Month-end view (`/month`): green / yellow per person; every event opens to its original lines (who wrote them, in which language) and the yardstick's reason; dropped lines are only counted, never shown on anyone's page | ✅ the quiet person: 26 green / 0 yellow (wrote only 3 lines) · the loud person: 3 green / 20 yellow (wrote 32) · the yardstick sorts the 144 events into 37 付ける / 75 迷う (outside the owner's rules, so the owner decides) / 32 付けない |
| F6 | The owner sets each person's yen with + and − (one press = 100 / 500 / 1,000 / 5,000 yen, or type the number) and the total is added up at the bottom, after the last person — changed after the owner tried the screen on 11/3: setting a total first and moving shares 0–10 was hard to follow. Plain TypeScript turns the amounts into exact shares and back (`splitFromAmounts` → `allocate`, nothing left over); a decision kept as shares (the fictional owner's file) is still split to the yen by largest remainder. Claude never calculates money | ✅ fictional decision: 50,000 yen → 11,700 / 5,900 × 6 / 2,900, nothing left over; any yen the owner sets comes back exactly (tested) |
| F7 | Thank-you letters in each person's language: the letter-writer subagent uses only the checked facts and the amount from F6; plain code checks every letter (amount exactly once, no other money, every fact it uses is real, no character words, the right language) and sends it back once with the problems | ✅ real run: 8/8 letters passed (one after a retry), Japanese / Vietnamese / Indonesian, 26 s for about $0.20 |
| F8 | Two numbers for the video: ① the time to make the month-end decision, by hand vs with this tool; ② on twenty made-up scenes the owner answers (付ける / 付けない / 迷う), how often the fact extractor gives the owner's answer **without and with the owner's yardstick skill** — the only difference between the two runs is the skill, and every run first proves the skill is (or is not) in context with a word-for-word quote (`npm run f8`; the owner's answers and skill stay private, only the counts are published in `data/derived/f8.json`) | ② measured with a real shop owner's answers (Sonnet, 3 runs each). **Twenty scenes: without the skill 7, 7, 8 → with the owner's skill 9, 9, 9.** Most misses were small everyday help the owner does not reward (付けない) but Claude does (付ける): the owner's ten written answers say teaching and helping count. **Twelve new scenes the owner answered afterwards** (`npm run f8 -- --round2`, `data/derived/f8-round2.json`): no skill 6, 6, 7 · the skill 5, 5, 5 · **the skill plus the owner's twenty earlier answers as examples 9, 7, 8** · the skill plus the owner's own one-line reason 5, 5, 5 · both 7, 7, 8. The owner's past decisions carried over to new lines (three small everyday scenes, help and tidying, went from 0 of 3 runs to 3 of 3); the one-line reason alone did not move the count. (Inside the twenty, examples from one half tested on the other: 8, 8, 8 → 9, 9, 9, `--examples`.) **① measured once with the same real owner on the fictional month (11/3): by hand, the owner spends about 30 minutes per person, starting three days before the end of the month (about 5 hours for 10 people). With this tool, from "start" to the eight finished letters took 18 min 07 s for 8 people — about 2 min 15 s per person.** The time includes the owner working out the old money screen, which was rebuilt the same day (F6); Claude's preparation (facts and checks, 150 s) ran beforehand and is not included |
| F9 | The owner corrects the month-end verdicts on `/month` (open an event → 店長の答え: 付ける / 迷う / 付けない), and one tap adds those decisions to the yardstick Skill as examples (「店長が実際に決めた例」): word for word, without people's names, by plain code (no Claude). Month after month the section grows; a new decision on the same line replaces the old one; past 60 the oldest leave first; the version before each save is kept in `data/local/skill-history/` and one tap puts it back. Why examples: in F8 ② the owner's past decisions carried over to new lines (5 → 9, 7, 8 of 12) while a one-line reason did not | ✅ working (6 tests; not yet measured on a second month) |
| — | **Your own shop:** a shop file (shop name + staff list) switches every screen from the fictional café to the real shop; its lines, its yardstick skill and its month-end result stay in folders that are never committed; `npm run month` takes the shop's own month through F3 + F4 (no answer key, so no score) | ✅ working (12 tests; built and checked in the browser with a test shop: the shop's names only, no fictional line mixed in, the fictional demo unchanged) — not yet run on a real shop's month |

## Try it

Requires Node.js 22.18+ (TypeScript files run directly with Node).

```bash
npm install
npm run seed     # (re)generate the fictional month → data/seed/
npm run dev      # http://localhost:3000  — pick a name, write one line, save
                 # http://localhost:3000/monosashi — the owner's ten questions → the yardstick skill
                 # http://localhost:3000/month — the month-end view, the owner's decision and the letters;
                 #   open an event, correct the answer (店長の答え), then 「物差しに覚えさせる」 adds it to the skill
npm test         # all tests (no API calls)
```

Calling Claude needs an API key in `.env.local` (never committed):

```bash
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env.local
npm run monosashi   # writes .claude/skills/demo-cafe-monosashi/SKILL.md from the fictional owner's answers
npm run facts       # F3 + F4 on the fictional month with the real subagents, scored against the answer key
                    # → data/derived/month.json (committed, so the results can be read without a key)
npm run letters     # F6 + F7: the fictional owner's decision → amounts by code → one letter per person
                    # → data/derived/letters.json (committed)
npm run f8 -- --demo  # F8 ② dry run with the fictional café's skill: twenty scenes, without vs with the skill
npm run f8            # F8 ② with a real owner's private answers in data/local/f8/ (not in this repository);
                      # --examples: the owner's answers as examples, two folds · --round2: twelve new scenes
```

Without a key the app still runs: it shows the skill, the month and the letters already in the repository, and the buttons that call Claude are disabled.
Set `MIENAI_ALLOW_LIVE=0` to switch off Claude calls even when a key is present (for a public demo).

Lines written in the app are stored in `data/local/entries.json` (ignored by git).
The fictional month is in `data/seed/entries.json`; `data/seed/labels.json` is the hidden answer key used only by tests.

## Use it in your own shop

**Who it is for, and when:** the owner of a small shop or restaurant run with part-time staff (some of whom may write in Vietnamese or Indonesian) who hands out a month-end extra and decides it by hand. Every day, each person writes one line on a phone; in the last days of the month, the owner opens `/month`, decides, and the letters are written. For 8 staff it costs about $0.90 a month.

The demo is the fictional café. For a real shop, make a shop file **outside this repository**, so nothing about the shop can be committed:

```json
{
  "name": "Your shop",
  "staff": [
    { "id": "aoi", "name": "あおい", "lang": "ja" },
    { "id": "tuan", "name": "トゥアン (Tuan)", "roman": "Tuan", "ja": "トゥアン", "lang": "vi" }
  ]
}
```

- `id`: lowercase letters, numbers and `-`, used inside the files (never shown) · `name`: shown on the screens · `lang`: `ja`, `vi` or `id`, the language the person writes in and gets the letter in
- optional `roman`: the name in Latin letters (the fact extractor sees it next to the name, and Vietnamese / Indonesian letters use it) · optional `ja`: the name in Japanese without さん (default: `name`), so 「トゥアンさんが」 is left out on the person's own card

Point the app at it in `.env.local` (read by `npm run dev`, `npm run build` and the scripts):

```bash
MIENAI_SHOP_FILE=/path/to/my-shop/shop.json
```

Then every screen is the shop instead of the fictional café:

1. `/monosashi` — the owner answers the ten questions (empty, no fictional answers). The yardstick skill is written next to the shop file (`/path/to/my-shop/.claude/skills/…/SKILL.md`, earlier versions in `/path/to/my-shop/skill-history/`), not into this repository.
2. `/` — each person picks their name and writes one line a day → `data/local/entries.json`.
3. At the end of the month: `npm run month` (or `npm run month -- --month 2026-11`). It first makes the fact extractor quote the shop's own yardstick word for word, then goes through the shop's lines → `data/local/month.json`. A real month has no answer key, so there is no score.
4. `/month` — the shop's month: green / yellow per person, the owner's corrections (added to the shop's own skill), the owner's decision and the letters. Before `npm run month` it says how many lines are waiting.

A broken shop file stops with the problem in plain Japanese; it never falls back to the fictional café. Without `MIENAI_SHOP_FILE` everything is the fictional demo, exactly as before.

## The fictional month

- A fictional small café with 8 staff: 5 write in Japanese, 2 in Vietnamese, 1 in Indonesian.
- 180 lines: 108 "someone helped", 36 self-reports, 18 gossip/judgements, 9 duplicates of an event already reported, 9 vague lines.
- Every duplicate tells the same event as its original in another language (for example Japanese and Indonesian),
  so finding it means understanding both lines, not matching words.
- One **loud** person: 20 self-reports, named by others only 3 times.
- One **quiet** person (writes in Vietnamese): writes 3 lines all month, but is named by others 30 times.

## Where Claude is used — which feature, which model, and why

**Claude Code** is the main development tool: planning, code, tests, and the real runs below were all done in Claude Code.
Inside the app, the **Claude Agent SDK** (TypeScript) runs every Claude call. Each role gets the feature and model that fit its job:

| Role | Claude feature | Model · effort | Why |
|---|---|---|---|
| F2 yardstick writer (`src/lib/monosashi/claude-writer.ts`) | Agent SDK `query()` with a JSON schema; plain code renders the file | Opus 5.5 · high | Runs once per shop, and every later step depends on it, so quality matters most |
| The owner's yardstick (`.claude/skills/demo-cafe-monosashi/SKILL.md`) | **Skill** — written by Claude, for Claude | — | The owner's rules become a plain file the extractor loads every time: readable by the owner, reviewable on GitHub, no character words |
| F3 `fact-extractor` (`src/lib/agents.ts`) | **Subagent** run as the main thread; every prompt starts with the Skill as a slash command (`/demo-cafe-monosashi`), so the owner's full rules are in its context — each real run first makes it quote a rule word for word, and stops if it cannot. JSON schema output | Sonnet 5.5 · medium | Reads every line in three languages, day by day — many calls, needs good reading at a steady cost |
| F4 `checker` | **Subagent**, JSON schema output | Haiku 5.5 · low | A narrow job: it only *suggests* which facts are the same event; plain code decides |
| F6 money (`src/lib/pay/allocate.ts`) | none — plain TypeScript | — | Money must be exact to the yen and explainable; Claude never calculates it |
| F7 `letter-writer` | **Subagent**, JSON schema output | Opus 5.5 · medium | Few calls, and warm, natural thank-yous in Japanese, Vietnamese and Indonesian matter |

How the calls are kept safe and honest:

- **Claude writes, plain code checks and decides.** Every answer is checked by code; a failing answer is sent back once with the list of problems, and anything that still fails is never shown as passed.
- **No tools and no MCP on purpose.** The subagents only read text and return JSON, so they cannot touch files, the network or money.
- **Measured against a hidden answer key.** The fictional month has planted duplicates (always in two languages), self-reports, gossip and vague lines; `npm run facts` prints the score.
- **Isolated runs.** The SDK runs with its own config directory and only the API key; every inherited `CLAUDE_*` / `ANTHROPIC_*` variable is dropped
  (we found a developer's own effort setting leaking in and making one call think for over four minutes). Subagents cannot start further subagents, and every call has a spending cap.
- Models can be changed per role with `MIENAI_MODEL_WRITER` / `_EXTRACTOR` / `_CHECKER` / `_LETTER`.
- **Cost**, measured on the fictional month (8 staff, 180 lines): facts and checks $0.70 (`data/derived/month.json`) + letters $0.20 (`data/derived/letters.json`) — **about $0.90 a month**. The yardstick skill is written once per shop (about $0.08). The cost grows with the number of lines.

## How it was built with Claude Code

Claude Code (Opus 5.5) was the center of the work, from the plan to the real runs:

1. **Plan before code.** Before the kickoff, Claude Code wrote a spec with an acceptance line for every feature (kept outside this repository, as the rules ask). Each row of the Status table is checked against its line.
2. **Measure first.** Right after F1, Claude Code built the fictional month with a hidden answer key (duplicates always told in two languages, self-reports, gossip, vague lines). Every later feature is scored against it, so "it works" always comes with a number.
3. **For every feature:** plain-code checks and tests first (no API calls in tests), then the real Claude call, then a real run on the fictional month, then fixes for whatever the numbers show, then a commit.
4. **Screens are checked like a user would.** Claude Code opens each page in a headless browser at phone (390 px) and PC widths, clicks through it (open a person, change a share, go back to the saved decision) and looks at the screenshots before committing.

What the real runs caught, and how each was fixed (each fix has a test):

| Found in a real run | Fix |
|---|---|
| One SDK call thought for over four minutes: the developer's own Claude Code settings (maximum effort, session variables) leaked into the app's SDK process | The app drops every inherited `CLAUDE_*` / `ANTHROPIC_*` variable and sets the effort per role |
| A subagent answered in prose instead of JSON: an empty tool list on the agent also removed the SDK's structured-output tool | Tools are switched off for the session only, and the agents inherit that |
| Claude would not merge two planted "duplicates" — rightly: the generator had written two different stories | The data generator was fixed, not the model; a test checks that every duplicate tells the same event |
| A letter thanked someone "for Miyuki": the extractor read the thankful ending 「〜してくれた」 as "done for the writer" | A stricter rule for the extractor and a new for-whom score (153/153) |
| Letters added purposes the facts did not state ("so the customers could read it easily") | One more rule for the letter writer, then a new real run, checked again |
| **The owner's Skill was listed but never read.** F8's dry run showed the Skill changed only 2 of 20 answers; asked to quote the yardstick, the extractor said it had none. (`AgentDefinition.skills` preloads a Skill only for subagents started through the Agent tool — not for an agent that runs as the main thread, as here.) | Every extractor prompt now starts with the Skill as a slash command, which puts its full text in the request. Each real run first asks the extractor to quote the first 「付けない」 rule word for word and stops if the quote is not exact; without the Skill it answers that it has none. F3–F7 were run again with the Skill really in place |
| **The owner's words and the owner's decisions disagreed.** The ten answers say teaching and helping count; the same owner did not reward small everyday help. On twelve new scenes the skill alone moved Claude away from this owner (6.3 → 5.0 of 12 on average) | The owner's past decisions go into the skill word for word as examples (`addOwnerExamples`: plain code, nothing that judges a person can enter, the rest of the skill unchanged). On the twelve new scenes: 8.0 of 12. The owner's one-line reason, added the same way, did not move the count by itself (5, 5, 5) |

## Principles

- Facts only — no personality scores, no gossip collected.
- Every number on the month-end screen links back to the original lines, shown next to any translation.
- Staff can see their own records. The owner makes the final call.

### Privacy

- **What goes to Claude:** the daily lines (to turn them into facts), the checked facts and the amounts (to write the letters), and the owner's ten answers (to write the yardstick). The subagents have no tools and no MCP, so they cannot touch files, the network or money.
- **What stays on the machine:** lines written in the app (`data/local/entries.json`) and the earlier versions of the yardstick (`data/local/skill-history/`) are never committed.
- **A real shop stays outside the repository:** the shop file, the shop's yardstick skill and its earlier versions live in the shop file's folder; the lines and the month-end result live in `data/local/`. Neither is ever committed.
- **The yardstick keeps actions, not people:** names are taken out of the owner's examples, and plain code refuses any word that judges a person's character.
- **Gossip and judgements are dropped and only counted** — they are never shown on anyone's page.

---

## 日本語の説明 (短く)

小さなお店の月末の「プラス（賞与・手当・ありがとう）」を、声の大きい人ではなく、本当に頑張った人に届けるための道具です。
スタッフは毎日1行を母語で書くだけ。Claude が事実だけにそろえ、月末に「周りが何度も名前を書いた見えない頑張り（緑）」と「本人の申告だけ（黄）」を分けて店長に見せます。**決めるのは店長**で、AI は配分を決めません。金額の計算はプログラムで1円まで行います。

- できたこと: F1（毎日の1行・元の文のまま保存）・架空の1か月分 180行（答えつき・テストつき）・F2（店長の10問 → Claude が書くスキル。人柄の言葉は入らない）・F3/F4（事実の係 = Sonnet・確かめの係 = Haiku・隠した答えと比べて全問正解）・F5（月末の画面 `/month`）・F6（店長が＋−で一人ずつ金額を決め、合計と手紙の金額はプログラム。11/3 に店長が使って分かりにくかった「合計と割合」の形から直した）・F7（手紙の係 = Opus が母語で手紙・コードが確かめる・8通とも通った）・F8 ②（店長と同じ答えになった数。架空の20場面: 物差しなし 7・7・8 → 物差しあり 9・9・9 / 20。後から店長が答えた新しい12場面: 物差しだけ 5・5・5 → 店長の前の20の答えを例に足すと 9・7・8 / 12（小さな手伝い・片づけの3場面が 0回 → 3回とも一致）。店長の理由の1行だけでは、合う数は変わらなかった（5・5・5）。物差しが本当に読まれているかは、決まりの1行を一字一句引用させて確かめる）・F9（店長が月末に Claude の答えを直すと、その答えが物差しのスキルの「店長が実際に決めた例」に入る。名前は外し、行動だけ・プログラムで足す・1回で元に戻せる）
- 前と後の時間 (F8 ①): 店長が手で決めると 1人30分 (月末の3日前から・10人で約5時間)。この道具では、架空の8人の月末が「はじめる」から8通の手紙の完成まで 18分07秒 (1人 約2分15秒)。11/3 に本物の店長が1回測った (お金の画面でまごついた時間も入れたまま。その画面は同じ日に作り直した・Claude の下ごしらえ 150秒は前もって済んでいて入れていない)
- 使う人と場面: パートのスタッフで回す小さなお店の店長 (ベトナム語やインドネシア語で書くスタッフがいてもよい)。スタッフは毎日スマホで1行・月末の数日に店長が `/month` を開いて決め、手紙ができる。8人で1か月 約0.9ドル
- 仕組みの図: 上の「How it works」(1回だけ = 店長の10問 → 物差しのスキル / 毎日 = 1人1行 / 月末 = 事実の係 → 確かめ → 月末の画面 → 店長が決める → 金額はプログラム → 母語の手紙)
- 費用: 架空の1か月 (8人・180行) で 事実と確かめ 0.70ドル＋手紙 0.20ドル = 1か月 約0.9ドル (物差しのスキルはお店ごとに1回 約0.08ドル)
- 試し方: Node.js 22.18 以上で `npm install` → `npm run dev` → http://localhost:3000 (毎日の1行)・`/monosashi` (店長の10問 → 物差しのスキル)・`/month` (月末の画面・店長が決める・手紙)。API の鍵が無くても、リポジトリに入っている結果で全部の画面を見られる (Claude を呼ぶボタンだけ止まる)。テストは `npm test` (API は呼ばない)。くわしくは上の「Try it」
- 自分のお店で使う: 店名とスタッフの名簿のファイルを作り、`.env.local` に `MIENAI_SHOP_FILE` を書くと、どの画面も架空のカフェから自分のお店に切り替わる。物差し・毎日の1行・月末の結果は手元のフォルダだけに置き、公開しない。月末は `npm run month`（本物の月には答えが無いので、答え合わせの点数は出さない）。詳しくは「Use it in your own shop」
