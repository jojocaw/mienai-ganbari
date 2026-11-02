"use client";

import { useEffect, useMemo, useState } from "react";
import { findCharacterWords, wordLabel, type SkillLint } from "@/lib/monosashi/lint";
import { QUESTIONS } from "@/lib/monosashi/questions";

type Skill = { relPath: string; text: string; lint: SkillLint };
type Written = Skill & { attempts: number; answerWords: { word: string; questionId: string }[] };

export default function MonosashiForm() {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [live, setLive] = useState(false);
  const [skill, setSkill] = useState<Skill | null>(null);
  const [written, setWritten] = useState<Written | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [problems, setProblems] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/monosashi")
      .then((r) => r.json())
      .then((d) => {
        setAnswers(d.demoAnswers ?? {});
        setSkill(d.skill);
        setLive(Boolean(d.live));
      })
      .catch(() => setError("読み込めませんでした"));
  }, []);

  const wordsByQuestion = useMemo(
    () => Object.fromEntries(QUESTIONS.map((q) => [q.id, [...new Set(findCharacterWords(answers[q.id] ?? "").map((h) => wordLabel(h.word)))]])),
    [answers],
  );
  const answerWordCount = Object.values(wordsByQuestion).reduce((n, w) => n + w.length, 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setProblems([]);
    setBusy(true);
    try {
      const r = await fetch("/api/monosashi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const d = await r.json();
      if (!r.ok) {
        setError(d.error || "書き出せませんでした");
        setProblems(d.problems ?? []);
        return;
      }
      setWritten(d.result);
      setSkill(d.result);
    } catch {
      setError("通信できませんでした");
    } finally {
      setBusy(false);
    }
  }

  const shown = written ?? skill;

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={submit} className="flex flex-col gap-5">
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
          架空の店長の答えが入っています。書きかえて試せます。
        </p>
        {QUESTIONS.map((q) => (
          <label key={q.id} className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold leading-snug text-stone-800">
              {q.no}. {q.text}
            </span>
            <textarea
              value={answers[q.id] ?? ""}
              onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
              placeholder={q.hint}
              rows={Math.min(6, Math.max(2, Math.ceil([...(answers[q.id] ?? "")].length / 20) + 1))}
              maxLength={400}
              className="w-full resize-y rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm leading-relaxed text-stone-900 focus:border-emerald-600 focus:outline-none"
            />
            {wordsByQuestion[q.id]?.length > 0 && (
              <span className="text-xs text-amber-800">
                人柄・態度の言葉「{wordsByQuestion[q.id].join("・")}」は、スキルには入れず行動の言葉にします
              </span>
            )}
          </label>
        ))}
        <button
          type="submit"
          disabled={!live || busy}
          className="rounded-xl bg-emerald-700 px-4 py-3 text-base font-bold text-white disabled:bg-stone-300"
        >
          {busy ? "Claude が書いています…（30秒ほど）" : "スキルに書き出す（Claude）"}
        </button>
        {!live && (
          <p className="text-xs leading-relaxed text-stone-500">
            この環境では Claude を呼ばない設定です。保存済みのスキルを下に出しています。
          </p>
        )}
        {error && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
            <p>{error}</p>
            {problems.length > 0 && (
              <ul className="mt-1 list-disc pl-5 text-xs">
                {problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </form>

      {shown && (
        <section className="flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
          <h2 className="text-base font-bold text-stone-900">書き出したスキル</h2>
          <p className="break-all font-mono text-xs text-stone-600">{shown.relPath}</p>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-900">付ける {shown.lint.counts.give}</span>
            <span className="rounded-full bg-stone-200 px-2.5 py-1 text-stone-800">付けない {shown.lint.counts.dontGive}</span>
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-900">迷う {shown.lint.counts.unsure}</span>
            <span className="rounded-full bg-sky-100 px-2.5 py-1 text-sky-900">例 {shown.lint.counts.examples}</span>
          </div>
          <p className="text-sm text-stone-800">
            人柄・態度の言葉: 答えに <b>{written ? written.answerWords.length : answerWordCount}</b> 件 → スキルに{" "}
            <b className={shown.lint.characterWords.length === 0 ? "text-emerald-700" : "text-red-700"}>{shown.lint.characterWords.length}</b> 件
          </p>
          {written && (
            <p className="text-xs text-stone-600">
              {written.attempts === 1 ? "1回目の案で確かめに通りました。" : `${written.attempts}回目で通りました（前の案の問題を Claude に伝えて書き直し）。`}
            </p>
          )}
          {!shown.lint.ok && (
            <ul className="list-disc pl-5 text-xs text-red-800">
              {shown.lint.problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
          <pre className="max-h-[28rem] overflow-auto whitespace-pre-wrap rounded-lg bg-white p-3 text-xs leading-relaxed text-stone-800">
            {shown.text}
          </pre>
        </section>
      )}
      {!shown && !error && <p className="text-sm text-stone-500">まだスキルは書き出されていません。</p>}
    </div>
  );
}
