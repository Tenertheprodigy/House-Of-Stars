export interface OrderEventRow {
  readonly id: number;
  readonly event_type: string;
  readonly to_status: string | null;
  readonly created_at: string;
}

const publicMilestones: Record<string, string> = {
  submitted: "Order submitted",
  under_review: "Verification in review",
  approved: "Approved",
  payout_queued: "Payout processing",
  payout_broadcast: "Payout sent",
  paid: "Paid",
  rejected: "Order rejected",
  cancelled: "Order cancelled",
  refunded: "Order refunded",
};

export function buildPublicTimeline(events: readonly OrderEventRow[]): Array<{
  label: string;
  occurredAt: string;
}> {
  const seen = new Set<string>();
  const result: Array<{ label: string; occurredAt: string }> = [];
  for (const event of events) {
    const label = event.to_status
      ? publicMilestones[event.to_status]
      : undefined;
    if (label && !seen.has(label)) {
      seen.add(label);
      result.push({ label, occurredAt: event.created_at });
    }
  }
  return result;
}

export function maskWallet(value: string): string {
  if (value.length <= 10) return `${value.slice(0, 3)}…${value.slice(-2)}`;
  return `${value.slice(0, 5)}…${value.slice(-3)}`;
}
