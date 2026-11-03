import Link from "next/link";

/** A page that does not exist: say so in plain words and offer the way back to the first page. */
export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <p className="text-xs font-semibold tracking-wide text-emerald-700">見えない頑張りを拾う</p>
      <h1 className="text-xl font-bold text-stone-900">このページは見つかりませんでした</h1>
      <p className="text-sm leading-relaxed text-stone-600">リンクの終わりに、ほかの文字がついていたかもしれません。</p>
      <Link href="/" className="rounded-xl bg-emerald-700 px-6 py-3.5 text-base font-bold text-white shadow-sm">
        最初の画面へ
      </Link>
    </main>
  );
}
