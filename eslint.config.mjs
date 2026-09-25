import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Private local artifacts and downloaded test tools are not project source.
    ".local/**",
    // The Chrome extension is a standalone browser-extension bundle with its
    // own runtime (chrome.* APIs); it is not part of the Next.js app.
    "chrome-extension/**",
  ]),
]);

export default eslintConfig;
