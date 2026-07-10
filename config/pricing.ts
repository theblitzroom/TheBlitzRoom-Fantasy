import type { CheckoutPlan } from "@/lib/stripePlans";

export type Plan = {
  id: "preview" | CheckoutPlan;
  name: string;
  price: string;
  priceDetail?: string;
  badge?: string;
  audience: string;
  features: string[];
  cta: string;
  highlighted?: boolean;
};

export const plans: Plan[] = [
  {
    id: "preview",
    name: "Preview",
    price: "$0",
    audience: "Try the interface before draft night.",
    features: ["Snapshot draft board", "Limited player board", "Sample recommendations"],
    cta: "Start preview"
  },
  {
    id: "draft_pro_season",
    name: "TwoBros Draft Pro",
    price: "$39.99",
    priceDetail: "2026 season pass",
    badge: "Best draft-night value",
    audience: "Live draft help without another monthly bill.",
    features: ["One-time payment", "Sleeper live sync", "Draft board and player rankings", "BPA and roster-need recommendations", "Access through the 2026 fantasy season"],
    cta: "Get Draft Pro",
    highlighted: true
  },
  {
    id: "draft_pro_monthly",
    name: "Draft Pro Monthly",
    price: "$7.99",
    priceDetail: "per month",
    badge: "Flexible access",
    audience: "Start small and keep live draft tools active only when you need them.",
    features: ["Monthly subscription", "Sleeper live sync", "Draft board and player rankings", "BPA and roster-need recommendations", "Cancel before next renewal"],
    cta: "Subscribe monthly"
  },
  {
    id: "dynasty_elite_season",
    name: "TwoBros Fantasy Elite",
    price: "$59",
    priceDetail: "2026 season pass",
    badge: "Full command center",
    audience: "The full command center for redraft and dynasty managers.",
    features: ["One-time payment", "All Draft Pro tools", "Redraft and dynasty command center", "Power rankings and roster strategy", "Trade value lab and multi-league dashboard"],
    cta: "Get Elite"
  },
  {
    id: "dynasty_elite_monthly",
    name: "Fantasy Elite Monthly",
    price: "$14.99",
    priceDetail: "per month",
    badge: "All-access monthly",
    audience: "Use the full redraft and dynasty toolkit with monthly flexibility.",
    features: ["Monthly subscription", "All Draft Pro tools", "Redraft and dynasty command center", "Power rankings and roster strategy", "Trade value lab and multi-league dashboard"],
    cta: "Subscribe monthly"
  }
];
