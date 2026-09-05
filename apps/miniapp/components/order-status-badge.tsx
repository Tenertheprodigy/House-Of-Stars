const labels: Record<string, string> = {
  draft: "Draft",
  awaiting_payment: "Awaiting payment",
  payment_pending: "Processing",
  payment_received: "Payment received",
  awaiting_evidence: "Awaiting evidence",
  submitted: "Submitted",
  under_review: "Under review",
  approved: "Approved",
  rejected: "Rejected",
  payout_queued: "Payout queued",
  payout_broadcast: "Payout sent",
  paid: "Paid",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

export function OrderStatusBadge({
  status,
}: {
  status: string;
}): React.ReactNode {
  const positive = ["approved", "paid"].includes(status);
  const negative = ["rejected", "cancelled", "refunded"].includes(status);
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${positive ? "bg-emerald-500/15 text-emerald-500" : negative ? "bg-red-500/15 text-red-500" : "bg-amber-500/15 text-amber-500"}`}
    >
      {labels[status] ?? status.replaceAll("_", " ")}
    </span>
  );
}
