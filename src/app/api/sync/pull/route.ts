import { NextResponse } from "next/server";
import {
  WEB_BETA_API_STUB_HTTP_STATUS,
} from "@/lib/sync/webBetaApiStubs";
import { buildSyncPullApiDisabledResponse } from "@/lib/sync/syncPullApiStub";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(buildSyncPullApiDisabledResponse(), {
    status: WEB_BETA_API_STUB_HTTP_STATUS,
  });
}
