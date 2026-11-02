// Generates the fictional daily lines for one month of a fictional small café.
// Writes data/seed/entries.json (what the app sees) and data/seed/labels.json (the hidden answer key for tests).
// Everything here is made up: the café, the people and the events.
//
// 架空の小さなカフェの、1か月分の架空の「毎日の1行」を作る。
// data/seed/entries.json = アプリが読む物 / data/seed/labels.json = テストだけが読む答え (AI には渡さない)。
//
// Run: npm run seed   (deterministic: the same seed always gives the same file)

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { STAFF, type Lang, type Staff } from "../src/lib/staff.ts";

type Kind = "help" | "self" | "gossip" | "vague" | "dup";

export interface Label {
  id: string;
  kind: Kind;
  authorId: string;
  /** Who did the good deed (help/dup/self), or who is talked about (gossip). */
  subjectIds: string[];
  task?: string;
  /** Same real-world event → same key. Duplicates share the key of the original. */
  eventKey?: string;
  dupOf?: string;
}

// ---------------------------------------------------------------------------
// Deterministic random numbers (mulberry32)
let state = 20261102;
function rand(): number {
  state |= 0;
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)];
function shuffle<T>(xs: T[]): T[] {
  for (let i = xs.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [xs[i], xs[j]] = [xs[j], xs[i]];
  }
  return xs;
}
const repeat = (counts: Record<string, number>): string[] =>
  Object.entries(counts).flatMap(([id, n]) => Array.from({ length: n }, () => id));

// ---------------------------------------------------------------------------
// Sentence templates. {T} = the person who did it, {U} = the person who was helped.

interface Task {
  key: string;
  other: Record<Lang, string[]>;
  self: Record<Lang, string[]>;
  needsU?: boolean;
}

