import { NextResponse } from "next/server";
import {
  cloudNotConfiguredResponse,
  getBearerToken,
  supabaseErrorResponse,
} from "@/lib/cloud/api";
import { getSupabaseUser } from "@/lib/cloud/supabaseRest";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const disabled = cloudNotConfiguredResponse("auth-session");
  if (disabled) return disabled;

  const accessToken = getBearerToken(request);
  if (!accessToken) {
    return NextResponse.json({
      format: "zhinote-cloud-auth-session",
      authenticated: false,
      user: null,
      privacy_note:
        "未提供 Bearer token；不会读取 cookies、本地笔记、文件或数据库。",
    });
  }

  try {
    const user = await getSupabaseUser(accessToken);
    return NextResponse.json({
      format: "zhinote-cloud-auth-session",
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
      },
      privacy_note:
        "该接口只验证 Supabase Auth 用户，不读取本地笔记、文件或数据库内容。",
    });
  } catch (error) {
    return supabaseErrorResponse(error);
  }
}
