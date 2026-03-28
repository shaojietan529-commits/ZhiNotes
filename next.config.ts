import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required headers for SQLite WASM with OPFS (SharedArrayBuffer)
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          {
            key: "Cross-Origin-Embedder-Policy",
            value: "require-corp",
          },
        ],
      },
    ];
  },
  // Empty turbopack config to acknowledge Turbopack is the default bundler
  turbopack: {},
};

export default nextConfig;