const TASKS: Task[] = [
  {
    key: "mop",
    other: {
      ja: ["{T}さんが閉店後に一人で床のモップがけをしてくれていた。", "閉店後、{T}さんが何も言わずに床を全部拭いてくれた。"],
      vi: ["Sau giờ đóng cửa, {T} đã lau sạch sàn một mình.", "{T} lặng lẽ lau hết sàn sau khi quán đóng cửa."],
      id: ["Setelah tutup, {T} mengepel lantai sendirian.", "{T} diam-diam mengepel seluruh lantai setelah kafe tutup."],
    },
    self: {
      ja: ["今日は閉店後の床のモップがけを私が全部やりました。"],
      vi: ["Hôm nay tôi đã lau sàn sau khi đóng cửa."],
      id: ["Hari ini saya yang mengepel lantai setelah tutup."],
    },
  },
  {
    key: "dishes",
    other: {
      ja: ["ピークの時間に{T}さんがたまった洗い物を全部片づけてくれた。", "{T}さんが山になっていた洗い物を黙って洗ってくれた。"],
      vi: ["Lúc đông khách, {T} đã rửa hết chồng chén bát.", "{T} âm thầm rửa sạch đống ly tách còn tồn."],
      id: ["Saat ramai, {T} mencuci semua piring yang menumpuk.", "{T} diam-diam mencuci tumpukan gelas dan piring."],
    },
    self: {
      ja: ["お昼のピークの洗い物は私がほとんど一人でやりました。"],
      vi: ["Hôm nay tôi rửa gần hết chén bát buổi trưa."],
      id: ["Siang ini hampir semua piring saya yang mencuci."],
    },
  },
  {
    key: "teach_register",
    needsU: true,
    other: {
      ja: ["{T}さんが{U}さんにレジの打ち方をていねいに教えていた。", "{T}さんが{U}さんのレジ締めに最後まで付き合って教えていた。"],
      vi: ["{T} đã kiên nhẫn chỉ cho {U} cách dùng máy tính tiền.", "{T} ở lại chỉ {U} cách kết sổ cuối ngày."],
      id: ["{T} dengan sabar mengajari {U} cara memakai kasir.", "{T} menemani {U} sampai selesai belajar menutup kasir."],
    },
    self: {
      ja: ["今日は私が新人さんにレジを教えました。"],
      vi: ["Hôm nay tôi đã chỉ bạn mới cách dùng máy tính tiền."],
      id: ["Hari ini saya mengajari karyawan baru memakai kasir."],
    },
  },
  {
    key: "setup",
    other: {
      ja: ["{T}さんが朝いちばんに来て、テーブルとイスを全部並べてくれていた。", "開店前、{T}さんがテラス席まで拭いてくれていた。"],
      vi: ["{T} đến sớm nhất và xếp hết bàn ghế trước giờ mở cửa.", "Trước giờ mở cửa, {T} đã lau cả bàn ngoài hiên."],
      id: ["{T} datang paling pagi dan menata semua meja dan kursi.", "Sebelum buka, {T} sudah mengelap meja teras juga."],
    },
    self: {
      ja: ["今日は朝いちばんに来て開店の準備を私がしました。"],
      vi: ["Hôm nay tôi đến sớm để chuẩn bị mở cửa."],
      id: ["Hari ini saya datang pagi untuk menyiapkan pembukaan."],
    },
  },
  {
    key: "boxes",
    other: {
      ja: ["届いた重い牛乳の箱を、{T}さんが全部冷蔵庫まで運んでくれた。", "{T}さんが重い粉の袋を倉庫の奥まで運んでくれた。"],
      vi: ["{T} đã khiêng hết mấy thùng sữa nặng vào tủ lạnh.", "{T} vác mấy bao bột nặng vào tận trong kho."],
      id: ["{T} mengangkat semua kotak susu yang berat ke kulkas.", "{T} membawa karung tepung yang berat sampai ke gudang belakang."],
    },
    self: {
      ja: ["重い荷物の運び込みは今日も私がやりました。"],
      vi: ["Hôm nay tôi lại khiêng hàng nặng vào kho."],
      id: ["Hari ini saya lagi yang mengangkat barang-barang berat."],
    },
  },
  {
    key: "beans",
    other: {
      ja: ["{T}さんがコーヒー豆の補充と在庫の数の確認をしてくれていた。", "豆が切れそうなのに{T}さんが気づいて、早めに補充してくれた。"],
      vi: ["{T} đã bổ sung hạt cà phê và kiểm tra số lượng tồn kho.", "{T} nhận ra sắp hết hạt cà phê nên đã bổ sung sớm."],
      id: ["{T} mengisi ulang biji kopi dan mengecek stok.", "{T} sadar biji kopi hampir habis lalu segera mengisinya."],
    },
    self: {
      ja: ["豆の補充と在庫の確認は私がやっておきました。"],
      vi: ["Tôi đã bổ sung hạt cà phê và kiểm tra kho."],
      id: ["Saya sudah mengisi biji kopi dan mengecek stok."],
    },
  },
  {
    key: "toilet",
    other: {
      ja: ["だれもやりたがらないトイレ掃除を、{T}さんが今日もやってくれていた。", "{T}さんがトイレの紙の補充と掃除をしてくれていた。"],
      vi: ["{T} lại dọn nhà vệ sinh, việc mà không ai muốn làm.", "{T} đã dọn và thay giấy trong nhà vệ sinh."],
      id: ["{T} lagi-lagi membersihkan toilet, pekerjaan yang tidak disukai orang.", "{T} membersihkan toilet dan mengganti tisunya."],
    },
    self: {
      ja: ["トイレ掃除は今日も私がやりました。"],
      vi: ["Hôm nay tôi đã dọn nhà vệ sinh."],
      id: ["Hari ini saya membersihkan toilet."],
    },
  },
  {
    key: "lost_item",
    other: {
      ja: ["お客様の忘れ物に{T}さんが気づいて、走って追いかけて届けていた。", "{T}さんがお客様の忘れた傘を駅の近くまで届けに行っていた。"],
      vi: ["{T} thấy khách để quên đồ nên đã chạy theo trả lại.", "{T} mang chiếc ô khách bỏ quên ra tận gần ga để trả."],
      id: ["{T} melihat barang pelanggan tertinggal dan berlari mengembalikannya.", "{T} mengantar payung pelanggan yang tertinggal sampai dekat stasiun."],
    },
    self: {
      ja: ["お客様の忘れ物を私が追いかけて届けました。"],
      vi: ["Tôi đã chạy theo trả đồ khách để quên."],
      id: ["Saya mengejar pelanggan untuk mengembalikan barangnya."],
    },
  },
  {
    key: "cover_shift",
    other: {
      ja: ["急に休んだ人の代わりに、{T}さんが予定外でシフトに入ってくれた。", "{T}さんが自分の休みを返上して、人が足りない時間に入ってくれた。"],
      vi: ["{T} đã làm thay ca cho người nghỉ đột xuất.", "{T} bỏ ngày nghỉ của mình để vào làm lúc thiếu người."],
      id: ["{T} menggantikan shift teman yang tiba-tiba libur.", "{T} merelakan hari liburnya untuk masuk saat kekurangan orang."],
    },
    self: {
      ja: ["急な休みが出たので、私が代わりにシフトに入りました。"],
      vi: ["Có người nghỉ đột xuất nên tôi đã làm thay."],
      id: ["Ada yang libur mendadak, jadi saya menggantikannya."],
    },
  },
  {
    key: "cake_prep",
    other: {
      ja: ["{T}さんが朝早く来て、今日のケーキの仕込みを全部終わらせてくれていた。", "{T}さんがチーズケーキの仕込みを手伝ってくれて、開店に間に合った。"],
      vi: ["{T} đến từ sáng sớm và chuẩn bị xong hết bánh cho hôm nay.", "{T} phụ làm bánh phô mai nên kịp giờ mở cửa."],
      id: ["{T} datang pagi-pagi dan menyelesaikan persiapan kue hari ini.", "{T} membantu membuat cheesecake sehingga sempat sebelum buka."],
    },
    self: {
      ja: ["今日のケーキの仕込みは私が朝早く来てやりました。"],
      vi: ["Hôm nay tôi đến sớm để chuẩn bị bánh."],
      id: ["Hari ini saya datang pagi untuk menyiapkan kue."],
    },
  },
  {
    key: "garbage",
    other: {
      ja: ["{T}さんがゴミの分別をやり直して、まとめて出してくれた。", "閉店後のゴミ出しを{T}さんが全部やってくれていた。"],
      vi: ["{T} đã phân loại lại rác và mang đi đổ.", "{T} đã đổ hết rác sau khi đóng cửa."],
      id: ["{T} memilah ulang sampah lalu membuangnya.", "{T} membuang semua sampah setelah kafe tutup."],
    },
    self: {
      ja: ["ゴミの分別とゴミ出しは私がやりました。"],
      vi: ["Tôi đã phân loại và đổ rác."],
      id: ["Saya yang memilah dan membuang sampah."],
    },
  },
  {
    key: "signboard",
    other: {
      ja: ["風で倒れた外の看板を、{T}さんが直して重しを付けてくれた。", "{T}さんが外のメニューの看板の字を書き直してくれた。"],
      vi: ["{T} đã dựng lại tấm biển bị gió thổi đổ và chèn vật nặng.", "{T} đã viết lại chữ trên bảng thực đơn ngoài cửa."],
      id: ["{T} memperbaiki papan nama yang jatuh karena angin dan memberinya pemberat.", "{T} menulis ulang menu di papan depan kafe."],
    },
    self: {
      ja: ["外の看板が倒れていたので私が直しました。"],
      vi: ["Tấm biển ngoài cửa bị đổ nên tôi đã dựng lại."],
      id: ["Papan nama di depan jatuh, jadi saya memperbaikinya."],
    },
  },
];

