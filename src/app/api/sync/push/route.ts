import { NextResponse } from "next/server";
import {
  WEB_BETA_API_STUB_HTTP_STATUS,
} from "@/lib/sync/webBetaApiStubs";
import { buildSyncPushApiDisabledResponse } from "@/lib/sync/syncPushApiStub";

export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(buildSyncPushApiDisabledResponse(), {
    status: WEB_BETA_API_STUB_HTTP_STATUS,
  });
}
