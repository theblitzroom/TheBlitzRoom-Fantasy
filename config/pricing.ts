export type Plan = {
  id: "preview" | "draft_pro_season" | "dynasty_elite_season";
  name: string;
  price: string;
  priceDetail?: string;
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
    audience: "Live draft help without another monthly bill.",
    features: ["One-time payment", "Sleeper live sync", "Draft board and player rankings", "BPA and roster-need recommendations", "Access through the 2026 fantasy season"],
    cta: "Get Draft Pro",
    highlighted: true
  },
  {
    id: "dynasty_elite_season",
    name: "TwoBros Fantasy Elite",
    price: "$59",
    priceDetail: "2026 season pass",
    audience: "The full command center for redraft and dynasty managers.",
    features: ["One-time payment", "All Draft Pro tools", "Redraft and dynasty command center", "Power rankings and roster strategy", "Trade value lab and multi-league dashboard"],
    cta: "Get Elite"
  }
];
