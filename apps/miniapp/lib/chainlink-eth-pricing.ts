import Decimal from "decimal.js";

const DECIMALS_SELECTOR = "0x313ce567";
const LATEST_ROUND_DATA_SELECTOR = "0xfeaf968c";

interface JsonRpcResponse {
  result?: string;
  error?: { message?: string };
}

export interface EthUsdPrice {
  usdPrice: string;
  updatedAt: string;
  source: "chainlink_eth_usd";
}

interface ChainlinkOptions {
  rpcUrl?: string;
  feedAddress: string;
  maxAgeSeconds: number;
  timeoutMs: number;
  retries: number;
  now?: () => Date;
  fetcher?: typeof fetch;
}

async function rpcCall(
  methodData: string,
  options: ChainlinkOptions,
): Promise<string> {
  if (!options.rpcUrl)
    throw new Error("ETH quotes are temporarily unavailable.");
  let lastError: unknown;
  for (let attempt = 0; attempt <= options.retries; attempt += 1) {
    try {
      const response = await (options.fetcher ?? fetch)(options.rpcUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_call",
          params: [{ to: options.feedAddress, data: methodData }, "latest"],
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(options.timeoutMs),
      });
      if (!response.ok) throw new Error(`RPC returned ${response.status}`);
      const payload = (await response.json()) as JsonRpcResponse;
      if (payload.error || !payload.result?.startsWith("0x"))
        throw new Error(payload.error?.message ?? "Invalid RPC response");
      return payload.result;
    } catch (error) {
      lastError = error;
    }
  }
  console.error("Chainlink ETH/USD read failed", {
    cause: lastError instanceof Error ? lastError.name : "unknown",
  });
  throw new Error("ETH quotes are temporarily unavailable.");
}

function words(value: string): string[] {
  const hex = value.slice(2);
  if (!hex || hex.length % 64 !== 0)
    throw new Error("Invalid Chainlink response");
  return hex.match(/.{64}/g) ?? [];
}

function uint(word: string): bigint {
  return BigInt(`0x${word}`);
}

function int(word: string): bigint {
  const value = uint(word);
  return value >= 1n << 255n ? value - (1n << 256n) : value;
}

export async function getEthUsdPrice(
  options: ChainlinkOptions,
): Promise<EthUsdPrice> {
  try {
    const [decimalsValue, roundValue] = await Promise.all([
      rpcCall(DECIMALS_SELECTOR, options),
      rpcCall(LATEST_ROUND_DATA_SELECTOR, options),
    ]);
    const decimalsWords = words(decimalsValue);
    const roundWords = words(roundValue);
    if (decimalsWords.length !== 1 || roundWords.length < 5)
      throw new Error("Invalid Chainlink round data");
    const decimals = Number(uint(decimalsWords[0]!));
    const roundId = uint(roundWords[0]!);
    const answer = int(roundWords[1]!);
    const updatedAt = uint(roundWords[3]!);
    const answeredInRound = uint(roundWords[4]!);
    if (decimals < 0 || decimals > 36 || roundId === 0n || answer <= 0n)
      throw new Error("Invalid Chainlink answer");
    if (updatedAt === 0n || answeredInRound < roundId)
      throw new Error("Invalid Chainlink round");
    const nowSeconds = BigInt(
      Math.floor((options.now ?? (() => new Date()))().getTime() / 1000),
    );
    if (
      updatedAt > nowSeconds + 60n ||
      nowSeconds - updatedAt > BigInt(options.maxAgeSeconds)
    )
      throw new Error("Stale Chainlink price");
    return {
      usdPrice: new Decimal(answer.toString())
        .div(new Decimal(10).pow(decimals))
        .toDecimalPlaces(18)
        .toFixed(18),
      updatedAt: new Date(Number(updatedAt) * 1000).toISOString(),
      source: "chainlink_eth_usd",
    };
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "ETH quotes are temporarily unavailable."
    )
      throw error;
    console.error("Chainlink ETH/USD validation failed", {
      cause: error instanceof Error ? error.message : "unknown",
    });
    throw new Error("ETH quotes are temporarily unavailable.");
  }
}
