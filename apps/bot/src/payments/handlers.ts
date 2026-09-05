import { createServiceRoleClient } from "@house-of-stars/database";
import type { Bot } from "grammy";
import { parseInvoicePayload, resolvePack } from "./payload.js";

export interface PaymentChargeRecordInput {
  readonly userId: string;
  readonly stars: number;
  readonly totalAmount: number;
  readonly currency: string;
  readonly telegramPaymentChargeId: string;
  readonly payload: string;
}

export interface PaymentChargeStore {
  hasCharge(chargeId: string): Promise<boolean>;
  recordPaid(input: PaymentChargeRecordInput): Promise<void>;
}

export function createSupabasePaymentChargeStore(input: {
  readonly supabaseUrl: string;
  readonly serviceRoleKey: string;
}): PaymentChargeStore {
  const client = createServiceRoleClient(input.supabaseUrl, input.serviceRoleKey);

  return {
    async hasCharge(chargeId: string): Promise<boolean> {
      const { data, error } = await client
        .from("payment_charges")
        .select("id")
        .eq("telegram_payment_charge_id", chargeId)
        .limit(1);

      if (error) throw error;
      return (data ?? []).length > 0;
    },
    async recordPaid(payment: PaymentChargeRecordInput): Promise<void> {
      const { data: profile, error: profileError } = await client
        .from("users")
        .select("stars_balance")
        .eq("id", payment.userId)
        .maybeSingle();

      if (profileError) throw profileError;
      if (!profile) {
        throw new Error(`No user profile found for payment user ${payment.userId}`);
      }

      const currentBalance = Number(profile.stars_balance ?? 0);

      const paymentPayload = JSON.parse(payment.payload) as Record<string, unknown>;

      const { error: insertError } = await client.from("payment_charges").insert({
        user_id: payment.userId,
        telegram_payment_charge_id: payment.telegramPaymentChargeId,
        payload: paymentPayload,
        stars_amount: payment.stars,
        total_amount: payment.totalAmount,
        currency: payment.currency,
        status: "paid",
      });

      if (insertError) {
        if (insertError.code === "23505") return;
        throw insertError;
      }

      const { error: updateError } = await client
        .from("users")
        .update({ stars_balance: currentBalance + payment.stars })
        .eq("id", payment.userId);

      if (updateError) throw updateError;
    },
  };
}

export function registerInvoiceHandlers(
  bot: Bot,
  paymentStore: PaymentChargeStore,
): void {
  bot.on("pre_checkout_query", async (ctx) => {
    const payloadText = ctx.preCheckoutQuery?.invoice_payload;
    if (!payloadText) {
      await ctx.answerPreCheckoutQuery(false, "Missing invoice payload");
      return;
    }

    try {
      const payload = parseInvoicePayload(payloadText);
      const expected = resolvePack({ stars: payload.stars });
      const totalAmount = Number(ctx.preCheckoutQuery.total_amount);
      const valid =
        expected.stars === payload.stars &&
        Number.isSafeInteger(totalAmount) &&
        totalAmount > 0 &&
        totalAmount === payload.stars &&
        ctx.preCheckoutQuery.currency === "XTR" &&
        Boolean(payload.userId) &&
        Boolean(payload.nonce);

      if (!valid) {
        console.warn("Rejected pre_checkout_query", {
          payload,
          totalAmount,
          currency: ctx.preCheckoutQuery.currency,
        });
        await ctx.answerPreCheckoutQuery(false, "Unable to validate your purchase");
        return;
      }

      console.info("pre_checkout_query accepted", {
        userId: payload.userId,
        stars: payload.stars,
        chargeId: ctx.preCheckoutQuery.id,
      });
      await ctx.answerPreCheckoutQuery(true);
    } catch (error) {
      console.warn("Invalid invoice payload in pre_checkout_query", error);
      await ctx.answerPreCheckoutQuery(false, "Invalid purchase information");
    }
  });

  bot.on("message", async (ctx) => {
    const payment = ctx.message?.successful_payment;
    if (!payment) {
      return;
    }

    const paymentChargeId = payment.telegram_payment_charge_id;
    if (!paymentChargeId) {
      console.warn("successful_payment missing telegram_payment_charge_id");
      return;
    }

    if (await paymentStore.hasCharge(paymentChargeId)) {
      console.info("Ignoring duplicate successful_payment", {
        paymentChargeId,
      });
      return;
    }

    try {
      const payload = parseInvoicePayload(payment.invoice_payload);
      const totalAmount = Number(payment.total_amount ?? 0);
      const currency = payment.currency;

      if (!Number.isSafeInteger(totalAmount) || totalAmount <= 0) {
        console.warn("successful_payment rejected: invalid total amount", {
          paymentChargeId,
          totalAmount,
        });
        return;
      }

      if (currency !== "XTR" || totalAmount !== payload.stars) {
        console.warn("successful_payment rejected: invalid payment details", {
          paymentChargeId,
          totalAmount,
          currency,
          payload,
        });
        return;
      }

      await paymentStore.recordPaid({
        userId: payload.userId,
        stars: payload.stars,
        totalAmount,
        currency,
        telegramPaymentChargeId: paymentChargeId,
        payload: payment.invoice_payload,
      });

      console.info("successful_payment credited Stars", {
        userId: payload.userId,
        stars: payload.stars,
        paymentChargeId,
      });
    } catch (error) {
      console.error("Failed to process successful_payment", error);
    }
  });
}
