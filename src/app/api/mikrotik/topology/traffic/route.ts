import { NextRequest, NextResponse } from "next/server";
import { withPermission } from "@/lib/api-access";
import {
  getSampledTopology,
  topologyTraffic,
} from "@/lib/network/traffic-service";
export const dynamic = "force-dynamic";
export const GET = withPermission("read", async (req: NextRequest) => {
  const topology = await getSampledTopology("MIKROTIK", req);
  return NextResponse.json(
    { success: true, data: topologyTraffic(topology) },
    { headers: { "Cache-Control": "private, no-store" } },
  );
});
