import type {
  PayoutProvider,
  PayoutReceipt,
  PayoutRequest,
  PayoutStatus,
} from "./index";

interface MockPayout extends PayoutReceipt {
  readonly request: PayoutRequest;
}

/** Development/test provider only. It never signs or broadcasts a transaction. */
export class MockPayoutProvider implements PayoutProvider {
  private readonly byReference = new Map<string, MockPayout>();
  private readonly byIdempotencyKey = new Map<string, string>();
  private sequence = 0;

  async createPayout(request: PayoutRequest): Promise<PayoutReceipt> {
    const existingReference = this.byIdempotencyKey.get(request.idempotencyKey);
    if (existingReference) return this.require(existingReference);
    if (!/^\d+(\.\d+)?$/.test(request.amount) || request.amount === "0")
      throw new Error("Payout amount must be a positive decimal string");
    const providerReference = `mock-payout-${++this.sequence}`;
    const payout: MockPayout = {
      providerReference,
      status: "pending",
      request,
    };
    this.byReference.set(providerReference, payout);
    this.byIdempotencyKey.set(request.idempotencyKey, providerReference);
    return payout;
  }

  async getPayoutStatus(providerReference: string): Promise<PayoutReceipt> {
    return this.require(providerReference);
  }
  async cancelPayout(providerReference: string): Promise<PayoutReceipt> {
    const current = this.require(providerReference);
    if (["broadcast", "confirmed"].includes(current.status))
      throw new Error("Payout can no longer be cancelled");
    const cancelled = { ...current, status: "cancelled" as const };
    this.byReference.set(providerReference, cancelled);
    return cancelled;
  }
  /** Test-only state advancement; this performs no network operation. */
  setStatus(providerReference: string, status: PayoutStatus): void {
    const current = this.require(providerReference);
    this.byReference.set(providerReference, { ...current, status });
  }
  get createdCount(): number {
    return this.byReference.size;
  }
  private require(reference: string): MockPayout {
    const payout = this.byReference.get(reference);
    if (!payout) throw new Error("Payout not found");
    return payout;
  }
}
