// F2: turns a checked draft into SKILL.md. The layout is fixed by code so every shop's skill has the same shape.
// F2: 確かめた案を SKILL.md にする。形はコードで決めるので、どのお店のスキルも同じ並びになる。

import type { Draft, Rule } from "./lint.ts";
import { QUESTIONS } from "./questions.ts";

const noOf = (id: string) => QUESTIONS.find((q) => q.id === id)?.no;

function sources(rule: Rule): string {
  const nos = [...new Set(rule.from.map(noOf).filter((n): n is number => n !== undefined))].sort((a, b) => a - b);
  return nos.length ? `（答え ${nos.join("・")}）` : "";
}

export function renderSkill(draft: Draft, opts: { shopName: string; skillName: string; date: string }): string {
  const list = (rules: Rule[]) => (rules.length ? rules.map((r) => `- ${r.text}${sources(r)}`).join("\n") : "- （なし）");
  return `---
name: ${opts.skillName}
description: ${opts.shopName}の店長の物差し。スタッフの毎日の1行を読んで、月末のプラスに「付ける・付けない・迷う」を店長の決まりで分ける時に使う。金額や配分は決めない。
---

# ${opts.shopName}の物差し

店長が10問に答え、その答えから書き出した決まりです（書き出した日: ${opts.date}）。
**決めるのは店長です。** このスキルは「付ける・付けない・迷う」の目安を出すだけで、金額や配分は決めません。

## 店長が一番大事にしたいこと

${draft.summary}

## 付ける

月末のプラスの候補にする行動です。

${list(draft.give)}

## 付けない

${list(draft.dontGive)}

## 迷う

この物差しだけでは決められない行動です。目安を出さず、店長に見せます。

${list(draft.unsure)}

## 例

${draft.examples.map((ex) => `- 「${ex.line}」→ **${ex.verdict}**: ${ex.reason}`).join("\n")}

## 読み方の決まり

- 書かれた行動だけを見る。人を評価する言葉は使わず、「誰が・誰に・何をしたか」で書く。
- 1行に書かれていないことは足さない。分からない時は「迷う」にする。
- 判断には、もとの1行をいつも一緒に残す。
`;
}
