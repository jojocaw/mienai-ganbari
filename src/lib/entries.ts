// Daily one-line entries: validation and a small JSON-file store.
// The text is stored exactly as typed (no trimming, no translation, no normalization).
// 毎日の1行: 確かめと、手元の JSON ファイルへの保存。文は打たれたまま保存する (削らない・訳さない・形を変えない)。

import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { findStaff, type Lang } from "./staff.ts";

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
}

export const MAX_CHARS = 200;

export class EntryError extends Error {}

/** Returns an error message, or null when the input is a valid one-line entry. */
export function validateEntry(authorId: unknown, text: unknown): string | null {
  if (typeof authorId !== "string" || !findStaff(authorId)) return "名前を一覧から選んでください";
  if (typeof text !== "string") return "1行を書いてください";
  if (/[\r\n\u2028\u2029]/.test(text)) return "1行で書いてください（改行は入れられません）";
  if (text.trim().length === 0) return "1行を書いてください";
  if ([...text].length > MAX_CHARS) return `${MAX_CHARS}文字までにしてください`;
  return null;
}

export function todayJst(now: Date = new Date()): string {
  return new Date(now.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

function dataDir(): string {
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
  return readJson(path.join(dataDir(), "entries.json"));
}

/** Fictional seed entries plus entries written in the app, oldest first. */
export async function listEntries(): Promise<Entry[]> {
  const all = [...(await readJson(seedFile())), ...(await readLocalEntries())];
  return all.sort((a, b) => (a.date === b.date ? a.createdAt.localeCompare(b.createdAt) : a.date.localeCompare(b.date)));
}

let writing: Promise<unknown> = Promise.resolve();

/** Validates and appends one entry. The text is saved byte-for-byte as given. */
export async function addEntry(authorId: unknown, text: unknown, now: Date = new Date()): Promise<Entry> {
  const err = validateEntry(authorId, text);
  if (err) throw new EntryError(err);
  const staff = findStaff(authorId as string)!;
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
    const dir = dataDir();
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
