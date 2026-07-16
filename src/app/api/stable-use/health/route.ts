import { NextResponse } from "next/server";
import { buildStableUseHealthResponse } from "@/lib/sync/stableUseHealth";

export const dynamic = "force-dynamic";

export async function GET() {
  const response = NextResponse.json(buildStableUseHealthResponse());
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}
