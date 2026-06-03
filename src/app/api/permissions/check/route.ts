import { NextResponse } from "next/server";
import {
  WEB_BETA_API_STUB_HTTP_STATUS,
} from "@/lib/sync/webBetaApiStubs";
import { buildPermissionCheckApiDisabledResponse } from "@/lib/security/permissionCheckApiStub";

export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(buildPermissionCheckApiDisabledResponse(), {
    status: WEB_BETA_API_STUB_HTTP_STATUS,
  });
}
