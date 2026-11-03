"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LANG_LABEL, PLACEHOLDER, type Staff } from "@/lib/staff";

type Saved = { text: string; date: string; lang: keyof typeof LANG_LABEL };

/** One example line per language for first-time visitors of the demo (names from the fictional café). */
function exampleLine(me: Staff): string {
  if (me.lang === "vi") return "Hôm nay Haruka đã ở lại sau giờ làm để lau sàn bếp giúp mọi người.";
  if (me.lang === "id") return "Hari ini Kenji membantu saya mengangkat kotak berat dari gudang.";
  return `閉店後、${me.id === "miyuki" ? "けんじ" : "みゆき"}さんが黙って冷蔵庫の中を全部ふいてくれた。`;
}

/**
 * staff: the names to pick from (the fictional café's or the real shop's). real: a real shop, so no fictional lines are counted.
 * demo: the static phone demo, which adds a how-to line, an example button and a big "next" button after saving.
 */
export default function EntryForm({ staff, real, demo = false }: { staff: readonly Staff[]; real: boolean; demo?: boolean }) {
  const [authorId, setAuthorId] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<Saved | null>(null);
  const [total, setTotal] = useState<number | null>(null);

  const me = staff.find((s) => s.id === authorId);

  useEffect(() => {
    fetch("/api/entries?limit=1")
      .then((r) => r.json())
      .then((d) => setTotal(d.total))
      .catch(() => {});
  }, [saved]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const r = await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authorId, text }),
      });
      const d = await r.json();
      if (!r.ok) {
        setError(d.error || "保存できませんでした");
        return;
      }
      setSaved({ text: d.entry.text, date: d.entry.date, lang: d.entry.lang });
      setText("");
    } catch {
      setError("保存できませんでした（通信）");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      {demo && (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm leading-relaxed text-emerald-900">
          <span className="font-bold">① スタッフの画面</span>　スタッフのだれか1人になったつもりで名前を選び、1行書いてみてください。迷ったら「例を入れる」を押すだけで大丈夫です。
        </p>
      )}
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold text-stone-600">あなたの名前（一覧から選ぶだけ）</legend>
        <div className="grid grid-cols-2 gap-2">
          {staff.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setAuthorId(s.id)}
              aria-pressed={authorId === s.id}
              className={`rounded-xl border px-3 py-3 text-left text-base ${
                authorId === s.id ? "border-emerald-600 bg-emerald-50 font-semibold" : "border-stone-300 bg-white"
              }`}
            >
              {s.name}
              <span className="block text-xs text-stone-500">{LANG_LABEL[s.lang]}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-2">
        <span className="flex items-center justify-between gap-2 text-sm font-semibold text-stone-600">
          今日の1行（母語で大丈夫です）
          {demo && me && (
            <button
              type="button"
              onClick={() => setText(exampleLine(me))}
              className="shrink-0 rounded-lg border border-emerald-600 px-2.5 py-1 text-xs font-bold text-emerald-700"
            >
              例を入れる
            </button>
          )}
        </span>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={me ? PLACEHOLDER[me.lang] : PLACEHOLDER.ja}
          lang={me?.lang ?? "ja"}
          maxLength={400}
          className="rounded-xl border border-stone-300 bg-white px-3 py-3 text-base"
        />
      </label>

      {error && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{error}</p>}

      <button
        type="submit"
        disabled={busy || !authorId || !text}
        className="rounded-xl bg-emerald-700 px-4 py-3 text-base font-semibold text-white disabled:bg-stone-300"
      >
        {busy ? "保存しています…" : "保存する"}
      </button>

      {saved && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm">
          <p className="font-semibold text-emerald-800">保存しました（{saved.date}・{LANG_LABEL[saved.lang]}）</p>
          <p className="mt-1 whitespace-pre-wrap text-stone-800" lang={saved.lang}>
            {saved.text}
          </p>
          <p className="mt-1 text-xs text-stone-500">書いたままの文で保存されます。訳や書き直しはしません。</p>
          {demo && (
            <div className="mt-3 flex flex-col gap-3 border-t border-emerald-200 pt-3">
              <p className="leading-relaxed text-stone-800">
                月末に Claude がこの1行を読み、「だれが・だれのために・何をしたか」を拾って、店長の画面に並べます。
                <span className="block text-xs text-stone-500">（試し版では Claude を止めているので、架空の10月の180行を読んだ結果を見せます）</span>
              </p>
              <Link href="/month" className="rounded-xl bg-emerald-700 py-3.5 text-center text-base font-bold text-white shadow-sm">
                次へ：② 店長として月末を見る →
              </Link>
            </div>
          )}
        </div>
      )}

      {total !== null && <p className="text-center text-xs text-stone-500">これまでの記録: {total} 行{real ? "" : "（架空のデータを含む）"}</p>}
    </form>
  );
}
