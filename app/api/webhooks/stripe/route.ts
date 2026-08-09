import { NextResponse } from "next/server";

import { ApiError } from "@/lib/http";
import { isStripeConfigured, verifyStripeWebhook } from "@/lib/stripe";
import {
  completeStripeCheckout,
  expireStripeCheckout,
  syncStripeRefund,
} from "@/services/billing";

/**
 * Stripe webhook — public (no session). Authenticity comes from the
 * `Stripe-Signature` header, verified against STRIPE_WEBHOOK_SECRET.
 *
 * Handlers are idempotent: Stripe retries failed deliveries, and every
 * handler re-checks state before mutating.
 */
export const POST = async (req: Request) => {
  try {
    if (!isStripeConfigured()) {
      return NextResponse.json(
        { success: false, error: "Stripe is not configured" },
        { status: 503 }
      );
    }
    const payload = await req.text();
    const signature = req.headers.get("stripe-signature");
    if (!signature) throw new ApiError(400, "Missing stripe-signature header");

    const event = verifyStripeWebhook(payload, signature);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as {
          id: string;
          payment_status: string | null;
          amount_total: number | null;
          currency: string | null;
          metadata: Record<string, string> | null;
          payment_intent: string | null;
        };
        await completeStripeCheckout(session);
        break;
      }
      case "checkout.session.expired": {
        const session = event.data.object as { id: string };
        await expireStripeCheckout(session.id);
        break;
      }
      case "refund.created": {
        const refund = event.data.object as {
          id: string;
          status: string;
          payment_intent: string | null;
          amount: number;
          currency: string;
        };
        await syncStripeRefund(refund);
        break;
      }
      default:
        // Unhandled event types are acknowledged (no retry needed).
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status }
      );
    }
    console.error("[stripe-webhook]", error);
    return NextResponse.json(
      { success: false, error: "Webhook processing failed" },
      { status: 500 }
    );
  }
};
