import Decimal from "decimal.js";
import type { SupabaseClient } from "@supabase/supabase-js";

export type DecimalString = string;
export interface StoredQuote {
  readonly id: string;
  readonly userId: string;
  readonly starsAmount: number;
  readonly usdValue: DecimalString;
  readonly payoutAsset: string;
  readonly payoutNetwork: string;
  readonly assetAmount: DecimalString;
  readonly exchangeRate: DecimalString;
  readonly fees: DecimalString;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly consumedAt: string | null;
}
export type QuoteTerms = Omit<StoredQuote, "id" | "createdAt" | "consumedAt">;
export interface QuoteRepository {
  create(terms: QuoteTerms): Promise<StoredQuote>;
  findForUser(quoteId: string, userId: string): Promise<StoredQuote | null>;
  consume(
    quoteId: string,
    userId: string,
    consumedAt: string,
  ): Promise<StoredQuote | null>;
  expire(quoteId: string, userId: string, expiredAt: string): Promise<boolean>;
}
export interface AssetPrice {
  readonly asset: string;
  readonly network: string;
  readonly usdPerAsset: DecimalString;
}
export interface PricingConfiguration {
  readonly usdPerStar: DecimalString;
  readonly feeRate: DecimalString;
  readonly fixedFeeUsd: DecimalString;
  readonly quoteTtlSeconds?: number;
  readonly assets: readonly AssetPrice[];
}
export type QuoteValidation =
  | { readonly valid: true; readonly quote: StoredQuote }
  | {
      readonly valid: false;
      readonly reason: "not_found" | "expired" | "consumed";
    };
export interface PricingProvider {
  getUsdValueForStars(starsAmount: number): Promise<DecimalString>;
  getAssetQuote(input: {
    userId: string;
    starsAmount: number;
    payoutAsset: string;
  }): Promise<StoredQuote>;
  validateQuote(input: {
    userId: string;
    quoteId: string;
    consume?: boolean;
  }): Promise<QuoteValidation>;
  expireQuote(input: { userId: string; quoteId: string }): Promise<boolean>;
}

export class DecimalPricingProvider implements PricingProvider {
  private readonly ttlSeconds: number;
  constructor(
    private readonly repository: QuoteRepository,
    private readonly configuration: PricingConfiguration,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.ttlSeconds = configuration.quoteTtlSeconds ?? 60;
    assertPositiveDecimal(configuration.usdPerStar, "USD per Star");
    assertNonNegativeDecimal(configuration.feeRate, "fee rate");
    assertNonNegativeDecimal(configuration.fixedFeeUsd, "fixed fee");
    if (!Number.isSafeInteger(this.ttlSeconds) || this.ttlSeconds <= 0)
      throw new Error("Quote TTL must be a positive integer");
  }
  async getUsdValueForStars(starsAmount: number): Promise<DecimalString> {
    assertStars(starsAmount);
    return new Decimal(starsAmount)
      .mul(this.configuration.usdPerStar)
      .toDecimalPlaces(2, Decimal.ROUND_DOWN)
      .toFixed(2);
  }
  async getAssetQuote(input: {
    userId: string;
    starsAmount: number;
    payoutAsset: string;
  }): Promise<StoredQuote> {
    if (!input.userId) throw new Error("Authenticated user is required");
    assertStars(input.starsAmount);
    const asset = this.configuration.assets.find(
      (candidate) => candidate.asset === input.payoutAsset,
    );
    if (!asset) throw new Error("Unsupported payout asset");
    assertPositiveDecimal(asset.usdPerAsset, "asset exchange rate");
    const usdValue = new Decimal(
      await this.getUsdValueForStars(input.starsAmount),
    );
    const fees = usdValue
      .mul(this.configuration.feeRate)
      .add(this.configuration.fixedFeeUsd)
      .toDecimalPlaces(2, Decimal.ROUND_UP);
    const netUsd = usdValue.sub(fees);
    if (netUsd.lte(0)) throw new Error("Fees exceed quote value");
    const createdAt = this.now();
    return this.repository.create({
      userId: input.userId,
      starsAmount: input.starsAmount,
      usdValue: usdValue.toFixed(2),
      payoutAsset: asset.asset,
      payoutNetwork: asset.network,
      assetAmount: netUsd
        .div(asset.usdPerAsset)
        .toDecimalPlaces(18, Decimal.ROUND_DOWN)
        .toFixed(18),
      exchangeRate: new Decimal(asset.usdPerAsset)
        .toDecimalPlaces(18)
        .toFixed(18),
      fees: fees.toFixed(2),
      expiresAt: new Date(
        createdAt.getTime() + this.ttlSeconds * 1000,
      ).toISOString(),
    });
  }
  async validateQuote(input: {
    userId: string;
    quoteId: string;
    consume?: boolean;
  }): Promise<QuoteValidation> {
    const quote = await this.repository.findForUser(
      input.quoteId,
      input.userId,
    );
    if (!quote) return { valid: false, reason: "not_found" };
    if (quote.consumedAt) return { valid: false, reason: "consumed" };
    const now = this.now();
    if (Date.parse(quote.expiresAt) <= now.getTime())
      return { valid: false, reason: "expired" };
    if (!input.consume) return { valid: true, quote };
    const consumed = await this.repository.consume(
      quote.id,
      input.userId,
      now.toISOString(),
    );
    return consumed
      ? { valid: true, quote: consumed }
      : { valid: false, reason: "consumed" };
  }
  async expireQuote(input: {
    userId: string;
    quoteId: string;
  }): Promise<boolean> {
    return this.repository.expire(
      input.quoteId,
      input.userId,
      this.now().toISOString(),
    );
  }
}

