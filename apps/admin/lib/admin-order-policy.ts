export type AdminOrderAction = "approve" | "reject" | "request_more_evidence";

const transitions: Record<AdminOrderAction, ReadonlySet<string>> = {
  approve: new Set(["under_review"]),
  reject: new Set(["submitted", "under_review", "awaiting_evidence"]),
  request_more_evidence: new Set(["submitted", "under_review"]),
};

export function canTransition(
  status: string,
  action: AdminOrderAction,
): boolean {
  return transitions[action].has(status);
}

export function getPayoutEligibility(
  input: {
    status: string;
    settlementAvailableAt: string | null;
    hasPayout: boolean;
    walletValidated?: boolean;
  },
  now = new Date(),
): { eligible: boolean; reason: string } {
  if (input.hasPayout)
    return { eligible: false, reason: "A payout record already exists." };
  if (input.status !== "approved")
    return { eligible: false, reason: "The order must be approved first." };
  if (input.walletValidated === false)
    return {
      eligible: false,
      reason: "The destination wallet has not been validated.",
    };
  if (
    input.settlementAvailableAt &&
    new Date(input.settlementAvailableAt).getTime() > now.getTime()
  )
    return {
      eligible: false,
      reason: `Settlement hold until ${new Date(input.settlementAvailableAt).toISOString()}.`,
    };
  return { eligible: true, reason: "Approved and settlement hold cleared." };
}
