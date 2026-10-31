import { describe, it, expect } from "vitest";
import { clientIdentity } from "@/lib/network/client-identity";
import { buildUnifiTopology } from "@/lib/network/topology";
describe("observed client identity and AP membership", () => {
  it("prefers a friendly alias and retains the actual hostname", () => {
    expect(
      clientIdentity({
        name: "Điện thoại An",
        hostname: "iPhone",
        mac: "aa:bb:cc:dd:ee:ff",
      }),
    ).toMatchObject({
      name: "Điện thoại An",
      hostname: "iPhone",
      nameSource: "alias",
    });
  });
  it("does not invent a hostname or OS from numeric fingerprint identifiers", () => {
    expect(
      clientIdentity({
        mac: "aa:bb:cc:dd:ee:ff",
        oui: "Samsung",
        fingerprint_os: 123,
      }),
    ).toMatchObject({
      name: "Samsung · EE:FF",
      hostname: undefined,
      osName: undefined,
    });
  });
  it("attaches the observed AP name and MAC to clients even when the controller omits ap_name", () => {
    const graph = buildUnifiTopology(
      [{ mac: "aa:aa:aa:aa:aa:aa", type: "uap", name: "AP Tầng 2" }],
      [
        {
          mac: "bb:bb:bb:bb:bb:bb",
          name: "Máy tính An",
          hostname: "DESKTOP-AN",
          ap_mac: "aa:aa:aa:aa:aa:aa",
          signal: -55,
          noise: -95,
        },
      ],
      "2026-10-24T09:00:00Z",
    );
    expect(graph.nodes.find((n) => n.type === "client")).toMatchObject({
      name: "Máy tính An",
      meta: {
        apName: "AP Tầng 2",
        hostname: "DESKTOP-AN",
        signal: -55,
        noise: -95,
      },
    });
  });
});