const GOSSIP: Record<Lang, string[]> = {
  ja: ["{T}さんはやる気がないと思う。", "{T}さんはいつも楽な仕事ばかり選んでいる気がする。", "{T}さんは態度が悪い。", "{T}さんは今日も何もしていなかった。"],
  vi: ["{T} lúc nào cũng có vẻ lười biếng.", "{T} chỉ thích chọn việc nhẹ."],
  id: ["{T} kelihatannya malas.", "{T} selalu memilih pekerjaan yang ringan."],
};

const VAGUE: Record<Lang, string[]> = {
  ja: ["今日もみんなよく頑張っていた。", "いろいろ手伝いました。", "今日は忙しかったけど、なんとか回った。"],
  vi: ["Hôm nay mọi người đều cố gắng.", "Hôm nay bận nhưng mọi việc vẫn ổn."],
  id: ["Semua orang bekerja keras hari ini.", "Hari ini sibuk, tapi semuanya lancar."],
};

/** The "loud" person adds a boast to some self-reports. */
const BOAST = ["自分がいないと回らなかったと思います。", "今日もいちばん動いていたのは自分です。"];

// ---------------------------------------------------------------------------

const byId = new Map(STAFF.map((s) => [s.id, s]));
const nameIn = (lang: Lang, who: Staff) => (lang === "ja" ? who.ja : who.roman);
function fill(tpl: string, author: Staff, t?: Staff, u?: Staff): string {
  let s = tpl;
  if (t) s = s.replaceAll("{T}", nameIn(author.lang, t));
  if (u) s = s.replaceAll("{U}", nameIn(author.lang, u));
  return s;
}

