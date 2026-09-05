export interface QuickSellQuote {
  quoteId: string;
  starsAmount: number;
  usdValue: string;
  payoutAsset: string;
  payoutNetwork: string;
  payoutAmount: string;
  exchangeRate: string;
  expiresAt: string;
  consumed?: boolean;
}
export interface QuickSellDraft {
  quote: QuickSellQuote;
  walletAddress?: string;
  walletConfirmed?: boolean;
}
const key = "house-of-stars:quick-sell";
export function saveQuickSellDraft(draft: QuickSellDraft): void {
  sessionStorage.setItem(key, JSON.stringify(draft));
}
export function loadQuickSellDraft(): QuickSellDraft | null {
  try {
    const value = sessionStorage.getItem(key);
    return value ? (JSON.parse(value) as QuickSellDraft) : null;
  } catch {
    return null;
  }
}
export function clearQuickSellDraft(): void {
  sessionStorage.removeItem(key);
}
