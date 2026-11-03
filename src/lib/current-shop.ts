// The shop for a page (Next.js only). The shop file is read with plain synchronous file reads, which a
// prerender would bake into the page at build time. So for a real shop, rendering waits for the request
// (connection()) and the shop is read every time; the fictional café's pages stay prerendered as before.
// ページ用のお店 (Next.js だけ)。本物のお店は毎回読み直し、架空のカフェのページは今までどおり前もって作る。

import { connection } from "next/server";
import { shopConfig, type ShopConfig } from "./shop-config.ts";

export async function currentShop(): Promise<ShopConfig> {
  if (process.env.MIENAI_SHOP_FILE) await connection();
  return shopConfig();
}