/** Pairs authors with subjects so that nobody writes about themselves. */
function pairAuthors(subjects: string[], authors: string[]): [string, string][] {
  shuffle(authors);
  for (let i = 0; i < subjects.length; i++) {
    if (authors[i] !== subjects[i]) continue;
    const j = authors.findIndex((a, k) => k !== i && a !== subjects[i] && authors[i] !== subjects[k]);
    if (j < 0) throw new Error("cannot pair authors");
    [authors[i], authors[j]] = [authors[j], authors[i]];
  }
  return subjects.map((s, i) => [authors[i], s]);
}

interface Row {
  kind: Kind;
  authorId: string;
  subjectIds: string[];
  task?: string;
  text: string;
  day?: number;
  ref?: Row;
}

function helpLine(author: Staff, subj: Staff, task: Task): string {
  const u = task.needsU ? pick(STAFF.filter((x) => x.id !== subj.id && x.id !== author.id)) : undefined;
  return fill(pick(task.other[author.lang]), author, subj, u);
}

function selfLine(author: Staff, task: Task): string {
  let text = pick(task.self[author.lang]);
  if (author.id === "sota") {
    text = text.replace("私が", "自分が");
    if (rand() < 0.6) text += pick(BOAST);
  }
  return text;
}

function build(): Row[] {
  const rows: Row[] = [];

  // help: 108 lines. Minh (the quiet one) is mentioned by others 26 times; Sota (the loud one) only 3 times.
  const helpSubjects = shuffle(repeat({ minh: 26, sota: 3, haruka: 14, miyuki: 13, kenji: 13, ayane: 13, lan: 13, putri: 13 }));
  const helpAuthors = repeat({ sota: 4, minh: 2, haruka: 18, miyuki: 17, kenji: 17, ayane: 17, lan: 17, putri: 16 });
  for (const [a, s] of pairAuthors(helpSubjects, helpAuthors)) {
    const task = pick(TASKS);
    rows.push({ kind: "help", authorId: a, subjectIds: [s], task: task.key, text: helpLine(byId.get(a)!, byId.get(s)!, task) });
  }

  // self-reports: 36 lines. Sota writes 20 of them; Minh writes none.
  for (const a of repeat({ sota: 20, haruka: 3, miyuki: 3, kenji: 3, ayane: 3, lan: 2, putri: 2 })) {
    const task = pick(TASKS);
    rows.push({ kind: "self", authorId: a, subjectIds: [a], task: task.key, text: selfLine(byId.get(a)!, task) });
  }

  // gossip / judgements about character: 18 lines (to be discarded by the fact checker).
  const gossipSubjects = shuffle(repeat({ minh: 4, lan: 3, putri: 2, haruka: 2, kenji: 2, ayane: 2, miyuki: 2, sota: 1 }));
  const gossipAuthors = repeat({ sota: 6, kenji: 3, ayane: 3, haruka: 2, miyuki: 2, lan: 1, putri: 1 });
  for (const [a, s] of pairAuthors(gossipSubjects, gossipAuthors)) {
    const author = byId.get(a)!;
    rows.push({ kind: "gossip", authorId: a, subjectIds: [s], text: fill(pick(GOSSIP[author.lang]), author, byId.get(s)!) });
  }

  // vague lines: 9 (no who / no what).
  for (const a of repeat({ sota: 2, minh: 1, haruka: 1, miyuki: 1, kenji: 1, ayane: 1, lan: 1, putri: 1 })) {
    const author = byId.get(a)!;
    rows.push({ kind: "vague", authorId: a, subjectIds: [], text: pick(VAGUE[author.lang]) });
  }

  // spread the 171 lines over 30 days (about 6 a day)
  const order = shuffle([...rows]);
  order.forEach((r, i) => (r.day = Math.floor((i * 30) / order.length)));

  // Keep events unique: two "help" lines (or a help line and a self-report) about the same person, job and day
  // would be one event written twice, and only the planted duplicates below may do that.
  const taken = new Set<string>();
  for (const r of order) {
    if (r.kind !== "help" && r.kind !== "self") continue;
    const author = byId.get(r.authorId)!;
    const subj = byId.get(r.subjectIds[0])!;
    if (taken.has(`${r.day}|${subj.id}|${r.task}`)) {
      const task = pick(TASKS.filter((t) => !taken.has(`${r.day}|${subj.id}|${t.key}`)));
      r.task = task.key;
      r.text = r.kind === "help" ? helpLine(author, subj, task) : selfLine(author, task);
    }
    taken.add(`${r.day}|${subj.id}|${r.task}`);
  }

  // duplicates: 9 lines that report an event someone already reported (same day, same person, same task)
  const helps = rows.filter((r) => r.kind === "help");
  const aboutMinh = shuffle(helps.filter((r) => r.subjectIds[0] === "minh")).slice(0, 4);
  const others = shuffle(helps.filter((r) => r.subjectIds[0] !== "minh" && !TASKS.find((t) => t.key === r.task)?.needsU)).slice(0, 5);
  for (const orig of [...aboutMinh, ...others]) {
    const candidates = STAFF.filter((x) => x.id !== orig.authorId && x.id !== orig.subjectIds[0] && x.id !== "minh");
    const author = pick(candidates);
    const task = TASKS.find((t) => t.key === orig.task)!;
    const u = task.needsU ? pick(STAFF.filter((x) => x.id !== orig.subjectIds[0] && x.id !== author.id)) : undefined;
    rows.push({
      kind: "dup",
      authorId: author.id,
      subjectIds: [...orig.subjectIds],
      task: orig.task,
      text: fill(pick(task.other[author.lang]), author, byId.get(orig.subjectIds[0])!, u),
      day: orig.day,
      ref: orig,
    });
  }
  return rows;
}

