import { NextResponse } from "next/server";
import {
  AI_RUN_DISABLED_HTTP_STATUS,
  buildAiRunDisabledResponse,
} from "@/lib/ai/aiExecutionPolicy";

export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(buildAiRunDisabledResponse(), {
    status: AI_RUN_DISABLED_HTTP_STATUS,
  });
}
