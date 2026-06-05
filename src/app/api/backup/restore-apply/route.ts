import { NextResponse } from "next/server";
import {
  WEB_BETA_API_STUB_HTTP_STATUS,
} from "@/lib/sync/webBetaApiStubs";
import { buildRestoreApplyApiDisabledResponse } from "@/lib/sync/restoreApplyApiStub";

export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(buildRestoreApplyApiDisabledResponse(), {
    status: WEB_BETA_API_STUB_HTTP_STATUS,
  });
}
