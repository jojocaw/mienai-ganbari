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

## Status (Day 1 — 2026-11-02)

| | Feature | Status |
|---|---|---|
| F1 | Staff write one line a day (phone width, name picked from a list, line saved exactly as written) | ✅ working |
| — | Fictional month: 180 lines over 30 days with a known mix and an answer key | ✅ generated + tested |
| F2 | The owner's yardstick → a Claude **Skill** (`.claude/skills/<shop>-monosashi/SKILL.md`) | planned |
| F3 | Fact extractor (subagent): line → who / whom / what, gossip removed and counted | planned |
| F4 | Checker (subagent): finds duplicates and self-report-only claims | planned |
| F5 | Month-end view: green / yellow, every number traceable to its lines | planned |
| F6 | Allocation to the yen by plain TypeScript (Claude never calculates money) | planned |
| F7 | Thank-you letters in each person's language (subagent) | planned |

## Try it

Requires Node.js 22.18+ (TypeScript files run directly with Node).

```bash
npm install
npm run seed     # (re)generate the fictional month → data/seed/
npm run dev      # http://localhost:3000  — pick a name, write one line, save
npm test         # F1 + fictional-data tests
```

Lines written in the app are stored in `data/local/entries.json` (ignored by git).
The fictional month is in `data/seed/entries.json`; `data/seed/labels.json` is the hidden answer key used only by tests.

## The fictional month

- A fictional small café with 8 staff: 5 write in Japanese, 2 in Vietnamese, 1 in Indonesian.
- 180 lines: 108 "someone helped", 36 self-reports, 18 gossip/judgements, 9 duplicates of an event already reported, 9 vague lines.
- One **loud** person: 20 self-reports, named by others only 3 times.
- One **quiet** person (writes in Vietnamese): writes 3 lines all month, but is named by others 30 times.

## Where Claude is used

- **Claude Code** is the main development tool for this project (planning, code, tests).
- In the app (from F2 on): the **Claude Agent SDK** with a project Skill for the owner's yardstick and three subagents
  (fact extractor, checker, letter writer). Money is never calculated by Claude.

## Principles

- Facts only — no personality scores, no gossip collected.
- Every number on the month-end screen links back to the original lines, shown next to any translation.
- Staff can see their own records. The owner makes the final call.

---

## 日本語の説明 (短く)

小さなお店の月末の「プラス（賞与・手当・ありがとう）」を、声の大きい人ではなく、本当に頑張った人に届けるための道具です。
スタッフは毎日1行を母語で書くだけ。Claude が事実だけにそろえ、月末に「周りが何度も名前を書いた見えない頑張り（緑）」と「本人の申告だけ（黄）」を分けて店長に見せます。**決めるのは店長**で、AI は配分を決めません。金額の計算はプログラムで1円まで行います。

- 今日できたこと: F1（毎日の1行・元の文のまま保存）と、架空の1か月分 180行（答えつき・テストつき）
- 動かし方: 上の「Try it」のとおり
