import { Suspense } from "react";
import { currentShop } from "@/lib/current-shop";

const DEMO = "すべてのデータは架空です。決めるのは店長で、AI は配分を決めません。";
const REAL = "毎日の1行と結果は手元のフォルダに保存し、公開しません（Claude に読ませる時だけ送ります）。決めるのは店長で、AI は配分を決めません。";

async function FooterText() {
  const { real } = await currentShop();
  return real ? REAL : DEMO;
}

/** The page footer: the fictional café says its data is made up; a real shop says where its data stays. */
export default function ShopFooter() {
  return (
    <footer className="mt-auto text-center text-xs leading-relaxed text-stone-400">
      <Suspense fallback={null}>
        <FooterText />
      </Suspense>
    </footer>
  );
}
