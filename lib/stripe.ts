import Stripe from "stripe";

export function getStripe(secretKeyOverride?: string) {
  const secretKey = secretKeyOverride ?? process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY.");
  }

  return new Stripe(secretKey);
}
