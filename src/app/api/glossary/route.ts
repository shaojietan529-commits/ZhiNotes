import { NextResponse } from "next/server";
import {
  authorizeMeetingAgent,
  getMeetingAgentQueueConfig,
} from "@/lib/meetings/agentQueue";
import { buildZhiHuiGlossary } from "@/lib/meetings/glossary";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const config = getMeetingAgentQueueConfig();
  if (config.status !== "ok") {
    return NextResponse.json(
      { error: "ZhiHui agent glossary not configured", missing_env: config.missing },
      { status: 501 }
    );
  }
  if (!authorizeMeetingAgent(request, config.agentToken)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const payload = await buildZhiHuiGlossary({
      kv: config.kv,
      requestUrl: new URL(request.url),
    });
    return NextResponse.json(payload);
  } catch {
    return NextResponse.json(
      { error: "ZhiHui glossary fetch failed" },
      { status: 502 }
    );
  }
}
