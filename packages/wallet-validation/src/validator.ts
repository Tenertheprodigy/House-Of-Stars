import { Address } from "@ton/core";
import { getAddress, isAddress } from "viem";
import type {
  AddressValidationInput,
  SupportedWalletNetwork,
  WalletAddressValidator,
  WalletValidationResult,
} from "./index";

type NetworkValidator = (
  address: string,
  network: string,
) => WalletValidationResult;
const knownValidators = new Map<string, NetworkValidator>([
  ["ETH:Ethereum", validateEthereum],
  ["ETH:Robinhood Chain", validateEthereum],
  ["GRAM:TON", validateTon],
]);

export class DefaultWalletAddressValidator implements WalletAddressValidator {
  private readonly configured = new Map<string, NetworkValidator>();
  constructor(supportedNetworks: readonly SupportedWalletNetwork[]) {
    for (const entry of supportedNetworks) {
      const validator =
        knownValidators.get(key(entry.asset, entry.network)) ??
        (entry.network === "Robinhood Chain" ? validateEthereum : undefined);
      if (validator)
        this.configured.set(key(entry.asset, entry.network), validator);
    }
  }
  validateAddress(input: AddressValidationInput): WalletValidationResult {
    const validator = this.configured.get(key(input.asset, input.network));
    if (!validator)
      return invalid(
        "unsupported_network",
        input.network,
        "This asset and blockchain network combination is not supported.",
      );
    return validator(input.address.trim(), input.network);
  }
}
function validateEthereum(
  candidate: string,
  network: string,
): WalletValidationResult {
  if (!isAddress(candidate, { strict: true }))
    return invalid(
      "invalid",
      network,
      "Enter a valid Ethereum address with valid hexadecimal encoding and checksum when mixed-case.",
    );
  return {
    valid: true,
    status: "valid",
    normalizedAddress: getAddress(candidate),
    network,
    reason: null,
  };
}
function validateTon(
  candidate: string,
  network: string,
): WalletValidationResult {
  try {
    return {
      valid: true,
      status: "valid",
      normalizedAddress: Address.parse(candidate).toString({
        bounceable: false,
        urlSafe: true,
      }),
      network,
      reason: null,
    };
  } catch {
    return invalid(
      "invalid",
      network,
      "Enter a valid TON raw or friendly address with a valid checksum.",
    );
  }
}
function invalid(
  status: "invalid" | "unsupported_network",
  network: string,
  reason: string,
): WalletValidationResult {
  return { valid: false, status, normalizedAddress: null, network, reason };
}
function key(asset: string, network: string): string {
  return `${asset}:${network}`;
}
