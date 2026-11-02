import Link from "next/link";
import EntryForm from "./EntryForm";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-1">
        <p className="text-xs font-semibold tracking-wide text-emerald-700">見えない頑張りを拾う</p>
        <h1 className="text-2xl font-bold text-stone-900">今日の1行</h1>
        <p className="text-sm leading-relaxed text-stone-600">
          今日、だれかに助けられたこと・だれかが黙ってやってくれたことを、1行だけ。母語で大丈夫です。
        </p>
      </header>
      <EntryForm />
      <Link href="/monosashi" className="text-center text-sm font-semibold text-emerald-700 underline underline-offset-4">
        店長の方へ: 物差しをつくる →
      </Link>
      <footer className="mt-auto text-center text-xs leading-relaxed text-stone-400">
        すべてのデータは架空です。決めるのは店長で、AI は配分を決めません。
      </footer>
    </main>
  );
}
