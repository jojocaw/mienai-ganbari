// Which shop this copy of the app serves. Server code only (it reads a file).
// Without MIENAI_SHOP_FILE it is the fictional café of the demo (data/seed, the committed yardstick skill).
// With it, the shop file gives the real shop's name and staff list, and everything about the real shop
// (the owner's yardstick skill, its history, the daily lines, the month-end result) stays in that file's folder
// and in data/local, which are never committed.
// どのお店のための画面か (サーバーだけ・ファイルを読むため)。MIENAI_SHOP_FILE が無ければ架空のカフェ (デモ)。
// あれば、そのファイルの店名と名簿を使い、本物のお店の物 (店長の物差し・控え・毎日の1行・月末の結果) は
// そのファイルのフォルダと data/local に置く (どちらも公開しない)。

import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { SHOP } from "./shop.ts";
import { STAFF, type Lang, type Staff } from "./staff.ts";

export interface ShopConfig {
  /** true when a real shop file is set (MIENAI_SHOP_FILE). */
  real: boolean;
  name: string;
  staff: readonly Staff[];
}

export class ShopFileError extends Error {}

const LANGS: readonly Lang[] = ["ja", "vi", "id"];
const ID = /^[a-z0-9][a-z0-9-]{0,31}$/;
const DEMO: ShopConfig = { real: false, name: SHOP.name, staff: STAFF };

/** Absolute path of the real shop file, or null for the fictional demo. */
export function shopFile(): string | null {
  const f = process.env.MIENAI_SHOP_FILE;
  // The shop file lives only on the shop's own computer, so the build never traces or bundles it.
  return f ? path.resolve(/*turbopackIgnore: true*/ process.cwd(), f) : null;
}

/** The real shop's folder (the shop file's folder), or null for the fictional demo. */
export function shopDir(): string | null {
  const f = shopFile();
  return f ? path.dirname(f) : null;
}

/** Checks a parsed shop file and fills the optional fields. Throws ShopFileError with the problem in plain Japanese. */
export function parseShopFile(raw: unknown): ShopConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new ShopFileError("名簿のファイルの形がちがいます ({ \"name\": ..., \"staff\": [...] })");
  const r = raw as Record<string, unknown>;
  const name = typeof r.name === "string" ? r.name.trim() : "";
  if (!name || [...name].length > 40) throw new ShopFileError("お店の名前 (name) を40文字までで入れてください");
  if (!Array.isArray(r.staff) || r.staff.length === 0) throw new ShopFileError("スタッフ (staff) を1人以上入れてください");
  if (r.staff.length > 50) throw new ShopFileError("スタッフは50人までです");
  const seen = new Set<string>();
  const staff: Staff[] = r.staff.map((s: unknown, i: number) => {
    const where = `${i + 1}人目`;
    if (!s || typeof s !== "object" || Array.isArray(s)) throw new ShopFileError(`${where}の形がちがいます`);
    const x = s as Record<string, unknown>;
    const id = typeof x.id === "string" ? x.id : "";
    if (!ID.test(id)) throw new ShopFileError(`${where}の id は、英小文字・数字・- で32文字までにしてください (${String(x.id)})`);
    if (seen.has(id)) throw new ShopFileError(`id (${id}) が2回あります`);
    seen.add(id);
    const shown = typeof x.name === "string" ? x.name.trim() : "";
    if (!shown || [...shown].length > 30) throw new ShopFileError(`${where} (${id}) の名前 (name) を30文字までで入れてください`);
    if (!LANGS.includes(x.lang as Lang)) throw new ShopFileError(`${where} (${id}) の言葉 (lang) は ja / vi / id のどれかです`);
    const text = (key: "roman" | "ja", fallback: string): string => {
      const v = x[key];
      if (v === undefined) return fallback;
      if (typeof v !== "string" || [...v].length > 30) throw new ShopFileError(`${where} (${id}) の ${key} は30文字までの文字です`);
      return v.trim();
    };
    return { id, name: shown, roman: text("roman", ""), ja: text("ja", shown.replace(/さん$/, "")), lang: x.lang as Lang };
  });
  return { real: true, name, staff };
}

let cache: { file: string; mtimeMs: number; config: ShopConfig } | null = null;

/** The shop this copy serves. Reads the shop file again when it changes. */
export function shopConfig(): ShopConfig {
  const file = shopFile();
  if (!file) return DEMO;
  let mtimeMs: number;
  try {
    mtimeMs = statSync(file).mtimeMs;
  } catch {
    throw new ShopFileError(`名簿のファイルが見つかりません (${file})`);
  }
  if (cache && cache.file === file && cache.mtimeMs === mtimeMs) return cache.config;
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    throw new ShopFileError(`名簿のファイルが JSON として読めません (${e instanceof Error ? e.message : String(e)})`);
  }
  const config = parseShopFile(raw);
  cache = { file, mtimeMs, config };
  return config;
}

export const staffList = (): readonly Staff[] => shopConfig().staff;

export const findPerson = (id: string): Staff | undefined => staffList().find((s) => s.id === id);
