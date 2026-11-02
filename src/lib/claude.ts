// One place that starts Claude through the Claude Agent SDK, with the same guard rails every time.
// Claude Agent SDK で Claude を動かす入口を1つにまとめ、毎回同じ守りを付ける。

import { promises as fs } from "node:fs";
import path from "node:path";
import { query, type AgentDefinition, type Options, type SettingSource } from "@anthropic-ai/claude-agent-sdk";

export class MissingApiKeyError extends Error {}

export class ClaudeRunError extends Error {
  readonly subtype: string | undefined;
  readonly costUsd: number;
  constructor(message: string, subtype?: string, costUsd = 0) {
    super(message);
    this.subtype = subtype;
    this.costUsd = costUsd;
  }
}

export function hasApiKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function configDir(): string {
  return process.env.MIENAI_CLAUDE_CONFIG_DIR || path.join(process.cwd(), "data", "local", "claude-config");
}

/**
 * Environment for the Claude Code process behind the SDK.
 * - `env` replaces the whole environment, so process.env is spread first (PATH, HOME, ...).
 * - An API key is required. A separate CLAUDE_CONFIG_DIR keeps the app away from the developer's own
 *   Claude Code settings, hooks and login, so it can never fall back to a personal subscription.
 * - Subagents may not start further subagents (one level only).
 */
export async function claudeEnv(): Promise<Record<string, string | undefined>> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new MissingApiKeyError("ANTHROPIC_API_KEY が設定されていません (.env.local に書いてください)");
  const dir = configDir();
  await fs.mkdir(dir, { recursive: true });
  return {
    ...process.env,
    ANTHROPIC_API_KEY: key,
    CLAUDE_CONFIG_DIR: dir,
    CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH: "1",
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
    CLAUDE_AGENT_SDK_CLIENT_APP: "mienai-ganbari/0.1.0",
  };
}

/**
 * One structured answer from Claude, with no tools, no saved session and a hard spending cap.
 * Pass `agent` (with `agents`) to run one of the app's subagents as the main thread: its prompt, model and
 * preloaded skills apply. `settingSources: ["project"]` lets it find the yardstick skill in .claude/skills.
 */
export async function runStructured<T>(args: {
  system?: string;
  prompt: string;
  schema: Record<string, unknown>;
  model?: string;
  maxBudgetUsd: number;
  agent?: string;
  agents?: Record<string, AgentDefinition>;
  settingSources?: SettingSource[];
}): Promise<{ data: T; costUsd: number }> {
  const options: Options = {
    ...(args.system ? { systemPrompt: args.system } : {}),
    ...(args.model ? { model: args.model } : {}),
    ...(args.agent ? { agent: args.agent, agents: args.agents } : {}),
    tools: [],
    settingSources: args.settingSources ?? [],
    persistSession: false,
    permissionMode: "dontAsk",
    maxTurns: 4,
    maxBudgetUsd: args.maxBudgetUsd,
    outputFormat: { type: "json_schema", schema: args.schema },
    env: await claudeEnv(),
    cwd: process.cwd(),
  };
  for await (const m of query({ prompt: args.prompt, options })) {
    if (m.type !== "result") continue;
    if (m.subtype === "success" && !m.is_error && m.structured_output !== undefined) {
      return { data: m.structured_output as T, costUsd: m.total_cost_usd };
    }
    throw new ClaudeRunError(`Claude の処理が途中で止まりました (${m.subtype})`, m.subtype, m.total_cost_usd);
  }
  throw new ClaudeRunError("Claude から結果が返りませんでした");
}
