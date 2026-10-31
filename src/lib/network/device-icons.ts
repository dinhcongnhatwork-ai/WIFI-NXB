/** Shared local hardware artwork and conservative device identity classification. */
export type DeviceIdentity = {
  type?: string;
  kind?: string;
  name?: string;
  meta?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export const DEVICE_ICONS = {
  ap: { src: "/device-icons/ap-v2.png", alt: "Điểm truy cập WiFi" },
  router: { src: "/device-icons/router-v2.png", alt: "Router" },
  switch: { src: "/device-icons/switch-v2.png", alt: "Switch mạng" },
  laptop: { src: "/device-icons/laptop-v2.png", alt: "Laptop" },
  desktop: { src: "/device-icons/desktop-v2.png", alt: "Máy tính để bàn" },
  phone: { src: "/device-icons/phone-v2.png", alt: "Điện thoại" },
  printer: { src: "/device-icons/printer-v2.png", alt: "Máy in" },
  tv: { src: "/device-icons/tv-v2.png", alt: "TV" },
  server: { src: "/device-icons/server-v2.png", alt: "Máy chủ" },
  "generic-device": { src: "/device-icons/generic-device-v2.png", alt: "Thiết bị mạng" },
} as const;
export type DeviceCategory = keyof typeof DEVICE_ICONS;

const aliases: Record<string, DeviceCategory> = {
  ap: "ap", "access point": "ap", "wireless access point": "ap", uap: "ap",
  router: "router", gateway: "router", udm: "router", usg: "router",
  switch: "switch", usw: "switch", "network switch": "switch",
  laptop: "laptop", notebook: "laptop", "notebook computer": "laptop",
  desktop: "desktop", computer: "desktop", pc: "desktop", workstation: "desktop",
  phone: "phone", smartphone: "phone", mobile: "phone", tablet: "phone",
  printer: "printer", "network printer": "printer", scanner: "printer",
  tv: "tv", television: "tv", "smart tv": "tv", "smart television": "tv",
  server: "server", nas: "server", "file server": "server", "storage server": "server",
  "generic device": "generic-device",
};
const text = (value: unknown) => typeof value === "string" ? value.toLowerCase().replace(/[_-]+/g, " ").trim() : "";
const exact = (value: unknown) => aliases[text(value)];

const metadataOf = (device: DeviceIdentity) => ({ ...device.metadata, ...device.meta });
const isMikrotik = (meta: Record<string, unknown>) =>
  [meta.provider, meta.vendor].some(value => /\bmikrotik\b/.test(text(value)));
const mikrotikModelCategory = (meta: Record<string, unknown>): DeviceCategory | undefined => {
  if (!isMikrotik(meta)) return undefined;
  const model = [meta.model, meta.modelName, meta.platform, meta.boardName].map(text).join(" ");
  if (/\b(?:crs|css)\s?\d{3}\w*/.test(model)) return "switch";
  if (/\b(?:ccr\s?\d{4}\w*|rb\s?\d{3,4}\w*)/.test(model)) return "router";
  return undefined;
};

export function classifyDevice(device: DeviceIdentity): DeviceCategory {
  // Explicit hardware roles and controller categories outrank inferred OS/name.
  const role = exact(device.type) || exact(device.kind);
  if (role) return role;
  const meta = metadataOf(device);
  for (const key of ["deviceCategory", "deviceType", "deviceFamily", "category", "dev_cat_name"]) {
    const category = exact(meta[key]);
    if (category) return category;
  }
  // Known MikroTik hardware families can identify otherwise generic observed peers.
  const rawHardwareRole = text(device.type || device.kind);
  if (!rawHardwareRole || ["client", "host", "device", "unknown", "neighbor"].includes(rawHardwareRole)) {
    const modelCategory = mikrotikModelCategory(meta);
    if (modelCategory) return modelCategory;
  }
  // Unknown explicit hardware roles should not become phones from a name alone.
  const rawRole = text(device.type || device.kind);
  if (rawRole && !["client", "host", "device", "unknown"].includes(rawRole)) return "generic-device";
  const identity = [meta.deviceCategory, meta.deviceType, meta.deviceFamily, meta.model, meta.modelName, meta.osName, meta.os_name, meta.hostname, device.name].map(text).join(" ");
  if (/\b(uap|u[67] (?:pro|lite|lr|enterprise|mesh|plus)|access point)\b/.test(identity)) return "ap";
  if (/\b(usw|network switch)\b/.test(identity)) return "switch";
  if (/\b(udm|usg|uxg|edgerouter)\b/.test(identity)) return "router";
  if (/\b(printer|laserjet|officejet|deskjet|imageclass|ecosys|pixma)\b/.test(identity)) return "printer";
  if (/\b(server|nas|synology|qnap|poweredge|proliant)\b/.test(identity)) return "server";
  if (/\b(tv|television|bravia|webos|tizen|roku)\b/.test(identity)) return "tv";
  if (/\b(galaxy ?book|macbook|laptop|notebook|chromebook|thinkpad|latitude|elitebook|zenbook)\b/.test(identity)) return "laptop";
  if (/\b(iphone|ipad|ipod|ios|android|smartphone|phone|mobile|galaxy ?(?:note\w*|s\d\w*|a\d\w*|m\d\w*|j\d\w*|z ?(?:fold|flip)\w*))\b/.test(identity)) return "phone";
  if (/\b(imac|mac ?mini|mac ?pro|desktop|workstation|windows|macos|mac os|ubuntu desktop|computer)\b/.test(identity)) return "desktop";
  return "generic-device";
}

export function deviceIcon(device: DeviceIdentity) {
  const meta = metadataOf(device);
  const category = classifyDevice(device);
  if (isMikrotik(meta)) {
    // Provisioned role is authoritative; a model alone does not establish core placement.
    const role = text(meta.deviceRole);
    if (role === "core switch")
      return { src: "/device-icons/mikrotik-core-switch-v3.png", alt: "Switch lõi MikroTik" };
    if (role === "access switch") return DEVICE_ICONS.switch;
    if (category === "router")
      return { src: "/device-icons/mikrotik-router-v3.png", alt: "Router MikroTik" };
  }
  return DEVICE_ICONS[category];
}
