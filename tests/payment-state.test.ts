import { describe, expect, it } from "vitest";

import { deriveClaimTransition } from "@/lib/payment-state";

describe("webhook-authoritative payment transitions", () => {
  it("fulfills only on a paid completion or async success", () => {
    expect(
      deriveClaimTransition({
        eventType: "checkout.session.completed",
        checkoutStatus: "complete",
        paymentStatus: "paid",
        currentStatus: "reserved",
      }),
    ).toBe("owned");

    expect(
      deriveClaimTransition({
        eventType: "checkout.session.completed",
        checkoutStatus: "complete",
        paymentStatus: "unpaid",
        currentStatus: "reserved",
      }),
    ).toBe("payment_pending");
  });

  it("keeps inventory blocked while a delayed payment is pending", () => {
    expect(
      deriveClaimTransition({
        eventType: "reconcile",
        checkoutStatus: "complete",
        paymentStatus: "unpaid",
        currentStatus: "payment_pending",
      }),
    ).toBeNull();
  });

  it("does not let late failure or expiry overwrite ownership", () => {
    for (const eventType of ["checkout.session.async_payment_failed", "checkout.session.expired"]) {
      expect(
        deriveClaimTransition({
          eventType,
          checkoutStatus: eventType.endsWith("expired") ? "expired" : "complete",
          paymentStatus: "unpaid",
          currentStatus: "owned",
        }),
      ).toBeNull();
    }
  });

  it("allows a verified success to repair an out-of-order terminal transition", () => {
    expect(
      deriveClaimTransition({
        eventType: "checkout.session.async_payment_succeeded",
        checkoutStatus: "complete",
        paymentStatus: "paid",
        currentStatus: "failed",
      }),
    ).toBe("owned");
  });
});
