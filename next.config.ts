import type { NextConfig } from "next";

// `npm run demo:build` (MIENAI_DEMO_EXPORT=1): a static copy of the fictional café for GitHub Pages, served under
// /mienai-ganbari/. Only the pages are built (pageExtensions leaves every route.ts out); in the browser,
// demo/shim.js answers the pages' /api calls from the committed fictional month. A static export cannot prerender
// partially, so the demo turns Cache Components and Partial Prefetching off. The normal app is unchanged.
// 試し版 (GitHub Pages) の時だけ: 画面だけを静的に作り、API の代わりはブラウザの shim が架空の1か月から答える。
const demoExport = process.env.MIENAI_DEMO_EXPORT === "1";
const demo = {
  output: "export",
  basePath: "/mienai-ganbari",
  trailingSlash: true,
  pageExtensions: ["tsx"],
  images: { unoptimized: true },
  cacheComponents: false,
  partialPrefetching: false,
} as const satisfies NextConfig;

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
  ...(demoExport ? demo : {}),
};

export default nextConfig;
