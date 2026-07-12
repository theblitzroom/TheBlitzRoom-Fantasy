import type { LucideIcon } from "lucide-react";
import {
  BadgeDollarSign,
  BarChart3,
  CircleHelp,
  Command,
  Crosshair,
  Gauge,
  GitCompareArrows,
  Home,
  ListPlus,
  Search,
  ShieldCheck,
  Swords,
  Trophy,
  Users
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  description: string;
  icon: LucideIcon;
};

export const navItems: NavItem[] = [
  { label: "Home", href: "/", description: "Product overview", icon: Home },
  { label: "Command Center", href: "/command-center", description: "Live draft intelligence", icon: Command },
  { label: "League Hub", href: "/league-hub", description: "League settings and context", icon: Trophy },
  { label: "Power Rankings", href: "/power-rankings", description: "Team strength signals", icon: BarChart3 },
  { label: "Team Hub", href: "/team-hub/my-team", description: "My team overview", icon: Users },
  { label: "Matchup", href: "/matchup", description: "Weekly matchup command", icon: Crosshair },
  { label: "Waivers", href: "/waivers", description: "Add/drop recommendations", icon: ListPlus },
  { label: "Rosters", href: "/rosters", description: "Roster build comparison", icon: ShieldCheck },
  { label: "Trade Value", href: "/trade-value", description: "Dynasty market lens", icon: Swords },
  { label: "Trade Calculator", href: "/trade-calculator", description: "Deal value math", icon: GitCompareArrows },
  { label: "Trade Finder", href: "/trade-finder", description: "Find partner fits", icon: Search },
  { label: "Draft Room", href: "/draft-room", description: "Sleeper live sync", icon: Gauge },
  { label: "Pricing", href: "/pricing", description: "Plans and access", icon: BadgeDollarSign },
  { label: "FAQ", href: "/faq", description: "Common questions", icon: CircleHelp },
  { label: "Account", href: "/account", description: "Subscription status", icon: ShieldCheck }
];
