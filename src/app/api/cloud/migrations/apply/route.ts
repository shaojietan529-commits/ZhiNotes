import { NextResponse } from "next/server";
import {
  WEB_BETA_API_STUB_HTTP_STATUS,
} from "@/lib/sync/webBetaApiStubs";
import { buildCloudMigrationApplyApiDisabledResponse } from "@/lib/sync/cloudMigrationApplyApiStub";

export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(buildCloudMigrationApplyApiDisabledResponse(), {
    status: WEB_BETA_API_STUB_HTTP_STATUS,
  });
}
