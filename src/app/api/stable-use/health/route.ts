import { NextResponse } from "next/server";
import { buildStableUseHealthResponse } from "@/lib/sync/stableUseHealth";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(buildStableUseHealthResponse());
}
