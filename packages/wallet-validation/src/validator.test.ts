import { describe, expect, it } from "vitest";
import { DefaultWalletAddressValidator } from "./validator";

const validator = new DefaultWalletAddressValidator([
  { asset: "ETH", network: "Ethereum" },
  { asset: "GRAM", network: "TON" },
]);
describe("network-aware wallet validation", () => {
  it("uses EVM validation for Robinhood Chain", () => {
    const robinhood = new DefaultWalletAddressValidator([
      { asset: "AAPL", network: "Robinhood Chain" },
    ]);
    expect(
      robinhood.validateAddress({
        asset: "AAPL",
        network: "Robinhood Chain",
        address: "0x1111111111111111111111111111111111111111",
      }).valid,
    ).toBe(true);
  });
  it("validates and normalizes Ethereum addresses", () => {
    expect(
      validator.validateAddress({
        asset: "ETH",
        network: "Ethereum",
        address: "0x0000000000000000000000000000000000000001",
      }),
    ).toEqual({
      valid: true,
      status: "valid",
      normalizedAddress: "0x0000000000000000000000000000000000000001",
      network: "Ethereum",
      reason: null,
    });
  });
  it("rejects malformed Ethereum encoding rather than checking length", () => {
    expect(
      validator.validateAddress({
        asset: "ETH",
        network: "Ethereum",
        address: "0xGG00000000000000000000000000000000000001",
      }),
    ).toMatchObject({ valid: false, status: "invalid" });
  });
  it("validates and normalizes TON addresses", () => {
    expect(
      validator.validateAddress({
        asset: "GRAM",
        network: "TON",
        address:
          "0:0000000000000000000000000000000000000000000000000000000000000000",
      }),
    ).toMatchObject({
      valid: true,
      normalizedAddress: "UQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJKZ",
      network: "TON",
    });
  });
  it("rejects TON addresses with invalid checksums", () => {
    expect(
      validator.validateAddress({
        asset: "GRAM",
        network: "TON",
        address: "UQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      }),
    ).toMatchObject({ valid: false, status: "invalid" });
  });
  it("enables only explicitly configured asset/network pairs", () => {
    const restricted = new DefaultWalletAddressValidator([
      { asset: "GRAM", network: "TON" },
    ]);
    expect(
      restricted.validateAddress({
        asset: "ETH",
        network: "Ethereum",
        address: "0x0000000000000000000000000000000000000001",
      }),
    ).toMatchObject({
      valid: false,
      status: "unsupported_network",
      network: "Ethereum",
    });
  });
  it("does not treat exchange names as blockchain networks", () => {
    expect(
      validator.validateAddress({
        asset: "ETH",
        network: "SomeExchange",
        address: "0x0000000000000000000000000000000000000001",
      }),
    ).toMatchObject({ valid: false, status: "unsupported_network" });
  });
});
