"use client";

const CLOUD_SESSION_KEY = "zhinotes.cloud.session.v1";
const EXPIRY_SKEW_MS = 60_000;

export interface ZhiNotesCloudSessionUser {
  id: string;
  email: string | null;
}

export interface ZhiNotesCloudSession {
  accessToken: string;
  refreshToken: string | null;
  tokenType: string;
  expiresAt: number | null;
  storedAt: string;
  user: ZhiNotesCloudSessionUser | null;
}

export type ZhiNotesAuthHashResult =
  | {
      status: "authenticated";
      session: ZhiNotesCloudSession;
    }
  | {
      status: "error";
      error: string;
      description: string;
    }
  | {
      status: "empty";
    };

export function readCloudSession() {
  if (!canUseLocalStorage()) return null;

  const raw = window.localStorage.getItem(CLOUD_SESSION_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<ZhiNotesCloudSession>;
    if (!parsed.accessToken || typeof parsed.accessToken !== "string") {
      clearCloudSession();
      return null;
    }

    return {
      accessToken: parsed.accessToken,
      refreshToken:
        typeof parsed.refreshToken === "string" ? parsed.refreshToken : null,
      tokenType:
        typeof parsed.tokenType === "string" ? parsed.tokenType : "bearer",
      expiresAt:
        typeof parsed.expiresAt === "number" ? parsed.expiresAt : null,
      storedAt:
        typeof parsed.storedAt === "string"
          ? parsed.storedAt
          : new Date().toISOString(),
      user: isSessionUser(parsed.user) ? parsed.user : null,
    } satisfies ZhiNotesCloudSession;
  } catch {
    clearCloudSession();
    return null;
  }
}

export function writeCloudSession(session: ZhiNotesCloudSession) {
  if (!canUseLocalStorage()) return;
  window.localStorage.setItem(CLOUD_SESSION_KEY, JSON.stringify(session));
}

export function clearCloudSession() {
  if (!canUseLocalStorage()) return;
  window.localStorage.removeItem(CLOUD_SESSION_KEY);
}

export function getCloudAccessToken() {
  const session = readCloudSession();
  if (!session) return "";

  if (isCloudSessionExpired(session)) {
    clearCloudSession();
    return "";
  }

  return session.accessToken;
}

export function isCloudSessionExpired(session: ZhiNotesCloudSession) {
  return Boolean(
    session.expiresAt && session.expiresAt - EXPIRY_SKEW_MS <= Date.now()
  );
}

export function parseSupabaseAuthHash(hash: string): ZhiNotesAuthHashResult {
  const value = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!value) return { status: "empty" };

  const params = new URLSearchParams(value);
  const error = params.get("error");
  if (error) {
    return {
      status: "error",
      error,
      description:
        params.get("error_description") ||
        params.get("error_code") ||
        "Supabase Auth did not return a usable session.",
    };
  }

  const accessToken = params.get("access_token");
  if (!accessToken) return { status: "empty" };

  const expiresIn = Number(params.get("expires_in"));
  const expiresAt = Number.isFinite(expiresIn)
    ? Date.now() + expiresIn * 1000
    : null;

  return {
    status: "authenticated",
    session: {
      accessToken,
      refreshToken: params.get("refresh_token"),
      tokenType: params.get("token_type") || "bearer",
      expiresAt,
      storedAt: new Date().toISOString(),
      user: null,
    },
  };
}

function canUseLocalStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function isSessionUser(value: unknown): value is ZhiNotesCloudSessionUser {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    (typeof record.email === "string" || record.email === null)
  );
}
