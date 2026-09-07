import type { PayoutAssetConfig } from "../config/server";
import { getRobinhoodStockUsdPrice } from "./robinhood-stock-pricing";

export async function resolvePayoutAssetPrice(
  asset: PayoutAssetConfig,
): Promise<PayoutAssetConfig> {
  if (asset.category !== "stock") return asset;
  return { ...asset, usdPerAsset: await getRobinhoodStockUsdPrice(asset.asset) };
}
