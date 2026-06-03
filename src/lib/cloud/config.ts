export interface ZhiNotesCloudConfig {
  enabled: boolean;
  allowWrites: boolean;
  appUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  authRedirectOrigins: string[];
}

export interface CloudReadiness {
  enabled: boolean;
  canUseAnonClient: boolean;
  canUseServiceClient: boolean;
  allowWrites: boolean;
  missing: string[];
}

export function getZhiNotesCloudConfig(): ZhiNotesCloudConfig {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";
  const configuredOrigins = parseCommaList(
    process.env.ZHINOTES_AUTH_REDIRECT_ORIGINS
  );
  const defaultOrigin = getOrigin(appUrl);

  return {
    enabled: process.env.ZHINOTES_CLOUD_ENABLED === "true",
    allowWrites: process.env.ZHINOTES_ALLOW_CLOUD_WRITES === "true",
    appUrl,
    supabaseUrl: trimTrailingSlash(
      process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? ""
    ),
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "",
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "",
    authRedirectOrigins: Array.from(
      new Set([defaultOrigin, ...configuredOrigins].filter(Boolean))
    ),
  };
}

export function getCloudReadiness(): CloudReadiness {
  const config = getZhiNotesCloudConfig();
  const missing: string[] = [];

  if (!config.enabled) missing.push("ZHINOTES_CLOUD_ENABLED=true");
  if (!config.supabaseUrl) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!config.supabaseAnonKey) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  return {
    enabled: config.enabled && missing.length === 0,
    canUseAnonClient: Boolean(config.supabaseUrl && config.supabaseAnonKey),
    canUseServiceClient: Boolean(
      config.supabaseUrl && config.supabaseServiceRoleKey
    ),
    allowWrites: config.allowWrites,
    missing,
  };
}

export function isAllowedAuthRedirect(redirectTo: string | null) {
  if (!redirectTo) return true;

  const config = getZhiNotesCloudConfig();
  const redirectOrigin = getOrigin(redirectTo);
  return Boolean(
    redirectOrigin && config.authRedirectOrigins.includes(redirectOrigin)
  );
}

function parseCommaList(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function getOrigin(value: string) {
  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
}
