import Link from "next/link";
import Script from "next/script";

// Only in the static demo for GitHub Pages (`npm run demo:build`): a one-line note at the top of every page, a guide
// for first-time visitors on the first page, and the shim that answers the pages' /api calls in the browser.
// In the normal app all of this renders nothing.
// 試し版 (GitHub Pages) の時だけ: 各ページの上の1行のお知らせ・最初の画面の案内・ブラウザの中で /api に答える shim。
// ふだんのアプリでは何も出さない。

export const DEMO_EXPORT = process.env.MIENAI_DEMO_EXPORT === "1";

export function DemoNote() {
  if (!DEMO_EXPORT) return null;
  return (
    <details className="group border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-[12px] leading-relaxed text-amber-950">
      <summary className="mx-auto flex max-w-xl cursor-pointer list-none items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
        <span>
          <span className="font-bold">試し版</span>・データはすべて架空です
        </span>
        <span className="shrink-0 font-semibold underline underline-offset-2 group-open:hidden">くわしく</span>
        <span className="hidden shrink-0 font-semibold underline underline-offset-2 group-open:inline">閉じる</span>
      </summary>
      <div className="mx-auto mt-1 flex max-w-xl flex-col gap-1 pb-1">
        <p>
          書いた1行は、この端末の中にだけ残ります。Claude を呼ぶ所は止めてあり、架空の1か月で Claude が実際に出した結果を見せています。
        </p>
        <p className="text-amber-900/80">
          Demo with fictional data. Lines you write stay on this device. Claude calls are switched off; you see the real results Claude produced for the
          fictional month.{" "}
          <a href="https://github.com/jojocaw/mienai-ganbari" className="font-semibold underline underline-offset-2">
            README &amp; code
          </a>
        </p>
      </div>
    </details>
  );
}

/** The first thing a visitor sees in the demo: what the tool is in one line, the three steps, and one big button. */
export function DemoGuide() {
  if (!DEMO_EXPORT) return null;
  return (
    <section className="flex flex-col gap-4 rounded-2xl bg-emerald-700 p-5 text-white shadow-sm">
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold tracking-wide text-emerald-100">3分でできる体験</p>
        <h2 className="text-xl font-bold leading-snug">見えない頑張りに、月末「ありがとう」を届ける道具です</h2>
        <p className="text-sm leading-relaxed text-emerald-50">
          スタッフは毎日1行、だれかに助けられたことを書くだけ。月末に店長が、その1行をもとに一人ひとりへお礼と手紙を届けます。
        </p>
      </div>
      <ol className="flex flex-col gap-2 text-[15px] font-semibold">
        <li className="rounded-xl bg-white/10 px-3 py-2">① スタッフになって、今日の1行を書く</li>
        <li className="rounded-xl bg-white/10 px-3 py-2">② 店長になって、月末のお礼を決める</li>
        <li className="rounded-xl bg-white/10 px-3 py-2">③ 一人ひとりに、母語の手紙が届く</li>
      </ol>
      <a href="#write" className="rounded-xl bg-white py-3.5 text-center text-base font-bold text-emerald-800 shadow-sm">
        ① から始める
      </a>
      <Link href="/month" className="text-center text-sm text-emerald-50 underline underline-offset-4">
        ② の店長の画面から見る →
      </Link>
    </section>
  );
}

/** Step ② in the demo: how to read the month-end page in three lines, and one big button to where the owner decides. */
export function DemoMonthGuide() {
  if (!DEMO_EXPORT) return null;
  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-emerald-700 p-4 text-white shadow-sm">
      <div className="flex flex-col gap-1">
        <p className="text-xs font-semibold tracking-wide text-emerald-100">② 店長の画面</p>
        <h2 className="text-lg font-bold leading-snug">この画面の見方は3つだけ</h2>
      </div>
      <ol className="flex flex-col gap-2 text-sm leading-relaxed">
        <li className="rounded-xl bg-white/10 px-3 py-2">
          <b>1.</b> 「みんなの10月」で、一人ずつの頑張りを見る。<b>緑</b> = ほかの人が名前を書いた頑張り、<b>黄</b> = 本人だけが書いたこと。押すと元の1行が出ます。
        </li>
        <li className="rounded-xl bg-white/10 px-3 py-2">
          <b>2.</b> 「店長が決める」で、＋を押して一人ずつお礼の金額を決める。
        </li>
        <li className="rounded-xl bg-white/10 px-3 py-2">
          <b>3.</b> 一番下で、一人ひとりへの母語の手紙を読む。
        </li>
      </ol>
      <a href="#decide" className="rounded-xl bg-white py-3.5 text-center text-base font-bold text-emerald-800 shadow-sm">
        お礼を決める所へ ↓
      </a>
      <div className="flex justify-center gap-5 text-sm text-emerald-50">
        <a href="#people" className="underline underline-offset-4">
          1. 頑張りを見る ↓
        </a>
        <a href="#letters" className="underline underline-offset-4">
          3. 手紙を先に見る ↓
        </a>
      </div>
    </section>
  );
}

export function DemoShim() {
  if (!DEMO_EXPORT) return null;
  return <Script src="/mienai-ganbari/demo/shim.js" strategy="beforeInteractive" />;
}
