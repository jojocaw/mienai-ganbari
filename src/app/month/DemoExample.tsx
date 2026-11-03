import { readFileSync } from "node:fs";
import path from "node:path";
import { LANG_LABEL, STAFF, type Lang } from "@/lib/staff";
import { DEMO_EXPORT } from "../DemoNote";

// Static demo only: one real result from the fictional month, read from the committed files at build time —
// the line exactly as a staff member wrote it, and what Claude took from it. In the normal app this renders nothing.
// 試し版だけ: 架空の1か月の本物の結果を1つ (書いたままの1行 → Claude が拾った事実)。作る時にファイルから読む。

const EXAMPLE = "seed-121";
const VERDICT: Record<string, string> = { 付ける: "お礼に入れる", 付けない: "お礼には入れない", 迷う: "店長に確かめる" };

type Entry = { id: string; authorId: string; lang: Lang; text: string };
type Fact = { entryId: string; action: string; verdict: string; corroboratedBy: string[] };

export default function DemoExample() {
  if (!DEMO_EXPORT) return null;
  const entries = JSON.parse(readFileSync(path.join(process.cwd(), "data", "seed", "entries.json"), "utf8")) as Entry[];
  const month = JSON.parse(readFileSync(path.join(process.cwd(), "data", "derived", "month.json"), "utf8")) as { facts: Fact[] };
  const line = entries.find((e) => e.id === EXAMPLE);
  const fact = month.facts.find((f) => f.entryId === EXAMPLE);
  if (!line || !fact) return null;
  const name = (id: string) => STAFF.find((s) => s.id === id)?.ja ?? id;
  return (
    <section className="flex flex-col gap-2 rounded-2xl border border-stone-200 bg-white p-4">
      <h2 className="text-sm font-bold text-stone-900">例：月末に Claude はこう読みます</h2>
      <div className="rounded-xl bg-stone-50 px-3 py-2 text-sm">
        <span className="block text-xs text-stone-500">
          {name(line.authorId)}さんが書いた1行（{LANG_LABEL[line.lang]}）
        </span>
        <span lang={line.lang}>{line.text}</span>
      </div>
      <p className="text-center text-sm text-stone-400" aria-hidden>
        ↓
      </p>
      <div className="flex flex-col gap-1 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-950">
        <span className="text-xs text-emerald-800">Claude が拾った事実（日本語）</span>
        <span>{fact.action}</span>
        {fact.corroboratedBy.length > 0 && (
          <span className="text-xs text-emerald-800">{fact.corroboratedBy.map(name).join("さん・")}さんも、同じ出来事を書いていました</span>
        )}
        <span className="text-xs text-emerald-800">
          Claude の見立て：{VERDICT[fact.verdict] ?? fact.verdict}（最後に決めるのは店長です）
        </span>
      </div>
    </section>
  );
}