function main() {
  const rows = build();
  // time of writing: the evening of that day (JST), so the order inside a day looks natural
  const stamped = rows.map((r) => {
    const minutes = 17 * 60 + Math.floor(rand() * 6 * 60);
    const date = `2026-10-${String((r.day ?? 0) + 1).padStart(2, "0")}`;
    const created = new Date(`${date}T${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}:00+09:00`);
    return { r, date, created };
  });
  // a duplicate is written after the line it repeats
  for (const s of stamped) {
    if (s.r.kind !== "dup") continue;
    const orig = stamped.find((x) => x.r === s.r.ref)!;
    if (s.created <= orig.created) s.created = new Date(orig.created.getTime() + (5 + Math.floor(rand() * 90)) * 60000);
  }
  stamped.sort((a, b) => a.created.getTime() - b.created.getTime());
  const idOf = new Map<Row, string>();
  stamped.forEach((s, i) => idOf.set(s.r, `seed-${String(i + 1).padStart(3, "0")}`));

  const entries = stamped.map((s) => ({
    id: idOf.get(s.r)!,
    date: s.date,
    authorId: s.r.authorId,
    lang: byId.get(s.r.authorId)!.lang,
    text: s.r.text,
    createdAt: s.created.toISOString(),
    source: "seed" as const,
  }));
  const labels: Label[] = stamped.map((s) => {
    const r = s.r;
    const base = r.ref ?? r;
    const eventKey = r.kind === "help" || r.kind === "dup" || r.kind === "self" ? `${s.date}:${base.task}:${base.subjectIds[0]}` : undefined;
    return {
      id: idOf.get(r)!,
      kind: r.kind,
      authorId: r.authorId,
      subjectIds: r.subjectIds,
      ...(r.task ? { task: r.task } : {}),
      ...(eventKey ? { eventKey } : {}),
      ...(r.ref ? { dupOf: idOf.get(r.ref)! } : {}),
    };
  });

  const dir = path.join(process.cwd(), "data", "seed");
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "entries.json"), JSON.stringify(entries, null, 2) + "\n");
  writeFileSync(path.join(dir, "labels.json"), JSON.stringify(labels, null, 2) + "\n");
  const count = (k: Kind) => labels.filter((l) => l.kind === k).length;
  console.log(
    `wrote ${entries.length} lines: help ${count("help")} / self ${count("self")} / gossip ${count("gossip")} / vague ${count("vague")} / dup ${count("dup")}`,
  );
}

main();
