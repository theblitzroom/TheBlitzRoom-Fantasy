export type SubscriptionPlan = "preview" | "draft_pro" | "dynasty_elite";

export type SubscriptionState = {
  plan: SubscriptionPlan;
  status: "preview" | "active" | "past_due" | "canceled";
};

export const previewSubscription: SubscriptionState = {
  plan: "preview",
  status: "preview"
};

const planRank: Record<SubscriptionPlan, number> = {
  preview: 0,
  draft_pro: 1,
  dynasty_elite: 2
};

export function hasPlanAccess(current: SubscriptionPlan, required: SubscriptionPlan) {
  return planRank[current] >= planRank[required];
}

export function isPaidPlan(plan: SubscriptionPlan) {
  return plan === "draft_pro" || plan === "dynasty_elite";
}
