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

---

## Status (2026-11-02)

| | Feature | Status |
|---|---|---|
| F1 | Staff write one line a day (phone width, name picked from a list, line saved exactly as written) | ✅ working |
| — | Fictional month: 180 lines over 30 days with a known mix and an answer key | ✅ generated + tested |
| F2 | The owner's yardstick → a Claude **Skill** (`.claude/skills/<shop>-monosashi/SKILL.md`): ten questions, Claude writes a draft, plain code checks it (no character words, every rule points back to an answer), one retry, then the file is written | ✅ first real run: 6 give / 5 don't give / 3 unsure / 7 examples, 3 character words in the answers → 0 in the skill (Opus, ~$0.08) |
| F3 | Fact extractor (subagent, preloads the owner's Skill): line → who did what for whom + the yardstick's verdict; gossip, judgements and vague lines are dropped and only counted. Plain code checks every answer (each line exactly once, people from the list, no character words) | ✅ real run on the fictional month: who did it right for 153/153 lines in Japanese, Vietnamese and Indonesian |
| F4 | Checker: plain code groups the same event (same day, same person, same job) and finds self-report-only claims; a small checker subagent may suggest extra groups, accepted only when safe. Scored against the hidden answer key | ✅ real run: 9/9 duplicates (each written in two different languages), 36/36 self-report-only claims, 27/27 dropped lines, who did it 153/153, for whom 153/153, 0 false alarms · 30 days in 130 s for about $0.49 |
| F5 | Month-end view (`/month`): green / yellow per person; every event opens to its original lines (who wrote them, in which language) and the yardstick's reason; dropped lines are only counted, never shown on anyone's page | ✅ the quiet person: 26 green / 0 yellow (wrote only 3 lines) · the loud person: 3 green / 20 yellow (wrote 32) |
| F6 | The owner sets the total, the unit (1/10/100/1000 yen) and a share 0–10 per person; plain TypeScript splits it to the yen (largest remainder, ties → larger share, then list order) and the rule is shown on the screen. Claude never calculates money | ✅ fictional decision: 50,000 yen → 11,700 / 5,900 × 6 / 2,900, nothing left over |
| F7 | Thank-you letters in each person's language: the letter-writer subagent uses only the checked facts and the amount from F6; plain code checks every letter (amount exactly once, no other money, every fact it uses is real, no character words, the right language) and sends it back once with the problems | ✅ real run: 8/8 letters passed (one after a retry), Japanese / Vietnamese / Indonesian, 25 s for about $0.19 |

## Try it

Requires Node.js 22.18+ (TypeScript files run directly with Node).

```bash
npm install
npm run seed     # (re)generate the fictional month → data/seed/
npm run dev      # http://localhost:3000  — pick a name, write one line, save
                 # http://localhost:3000/monosashi — the owner's ten questions → the yardstick skill
                 # http://localhost:3000/month — the month-end view, the owner's decision and the letters
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
```

Without a key the app still runs: it shows the skill, the month and the letters already in the repository, and the buttons that call Claude are disabled.
Set `MIENAI_ALLOW_LIVE=0` to switch off Claude calls even when a key is present (for a public demo).

Lines written in the app are stored in `data/local/entries.json` (ignored by git).
The fictional month is in `data/seed/entries.json`; `data/seed/labels.json` is the hidden answer key used only by tests.

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
| F3 `fact-extractor` (`src/lib/agents.ts`) | **Subagent** that preloads the Skill (`skills: [...]`), JSON schema output | Sonnet 5.5 · medium | Reads every line in three languages, day by day — many calls, needs good reading at a steady cost |
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

## Principles

- Facts only — no personality scores, no gossip collected.
- Every number on the month-end screen links back to the original lines, shown next to any translation.
- Staff can see their own records. The owner makes the final call.

---

## 日本語の説明 (短く)

小さなお店の月末の「プラス（賞与・手当・ありがとう）」を、声の大きい人ではなく、本当に頑張った人に届けるための道具です。
スタッフは毎日1行を母語で書くだけ。Claude が事実だけにそろえ、月末に「周りが何度も名前を書いた見えない頑張り（緑）」と「本人の申告だけ（黄）」を分けて店長に見せます。**決めるのは店長**で、AI は配分を決めません。金額の計算はプログラムで1円まで行います。

- できたこと: F1（毎日の1行・元の文のまま保存）・架空の1か月分 180行（答えつき・テストつき）・F2（店長の10問 → Claude が書くスキル。人柄の言葉は入らない）・F3/F4（事実の係 = Sonnet・確かめの係 = Haiku・隠した答えと比べて全問正解）・F5（月末の画面 `/month`）・F6（割合から1円までプログラムで計算）・F7（手紙の係 = Opus が母語で手紙・コードが確かめる・8通とも通った）
- 動かし方: 上の「Try it」のとおり
