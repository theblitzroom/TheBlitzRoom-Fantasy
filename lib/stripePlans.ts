import type { SubscriptionPlan } from "@/lib/subscription";

export type PaidPlan = Exclude<SubscriptionPlan, "preview">;

export type StripePlanConfig = {
  plan: PaidPlan;
  priceEnvKey: "STRIPE_DRAFT_PRO_PRICE_ID" | "STRIPE_DYNASTY_ELITE_PRICE_ID";
};

export const stripePlans: Record<PaidPlan, StripePlanConfig> = {
  draft_pro: {
    plan: "draft_pro",
    priceEnvKey: "STRIPE_DRAFT_PRO_PRICE_ID"
  },
  dynasty_elite: {
    plan: "dynasty_elite",
    priceEnvKey: "STRIPE_DYNASTY_ELITE_PRICE_ID"
  }
};

export function getStripePriceId(plan: PaidPlan) {
  const config = stripePlans[plan];
  const priceId = process.env[config.priceEnvKey];

  if (!priceId) {
    throw new Error(`Missing ${config.priceEnvKey}.`);
  }

  return priceId;
}

export function getPlanFromPriceId(priceId: string | null | undefined): PaidPlan | "preview" {
  if (!priceId) {
    return "preview";
  }

  if (priceId === process.env.STRIPE_DYNASTY_ELITE_PRICE_ID) {
    return "dynasty_elite";
  }

  if (priceId === process.env.STRIPE_DRAFT_PRO_PRICE_ID) {
    return "draft_pro";
  }

  return "preview";
}
