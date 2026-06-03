import { NextResponse } from "next/server";
import {
  authRequiredResponse,
  cloudNotConfiguredResponse,
  getBearerToken,
  requireCloudWritesResponse,
  supabaseErrorResponse,
} from "@/lib/cloud/api";
import { requestSupabaseAuth } from "@/lib/cloud/supabaseRest";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const disabled = cloudNotConfiguredResponse("auth-logout");
  if (disabled) return disabled;

  const writesDisabled = requireCloudWritesResponse("auth-logout");
  if (writesDisabled) return writesDisabled;

  const accessToken = getBearerToken(request);
  if (!accessToken) return authRequiredResponse();

  try {
    await requestSupabaseAuth("/logout", { method: "POST" }, accessToken);
    return NextResponse.json({
      format: "zhinote-cloud-auth-logout",
      status: "signed-out",
      privacy_note:
        "该接口只结束 Supabase Auth session，不读取或上传本地笔记、文件或数据库。",
    });
  } catch (error) {
    return supabaseErrorResponse(error);
  }
}
