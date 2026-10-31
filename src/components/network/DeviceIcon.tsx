"use client";
import { useState, type ReactNode } from "react";
import { Box } from "lucide-react";
import { deviceIcon, type DeviceIdentity } from "@/lib/network/device-icons";

export function DeviceIcon({ device, size = 24, className = "", fallback = null }: {
  device: DeviceIdentity;
  size?: number;
  className?: string;
  fallback?: ReactNode;
}) {
  const icon = deviceIcon(device);
  const [failedSource, setFailedSource] = useState<string | null>(null);
  if (failedSource === icon.src) return <>{fallback ?? <Box size={size} className={`shrink-0 ${className}`} role="img" aria-label={icon.alt} />}</>;
  return (
    // Local transparent PNGs also work in topology image exports.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={icon.src} alt={icon.alt} width={size} height={size}
      draggable={false} className={`shrink-0 object-contain ${className}`}
      style={{ width: size, height: size }} onError={() => setFailedSource(icon.src)} />
  );
}
