export const robinhoodStockSymbols = [
  "AAPL", "AMC", "AMD", "AMZN", "BABA", "BB", "BE", "BULL", "COIN",
  "COST", "CRCL", "DELL", "DJT", "F", "FIG", "GLD", "GME", "GOOGL",
  "HIMS", "IBM", "INDA", "JNJ", "LLY", "LULU", "META", "MRNA", "MRVL",
  "MSFT", "MSTR", "MU", "NFLX", "NU", "NVDA", "PFE", "PLTR", "QQQ",
  "RBLX", "RDDT", "RIVN", "SGOV", "SHOP", "SKHY", "SLV", "SNAP",
  "SNDK", "SPCX", "SPY", "TSLA", "TSM", "TTWO", "UPS", "USO", "WYFI",
] as const;

export type RobinhoodStockSymbol = (typeof robinhoodStockSymbols)[number];

const symbolSet = new Set<string>(robinhoodStockSymbols);

export function isRobinhoodStockSymbol(value: string): value is RobinhoodStockSymbol {
  return symbolSet.has(value);
}
