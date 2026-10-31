/** Local copies of the device artwork supplied by the operator. */
export type DeviceIdentity = {
  type?: string;
  kind?: string;
  name?: string;
  meta?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};
const icons = {
  phone: { src: "/device-icons/phone.png", alt: "Điện thoại" },
  computer: { src: "/device-icons/laptop.png", alt: "Máy tính / laptop" },
  ap: { src: "/device-icons/unifi-ap.png", alt: "UniFi AP" },
};
export function deviceIcon(device: DeviceIdentity) {
  const meta = device.meta || device.metadata || {};
  const role = device.type || device.kind;
  // Topology AP nodes currently originate from UniFi. Monitor carries provider.
  if (role === "ap") {
    return !meta.provider || /unifi/i.test(String(meta.provider))
      ? icons.ap
      : null;
  }
  if (
    role &&
    ![
      "client",
      "host",
      "computer",
      "laptop",
      "desktop",
      "phone",
      "smartphone",
    ].includes(role)
  )
    return null;
  const identity = [
    role,
    meta.deviceCategory,
    meta.deviceType,
    meta.deviceFamily,
    meta.osName,
    meta.os_name,
    meta.model,
    meta.hostname,
    device.name,
  ]
    .filter((value) => typeof value === "string")
    .join(" ")
    .toLowerCase();
  if (/\bgalaxy[- ]?book\b/.test(identity)) return icons.computer;
  if (
    /\b(iphone|ipad|ipod|ios|android|smartphone|phone|mobile|samsung galaxy|galaxy[- ]?(?:note\d*|s\d\w*|a\d\w*|m\d\w*|j\d\w*|z[- ]?(?:fold|flip)\d*))\b/.test(
      identity,
    )
  )
    return icons.phone;
  if (
    /\b(windows|macos|mac os|macbook|imac|laptop|desktop|computer|chromebook|chrome os|ubuntu desktop|galaxy[- ]?book)\b/.test(
      identity,
    )
  )
    return icons.computer;
  return null;
}
