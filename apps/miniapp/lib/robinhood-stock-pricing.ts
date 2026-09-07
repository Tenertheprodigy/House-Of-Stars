import { isRobinhoodStockSymbol } from "@house-of-stars/shared";
import Decimal from "decimal.js";
import { z } from "zod";

const ROBINHOOD_CHAIN_ID = 4663;
const API_BASE = "https://api.robinhood.com/rhj";

const deploymentSchema = z.object({
  contractAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  chainId: z.number().int(),
});
const assetSchema = z.object({
  tokenSymbol: z.string(),
  currentMultiplier: z.string(),
  deployments: z.array(deploymentSchema),
  status: z.string(),
});
const assetsResponseSchema = z.object({ assets: z.array(assetSchema) });
const priceResponseSchema = z.object({
  quotes: z.array(
    z.object({
      tokenSymbol: z.string(),
      ask: z.string(),
      currency: z.literal("USD"),
      isTradingHalt: z.boolean(),
      deployments: z.array(deploymentSchema),
    }),
  ),
});

interface CachedAssets {
  expiresAt: number;
  value: z.infer<typeof assetSchema>[];
}
let assetsCache: CachedAssets | undefined;

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error("Robinhood pricing service is unavailable");
  return response.json();
}

async function getAssets(): Promise<z.infer<typeof assetSchema>[]> {
  if (assetsCache && assetsCache.expiresAt > Date.now()) return assetsCache.value;
  const parsed = assetsResponseSchema.parse(await fetchJson(`${API_BASE}/assets`));
  assetsCache = { value: parsed.assets, expiresAt: Date.now() + 300_000 };
  return parsed.assets;
}

export async function getRobinhoodStockUsdPrice(symbol: string): Promise<string> {
  if (!isRobinhoodStockSymbol(symbol)) throw new Error("Unsupported stock token");
  const [assets, pricesValue] = await Promise.all([
    getAssets(),
    fetchJson(`${API_BASE}/prices/${encodeURIComponent(symbol)}`),
  ]);
  const metadata = assets.find((item) => item.tokenSymbol === symbol);
  const quote = priceResponseSchema
    .parse(pricesValue)
    .quotes.find((item) => item.tokenSymbol === symbol);
  const onMainnet = (deployments: z.infer<typeof deploymentSchema>[]): boolean =>
    deployments.some((item) => item.chainId === ROBINHOOD_CHAIN_ID);
  if (!metadata || metadata.status !== "ASSET_STATUS_ACTIVE" || !onMainnet(metadata.deployments)) {
    throw new Error("This stock token is not active on Robinhood Chain");
  }
  if (!quote || quote.isTradingHalt || !onMainnet(quote.deployments)) {
    throw new Error("A quote is currently unavailable for this stock token");
  }
  const price = new Decimal(quote.ask).mul(metadata.currentMultiplier);
  if (!price.isFinite() || price.lte(0)) throw new Error("Invalid stock-token price");
  return price.toDecimalPlaces(18).toFixed(18);
}
