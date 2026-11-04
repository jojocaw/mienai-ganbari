// Daily one-line entries: validation and a small JSON-file store.
// The text is stored exactly as typed (no trimming, no translation, no normalization).
// 毎日の1行: 確かめと、手元の JSON ファイルへの保存。文は打たれたまま保存する (削らない・訳さない・形を変えない)。

import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { findPerson, shopConfig } from "./shop-config.ts";
import type { Lang } from "./staff.ts";

export interface Entry {
  id: string;
  /** Day the line is about, in JST (YYYY-MM-DD). */
  date: string;
  authorId: string;
  lang: Lang;
  /** The line exactly as the staff member wrote it. */
  text: string;
  createdAt: string;
  source: "seed" | "app";
  /** F10: the one question asked right after a vague line was saved, and the writer's answer. The line itself never changes. */
  clarification?: Clarification;
}

/** F10: one question back about a line, in the writer's language, and the answer exactly as typed (absent when not answered). */
export interface Clarification {
  question: string;
  askedAt: string;
  answer?: string;
  answeredAt?: string;
}

export const MAX_CHARS = 200;

export class EntryError extends Error {}

/** Returns an error message, or null when the input is a valid one-line entry. */
export function validateEntry(authorId: unknown, text: unknown): string | null {
  if (typeof authorId !== "string" || !findPerson(authorId)) return "名前を一覧から選んでください";
  if (typeof text !== "string") return "1行を書いてください";
  if (/[\r\n\u2028\u2029]/.test(text)) return "1行で書いてください（改行は入れられません）";
  if (text.trim().length === 0) return "1行を書いてください";
  if ([...text].length > MAX_CHARS) return `${MAX_CHARS}文字までにしてください`;
  return null;
}

export function todayJst(now: Date = new Date()): string {
  return new Date(now.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

/** The local folder for lines written in the app (and, for a real shop, its month-end files). Never committed. */
export function localDataDir(): string {
  return process.env.MIENAI_DATA_DIR || path.join(process.cwd(), "data", "local");
}

function seedFile(): string {
  return process.env.MIENAI_SEED_FILE || path.join(process.cwd(), "data", "seed", "entries.json");
}

async function readJson(file: string): Promise<Entry[]> {
  try {
    const raw = await fs.readFile(file, "utf8");
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Entry[]) : [];
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
}

/** Entries written in the app (not the fictional seed). */
export async function readLocalEntries(): Promise<Entry[]> {
  return readJson(path.join(localDataDir(), "entries.json"));
}

/** Fictional seed entries plus entries written in the app, oldest first. A real shop lists only its own lines. */
export async function listEntries(): Promise<Entry[]> {
  const seed = shopConfig().real ? [] : await readJson(seedFile());
  const all = [...seed, ...(await readLocalEntries())];
  return all.sort((a, b) => (a.date === b.date ? a.createdAt.localeCompare(b.createdAt) : a.date.localeCompare(b.date)));
}

let writing: Promise<unknown> = Promise.resolve();

/** Validates and appends one entry. The text is saved byte-for-byte as given. */
export async function addEntry(authorId: unknown, text: unknown, now: Date = new Date()): Promise<Entry> {
  const err = validateEntry(authorId, text);
  if (err) throw new EntryError(err);
  const staff = findPerson(authorId as string)!;
  const entry: Entry = {
    id: randomUUID(),
    date: todayJst(now),
    authorId: staff.id,
    lang: staff.lang,
    text: text as string,
    createdAt: now.toISOString(),
    source: "app",
  };
  // Serialize writes so two quick submissions cannot overwrite each other.
  const job = writing.then(async () => {
    const dir = localDataDir();
    await fs.mkdir(dir, { recursive: true });
    const file = path.join(dir, "entries.json");
    const current = await readJson(file);
    current.push(entry);
    const tmp = `${file}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(current, null, 2) + "\n", "utf8");
    await fs.rename(tmp, file);
  });
  writing = job.catch(() => {});
  await job;
  return entry;
}

/** F10: same rules as the line itself: one line, not empty, at most MAX_CHARS characters. */
export function validateAnswer(answer: unknown): string | null {
  if (typeof answer !== "string") return "答えを1行で書いてください";
  if (/[\r\n\u2028\u2029]/.test(answer)) return "1行で書いてください（改行は入れられません）";
  if (answer.trim().length === 0) return "答えを1行で書いてください";
  if ([...answer].length > MAX_CHARS) return `${MAX_CHARS}文字までにしてください`;
  return null;
}

/** One line written in the app, by id. */
export async function findLocalEntry(id: unknown): Promise<Entry | undefined> {
  if (typeof id !== "string") return undefined;
  return (await readLocalEntries()).find((e) => e.id === id);
}

/** Changes one line written in the app, in the same queue as addEntry, so writes never overwrite each other. */
async function updateLocalEntry(id: string, change: (e: Entry) => Entry): Promise<Entry> {
  let updated: Entry | undefined;
  const job = writing.then(async () => {
    const file = path.join(localDataDir(), "entries.json");
    const current = await readJson(file);
    const i = current.findIndex((e) => e.id === id);
    if (i < 0) throw new EntryError("その1行が見つかりません");
    updated = change(current[i]);
    current[i] = updated;
    const tmp = `${file}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(current, null, 2) + "\n", "utf8");
    await fs.rename(tmp, file);
  });
  writing = job.catch(() => {});
  await job;
  return updated!;
}

/** F10: keeps the question that was shown for this line. A line is asked about at most once. */
export async function setQuestion(entryId: string, question: string, now: Date = new Date()): Promise<Entry> {
  return updateLocalEntry(entryId, (e) => {
    if (e.clarification) throw new EntryError("この1行には、もう聞き返しています");
    return { ...e, clarification: { question, askedAt: now.toISOString() } };
  });
}

/** F10: adds the writer's answer next to the line, exactly as typed. The line itself stays as it was written. */
export async function addAnswer(entryId: unknown, answer: unknown, now: Date = new Date()): Promise<Entry> {
  const err = validateAnswer(answer);
  if (err) throw new EntryError(err);
  if (typeof entryId !== "string") throw new EntryError("その1行が見つかりません");
  return updateLocalEntry(entryId, (e) => {
    if (!e.clarification) throw new EntryError("この1行には聞き返していません");
    if (e.clarification.answer !== undefined) throw new EntryError("答えはもう足してあります");
    return { ...e, clarification: { ...e.clarification, answer: answer as string, answeredAt: now.toISOString() } };
  });
}
