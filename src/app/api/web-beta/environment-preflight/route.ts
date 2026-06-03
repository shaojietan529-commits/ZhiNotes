import { NextResponse } from "next/server";
import { buildWebBetaEnvironmentPreflight } from "@/lib/sync/webBetaEnvironmentPreflight";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    buildWebBetaEnvironmentPreflight((key) => process.env[key])
  );
}
