import { describe, expect, it } from "vitest";
import { MockPayoutProvider } from "./mock-payout-provider";

const request = {
  asset: "GRAM",
  network: "TON",
  destination: "UQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJKZ",
  amount: "1.250000000000000000",
  idempotencyKey: "order:one",
};
describe("MockPayoutProvider", () => {
  it("returns the same payout for duplicate idempotency keys", async () => {
    const provider = new MockPayoutProvider();
    const first = await provider.createPayout(request);
    const duplicate = await provider.createPayout(request);
    expect(duplicate).toEqual(first);
    expect(provider.createdCount).toBe(1);
  });
  it("reports and cancels an unbroadcast payout", async () => {
    const provider = new MockPayoutProvider();
    const payout = await provider.createPayout(request);
    await expect(
      provider.getPayoutStatus(payout.providerReference),
    ).resolves.toMatchObject({ status: "pending" });
    await expect(
      provider.cancelPayout(payout.providerReference),
    ).resolves.toMatchObject({ status: "cancelled" });
  });
  it("does not cancel broadcast payouts", async () => {
    const provider = new MockPayoutProvider();
    const payout = await provider.createPayout(request);
    provider.setStatus(payout.providerReference, "broadcast");
    await expect(
      provider.cancelPayout(payout.providerReference),
    ).rejects.toThrow("no longer");
  });
});
