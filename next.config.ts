import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Agent SDK starts a bundled Claude Code binary, so it must load with plain Node, not the bundler.
  serverExternalPackages: ["@anthropic-ai/claude-agent-sdk"],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
