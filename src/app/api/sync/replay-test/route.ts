import { NextResponse } from "next/server";
import { buildSyncReplayTestApiDisabledResponse } from "@/lib/sync/syncReplayTestApiStub";
import { WEB_BETA_API_STUB_HTTP_STATUS } from "@/lib/sync/webBetaApiStubs";

export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(buildSyncReplayTestApiDisabledResponse(), {
    status: WEB_BETA_API_STUB_HTTP_STATUS,
  });
}
