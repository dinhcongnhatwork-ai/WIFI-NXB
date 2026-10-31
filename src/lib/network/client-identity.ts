const text = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;
/** Friendly alias first, then observed hostname; never present a vendor as a hostname. */
export function clientIdentity(client: Record<string, any>) {
  const alias =
    text(client.name) ||
    text(client.display_name) ||
    text(client.hostname_alias);
  const hostname = text(client.hostname);
  const model =
    text(client.model) ||
    text(client.device_name) ||
    text(client.fingerprint?.model);
  const vendor =
    text(client.vendor) || text(client.oui) || text(client.fingerprint?.vendor);
  const mac = text(client.mac) || text(client.macAddress) || "";
  const knownHostname =
    hostname && hostname.toLowerCase() !== mac.toLowerCase()
      ? hostname
      : undefined;
  const tail = mac.split(":").slice(-2).join(":").toUpperCase();
  return {
    alias,
    hostname: knownHostname,
    model,
    vendor,
    name:
      alias ||
      knownHostname ||
      (model
        ? `${model}${tail ? ` · ${tail}` : ""}`
        : vendor
          ? `${vendor}${tail ? ` · ${tail}` : ""}`
          : `Thiết bị${tail ? ` · ${tail}` : " chưa rõ tên"}`),
    nameSource: alias
      ? "alias"
      : knownHostname
        ? "hostname"
        : model
          ? "model"
          : vendor
            ? "vendor"
            : "mac",
    osName:
      text(client.osName) ||
      text(client.os_name) ||
      text(client.fingerprintOs) ||
      text(client.fingerprint_os) ||
      text(client.fingerprint?.os_name) ||
      text(client.fingerprint?.osName),
  };
}
