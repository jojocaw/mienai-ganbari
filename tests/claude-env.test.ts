// The app's Claude process must not inherit the developer's own Claude Code settings (effort level, session, login).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

test("only the API key and the app's own settings reach the Claude process", async () => {
  process.env.MIENAI_CLAUDE_CONFIG_DIR = mkdtempSync(path.join(tmpdir(), "mienai-cfg-"));
  process.env.ANTHROPIC_API_KEY = "test-key";
  process.env.CLAUDE_CODE_EFFORT_LEVEL = "max";
  process.env.CLAUDE_CODE_SESSION_ID = "someone-elses-session";
  process.env.ANTHROPIC_BASE_URL = "https://example.invalid";
  const { claudeEnv } = await import("../src/lib/claude.ts");
  const env = await claudeEnv();
  assert.equal(env.ANTHROPIC_API_KEY, "test-key");
  assert.equal(env.CLAUDE_CODE_EFFORT_LEVEL, undefined);
  assert.equal(env.CLAUDE_CODE_SESSION_ID, undefined);
  assert.equal(env.ANTHROPIC_BASE_URL, undefined);
  assert.equal(env.CLAUDE_CONFIG_DIR, process.env.MIENAI_CLAUDE_CONFIG_DIR);
  assert.equal(env.CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH, "1");
  assert.equal(env.PATH, process.env.PATH);
});

test("without an API key Claude is never started", async () => {
  delete process.env.ANTHROPIC_API_KEY;
  const { claudeEnv, MissingApiKeyError } = await import("../src/lib/claude.ts");
  await assert.rejects(claudeEnv(), MissingApiKeyError);
});
