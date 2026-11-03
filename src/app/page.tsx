import Link from "next/link";
import { Suspense } from "react";
import { currentShop } from "@/lib/current-shop";
import { DemoGuide } from "./DemoNote";
import EntryForm from "./EntryForm";
import ShopFooter from "./ShopFooter";

/** The names to pick from: the fictional café's 8, or the real shop's staff from its shop file. */
async function Entry() {
  const { staff, real } = await currentShop();
  return <EntryForm staff={staff} real={real} />;
}

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-4 py-8">
      <DemoGuide />
      <header id="write" className="flex scroll-mt-4 flex-col gap-1">
        <p className="text-xs font-semibold tracking-wide text-emerald-700">見えない頑張りを拾う</p>
        <h1 className="text-2xl font-bold text-stone-900">今日の1行</h1>
        <p className="text-sm leading-relaxed text-stone-600">
          今日、だれかに助けられたこと・だれかが黙ってやってくれたことを、1行だけ。母語で大丈夫です。
        </p>
      </header>
      <Suspense fallback={<p className="text-sm text-stone-500">読み込み中…</p>}>
        <Entry />
      </Suspense>
      <div className="flex flex-col items-center gap-2">
        <Link href="/monosashi" className="text-sm font-semibold text-emerald-700 underline underline-offset-4">
          店長の方へ: 物差しをつくる →
        </Link>
        <Link href="/month" className="text-sm font-semibold text-emerald-700 underline underline-offset-4">
          店長の方へ: 月末のふりかえり →
        </Link>
      </div>
      <ShopFooter />
    </main>
  );
}
