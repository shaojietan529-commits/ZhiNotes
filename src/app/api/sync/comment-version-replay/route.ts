import { NextResponse } from "next/server";
import { buildCommentVersionReplayApiDisabledResponse } from "@/lib/sync/commentVersionReplayApiStub";
import { WEB_BETA_API_STUB_HTTP_STATUS } from "@/lib/sync/webBetaApiStubs";

export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(buildCommentVersionReplayApiDisabledResponse(), {
    status: WEB_BETA_API_STUB_HTTP_STATUS,
  });
}
