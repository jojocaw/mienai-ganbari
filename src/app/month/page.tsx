import type { Metadata } from "next";
import Link from "next/link";
import MonthBoard from "./MonthBoard";

export const metadata: Metadata = {
  title: "月末のふりかえり (mienai-ganbari)",
};

export default function MonthPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-4 py-8 sm:max-w-xl">
      <header className="flex flex-col gap-1">
        <Link href="/" className="text-xs font-semibold tracking-wide text-emerald-700">
          ← 見えない頑張りを拾う
        </Link>
        <h1 className="text-2xl font-bold text-stone-900">月末のふりかえり</h1>
        <p className="text-sm leading-relaxed text-stone-600">
          架空のカフェの10月。スタッフ8人が毎日書いた1行から、Claude が事実だけを取り出し、店長の物差しを当てました。だれにいくら届けるかを決めるのは店長です。
        </p>
      </header>
      <MonthBoard />
      <footer className="mt-auto text-center text-xs leading-relaxed text-stone-400">
        すべてのデータは架空です。決めるのは店長で、AI は配分を決めません。
      </footer>
    </main>
  );
}
