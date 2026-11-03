"use client";

import { useEffect, useState } from "react";
import { LANG_LABEL, PLACEHOLDER, type Staff } from "@/lib/staff";

type Saved = { text: string; date: string; lang: keyof typeof LANG_LABEL };

/** staff: the names to pick from (the fictional café's or the real shop's). real: a real shop, so no fictional lines are counted. */
export default function EntryForm({ staff, real }: { staff: readonly Staff[]; real: boolean }) {
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
        <span className="text-sm font-semibold text-stone-600">今日の1行（母語で大丈夫です）</span>
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
        </div>
      )}

      {total !== null && <p className="text-center text-xs text-stone-500">これまでの記録: {total} 行{real ? "" : "（架空のデータを含む）"}</p>}
    </form>
  );
}
