import Decimal from "decimal.js";
import type { PayoutAssetConfig, QuickSellConfig } from "../config/server";

export interface QuoteValues {
  starsAmount: number;
  usdValue: string;
  payoutAsset: string;
  payoutNetwork: string;
  payoutAmount: string;
  exchangeRate: string;
}

export function calculateQuoteValues(
  starsAmount: number,
  asset: PayoutAssetConfig,
  config: QuickSellConfig,
  enforceQuickSellMaximum = true,
): QuoteValues {
  if (!Number.isSafeInteger(starsAmount) || starsAmount <= 0)
    throw new Error("Stars amount must be a positive integer");
  const usdValue = new Decimal(starsAmount).mul(config.quickSellUsdPerStar);
  if (enforceQuickSellMaximum && usdValue.gt(config.quickSellMaxUsd))
    throw new Error("Amount exceeds the Quick Sell maximum");
  return {
    starsAmount,
    usdValue: usdValue.toDecimalPlaces(2).toFixed(2),
    payoutAsset: asset.asset,
    payoutNetwork: asset.network,
    payoutAmount: usdValue
      .div(asset.usdPerAsset)
      .toDecimalPlaces(18)
      .toFixed(18),
    exchangeRate: new Decimal(asset.usdPerAsset).toFixed(2),
  };
}
