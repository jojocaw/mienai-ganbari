import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { currentShop } from "@/lib/current-shop";
import { STAFF } from "@/lib/staff";
import { DEMO_EXPORT } from "../DemoNote";
import ShopFooter from "../ShopFooter";
import DemoExample from "./DemoExample";
import DemoYourLines from "./DemoYourLines";
import MonthBoard from "./MonthBoard";

export const metadata: Metadata = {
  title: "月末のふりかえり (mienai-ganbari)",
};

async function Intro() {
  const shop = await currentShop();
  return shop.real
    ? `${shop.name}の1か月。スタッフが毎日書いた1行から、Claude が事実だけを取り出し、店長の物差しを当てます。だれにいくら届けるかを決めるのは店長です。`
    : "架空のカフェの10月。スタッフ8人が毎日書いた1行から、Claude が事実だけを取り出し、店長の物差しを当てました。だれにいくら届けるかを決めるのは店長です。";
}

export default function MonthPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-4 py-8 sm:max-w-xl">
      <header className="flex flex-col gap-1">
        <Link href="/" className="text-xs font-semibold tracking-wide text-emerald-700">
          ← 見えない頑張りを拾う
        </Link>
        <h1 className="text-2xl font-bold text-stone-900">月末のふりかえり</h1>
        <p className="text-sm leading-relaxed text-stone-600">
          <Suspense fallback={null}>
            <Intro />
          </Suspense>
        </p>
      </header>
      {DEMO_EXPORT && <DemoYourLines names={Object.fromEntries(STAFF.map((s) => [s.id, s.name]))} />}
      <DemoExample />
      <MonthBoard />
      <ShopFooter />
    </main>
  );
}
