import type { PayoutAssetConfig } from "../config/server";
import { getRobinhoodStockUsdPrice } from "./robinhood-stock-pricing";
import { getEthUsdPrice } from "./chainlink-eth-pricing";
import type { QuickSellConfig } from "../config/server";

export async function resolvePayoutAssetPrice(
  asset: PayoutAssetConfig,
  config: QuickSellConfig,
): Promise<PayoutAssetConfig> {
  if (asset.asset === "ETH") {
    const price = await getEthUsdPrice({
      rpcUrl: config.chainlinkEthereumRpcUrl,
      feedAddress: config.chainlinkEthUsdFeedAddress,
      maxAgeSeconds: config.chainlinkPriceMaxAgeSeconds,
      timeoutMs: config.priceRequestTimeoutMs,
      retries: config.priceRequestRetries,
    });
    return {
      ...asset,
      usdPerAsset: price.usdPrice,
      priceSource: price.source,
      priceUpdatedAt: price.updatedAt,
    };
  }
  if (asset.category !== "stock")
    return { ...asset, priceSource: "configured" };
  const price = await getRobinhoodStockUsdPrice(asset.asset, {
    timeoutMs: config.priceRequestTimeoutMs,
    retries: config.priceRequestRetries,
  });
  return {
    ...asset,
    usdPerAsset: price.usdPrice,
    priceSource: price.source,
    priceUpdatedAt: price.updatedAt,
  };
}
