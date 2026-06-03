import { getZhiNotesCloudConfig } from "@/lib/cloud/config";

export interface SupabaseUser {
  id: string;
  email: string | null;
  aud?: string;
  role?: string;
  created_at?: string;
}

export class SupabaseRequestError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "SupabaseRequestError";
    this.status = status;
    this.body = body;
  }
}

export async function requestSupabaseAuth<T>(
  path: string,
  init: RequestInit,
  accessToken?: string
) {
  const config = getZhiNotesCloudConfig();
  return requestSupabase<T>({
    url: `${config.supabaseUrl}/auth/v1${path}`,
    key: config.supabaseAnonKey,
    init,
    accessToken,
  });
}

export async function requestSupabaseRest<T>(
  path: string,
  init: RequestInit,
  accessToken?: string
) {
  const config = getZhiNotesCloudConfig();
  return requestSupabase<T>({
    url: `${config.supabaseUrl}/rest/v1${path}`,
    key: config.supabaseAnonKey,
    init,
    accessToken,
  });
}

export async function getSupabaseUser(accessToken: string) {
  return requestSupabaseAuth<SupabaseUser>(
    "/user",
    { method: "GET" },
    accessToken
  );
}

async function requestSupabase<T>({
  url,
  key,
  init,
  accessToken,
}: {
  url: string;
  key: string;
  init: RequestInit;
  accessToken?: string;
}) {
  const headers = new Headers(init.headers);
  headers.set("apikey", key);
  headers.set("Accept", "application/json");

  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const response = await fetch(url, {
    ...init,
    headers,
    cache: "no-store",
  });
  const body = await readJson(response);

  if (!response.ok) {
    throw new SupabaseRequestError(
      getErrorMessage(body) || `Supabase request failed with ${response.status}`,
      response.status,
      body
    );
  }

  return body as T;
}

async function readJson(response: Response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function getErrorMessage(body: unknown) {
  if (typeof body === "string") return body;
  if (!body || typeof body !== "object") return "";

  const record = body as Record<string, unknown>;
  return (
    getString(record.msg) ||
    getString(record.message) ||
    getString(record.error_description) ||
    getString(record.error)
  );
}

function getString(value: unknown) {
  return typeof value === "string" ? value : "";
}
