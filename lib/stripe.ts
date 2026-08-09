import Stripe from "stripe";

import { env } from "@/lib/env";

export function isStripeConfigured(): boolean {
  return Boolean(env.STRIPE_SECRET_KEY);
}

let cached: Stripe | null = null;

/** Lazily-constructed Stripe client (server-side only). */
export function stripe(): Stripe {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error("Stripe is not configured — set STRIPE_SECRET_KEY");
  }
  cached ??= new Stripe(env.STRIPE_SECRET_KEY, {
    typescript: true,
  });
  return cached;
}

/** Verify a raw webhook payload with the configured signing secret. */
export function verifyStripeWebhook(
  payload: string | Buffer,
  signature: string
): Stripe.Event {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    throw new Error("Stripe webhook secret is not configured");
  }
  return stripe().webhooks.constructEvent(payload, signature, env.STRIPE_WEBHOOK_SECRET);
}
