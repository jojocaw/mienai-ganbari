"use client";

import { useEffect, useMemo, useState } from "react";
import { sameDecision, type Decision } from "@/lib/letters/plan";
import type { LetterRow, LettersRun } from "@/lib/letters/run";
import type { FactsRun } from "@/lib/month/load";
import type { EventView, MonthView, PersonView } from "@/lib/month/summary";
import { allocate, MAX_SHARE, MAX_TOTAL, RULE_TEXT, UNITS, yen, type Unit } from "@/lib/pay/allocate";
import { LANG_LABEL, STAFF } from "@/lib/staff";

type Data = { view: MonthView; run: FactsRun; decision: Decision; letters: LettersRun | null; live: boolean };

const ORDER = STAFF.map((s) => s.id);
const staffName = (id: string) => STAFF.find((s) => s.id === id)?.name ?? id;
const md = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;
/** The person's card already says who did it, so a leading "ミンさんが" is left out. */
const withoutActor = (action: string, actorId: string) => {
  const ja = STAFF.find((s) => s.id === actorId)?.ja;
  return ja ? action.replace(new RegExp(`^${ja}(さん)?(が|は)、?`), "") : action;
};
const modelLabel = (id: string) =>
  id
    .replace(/^claude-/, "")
    .replace(/-(\d+)-(\d+)$/, " $1.$2")
    .replace(/^./, (c) => c.toUpperCase());
const usd = (n: number) => `$${n.toFixed(2)}`;

const VERDICT_STYLE: Record<string, string> = {
  付ける: "bg-emerald-100 text-emerald-900",
  迷う: "bg-amber-100 text-amber-900",
  付けない: "bg-stone-200 text-stone-700",
};

