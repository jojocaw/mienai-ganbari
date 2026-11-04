// F10: the few words around the question, in the writer's language (the question itself comes from Claude).
// F10: 聞き返しの周りの短い言葉 (その人の言葉で)。聞き返しの文そのものは Claude が書く。

import type { Lang } from "../staff.ts";

export const ASK_WORDS: Record<Lang, { head: string; placeholder: string; add: string; skip: string; added: string }> = {
  ja: {
    head: "1つだけ聞かせてください（答えなくても大丈夫です）",
    placeholder: "短く1行で",
    add: "答えを足す",
    skip: "このままでいい",
    added: "答えを足しました（元の1行はそのままです）",
  },
  vi: {
    head: "Cho mình hỏi thêm 1 câu nhé (không trả lời cũng được)",
    placeholder: "Viết ngắn, 1 dòng",
    add: "Thêm câu trả lời",
    skip: "Để nguyên như vậy",
    added: "Đã thêm câu trả lời (dòng ban đầu vẫn giữ nguyên)",
  },
  id: {
    head: "Boleh tanya satu hal? (Tidak dijawab juga tidak apa-apa)",
    placeholder: "Tulis singkat, 1 baris",
    add: "Tambahkan jawaban",
    skip: "Biarkan seperti ini",
    added: "Jawaban sudah ditambahkan (baris aslinya tetap sama)",
  },
};
