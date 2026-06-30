import { NextResponse } from "next/server";
import { buildSyncReplayTestApiDisabledResponse } from "@/lib/sync/syncReplayTestApiStub";
import {
  buildWebBetaApiStubResponse,
  WEB_BETA_API_STUB_HTTP_STATUS,
} from "@/lib/sync/webBetaApiStubs";

export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(
    {
      ...buildSyncReplayTestApiDisabledResponse(),
      base_stub: buildWebBetaApiStubResponse("sync-replay-test"),
    },
    {
      status: WEB_BETA_API_STUB_HTTP_STATUS,
    }
  );
}