export default function MonthBoard() {
  const [data, setData] = useState<Data | null>(null);
  const [loadError, setLoadError] = useState("");
  const [totalText, setTotalText] = useState("");
  const [unit, setUnit] = useState<Unit>(100);
  const [shares, setShares] = useState<Record<string, number>>({});
  const [liveRun, setLiveRun] = useState<LettersRun | null>(null);
  const [busy, setBusy] = useState(false);
  const [letterError, setLetterError] = useState("");

  useEffect(() => {
    fetch("/api/month")
      .then((r) => r.json())
      .then((d: Data) => {
        setData(d);
        setTotalText(String(d.decision.total));
        setUnit(d.decision.unit);
        setShares(d.decision.shares);
      })
      .catch(() => setLoadError("読み込めませんでした"));
  }, []);

  const month = data?.decision.month ?? "";
  const decision: Decision = useMemo(() => ({ month, total: Number(totalText), unit, shares }), [month, totalText, unit, shares]);
  const split = useMemo(() => {
    try {
      return { allocation: allocate(decision.total, decision.shares, decision.unit, ORDER), error: "" };
    } catch (e) {
      return { allocation: null, error: e instanceof Error ? e.message : String(e) };
    }
  }, [decision]);

  if (loadError) return <p className="text-sm text-red-700">{loadError}</p>;
  if (!data) return <p className="text-sm text-stone-500">読み込み中…</p>;

  const isSaved = sameDecision(data.decision, decision);
  const shown = [liveRun, data.letters].find((r): r is LettersRun => Boolean(r && sameDecision(r.decision, decision))) ?? null;
  const scale = Math.max(1, ...data.view.persons.map((p) => p.green.length + p.yellow.length));

  function reset() {
    if (!data) return;
    setTotalText(String(data.decision.total));
    setUnit(data.decision.unit);
    setShares(data.decision.shares);
    setLetterError("");
  }

  async function writeLetters() {
    setBusy(true);
    setLetterError("");
    try {
      const r = await fetch("/api/letters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const d = await r.json();
      if (!r.ok) {
        setLetterError(d.error || "書けませんでした");
        return;
      }
      setLiveRun(d.run);
    } catch {
      setLetterError("通信できませんでした");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <Summary view={data.view} run={data.run} />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold text-stone-900">みんなの10月</h2>
        <p className="text-xs leading-relaxed text-stone-600">
          <span className="font-semibold text-emerald-800">緑</span> = ほかの人が書いた頑張り。
          <span className="font-semibold text-amber-800">黄</span> = 本人だけが書いたこと（ほかの人の1行では確かめられていない）。開くと、元の1行がそのまま見られます。
        </p>
        <div className="flex flex-col gap-2">
          {data.view.persons.map((p) => (
            <PersonCard key={p.id} person={p} scale={scale} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-stone-300 bg-white p-4">
        <h2 className="text-lg font-bold text-stone-900">店長が決める</h2>
        <p className="text-xs leading-relaxed text-stone-600">
          だれにどれだけ届けるか（割合）を決めるのは店長です。AI は配分を決めません。1円までの計算はプログラムが行います。
        </p>
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
          架空の店長の決めが入っています。変えて試せます。
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs font-semibold text-stone-700">
            今月のプラスの合計（円）
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={MAX_TOTAL}
              step={unit}
              value={totalText}
              onChange={(e) => setTotalText(e.target.value)}
              className="w-36 rounded-lg border border-stone-300 bg-white px-3 py-2 text-base tabular-nums text-stone-900 focus:border-emerald-600 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-stone-700">
            単位
            <select
              value={unit}
              onChange={(e) => setUnit(Number(e.target.value) as Unit)}
              className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-base text-stone-900"
            >
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u.toLocaleString("ja-JP")}円
                </option>
              ))}
            </select>
          </label>
        </div>
        <ul className="flex flex-col divide-y divide-stone-100">
          {data.view.persons.map((p) => {
            const amount = split.allocation?.amounts[p.id];
            const value = shares[p.id] ?? 0;
            return (
              <li key={p.id} className="flex items-center gap-2 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-stone-900">{p.name}</p>
                  <p className="text-[11px] text-stone-500">
                    <span className="text-emerald-800">緑 {p.green.length}</span>・<span className="text-amber-800">黄 {p.yellow.length}</span>
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label={`${p.name}の割合を1減らす`}
                    disabled={value <= 0}
                    onClick={() => setShares({ ...shares, [p.id]: value - 1 })}
                    className="h-8 w-8 rounded-lg border border-stone-300 text-lg leading-none text-stone-700 disabled:opacity-30"
                  >
                    −
                  </button>
                  <span className="w-6 text-center text-base font-bold tabular-nums" aria-label={`${p.name}の割合`}>
                    {value}
                  </span>
                  <button
                    type="button"
                    aria-label={`${p.name}の割合を1増やす`}
                    disabled={value >= MAX_SHARE}
                    onClick={() => setShares({ ...shares, [p.id]: value + 1 })}
                    className="h-8 w-8 rounded-lg border border-stone-300 text-lg leading-none text-stone-700 disabled:opacity-30"
                  >
                    +
                  </button>
                </div>
                <span className="w-20 shrink-0 text-right text-sm font-bold tabular-nums text-stone-900">
                  {amount === undefined ? "—" : yen(amount)}
                </span>
              </li>
            );
          })}
        </ul>
        {split.allocation ? (
          <p className="text-sm text-stone-800">
            配る合計 <b className="tabular-nums">{yen(split.allocation.distributed)}</b>・お店に残る{" "}
            <b className="tabular-nums">{yen(split.allocation.leftover)}</b>
          </p>
        ) : (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{split.error}</p>
        )}
        <details className="text-xs leading-relaxed text-stone-700">
          <summary className="cursor-pointer font-semibold">分け方の決まり（プログラムが行う計算）</summary>
          <ol className="mt-1 list-decimal pl-5">
            {RULE_TEXT.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ol>
        </details>
        {!isSaved && (
          <button type="button" onClick={reset} className="self-start text-sm font-semibold text-emerald-700 underline underline-offset-4">
            架空の店長の決めに戻す
          </button>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold text-stone-900">一人ずつの「ありがとう」</h2>
        <p className="text-xs leading-relaxed text-stone-600">
          手紙の係（Claude）が、確かめた事実だけから本人の母語で書きます。金額は上の計算の数をそのまま入れます。プログラムが1通ずつ確かめます: 金額がちょうど1回・ほかのお金の数なし・使った事実が本物・人柄の言葉なし・言語が合っている。
        </p>
        {shown ? (
          <>
            <p className="text-[11px] text-stone-500">
              {shown.letters.length}通・{shown.seconds}秒・{usd(shown.costUsd)}・{modelLabel(shown.model)}
              {shown === data.letters ? "（保存した結果）" : "（今書いた結果）"}
            </p>
            {shown.letters.map((l) => (
              <LetterCard key={l.personId} row={l} />
            ))}
          </>
        ) : (
          <div className="flex flex-col gap-2 rounded-xl border border-dashed border-stone-300 p-4 text-sm text-stone-700">
            <p>決めが変わったので、手紙は書き直しになります。</p>
            {data.live ? (
              <button
                type="button"
                disabled={busy || !split.allocation}
                onClick={writeLetters}
                className="rounded-xl bg-emerald-700 px-4 py-3 text-base font-bold text-white disabled:bg-stone-300"
              >
                {busy ? "Claude が書いています…（30秒ほど）" : "この決めで手紙を書く（Claude）"}
              </button>
            ) : (
              <>
                <p className="text-xs leading-relaxed text-stone-500">この環境では Claude を呼ばない設定です。保存した手紙は、架空の店長の決めの分です。</p>
                <button type="button" onClick={reset} className="self-start text-sm font-semibold text-emerald-700 underline underline-offset-4">
                  架空の店長の決めに戻して手紙を見る
                </button>
              </>
            )}
            {letterError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{letterError}</p>}
          </div>
        )}
      </section>

      <BehindTheScenes run={data.run} letters={shown ?? data.letters} />
    </div>
  );
}

function Summary({ view, run }: { view: MonthView; run: FactsRun }) {
  const t = view.totals;
  const s = run.score;
  const events = view.persons.flatMap((p) => [...p.green, ...p.yellow]);
  const by = (v: string) => events.filter((e) => e.verdict === v).length;
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-stone-200 bg-white p-4">
      <h2 className="text-base font-bold text-stone-900">10月の1行から</h2>
      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat n={t.lines} label="毎日の1行" />
        <Stat n={t.facts} label="取り出した事実" />
        <Stat n={t.events} label="出来事" />
      </div>
      <ul className="flex flex-col gap-0.5 text-xs leading-relaxed text-stone-700">
        <li>同じ出来事を2人が書いた → 1つにまとめた: {t.duplicates}</li>
        <li>本人だけが書いたこと（黄）: {t.selfOnly}</li>
        <li>人についてのうわさ・決めつけ → 捨てた: {t.dropped.gossip + t.dropped.judgement}</li>
        <li>だれが何をしたか分からない → 捨てた: {t.dropped.vague}</li>
      </ul>
      <p className="text-[11px] leading-relaxed text-stone-500">捨てた1行は数だけを出し、だれのことかは出しません。</p>
      <p className="text-xs leading-relaxed text-stone-700">
        店長の物差しで見ると（出来事 {t.events}）: <span className="whitespace-nowrap font-semibold text-emerald-800">付ける {by("付ける")}</span>・
        <span className="whitespace-nowrap font-semibold text-amber-800">迷う {by("迷う")}</span>（物差しで決められない = 店長が決める）・
        <span className="whitespace-nowrap">付けない {by("付けない")}</span>
      </p>
      <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs leading-relaxed text-emerald-900">
        架空のデータに隠した答えと比べると: 二重 {s.duplicates.found}/{s.duplicates.expected}・本人だけ {s.selfOnly.found}/
        {s.selfOnly.expected}・捨てる {s.dropped.found}/{s.dropped.expected}・だれが {s.actor.correct}/{s.actor.checked}・だれのため{" "}
        {s.forWhom.correct}/{s.forWhom.checked}
      </p>
    </section>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="rounded-lg bg-stone-50 px-1 py-2">
      <p className="text-xl font-bold tabular-nums text-stone-900">{n}</p>
      <p className="text-[11px] text-stone-500">{label}</p>
    </div>
  );
}

function PersonCard({ person, scale }: { person: PersonView; scale: number }) {
  const [open, setOpen] = useState(false);
  const g = person.green.length;
  const y = person.yellow.length;
  const give = person.green.filter((e) => e.verdict === "付ける").length;
  const unsure = person.green.filter((e) => e.verdict === "迷う").length;
  return (
    <div className="rounded-xl border border-stone-200 bg-white">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full flex-col gap-2 p-3 text-left">
        <div className="flex items-baseline justify-between gap-2">
          <span className="shrink-0 text-base font-bold text-stone-900">{person.name}</span>
          <span className="text-right text-[11px] text-stone-500">
            {LANG_LABEL[person.lang]}・本人が書いた1行 {person.wrote}
          </span>
        </div>
        <div className="flex h-2.5 overflow-hidden rounded-full bg-stone-100" aria-hidden>
          <div className="bg-emerald-500" style={{ width: `${(g / scale) * 100}%` }} />
          <div className="bg-amber-400" style={{ width: `${(y / scale) * 100}%` }} />
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-emerald-800">
            緑 {g}（付ける {give}・迷う {unsure}）
          </span>
          <span className="text-amber-800">黄 {y}</span>
          <span className="ml-auto text-stone-400">{open ? "閉じる ▲" : "開く ▼"}</span>
        </div>
      </button>
      {open && (
        <div className="flex flex-col gap-3 px-3 pb-3">
          {g > 0 && (
            <div>
              <h3 className="text-xs font-bold text-emerald-800">ほかの人が書いた頑張り（緑）</h3>
              <ul>
                {person.green.map((e) => (
                  <EventItem key={e.id} event={e} />
                ))}
              </ul>
            </div>
          )}
          {y > 0 && (
            <div>
              <h3 className="text-xs font-bold text-amber-800">本人だけが書いたこと（黄）</h3>
              <ul>
                {person.yellow.map((e) => (
                  <EventItem key={e.id} event={e} />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EventItem({ event }: { event: EventView }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="border-t border-stone-100 py-2">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-start gap-2 text-left">
        <span className="w-10 shrink-0 pt-0.5 text-xs tabular-nums text-stone-500">{md(event.date)}</span>
        <span className="flex-1 text-sm leading-snug text-stone-800">{withoutActor(event.action, event.actorId)}</span>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${VERDICT_STYLE[event.verdict] ?? ""}`}>{event.verdict}</span>
      </button>
      {event.writers.length > 1 && <p className="ml-12 mt-0.5 text-[11px] text-stone-500">{event.writers.length}人が書いた（1つにまとめた）</p>}
      {open && (
        <div className="ml-12 mt-1.5 flex flex-col gap-1.5">
          {event.lines.map((l) => (
            <blockquote key={l.entryId} className="rounded-lg bg-stone-50 px-2.5 py-1.5 text-xs leading-relaxed text-stone-800">
              <span className="block text-[11px] text-stone-500">
                {staffName(l.authorId)} が書いた（{LANG_LABEL[l.lang]}）
              </span>
              {l.text}
            </blockquote>
          ))}
          <p className="text-[11px] leading-relaxed text-stone-500">物差し: {event.reason}</p>
        </div>
      )}
    </li>
  );
}

function LetterCard({ row }: { row: LetterRow }) {
  const used = row.usedEntryIds.map((id) => row.reasons.find((r) => r.entryId === id)).filter((r) => r !== undefined);
  return (
    <article className="flex flex-col gap-2 rounded-xl border border-emerald-200 bg-white p-4">
      <header className="flex items-baseline justify-between gap-2">
        <h3 className="text-base font-bold text-stone-900">{staffName(row.personId)}</h3>
        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-sm font-bold tabular-nums text-emerald-900">{row.amountText}</span>
      </header>
      {row.letter ? (
        <>
          <p className="text-[11px] text-stone-500">
            {LANG_LABEL[row.lang]}・{row.attempts === 1 ? "1回目で確かめに通った" : `${row.attempts}回目で通った（前の案の問題を伝えて書き直し）`}
          </p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-stone-800">{row.letter}</p>
          {row.lang !== "ja" && row.japanese && (
            <details className="text-xs">
              <summary className="cursor-pointer font-semibold text-stone-600">日本語（店長の確認用）</summary>
              <p className="mt-1 whitespace-pre-wrap leading-relaxed text-stone-700">{row.japanese}</p>
            </details>
          )}
          <details className="text-xs">
            <summary className="cursor-pointer font-semibold text-stone-600">手紙に使った事実 {used.length}件</summary>
            <ul className="mt-1 flex flex-col gap-1.5">
              {used.map((r) => (
                <li key={r.entryId} className="leading-relaxed text-stone-700">
                  <span className="tabular-nums text-stone-500">{md(r.date)}</span> {withoutActor(r.action, row.personId)}
                  <blockquote className="mt-0.5 rounded-lg bg-stone-50 px-2.5 py-1 text-stone-600">{r.line}</blockquote>
                </li>
              ))}
            </ul>
          </details>
        </>
      ) : (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">
          <p>確かめに通りませんでした（この手紙は店長に出しません）。</p>
          <ul className="mt-1 list-disc pl-5">
            {row.problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

function BehindTheScenes({ run, letters }: { run: FactsRun; letters: LettersRun | null }) {
  const rows = [
    { who: "事実の係（サブエージェント）", model: modelLabel(run.models.extractor ?? ""), what: "店長の物差しのスキルを読み、1日ずつ1行を事実に直す", cost: `180行・${run.seconds}秒・${usd(run.costUsd)}（確かめの係と合わせて）` },
    { who: "確かめの係（サブエージェント）", model: modelLabel(run.models.checker ?? ""), what: "同じ出来事らしい組を出すだけ。まとめるかはプログラムが決める", cost: "" },
    { who: "お金の計算", model: "プログラム", what: "割合から1円まで分ける。Claude には計算させない", cost: "" },
    ...(letters
      ? [{ who: "手紙の係（サブエージェント）", model: modelLabel(letters.model), what: "確かめた事実だけで母語の手紙。プログラムが確かめ、通らなければ1回だけ書き直し", cost: `${letters.letters.length}通・${letters.seconds}秒・${usd(letters.costUsd)}` }]
      : []),
  ];
  return (
    <details className="rounded-xl border border-stone-200 bg-white p-4 text-xs leading-relaxed text-stone-700">
      <summary className="cursor-pointer text-sm font-bold text-stone-900">この画面の裏側（Claude の使い方）</summary>
      <ul className="mt-2 flex flex-col gap-2">
        {rows.map((r) => (
          <li key={r.who}>
            <p className="font-semibold text-stone-900">
              {r.who} — {r.model}
            </p>
            <p>{r.what}</p>
            {r.cost && <p className="text-stone-500">{r.cost}</p>}
          </li>
        ))}
      </ul>
    </details>
  );
}
