export type NotificationType =
  | "order_submitted"
  | "more_evidence_requested"
  | "order_approved"
  | "order_rejected"
  | "payout_queued"
  | "payout_broadcast"
  | "payout_confirmed";

export interface OrderNotificationEvent {
  eventId: number;
  orderId: string;
  orderNumber: number;
  telegramUserId: string;
  eventType: string;
  toStatus: string | null;
}
export interface NotificationDeliveryStore {
  claim(
    event: OrderNotificationEvent,
    type: NotificationType,
  ): Promise<boolean>;
  markSent(eventId: number, telegramMessageId: number): Promise<void>;
  markFailed(eventId: number, error: string): Promise<void>;
}
export interface OrderNotificationSender {
  send(input: {
    chatId: string;
    text: string;
    orderUrl: string;
  }): Promise<{ messageId: number }>;
}

const descriptions: Record<
  NotificationType,
  { message: string; status: string }
> = {
  order_submitted: { message: "has been received.", status: "Under Review" },
  more_evidence_requested: {
    message: "requires more evidence.",
    status: "Awaiting Evidence",
  },
  order_approved: { message: "has been approved.", status: "Approved" },
  order_rejected: { message: "has been rejected.", status: "Rejected" },
  payout_queued: {
    message: "has been queued for payout.",
    status: "Payout Queued",
  },
  payout_broadcast: {
    message: "payout has been broadcast.",
    status: "Payout Broadcast",
  },
  payout_confirmed: { message: "payout has been confirmed.", status: "Paid" },
};

export function classifyNotification(
  event: Pick<OrderNotificationEvent, "eventType" | "toStatus">,
): NotificationType | null {
  if (event.eventType === "admin_request_more_evidence")
    return "more_evidence_requested";
  if (event.eventType === "admin_approve") return "order_approved";
  if (event.eventType === "admin_reject") return "order_rejected";
  if (event.eventType === "admin_queue_payout") return "payout_queued";
  if (event.eventType !== "status_changed") return null;
  if (event.toStatus === "submitted") return "order_submitted";
  if (event.toStatus === "payout_broadcast") return "payout_broadcast";
  if (event.toStatus === "paid") return "payout_confirmed";
  return null;
}

export class OrderNotificationService {
  constructor(
    private readonly deliveries: NotificationDeliveryStore,
    private readonly sender: OrderNotificationSender,
    private readonly miniAppUrl: string,
  ) {}
  async deliver(
    event: OrderNotificationEvent,
  ): Promise<"sent" | "duplicate" | "ignored"> {
    const type = classifyNotification(event);
    if (!type) return "ignored";
    if (!(await this.deliveries.claim(event, type))) return "duplicate";
    const reference = `Order #${String(event.orderNumber).padStart(6, "0")}`;
    const copy = descriptions[type];
    try {
      const result = await this.sender.send({
        chatId: event.telegramUserId,
        text: `${reference} ${copy.message}\n\nStatus: ${copy.status}`,
        orderUrl: new URL(
          `/orders/${event.orderNumber}`,
          this.miniAppUrl,
        ).toString(),
      });
      await this.deliveries.markSent(event.eventId, result.messageId);
      return "sent";
    } catch (error) {
      await this.deliveries.markFailed(
        event.eventId,
        error instanceof Error ? error.message : "Telegram delivery failed",
      );
      throw error;
    }
  }
}
