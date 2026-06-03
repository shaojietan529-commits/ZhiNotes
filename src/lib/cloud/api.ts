import { NextResponse } from "next/server";
import {
  WEB_BETA_API_STUB_HTTP_STATUS,
  buildWebBetaApiStubResponse,
  type WebBetaApiStubId,
} from "@/lib/sync/webBetaApiStubs";
import { getCloudReadiness } from "@/lib/cloud/config";
import { SupabaseRequestError } from "@/lib/cloud/supabaseRest";

export function disabledCloudResponse(apiId: WebBetaApiStubId) {
  return NextResponse.json(buildWebBetaApiStubResponse(apiId), {
    status: WEB_BETA_API_STUB_HTTP_STATUS,
  });
}

export function cloudNotConfiguredResponse(apiId: WebBetaApiStubId) {
  const readiness = getCloudReadiness();
  if (readiness.enabled) return null;

  return NextResponse.json(
    {
      ...buildWebBetaApiStubResponse(apiId),
      cloud_config_status: "not-enabled-or-incomplete",
      missing_env: readiness.missing,
    },
    { status: WEB_BETA_API_STUB_HTTP_STATUS }
  );
}

export function requireCloudWritesResponse(apiId: WebBetaApiStubId) {
  const readiness = getCloudReadiness();
  if (readiness.allowWrites) return null;

  return NextResponse.json(
    {
      ...buildWebBetaApiStubResponse(apiId),
      cloud_config_status: "writes-disabled",
      missing_env: ["ZHINOTES_ALLOW_CLOUD_WRITES=true"],
    },
    { status: WEB_BETA_API_STUB_HTTP_STATUS }
  );
}

export function getBearerToken(request: Request) {
  const value = request.headers.get("authorization") ?? "";
  const [scheme, token] = value.split(" ");
  if (scheme.toLowerCase() !== "bearer" || !token) return "";
  return token.trim();
}

export function authRequiredResponse() {
  return NextResponse.json(
    {
      format: "zhinote-cloud-error",
      error: "auth-required",
      message: "需要 Bearer token 才能访问云端 workspace。",
    },
    { status: 401 }
  );
}

export function badRequestResponse(message: string) {
  return NextResponse.json(
    {
      format: "zhinote-cloud-error",
      error: "bad-request",
      message,
    },
    { status: 400 }
  );
}

export function supabaseErrorResponse(error: unknown) {
  if (error instanceof SupabaseRequestError) {
    return NextResponse.json(
      {
        format: "zhinote-cloud-error",
        error: "supabase-request-failed",
        message: error.message,
        status: error.status,
      },
      { status: Math.min(Math.max(error.status, 400), 599) }
    );
  }

  return NextResponse.json(
    {
      format: "zhinote-cloud-error",
      error: "unexpected-cloud-error",
      message: error instanceof Error ? error.message : "Unknown cloud error",
    },
    { status: 500 }
  );
}

export function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  if (!name || !domain) return "";
  return `${name.slice(0, 2)}***@${domain}`;
}
