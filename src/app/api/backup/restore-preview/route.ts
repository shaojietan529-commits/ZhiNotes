import { NextResponse } from "next/server";
import {
  WEB_BETA_API_STUB_HTTP_STATUS,
} from "@/lib/sync/webBetaApiStubs";
import { buildRestorePreviewApiDisabledResponse } from "@/lib/sync/restorePreviewApiStub";

export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(buildRestorePreviewApiDisabledResponse(), {
    status: WEB_BETA_API_STUB_HTTP_STATUS,
  });
}
