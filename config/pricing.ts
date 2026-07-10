import type { CheckoutPlan } from "@/lib/stripePlans";

export type Plan = {
  id: "preview" | CheckoutPlan;
  name: string;
  price: string;
  priceDetail?: string;
  badge?: string;
  billing?: "preview" | "season" | "monthly";
  audience: string;
  bestFor?: string;
  features: string[];
  cta: string;
  highlighted?: boolean;
};

export const plans: Plan[] = [
  {
    id: "preview",
    name: "Preview",
    price: "$0",
    billing: "preview",
    audience: "Try the interface before draft night.",
    bestFor: "I want to see the workflow before I buy.",
    features: ["Snapshot draft board", "Limited player board", "Sample recommendations"],
    cta: "Open free preview"
  },
  {
    id: "draft_pro_season",
    name: "TwoBros Draft Pro",
    price: "$39.99",
    priceDetail: "2026 season pass",
    badge: "Best draft-night value",
    billing: "season",
    audience: "Live draft help without another monthly bill.",
    bestFor: "I mainly want live draft help.",
    features: ["One-time payment", "Sleeper live sync", "Draft board and player rankings", "BPA and roster-need recommendations", "Access through the 2026 fantasy season"],
    cta: "Get Draft Pro",
    highlighted: false
  },
  {
    id: "draft_pro_monthly",
    name: "Draft Pro Monthly",
    price: "$7.99",
    priceDetail: "per month",
    badge: "Flexible access",
    billing: "monthly",
    audience: "Start small and keep live draft tools active only when you need them.",
    bestFor: "I want draft tools month to month.",
    features: ["Monthly subscription", "Sleeper live sync", "Draft board and player rankings", "BPA and roster-need recommendations", "Cancel before next renewal"],
    cta: "Subscribe monthly"
  },
  {
    id: "dynasty_elite_season",
    name: "TwoBros Fantasy Elite",
    price: "$59.99",
    priceDetail: "2026 season pass",
    badge: "Recommended",
    billing: "season",
    audience: "The full command center for redraft and dynasty managers.",
    bestFor: "I want draft help plus league, roster, dynasty, and trade tools.",
    features: ["One-time payment", "All Draft Pro tools", "Redraft and dynasty command center", "Power rankings and roster strategy", "Trade value lab and multi-league dashboard"],
    cta: "Get Elite",
    highlighted: true
  },
  {
    id: "dynasty_elite_monthly",
    name: "Fantasy Elite Monthly",
    price: "$14.99",
    priceDetail: "per month",
    badge: "All-access monthly",
    billing: "monthly",
    audience: "Use the full redraft and dynasty toolkit with monthly flexibility.",
    bestFor: "I want the full toolkit without a season pass.",
    features: ["Monthly subscription", "All Draft Pro tools", "Redraft and dynasty command center", "Power rankings and roster strategy", "Trade value lab and multi-league dashboard"],
    cta: "Subscribe monthly",
    highlighted: true
  }
];
