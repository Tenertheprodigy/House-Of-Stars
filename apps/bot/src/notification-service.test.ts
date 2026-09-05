import { describe, expect, it, vi } from "vitest";
import {
  OrderNotificationService,
  type NotificationDeliveryStore,
  type OrderNotificationEvent,
} from "./notification-service.js";

const event: OrderNotificationEvent = {
  eventId: 42,
  orderId: "order-id",
  orderNumber: 1248,
  telegramUserId: "123456",
  eventType: "status_changed",
  toStatus: "submitted",
};

describe("OrderNotificationService", () => {
  it("does not send a duplicate event when a worker retries", async () => {
    const claimed = new Set<number>();
    const store: NotificationDeliveryStore = {
      claim: vi.fn(async (item) => {
        if (claimed.has(item.eventId)) return false;
        claimed.add(item.eventId);
        return true;
      }),
      markSent: vi.fn(async () => undefined),
      markFailed: vi.fn(async () => undefined),
    };
    const sender = { send: vi.fn(async () => ({ messageId: 99 })) };
    const service = new OrderNotificationService(
      store,
      sender,
      "https://example.com",
    );
    await expect(service.deliver(event)).resolves.toBe("sent");
    await expect(service.deliver(event)).resolves.toBe("duplicate");
    expect(sender.send).toHaveBeenCalledTimes(1);
    expect(sender.send).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "Order #001248 has been received.\n\nStatus: Under Review",
        orderUrl: "https://example.com/orders/1248",
      }),
    );
  });

  it("ignores generic events duplicated by explicit admin audit events", async () => {
    const store = { claim: vi.fn(), markSent: vi.fn(), markFailed: vi.fn() };
    const sender = { send: vi.fn() };
    const service = new OrderNotificationService(
      store,
      sender,
      "https://example.com",
    );
    await expect(
      service.deliver({
        ...event,
        eventType: "status_changed",
        toStatus: "approved",
      }),
    ).resolves.toBe("ignored");
    expect(sender.send).not.toHaveBeenCalled();
  });
});
