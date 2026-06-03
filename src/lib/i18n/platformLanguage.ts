export const DEFAULT_APP_LOCALE = "zh-CN";
export const DEFAULT_APP_LANGUAGE_LABEL = "中文";

export const PLATFORM_LANGUAGE_BOUNDARY = {
  default_locale: DEFAULT_APP_LOCALE,
  default_language: DEFAULT_APP_LANGUAGE_LABEL,
  fallback_locale: "en-US",
  note:
    "ZhiNotes defaults to Chinese for the main product shell while internal ids, routes, and storage keys remain stable.",
} as const;
