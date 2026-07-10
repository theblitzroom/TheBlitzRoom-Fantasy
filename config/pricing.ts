export type Plan = {
  id: "preview" | "draft_pro" | "dynasty_elite";
  name: string;
  price: string;
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
    id: "draft_pro",
    name: "Draft Pro",
    price: "$20",
    audience: "Live drafts, mocks, and serious prep.",
    features: ["Sleeper live sync", "Full command center", "Roster-aware recommendations", "Saved league settings"],
    cta: "Unlock Draft Pro",
    highlighted: true
  },
  {
    id: "dynasty_elite",
    name: "TwoBros Fantasy Elite",
    price: "$50",
    audience: "One premium suite for redraft and dynasty leagues.",
    features: ["All Draft Pro tools", "Redraft and dynasty modes", "Power rankings", "Trade value lab", "Multi-league dashboard"],
    cta: "Go Elite"
  }
];
