import type { SubscriptionPlan } from "@/lib/subscription";

export type CheckoutPlan =
  | "draft_pro_season"
  | "dynasty_elite_season"
  | "draft_pro_monthly"
  | "dynasty_elite_monthly";

export type StripePlanConfig = {
  checkoutPlan: CheckoutPlan;
  accessPlan: Exclude<SubscriptionPlan, "preview">;
  checkoutMode: "payment" | "subscription";
  priceEnvKey:
    | "STRIPE_DRAFT_PRO_SEASON_PRICE_ID"
    | "STRIPE_DYNASTY_ELITE_SEASON_PRICE_ID"
    | "STRIPE_DRAFT_PRO_PRICE_ID"
    | "STRIPE_DYNASTY_ELITE_PRICE_ID";
  testPriceEnvKey:
    | "STRIPE_TEST_DRAFT_PRO_SEASON_PRICE_ID"
    | "STRIPE_TEST_DYNASTY_ELITE_SEASON_PRICE_ID"
    | "STRIPE_TEST_DRAFT_PRO_PRICE_ID"
    | "STRIPE_TEST_DYNASTY_ELITE_PRICE_ID";
  accessEndsAt?: string;
};

export const seasonAccessEndsAt = "2027-02-15T23:59:59.000Z";

export const stripePlans: Record<CheckoutPlan, StripePlanConfig> = {
  draft_pro_season: {
    checkoutPlan: "draft_pro_season",
    accessPlan: "draft_pro",
    checkoutMode: "payment",
    priceEnvKey: "STRIPE_DRAFT_PRO_SEASON_PRICE_ID",
    testPriceEnvKey: "STRIPE_TEST_DRAFT_PRO_SEASON_PRICE_ID",
    accessEndsAt: seasonAccessEndsAt
  },
  dynasty_elite_season: {
    checkoutPlan: "dynasty_elite_season",
    accessPlan: "dynasty_elite",
    checkoutMode: "payment",
    priceEnvKey: "STRIPE_DYNASTY_ELITE_SEASON_PRICE_ID",
    testPriceEnvKey: "STRIPE_TEST_DYNASTY_ELITE_SEASON_PRICE_ID",
    accessEndsAt: seasonAccessEndsAt
  },
  draft_pro_monthly: {
    checkoutPlan: "draft_pro_monthly",
    accessPlan: "draft_pro",
    checkoutMode: "subscription",
    priceEnvKey: "STRIPE_DRAFT_PRO_PRICE_ID",
    testPriceEnvKey: "STRIPE_TEST_DRAFT_PRO_PRICE_ID"
  },
  dynasty_elite_monthly: {
    checkoutPlan: "dynasty_elite_monthly",
    accessPlan: "dynasty_elite",
    checkoutMode: "subscription",
    priceEnvKey: "STRIPE_DYNASTY_ELITE_PRICE_ID",
    testPriceEnvKey: "STRIPE_TEST_DYNASTY_ELITE_PRICE_ID"
  }
};

export function getStripePlanConfig(plan: CheckoutPlan) {
  const config = stripePlans[plan];

  if (!config) {
    throw new Error("Invalid checkout plan.");
  }

  return config;
}

export function getStripePriceId(plan: CheckoutPlan) {
  const config = getStripePlanConfig(plan);
  const priceId = process.env[config.priceEnvKey];

  if (!priceId) {
    throw new Error(`Missing ${config.priceEnvKey}.`);
  }

  return priceId;
}

export function getStripeTestPriceId(plan: CheckoutPlan) {
  const config = getStripePlanConfig(plan);
  const priceId = process.env[config.testPriceEnvKey];

  if (!priceId) {
    throw new Error(`Missing ${config.testPriceEnvKey}.`);
  }

  if (!priceId.startsWith("price_")) {
    throw new Error(`${config.testPriceEnvKey} must be a Stripe price ID.`);
  }

  return priceId;
}

export function getPlanFromPriceId(priceId: string | null | undefined): SubscriptionPlan {
  if (!priceId) {
    return "preview";
  }

  const matchingConfig = Object.values(stripePlans).find((config) => priceId === process.env[config.priceEnvKey]);

  return matchingConfig?.accessPlan ?? "preview";
}

export function getSeasonAccessEndFromPriceId(priceId: string | null | undefined) {
  if (!priceId) {
    return null;
  }

  const matchingConfig = Object.values(stripePlans).find((config) => priceId === process.env[config.priceEnvKey]);

  return matchingConfig?.accessEndsAt ?? null;
}
