import type { Metadata } from "next";
import Link from "next/link";
import MonosashiForm from "./MonosashiForm";

export const metadata: Metadata = {
  title: "店長の物差し (mienai-ganbari)",
};

export default function MonosashiPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-1">
        <Link href="/" className="text-xs font-semibold tracking-wide text-emerald-700">
          ← 見えない頑張りを拾う
        </Link>
        <h1 className="text-2xl font-bold text-stone-900">店長の物差し</h1>
        <p className="text-sm leading-relaxed text-stone-600">
          10問に答えると、Claude があなたの決まりを、Claude が読める「スキル」のファイルに書き出します。人柄や態度の言葉は入りません。決めるのは店長です。
        </p>
      </header>
      <MonosashiForm />
      <footer className="mt-auto text-center text-xs leading-relaxed text-stone-400">
        すべてのデータは架空です。決めるのは店長で、AI は配分を決めません。
      </footer>
    </main>
  );
}
