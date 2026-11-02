// Which Claude model does which job. Each can be changed with an environment variable.
// - writer (F2): turns the owner's answers into the yardstick once, so quality matters most.
// - extractor (F3): reads every daily line and applies the yardstick; many calls.
// - checker (F4): only suggests which facts are the same event; a small, narrow job.
// - letter (F7): a few warm letters in each person's language after the owner decides.
// どの仕事をどのモデルにするか。役ごとに分け、環境変数で変えられる。

export type Role = "writer" | "extractor" | "checker" | "letter";

const DEFAULTS: Record<Role, string> = {
  writer: "claude-opus-5-5",
  extractor: "claude-sonnet-5-5",
  checker: "claude-haiku-5-5",
  letter: "claude-opus-5-5",
};

const ENV: Record<Role, string> = {
  writer: "MIENAI_MODEL_WRITER",
  extractor: "MIENAI_MODEL_EXTRACTOR",
  checker: "MIENAI_MODEL_CHECKER",
  letter: "MIENAI_MODEL_LETTER",
};

export function model(role: Role): string {
  return process.env[ENV[role]] || DEFAULTS[role];
}

/** How hard each role thinks. The writer works once and carefully; the others run often on narrow jobs. */
const EFFORT = { writer: "high", extractor: "medium", checker: "low", letter: "medium" } as const;

export function effort(role: Role): (typeof EFFORT)[Role] {
  return EFFORT[role];
}
