// F2: the ten questions the owner answers. The answers become the shop's yardstick skill.
// F2: 店長が答える10問。答えがお店の物差し (スキルのファイル) になる。

export interface Question {
  id: string;
  /** Number shown to the owner and used in the skill ("from answers 1 and 4"). */
  no: number;
  text: string;
  hint: string;
}

export const QUESTIONS: Question[] = [
  { id: "q1", no: 1, text: "スタッフのどんな行動に「助かった」と感じますか。場面を2〜3個書いてください。", hint: "例: 急な休みの代わりに入ってくれた" },
  { id: "q2", no: 2, text: "目立たないけれど、誰かがやらないと困る仕事は何ですか。", hint: "例: トイレ掃除、ゴミの分別" },
  { id: "q3", no: 3, text: "新人に教えること・ほかの人を手伝うことは、どのくらい大事ですか。", hint: "例: とても大事 / 担当の仕事の次に大事" },
  { id: "q4", no: 4, text: "急な休みの代わりに入る・シフトを延ばす、はどう扱いますか。", hint: "例: 一番ありがたい" },
  { id: "q5", no: 5, text: "自分の担当の仕事をきちんとやった、はプラスに入れますか。", hint: "例: 当たり前なので入れない" },
  { id: "q6", no: 6, text: "本人が「やりました」と書いただけで、ほかの人の記録がない時はどうしますか。", hint: "例: すぐには付けない / そのまま付ける" },
  { id: "q7", no: 7, text: "同じ出来事を2人が書いていたら、どう数えますか。", hint: "例: 1回と数える" },
  { id: "q8", no: 8, text: "休憩を削って働いた、のような「決まりすれすれの頑張り」はどうしますか。", hint: "例: 付けない / 迷う" },
  { id: "q9", no: 9, text: "プラスに入れないと決めていることはありますか。", hint: "例: 声の大きさ、話のうまさ" },
  { id: "q10", no: 10, text: "月末のプラスで一番大事にしたいことを、一言で。", hint: "例: 黙ってやってくれたことを拾いたい" },
];

export type OwnerAnswers = Record<string, string>;

export const MAX_ANSWER_CHARS = 400;
export const MIN_ANSWERED = 5;

/** Returns an error message, or null when the answers can be turned into a skill. */
export function validateAnswers(answers: unknown): string | null {
  if (typeof answers !== "object" || answers === null || Array.isArray(answers)) return "答えの形が正しくありません";
  const a = answers as Record<string, unknown>;
  for (const key of Object.keys(a)) {
    if (!QUESTIONS.some((q) => q.id === key)) return `知らない質問の答えがあります (${key})`;
    if (typeof a[key] !== "string") return `答え ${key} は文字で書いてください`;
    if ([...(a[key] as string)].length > MAX_ANSWER_CHARS) return `答えは1問 ${MAX_ANSWER_CHARS} 文字までにしてください`;
  }
  const answered = QUESTIONS.filter((q) => typeof a[q.id] === "string" && (a[q.id] as string).trim() !== "").length;
  if (answered < MIN_ANSWERED) return `少なくとも ${MIN_ANSWERED} 問に答えてください`;
  return null;
}
