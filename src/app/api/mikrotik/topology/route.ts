import { mikrotikInfrastructureTopology } from "@/lib/network/mikrotik-infrastructure";
import { getMikrotikFleetTopology } from "@/lib/network/mikrotik-fleet";
import { NextRequest, NextResponse } from "next/server";
import { withPermission } from "@/lib/api-access";
import { getSampledTopology } from "@/lib/network/traffic-service";
export const dynamic = "force-dynamic";
export const GET = withPermission("read", async (req: NextRequest) => {
  const topology =
    req.nextUrl.searchParams.get("scope") === "fleet"
      ? await getMikrotikFleetTopology(req)
      : mikrotikInfrastructureTopology(await getSampledTopology("MIKROTIK", req, { infrastructureOnly: true }));
  return NextResponse.json(
    { success: true, data: topology },
    { headers: { "Cache-Control": "private, no-store" } },
  );
});
