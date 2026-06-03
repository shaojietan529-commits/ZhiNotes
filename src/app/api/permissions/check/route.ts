import { NextResponse } from "next/server";
import {
  WEB_BETA_API_STUB_HTTP_STATUS,
  buildWebBetaApiStubResponse,
} from "@/lib/sync/webBetaApiStubs";

export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(buildWebBetaApiStubResponse("permission-check"), {
    status: WEB_BETA_API_STUB_HTTP_STATUS,
  });
}
