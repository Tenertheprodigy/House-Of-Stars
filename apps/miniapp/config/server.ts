import { z } from "zod";
import { robinhoodStockSymbols } from "@house-of-stars/shared";

const quickSellConfigSchema = z.object({
  QUICK_SELL_MAX_USD: z
    .string()
    .regex(/^\d+(\.\d+)?$/)
    .default("10"),
  QUICK_SELL_COOLDOWN_DAYS: z.coerce.number().int().positive().default(30),
  QUICK_SELL_QUOTE_TTL_SECONDS: z.coerce.number().int().positive().default(60),
  STAR_USD_RATE: z
    .string()
    .regex(/^\d+(\.\d+)?$/)
    .default("0.0145"),
  PLATFORM_FEE_PERCENT: z
    .string()
    .regex(/^\d+(\.\d+)?$/)
    .default("3"),
  CHAINLINK_ETHEREUM_RPC_URL: z.string().url().optional(),
  CHAINLINK_ETH_USD_FEED_ADDRESS: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/)
    .default("0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419"),
  CHAINLINK_PRICE_MAX_AGE_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(3600),
  PRICE_REQUEST_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive()
    .max(30_000)
    .default(5_000),
  PRICE_REQUEST_RETRIES: z.coerce.number().int().min(0).max(3).default(2),
  PAYOUT_ASSETS_JSON: z.string().optional(),
  STARS_CONTRACT_ADDRESS: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/)
    .optional(),
  STARS_USD_PER_TOKEN: z
    .string()
    .regex(/^\d+(\.\d+)?$/)
    .optional(),
  APPLE_GOOGLE_SETTLEMENT_DAYS: z.coerce.number().int().positive().default(21),
  GIFT_SETTLEMENT_DAYS: z.coerce.number().int().positive().default(7),
  ESTIMATED_PROCESSING_DAYS: z.coerce.number().int().positive().optional(),
});

const payoutAssetSchema = z.object({
  asset: z.string().min(1),
  network: z.string().min(1),
  usdPerAsset: z.string().regex(/^\d+(\.\d+)?$/),
  category: z.enum(["crypto", "token", "stock"]).default("crypto"),
  contractAddress: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/)
    .optional(),
  priceSource: z.string().optional(),
  priceUpdatedAt: z.string().datetime().nullable().optional(),
});
export type PayoutAssetConfig = z.infer<typeof payoutAssetSchema>;

export interface QuickSellConfig {
  readonly quickSellMaxUsd: string;
  readonly quickSellCooldownDays: number;
  readonly quickSellQuoteTtlSeconds: number;
  readonly quickSellUsdPerStar: string;
  readonly platformFeeRate: string;
  readonly chainlinkEthereumRpcUrl?: string;
  readonly chainlinkEthUsdFeedAddress: string;
  readonly chainlinkPriceMaxAgeSeconds: number;
  readonly priceRequestTimeoutMs: number;
  readonly priceRequestRetries: number;
  readonly payoutAssets: readonly PayoutAssetConfig[];
  readonly appleGoogleSettlementDays: number;
  readonly giftSettlementDays: number;
  readonly estimatedProcessingDays?: number;
}

export function getQuickSellConfig(
  environment: NodeJS.ProcessEnv = process.env,
): QuickSellConfig {
  const parsed = quickSellConfigSchema.parse(environment);
  const configuredAssets = parsed.PAYOUT_ASSETS_JSON
    ? z
        .array(payoutAssetSchema)
        .min(1)
        .parse(JSON.parse(parsed.PAYOUT_ASSETS_JSON))
    : [
        {
          asset: "ETH",
          network: "Robinhood Chain",
          usdPerAsset: "0",
          category: "crypto" as const,
        },
      ];
  const payoutAssets = [
    ...configuredAssets.filter(
      (asset) => asset.category !== "stock" && asset.asset !== "STARS",
    ),
    ...(parsed.STARS_CONTRACT_ADDRESS && parsed.STARS_USD_PER_TOKEN
      ? [
          {
            asset: "STARS",
            network: "Robinhood Chain",
            usdPerAsset: parsed.STARS_USD_PER_TOKEN,
            category: "token" as const,
            contractAddress: parsed.STARS_CONTRACT_ADDRESS,
          },
        ]
      : []),
    ...robinhoodStockSymbols.map((asset) => ({
      asset,
      network: "Robinhood Chain",
      usdPerAsset: "0",
      category: "stock" as const,
    })),
  ];
  return {
    quickSellMaxUsd: parsed.QUICK_SELL_MAX_USD,
    quickSellCooldownDays: parsed.QUICK_SELL_COOLDOWN_DAYS,
    quickSellQuoteTtlSeconds: parsed.QUICK_SELL_QUOTE_TTL_SECONDS,
    quickSellUsdPerStar: parsed.STAR_USD_RATE,
    platformFeeRate: parsed.PLATFORM_FEE_PERCENT,
    chainlinkEthereumRpcUrl: parsed.CHAINLINK_ETHEREUM_RPC_URL,
    chainlinkEthUsdFeedAddress: parsed.CHAINLINK_ETH_USD_FEED_ADDRESS,
    chainlinkPriceMaxAgeSeconds: parsed.CHAINLINK_PRICE_MAX_AGE_SECONDS,
    priceRequestTimeoutMs: parsed.PRICE_REQUEST_TIMEOUT_MS,
    priceRequestRetries: parsed.PRICE_REQUEST_RETRIES,
    payoutAssets,
    appleGoogleSettlementDays: parsed.APPLE_GOOGLE_SETTLEMENT_DAYS,
    giftSettlementDays: parsed.GIFT_SETTLEMENT_DAYS,
    estimatedProcessingDays: parsed.ESTIMATED_PROCESSING_DAYS,
  };
}
