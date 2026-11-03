import Script from "next/script";

// Only in the static demo for GitHub Pages (`npm run demo:build`): a note at the top of every page, and the shim
// that answers the pages' /api calls in the browser. In the normal app this renders nothing.
// 試し版 (GitHub Pages) の時だけ: 各ページの上のお知らせと、ブラウザの中で /api に答える shim。ふだんのアプリでは何も出さない。

export const DEMO_EXPORT = process.env.MIENAI_DEMO_EXPORT === "1";

export function DemoNote() {
  if (!DEMO_EXPORT) return null;
  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-[12px] leading-relaxed text-amber-950">
      <div className="mx-auto flex max-w-xl flex-col gap-1">
        <p>
          <span className="font-bold">試し版です。</span>
          データはすべて架空で、書いた1行はこの端末の中にだけ残ります。Claude を呼ぶ所は止めてあり、架空の1か月で Claude が実際に出した結果を見せています。
        </p>
        <p className="text-amber-900/80">
          Demo: all data is fictional, and lines you write stay on this device. Claude calls are switched off; you see the real
          results Claude produced for the fictional month.{" "}
          <a href="https://github.com/jojocaw/mienai-ganbari" className="font-semibold underline underline-offset-2">
            README &amp; code
          </a>
        </p>
      </div>
    </div>
  );
}

export function DemoShim() {
  if (!DEMO_EXPORT) return null;
  return <Script src="/mienai-ganbari/demo/shim.js" strategy="beforeInteractive" />;
}
