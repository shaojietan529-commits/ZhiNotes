import { NextResponse } from "next/server";
import {
  WEB_BETA_API_STUB_HTTP_STATUS,
} from "@/lib/sync/webBetaApiStubs";
import { buildAuditEventsApiDisabledResponse } from "@/lib/security/auditEventsApiStub";

export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(buildAuditEventsApiDisabledResponse(), {
    status: WEB_BETA_API_STUB_HTTP_STATUS,
  });
}
