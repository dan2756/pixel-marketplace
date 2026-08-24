import type { ClaimStatus } from "./types";

export type PaymentTransitionInput = {
  eventType: string;
  checkoutStatus: "open" | "complete" | "expired" | null;
  paymentStatus: string;
  currentStatus: ClaimStatus;
};

export function deriveClaimTransition({
  eventType,
  checkoutStatus,
  paymentStatus,
  currentStatus,
}: PaymentTransitionInput): ClaimStatus | null {
  if (currentStatus === "owned") return null;

  const paid =
    eventType === "checkout.session.async_payment_succeeded" ||
    ((eventType === "checkout.session.completed" || eventType === "reconcile") &&
      paymentStatus === "paid");
  if (paid) return "owned";

  if (
    (eventType === "checkout.session.completed" || eventType === "reconcile") &&
    checkoutStatus === "complete" &&
    currentStatus === "reserved"
  ) {
    return "payment_pending";
  }

  if (
    eventType === "checkout.session.async_payment_failed" &&
    (currentStatus === "reserved" || currentStatus === "payment_pending")
  ) {
    return "failed";
  }

  if (
    (eventType === "checkout.session.expired" || checkoutStatus === "expired") &&
    currentStatus === "reserved"
  ) {
    return "expired";
  }

  return null;
}
