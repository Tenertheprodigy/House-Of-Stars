import { z } from "zod";

export const userRoleSchema = z.enum(["user", "admin"]);
export type UserRole = z.infer<typeof userRoleSchema>;

export const profileSchema = z.object({
  id: z.uuid(),
  telegramUserId: z.string().min(1),
  displayName: z.string().min(1).max(128),
  role: userRoleSchema,
  createdAt: z.iso.datetime(),
});
export type Profile = z.infer<typeof profileSchema>;

export const healthStatusSchema = z.object({
  status: z.literal("ok"),
  service: z.string().min(1),
  timestamp: z.iso.datetime(),
});
export type HealthStatus = z.infer<typeof healthStatusSchema>;

export const orderStatusSchema = z.enum([
  "draft",
  "awaiting_payment",
  "payment_pending",
  "payment_received",
  "awaiting_evidence",
  "submitted",
  "under_review",
  "approved",
  "rejected",
  "payout_queued",
  "payout_broadcast",
  "paid",
  "cancelled",
  "refunded",
]);
export type OrderStatus = z.infer<typeof orderStatusSchema>;

/** User-facing list groupings. Add future user-action statuses here. */
export const orderStatusGroups = {
  processing: [
    "draft",
    "awaiting_payment",
    "payment_pending",
    "payment_received",
    "submitted",
    "under_review",
    "approved",
    "payout_queued",
    "payout_broadcast",
  ],
  completed: ["paid", "cancelled", "refunded", "rejected"],
  needsAction: ["awaiting_evidence"],
} as const satisfies Record<string, readonly OrderStatus[]>;
