import { NextResponse } from "next/server";
import {
  SESSION_COOKIE_NAME,
  deleteSession,
  getAccountConfig,
  readSessionToken,
} from "@/lib/account/server";

export const dynamic = "force-dynamic";

// Revokes the server-side session and clears the cookie.
export async function POST(request: Request) {
  const token = readSessionToken(request);
  const config = getAccountConfig();
  if (config && token) {
    try {
      await deleteSession(config, token);
    } catch {
      // Cookie still gets cleared below; the KV entry expires on its own.
    }
  }
  const response = NextResponse.json({ status: "signed-out" });
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}
