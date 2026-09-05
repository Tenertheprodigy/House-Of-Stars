export interface DestinationValidationResult {
  readonly valid: boolean;
  readonly normalizedDestination?: string;
  readonly reason?: string;
}
export type PayoutStatus =
  "pending" | "queued" | "broadcast" | "confirmed" | "failed" | "cancelled";
export interface PayoutRequest {
  readonly destination: string;
  readonly asset: string;
  readonly network: string;
  /** Decimal string; never a JavaScript floating-point monetary value. */
  readonly amount: string;
  readonly idempotencyKey: string;
}
export interface PayoutReceipt {
  readonly providerReference: string;
  readonly status: PayoutStatus;
}
/** Contract only. Implementations must keep signing material outside browser code. */
export interface PayoutProvider {
  createPayout(request: PayoutRequest): Promise<PayoutReceipt>;
  getPayoutStatus(providerReference: string): Promise<PayoutReceipt>;
  cancelPayout(providerReference: string): Promise<PayoutReceipt>;
}
export interface AddressValidationInput {
  readonly asset: string;
  readonly network: string;
  readonly address: string;
}
export type WalletValidationResult =
  | {
      readonly valid: true;
      readonly status: "valid";
      readonly normalizedAddress: string;
      readonly network: string;
      readonly reason: null;
    }
  | {
      readonly valid: false;
      readonly status: "invalid" | "unsupported_network";
      readonly normalizedAddress: null;
      readonly network: string;
      readonly reason: string;
    };
export interface WalletAddressValidator {
  validateAddress(input: AddressValidationInput): WalletValidationResult;
}
export interface SupportedWalletNetwork {
  readonly asset: string;
  readonly network: string;
}
export { DefaultWalletAddressValidator } from "./validator";
export { MockPayoutProvider } from "./mock-payout-provider";
