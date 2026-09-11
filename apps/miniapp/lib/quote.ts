import Decimal from "decimal.js";
import type { PayoutAssetConfig, QuickSellConfig } from "../config/server";

export interface QuoteValues {
  starsAmount: number;
  usdValue: string;
  payoutAsset: string;
  payoutNetwork: string;
  payoutAmount: string;
  exchangeRate: string;
  fees: string;
  netUsdValue: string;
  priceSource: string;
  priceUpdatedAt: string | null;
}

export function calculateStarUsdValue(
  starsAmount: number,
  usdPerStar: string,
): Decimal {
  if (!Number.isSafeInteger(starsAmount) || starsAmount <= 0)
    throw new Error("Stars amount must be a positive integer");
  return new Decimal(starsAmount).mul(usdPerStar);
}

export function calculateAssetQuote(
  netUsdValue: Decimal,
  usdPerAsset: string,
): string {
  return netUsdValue
    .div(usdPerAsset)
    .toDecimalPlaces(18, Decimal.ROUND_DOWN)
    .toFixed(18);
}

export function calculateQuoteValues(
  starsAmount: number,
  asset: PayoutAssetConfig,
  config: QuickSellConfig,
  enforceQuickSellMaximum = true,
): QuoteValues {
  const usdValue = calculateStarUsdValue(
    starsAmount,
    config.quickSellUsdPerStar,
  );
  if (enforceQuickSellMaximum && usdValue.gt(config.quickSellMaxUsd))
    throw new Error("Amount exceeds the Quick Sell maximum");
  const fees = usdValue
    .mul(config.platformFeeRate)
    .div(100)
    .toDecimalPlaces(18, Decimal.ROUND_UP);
  const netUsdValue = usdValue.sub(fees);
  if (netUsdValue.lte(0)) throw new Error("Fees exceed quote value");
  return {
    starsAmount,
    usdValue: usdValue.toDecimalPlaces(2).toFixed(2),
    payoutAsset: asset.asset,
    payoutNetwork: asset.network,
    payoutAmount: calculateAssetQuote(netUsdValue, asset.usdPerAsset),
    exchangeRate: new Decimal(asset.usdPerAsset)
      .toDecimalPlaces(18)
      .toFixed(18),
    fees: fees.toFixed(18),
    netUsdValue: netUsdValue.toDecimalPlaces(2, Decimal.ROUND_DOWN).toFixed(2),
    priceSource: asset.priceSource ?? "configured",
    priceUpdatedAt: asset.priceUpdatedAt ?? null,
  };
}
