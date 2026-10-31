"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { ConnectionSettings } from "@/components/network/ConnectionSettings";
export default function MikrotikInventory() {
  const router = useRouter(),
    params = useSearchParams();
  return (
    <ConnectionSettings
      providerFilter="MIKROTIK"
      autoCreate={params.get("add") === "1"}
      onSaved={() => router.push("/admin/mikrotik/topology?scope=fleet")}
    />
  );
}