function assertStars(value: number): void {
  if (!Number.isSafeInteger(value) || value <= 0)
    throw new Error("Stars amount must be a positive safe integer");
}
function assertPositiveDecimal(value: string, label: string): void {
  if (!new Decimal(value).isPositive())
    throw new Error(`${label} must be positive`);
}
function assertNonNegativeDecimal(value: string, label: string): void {
  if (new Decimal(value).isNegative())
    throw new Error(`${label} cannot be negative`);
}

export class SupabaseQuoteRepository implements QuoteRepository {
  constructor(private readonly client: SupabaseClient) {}
  async create(terms: QuoteTerms): Promise<StoredQuote> {
    const { data, error } = await this.client
      .from("order_quotes")
      .insert({
        user_id: terms.userId,
        stars_amount: terms.starsAmount,
        usd_value: terms.usdValue,
        payout_asset: terms.payoutAsset,
        payout_network: terms.payoutNetwork,
        expected_payout_amount: terms.assetAmount,
        exchange_rate: terms.exchangeRate,
        fees: terms.fees,
        expires_at: terms.expiresAt,
      })
      .select(
        "id,user_id,stars_amount,usd_value,payout_asset,payout_network,expected_payout_amount,exchange_rate,fees,created_at,expires_at,consumed_at",
      )
      .single();
    if (error) throw error;
    return mapQuote(data);
  }
  async findForUser(
    quoteId: string,
    userId: string,
  ): Promise<StoredQuote | null> {
    const { data, error } = await this.client
      .from("order_quotes")
      .select(
        "id,user_id,stars_amount,usd_value,payout_asset,payout_network,expected_payout_amount,exchange_rate,fees,created_at,expires_at,consumed_at",
      )
      .eq("id", quoteId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return data ? mapQuote(data) : null;
  }
  async consume(quoteId: string, userId: string): Promise<StoredQuote | null> {
    const { data, error } = await this.client.rpc("consume_order_quote", {
      p_quote_id: quoteId,
      p_user_id: userId,
    });
    if (error) return null;
    return mapQuote(data);
  }
  async expire(quoteId: string, userId: string): Promise<boolean> {
    const { data, error } = await this.client.rpc("expire_order_quote", {
      p_quote_id: quoteId,
      p_user_id: userId,
    });
    if (error) throw error;
    return data === true;
  }
}

function mapQuote(row: Record<string, unknown>): StoredQuote {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    starsAmount: Number(row.stars_amount),
    usdValue: String(row.usd_value),
    payoutAsset: String(row.payout_asset),
    payoutNetwork: String(row.payout_network),
    assetAmount: String(row.expected_payout_amount),
    exchangeRate: String(row.exchange_rate),
    fees: String(row.fees),
    createdAt: String(row.created_at),
    expiresAt: String(row.expires_at),
    consumedAt: row.consumed_at ? String(row.consumed_at) : null,
  };
}
