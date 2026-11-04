"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ASK_WORDS } from "@/lib/askback/words";
import { LANG_LABEL, PLACEHOLDER, type Staff } from "@/lib/staff";

type Saved = { id: string; text: string; date: string; lang: keyof typeof LANG_LABEL };

/** One example line per language for first-time visitors of the demo (names from the fictional café). */
function exampleLine(me: Staff): string {
  if (me.lang === "vi") return "Hôm nay Haruka đã ở lại sau giờ làm để lau sàn bếp giúp mọi người.";
  if (me.lang === "id") return "Hari ini Kenji membantu saya mengangkat kotak berat dari gudang.";
  return `閉店後、${me.id === "miyuki" ? "けんじ" : "みゆき"}さんが黙って冷蔵庫の中を全部ふいてくれた。`;
}

/** F10 (demo): a line too vague to say who did what, the same sentences as the fictional month's vague lines. */
function vagueLine(me: Staff): string {
  if (me.lang === "vi") return "Hôm nay mọi người đều cố gắng.";
  if (me.lang === "id") return "Semua orang bekerja keras hari ini.";
  return "いろいろ手伝いました。";
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
  // F10: one question back about a vague line, shown after the line is saved
  const [asking, setAsking] = useState(false);
  const [question, setQuestion] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [answered, setAnswered] = useState<string | null>(null);
  const [answerError, setAnswerError] = useState("");
  const [answerBusy, setAnswerBusy] = useState(false);

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
      setSaved({ id: d.entry.id, text: d.entry.text, date: d.entry.date, lang: d.entry.lang });
      setText("");
      askAbout(d.entry.id);
    } catch {
      setError("保存できませんでした（通信）");
    } finally {
      setBusy(false);
    }
  }

  /** F10: the line is already saved; Claude may ask one question back. Nothing is shown when it does not. */
  function askAbout(entryId: string) {
    setQuestion(null);
    setAnswer("");
    setAnswered(null);
    setAnswerError("");
    setAsking(true);
    fetch("/api/entries/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entryId }) })
      .then((r) => (r.ok ? r.json() : { question: null }))
      .then((d: { question?: string | null }) => setQuestion(typeof d.question === "string" && d.question ? d.question : null))
      .catch(() => {})
      .finally(() => setAsking(false));
  }

  async function sendAnswer() {
    if (!saved || !answer) return;
    setAnswerError("");
    setAnswerBusy(true);
    try {
      const r = await fetch("/api/entries/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId: saved.id, answer }),
      });
      const d = await r.json();
      if (!r.ok) {
        setAnswerError(d.error || "保存できませんでした");
        return;
      }
      setAnswered(d.entry.clarification.answer);
      setQuestion(null);
    } catch {
      setAnswerError("保存できませんでした（通信）");
    } finally {
      setAnswerBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      {demo && (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm leading-relaxed text-emerald-900">
          <span className="font-bold">① スタッフの画面</span>　スタッフのだれか1人になったつもりで名前を選び、1行書いてみてください。迷ったら「例を入れる」を押すだけで大丈夫です。「あいまいな例」では、Claude が1つだけ聞き返す様子が見られます。
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
        <span className="flex flex-wrap items-center justify-between gap-2 text-sm font-semibold text-stone-600">
          <span className="whitespace-nowrap">今日の1行（母語で大丈夫です）</span>
          {demo && me && (
            <span className="flex shrink-0 gap-1.5">
              <button
                type="button"
                onClick={() => setText(exampleLine(me))}
                className="rounded-lg border border-emerald-600 px-2.5 py-1 text-xs font-bold text-emerald-700"
              >
                例を入れる
              </button>
              <button
                type="button"
                onClick={() => setText(vagueLine(me))}
                className="rounded-lg border border-sky-600 px-2.5 py-1 text-xs font-bold text-sky-700"
              >
                あいまいな例
              </button>
            </span>
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
          {asking && <p className="mt-2 text-xs text-stone-500">…</p>}
          {question && (
            <div className="mt-3 flex flex-col gap-2 rounded-lg border border-sky-300 bg-white p-3">
              <p className="text-xs font-semibold text-sky-800" lang={saved.lang}>
                {ASK_WORDS[saved.lang].head}
              </p>
              <p className="text-base font-semibold text-stone-900" lang={saved.lang}>
                {question}
              </p>
              <input
                type="text"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    sendAnswer();
                  }
                }}
                placeholder={ASK_WORDS[saved.lang].placeholder}
                lang={saved.lang}
                maxLength={400}
                aria-label={question}
                className="rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-base"
              />
              {answerError && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{answerError}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={sendAnswer}
                  disabled={answerBusy || !answer}
                  className="flex-1 rounded-lg bg-sky-700 px-3 py-2.5 text-sm font-semibold text-white disabled:bg-stone-300"
                  lang={saved.lang}
                >
                  {ASK_WORDS[saved.lang].add}
                </button>
                <button
                  type="button"
                  onClick={() => setQuestion(null)}
                  className="rounded-lg border border-stone-300 px-3 py-2.5 text-sm text-stone-700"
                  lang={saved.lang}
                >
                  {ASK_WORDS[saved.lang].skip}
                </button>
              </div>
              {demo && (
                <p className="text-[11px] leading-relaxed text-stone-500">試し版では Claude を止めているので、用意しておいた聞き返しを出しています。本物では Claude がこの1行を読んで、だれが何をしたか分からない時だけ、その人の言葉で1つだけ聞き返します。</p>
              )}
            </div>
          )}
          {answered && (
            <div className="mt-2 border-l-2 border-sky-300 pl-2">
              <p className="text-stone-800" lang={saved.lang}>
                {answered}
              </p>
              <p className="text-xs text-sky-800" lang={saved.lang}>
                {ASK_WORDS[saved.lang].added}
              </p>
            </div>
          )}
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
