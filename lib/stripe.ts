import Stripe from "stripe";

function normalizedStripeEnv(value: string | undefined) {
  const normalized = value?.trim().replace(/^["']|["']$/g, "");
  return normalized && normalized !== "Encrypted" ? normalized : "";
}

export function getStripe(secretKeyOverride?: string) {
  const secretKey = normalizedStripeEnv(secretKeyOverride ?? process.env.STRIPE_SECRET_KEY);

  if (!secretKey.startsWith("sk_")) {
    throw new Error("Stripe checkout is not configured. Add a real STRIPE_SECRET_KEY that starts with sk_live_ or sk_test_.");
  }

  return new Stripe(secretKey);
}
