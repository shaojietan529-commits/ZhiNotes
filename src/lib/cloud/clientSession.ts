"use client";

export const CLOUD_SESSION_KEY = "zhinotes.cloud.session.v1";
export const CLOUD_SESSION_UPDATED_EVENT = "zhinotes:cloud-session-updated";
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

export type ZhiNotesCloudSessionRefreshResult =
  | {
      status: "refreshed";
      session: ZhiNotesCloudSession;
    }
  | {
      status: "missing-session" | "missing-refresh-token" | "refresh-failed";
      error: string;
      session: ZhiNotesCloudSession | null;
    };

let cloudSessionRefreshInFlight: Promise<ZhiNotesCloudSessionRefreshResult> | null =
  null;

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
  emitCloudSessionUpdated();
}

export function clearCloudSession() {
  if (!canUseLocalStorage()) return;
  window.localStorage.removeItem(CLOUD_SESSION_KEY);
  emitCloudSessionUpdated();
}

export function getCloudAccessToken() {
  const session = readCloudSession();
  if (!session) return "";

  return session.accessToken;
}

export function isCloudSessionExpired(session: ZhiNotesCloudSession) {
  return Boolean(
    session.expiresAt && session.expiresAt - EXPIRY_SKEW_MS <= Date.now()
  );
}

export async function ensureFreshCloudSession(
  options: { force?: boolean } = {}
): Promise<ZhiNotesCloudSessionRefreshResult> {
  const session = readCloudSession();
  if (!session) {
    return {
      status: "missing-session",
      error: "No local cloud session is stored.",
      session: null,
    };
  }
  if (!options.force && !isCloudSessionExpired(session)) {
    return { status: "refreshed", session };
  }
  return refreshCloudSession(session);
}

export async function refreshCloudSession(
  session: ZhiNotesCloudSession | null = readCloudSession()
): Promise<ZhiNotesCloudSessionRefreshResult> {
  if (!session) {
    return {
      status: "missing-session",
      error: "No local cloud session is stored.",
      session: null,
    };
  }
  if (!session.refreshToken) {
    return {
      status: "missing-refresh-token",
      error:
        "Cloud session is expired and no refresh token is available. Please sign in again.",
      session,
    };
  }
  if (cloudSessionRefreshInFlight) return cloudSessionRefreshInFlight;

  cloudSessionRefreshInFlight = runCloudSessionRefresh(session).finally(() => {
    cloudSessionRefreshInFlight = null;
  });
  return cloudSessionRefreshInFlight;
}

async function runCloudSessionRefresh(
  previousSession: ZhiNotesCloudSession
): Promise<ZhiNotesCloudSessionRefreshResult> {
  try {
    const response = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        refresh_token: previousSession.refreshToken,
      }),
    });
    const body = await readCloudSessionRefreshBody(response);
    if (!response.ok || !isCloudSessionRefreshResponse(body)) {
      return {
        status: "refresh-failed",
        error: getCloudSessionRefreshError(body, response),
        session: previousSession,
      };
    }
    const nextSession: ZhiNotesCloudSession = {
      ...body.session,
      user: body.session.user ?? previousSession.user,
    };
    writeCloudSession(nextSession);
    return {
      status: "refreshed",
      session: nextSession,
    };
  } catch (error) {
    return {
      status: "refresh-failed",
      error: error instanceof Error ? error.message : "Cloud session refresh failed.",
      session: previousSession,
    };
  }
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

function emitCloudSessionUpdated() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CLOUD_SESSION_UPDATED_EVENT));
}

function isSessionUser(value: unknown): value is ZhiNotesCloudSessionUser {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    (typeof record.email === "string" || record.email === null)
  );
}

async function readCloudSessionRefreshBody(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function isCloudSessionRefreshResponse(value: unknown): value is {
  session: ZhiNotesCloudSession;
} {
  if (!value || typeof value !== "object") return false;
  const session = (value as { session?: unknown }).session;
  if (!session || typeof session !== "object") return false;
  const record = session as Partial<ZhiNotesCloudSession>;
  return (
    typeof record.accessToken === "string" &&
    record.accessToken.length > 0 &&
    (typeof record.refreshToken === "string" || record.refreshToken === null) &&
    typeof record.tokenType === "string" &&
    (typeof record.expiresAt === "number" || record.expiresAt === null) &&
    typeof record.storedAt === "string" &&
    (record.user === null || isSessionUser(record.user))
  );
}

function getCloudSessionRefreshError(
  body: unknown,
  response: Response
): string {
  if (typeof body === "string" && body.trim()) return body.trim();
  if (!body || typeof body !== "object") {
    return `Cloud session refresh failed with HTTP ${response.status}.`;
  }
  const record = body as Record<string, unknown>;
  return (
    getRecordString(record, "message") ||
    getRecordString(record, "error_description") ||
    getRecordString(record, "error") ||
    `Cloud session refresh failed with HTTP ${response.status}.`
  );
}

function getRecordString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? value : "";
}
