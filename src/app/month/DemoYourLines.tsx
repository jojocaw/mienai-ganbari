"use client";

import { useEffect, useState } from "react";
import { LANG_LABEL, type Lang } from "@/lib/staff";

type Line = { id: string; date: string; authorId: string; lang: Lang; text: string; source: string; clarification?: { question: string; answer?: string } };

/**
 * Static demo only: the lines this visitor wrote on the first page (kept in this browser), so they can see where they
 * went. Shows nothing until a line has been written here.
 * 試し版だけ: 最初の画面で書いた1行 (このブラウザの中だけ) を出して、書いた物がどこへ行ったかを見せる。
 */
export default function DemoYourLines({ names }: { names: Record<string, string> }) {
  const [lines, setLines] = useState<Line[]>([]);
  useEffect(() => {
    fetch("/api/entries?limit=500")
      .then((r) => r.json())
      .then((d: { entries: Line[] }) => setLines(d.entries.filter((e) => e.source === "app")))
      .catch(() => {});
  }, []);
  if (lines.length === 0) return null;
  return (
    <section className="flex flex-col gap-2 rounded-2xl border border-emerald-200 bg-white p-4">
      <h2 className="text-sm font-bold text-emerald-800">あなたが書いた1行（この端末の中だけ）</h2>
      <ul className="flex flex-col gap-2">
        {lines.map((l) => (
          <li key={l.id} className="rounded-xl bg-stone-50 px-3 py-2 text-sm">
            <span className="block text-xs text-stone-500">
              {l.date}・{names[l.authorId] ?? l.authorId}・{LANG_LABEL[l.lang]}
            </span>
            <span lang={l.lang}>{l.text}</span>
            {l.clarification?.answer !== undefined && (
              <span className="mt-1 block border-l-2 border-sky-300 pl-2">
                <span className="block text-xs text-stone-500" lang={l.lang}>
                  書いた直後の聞き返し: {l.clarification.question}
                </span>
                <span lang={l.lang}>{l.clarification.answer}</span>
              </span>
            )}
          </li>
        ))}
      </ul>
      <p className="text-xs leading-relaxed text-stone-500">
        本物では、月末に Claude がこの1行も読んで、下の結果に入ります。試し版では Claude を止めているので、まだ読まれていません。
      </p>
    </section>
  );
}
