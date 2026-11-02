// Fictional staff of a fictional small café. All names are made up for this demo.
// 架空のカフェの架空のスタッフ (名前はすべて架空)。

export type Lang = "ja" | "vi" | "id";

export interface Staff {
  id: string;
  /** Name shown in the staff picker (Japanese UI). */
  name: string;
  /** Name used inside Vietnamese / Indonesian lines. */
  roman: string;
  /** Name used inside Japanese lines (without さん). */
  ja: string;
  /** The language this person writes their daily line in. */
  lang: Lang;
}

export const STAFF: readonly Staff[] = [
  { id: "haruka", name: "はるか", roman: "Haruka", ja: "はるか", lang: "ja" },
  { id: "sota", name: "そうた", roman: "Sota", ja: "そうた", lang: "ja" },
  { id: "miyuki", name: "みゆき", roman: "Miyuki", ja: "みゆき", lang: "ja" },
  { id: "kenji", name: "けんじ", roman: "Kenji", ja: "けんじ", lang: "ja" },
  { id: "ayane", name: "あやね", roman: "Ayane", ja: "あやね", lang: "ja" },
  { id: "lan", name: "ラン (Lan)", roman: "Lan", ja: "ラン", lang: "vi" },
  { id: "minh", name: "ミン (Minh)", roman: "Minh", ja: "ミン", lang: "vi" },
  { id: "putri", name: "プトリ (Putri)", roman: "Putri", ja: "プトリ", lang: "id" },
];

export const LANG_LABEL: Record<Lang, string> = {
  ja: "日本語",
  vi: "Tiếng Việt",
  id: "Bahasa Indonesia",
};

export const PLACEHOLDER: Record<Lang, string> = {
  ja: "今日、だれが・だれのために・何をしたか（1行）",
  vi: "Hôm nay ai đã làm gì, cho ai? (1 dòng)",
  id: "Hari ini siapa melakukan apa, untuk siapa? (1 baris)",
};

export function findStaff(id: string): Staff | undefined {
  return STAFF.find((s) => s.id === id);
}
