import type { QuickSellConfig } from "../config/server";

const terminalStatuses = new Set(["paid", "rejected", "cancelled", "refunded"]);
export type QuickSellEligibility =
  | { status: "eligible" }
  | { status: "processing"; reason: string }
  | { status: "not_eligible"; reason: string; eligibleAt: string };

export interface QuickSellOrderSummary {
  status: string;
  updatedAt: string;
}

export function determineQuickSellEligibility(
  orders: QuickSellOrderSummary[],
  config: Pick<QuickSellConfig, "quickSellCooldownDays">,
  now = new Date(),
): QuickSellEligibility {
  if (orders.some((order) => !terminalStatuses.has(order.status))) {
    return {
      status: "processing",
      reason: "Your previous Quick Sell order is still processing.",
    };
  }
  const latestCompleted = orders
    .filter((order) => order.status === "paid")
    .sort(
      (left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt),
    )[0];
  if (!latestCompleted) return { status: "eligible" };
  const eligibleAt = new Date(
    Date.parse(latestCompleted.updatedAt) +
      config.quickSellCooldownDays * 86_400_000,
  );
  if (eligibleAt.getTime() > now.getTime())
    return {
      status: "not_eligible",
      reason: `You can complete one Quick Sell every ${config.quickSellCooldownDays} days.`,
      eligibleAt: eligibleAt.toISOString(),
    };
  return { status: "eligible" };
}
