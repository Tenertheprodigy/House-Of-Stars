import { createServiceRoleClient } from "@house-of-stars/database/runtime";
import type { Bot } from "grammy";
import {
  OrderNotificationService,
  type NotificationDeliveryStore,
  type NotificationType,
  type OrderNotificationEvent,
  type OrderNotificationSender,
} from "./notification-service.js";

type Client = ReturnType<typeof createServiceRoleClient>;
type Candidate = {
  event_id: number;
  order_id: string;
  order_number: number;
  telegram_user_id: number | string;
  event_type: string;
  to_status: string | null;
};

class SupabaseDeliveryStore implements NotificationDeliveryStore {
  constructor(private readonly client: Client) {}
  async claim(
    event: OrderNotificationEvent,
    type: NotificationType,
  ): Promise<boolean> {
    const inserted = await this.client
      .from("notification_delivery")
      .insert({
        order_event_id: event.eventId,
        order_id: event.orderId,
        notification_type: type,
      })
      .select("id")
      .maybeSingle();
    if (!inserted.error) return true;
    if (inserted.error.code !== "23505") throw inserted.error;
    const existing = await this.client
      .from("notification_delivery")
      .select("id,status,attempts")
      .eq("order_event_id", event.eventId)
      .maybeSingle();
    if (existing.error || !existing.data || existing.data.status !== "failed")
      return false;
    const retried = await this.client
      .from("notification_delivery")
      .update({
        status: "processing",
        attempts: existing.data.attempts + 1,
        claimed_at: new Date().toISOString(),
        last_error: null,
      })
      .eq("id", existing.data.id)
      .eq("status", "failed")
      .select("id")
      .maybeSingle();
    if (retried.error) throw retried.error;
    return retried.data !== null;
  }
  async markSent(eventId: number, telegramMessageId: number): Promise<void> {
    const { error } = await this.client
      .from("notification_delivery")
      .update({
        status: "sent",
        telegram_message_id: telegramMessageId,
        sent_at: new Date().toISOString(),
        last_error: null,
      })
      .eq("order_event_id", eventId)
      .eq("status", "processing");
    if (error) throw error;
  }
  async markFailed(eventId: number, message: string): Promise<void> {
    const { error } = await this.client
      .from("notification_delivery")
      .update({ status: "failed", last_error: message.slice(0, 2000) })
      .eq("order_event_id", eventId)
      .eq("status", "processing");
    if (error) throw error;
  }
}

class GrammyNotificationSender implements OrderNotificationSender {
  constructor(private readonly bot: Bot) {}
  async send(input: {
    chatId: string;
    text: string;
    orderUrl: string;
  }): Promise<{ messageId: number }> {
    const message = await this.bot.api.sendMessage(input.chatId, input.text, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "View Order", web_app: { url: input.orderUrl } }],
        ],
      },
    });
    return { messageId: message.message_id };
  }
}

export function startNotificationWorker(input: {
  bot: Bot;
  supabaseUrl: string;
  serviceRoleKey: string;
  miniAppUrl: string;
  intervalMs?: number;
}): () => void {
  const client = createServiceRoleClient(
    input.supabaseUrl,
    input.serviceRoleKey,
  );
  const service = new OrderNotificationService(
    new SupabaseDeliveryStore(client),
    new GrammyNotificationSender(input.bot),
    input.miniAppUrl,
  );
  let running = false;
  const work = async (): Promise<void> => {
    if (running) return;
    running = true;
    try {
      const { data, error } = await client.rpc("pending_order_notifications", {
        p_limit: 100,
      });
      if (error) throw error;
      for (const item of (data ?? []) as Candidate[]) {
        try {
          await service.deliver({
            eventId: item.event_id,
            orderId: item.order_id,
            orderNumber: item.order_number,
            telegramUserId: String(item.telegram_user_id),
            eventType: item.event_type,
            toStatus: item.to_status,
          });
        } catch (error) {
          console.error(
            "Order notification delivery failed",
            item.event_id,
            error instanceof Error ? error.name : "unknown_error",
          );
        }
      }
    } catch (error) {
      console.error(
        "Notification worker poll failed",
        error instanceof Error ? error.name : "unknown_error",
      );
    } finally {
      running = false;
    }
  };
  void work();
  const timer = setInterval(() => void work(), input.intervalMs ?? 10_000);
  return () => clearInterval(timer);
}
