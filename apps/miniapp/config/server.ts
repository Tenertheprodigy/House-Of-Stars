import { z } from "zod";

const quickSellConfigSchema = z.object({
  QUICK_SELL_MAX_USD: z
    .string()
    .regex(/^\d+(\.\d+)?$/)
    .default("10"),
  QUICK_SELL_COOLDOWN_DAYS: z.coerce.number().int().positive().default(30),
  QUICK_SELL_QUOTE_TTL_SECONDS: z.coerce.number().int().positive().default(60),
  QUICK_SELL_USD_PER_STAR: z
    .string()
    .regex(/^\d+(\.\d+)?$/)
    .default("0.01"),
  PAYOUT_ASSETS_JSON: z.string().optional(),
  APPLE_GOOGLE_SETTLEMENT_DAYS: z.coerce.number().int().positive().default(21),
  GIFT_SETTLEMENT_DAYS: z.coerce.number().int().positive().default(7),
  ESTIMATED_PROCESSING_DAYS: z.coerce.number().int().positive().optional(),
});

const payoutAssetSchema = z.object({
  asset: z.string().min(1),
  network: z.string().min(1),
  usdPerAsset: z.string().regex(/^\d+(\.\d+)?$/),
});
export type PayoutAssetConfig = z.infer<typeof payoutAssetSchema>;

export interface QuickSellConfig {
  readonly quickSellMaxUsd: string;
  readonly quickSellCooldownDays: number;
  readonly quickSellQuoteTtlSeconds: number;
  readonly quickSellUsdPerStar: string;
  readonly payoutAssets: readonly PayoutAssetConfig[];
  readonly appleGoogleSettlementDays: number;
  readonly giftSettlementDays: number;
  readonly estimatedProcessingDays?: number;
}

export function getQuickSellConfig(
  environment: NodeJS.ProcessEnv = process.env,
): QuickSellConfig {
  const parsed = quickSellConfigSchema.parse(environment);
  const payoutAssets = parsed.PAYOUT_ASSETS_JSON
    ? z
        .array(payoutAssetSchema)
        .min(1)
        .parse(JSON.parse(parsed.PAYOUT_ASSETS_JSON))
    : [
        { asset: "ETH", network: "Ethereum", usdPerAsset: "3000" },
        { asset: "GRAM", network: "TON", usdPerAsset: "5" },
      ];
  return {
    quickSellMaxUsd: parsed.QUICK_SELL_MAX_USD,
    quickSellCooldownDays: parsed.QUICK_SELL_COOLDOWN_DAYS,
    quickSellQuoteTtlSeconds: parsed.QUICK_SELL_QUOTE_TTL_SECONDS,
    quickSellUsdPerStar: parsed.QUICK_SELL_USD_PER_STAR,
    payoutAssets,
    appleGoogleSettlementDays: parsed.APPLE_GOOGLE_SETTLEMENT_DAYS,
    giftSettlementDays: parsed.GIFT_SETTLEMENT_DAYS,
    estimatedProcessingDays: parsed.ESTIMATED_PROCESSING_DAYS,
  };
}
