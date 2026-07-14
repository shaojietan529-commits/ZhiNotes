import { NextResponse } from "next/server";
import {
  badRequestResponse,
  cloudNotConfiguredResponse,
  requireCloudWritesResponse,
  supabaseErrorResponse,
} from "@/lib/cloud/api";
import { requestSupabaseAuth } from "@/lib/cloud/supabaseRest";
import type {
  ZhiNotesCloudSession,
  ZhiNotesCloudSessionUser,
} from "@/lib/cloud/clientSession";

export const dynamic = "force-dynamic";

interface RefreshRequestBody {
  refresh_token?: unknown;
}

interface SupabaseRefreshResponse {
  access_token?: unknown;
  refresh_token?: unknown;
  token_type?: unknown;
  expires_in?: unknown;
  user?: {
    id?: unknown;
    email?: unknown;
  } | null;
}

export async function POST(request: Request) {
  const disabled = cloudNotConfiguredResponse("auth-session");
  if (disabled) return disabled;

  const writesDisabled = requireCloudWritesResponse("auth-session");
  if (writesDisabled) return writesDisabled;

  let body: RefreshRequestBody;
  try {
    body = (await request.json()) as RefreshRequestBody;
  } catch {
    return badRequestResponse("请求体需要是 JSON。");
  }

  const refreshToken =
    typeof body.refresh_token === "string" ? body.refresh_token.trim() : "";
  if (!refreshToken) {
    return badRequestResponse("refresh_token 不能为空。");
  }

  try {
    const refreshed = await requestSupabaseAuth<SupabaseRefreshResponse>(
      "/token?grant_type=refresh_token",
      {
        method: "POST",
        body: JSON.stringify({
          refresh_token: refreshToken,
        }),
      }
    );
    const session = buildCloudSessionFromRefresh(refreshed);
    if (!session) {
      return NextResponse.json(
        {
          format: "zhinote-cloud-auth-refresh",
          status: "invalid-refresh-response",
          message: "Supabase 没有返回可用的新 session。",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      format: "zhinote-cloud-auth-refresh",
      status: "refreshed",
      session,
      privacy_note:
        "该接口只用 refresh token 换取新的 Supabase session，不读取或上传本地笔记、文件、数据库或同步队列内容。",
    });
  } catch (error) {
    return supabaseErrorResponse(error);
  }
}

function buildCloudSessionFromRefresh(
  value: SupabaseRefreshResponse
): ZhiNotesCloudSession | null {
  const accessToken = getString(value.access_token);
  if (!accessToken) return null;

  const expiresIn =
    typeof value.expires_in === "number" && Number.isFinite(value.expires_in)
      ? value.expires_in
      : null;
  return {
    accessToken,
    refreshToken: getString(value.refresh_token) || null,
    tokenType: getString(value.token_type) || "bearer",
    expiresAt: expiresIn ? Date.now() + expiresIn * 1000 : null,
    storedAt: new Date().toISOString(),
    user: getRefreshUser(value.user),
  };
}

function getRefreshUser(value: SupabaseRefreshResponse["user"]): ZhiNotesCloudSessionUser | null {
  if (!value || typeof value !== "object") return null;
  const id = getString(value.id);
  if (!id) return null;
  return {
    id,
    email: getString(value.email) || null,
  };
}

function getString(value: unknown) {
  return typeof value === "string" ? value : "";
}
