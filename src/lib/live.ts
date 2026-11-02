/** Claude is called only when an API key is set and live calls are not switched off (MIENAI_ALLOW_LIVE=0). */
export function live(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY) && process.env.MIENAI_ALLOW_LIVE !== "0";
}
