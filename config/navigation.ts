import type { LucideIcon } from "lucide-react";
import {
  BadgeDollarSign,
  BarChart3,
  CircleHelp,
  Command,
  Gauge,
  Home,
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
  { label: "Rosters", href: "/rosters", description: "Roster construction", icon: Users },
  { label: "Trade Value", href: "/trade-value", description: "Dynasty market lens", icon: Swords },
  { label: "Draft Room", href: "/draft-room", description: "Sleeper live sync", icon: Gauge },
  { label: "Pricing", href: "/pricing", description: "Plans and access", icon: BadgeDollarSign },
  { label: "FAQ", href: "/faq", description: "Common questions", icon: CircleHelp },
  { label: "Account", href: "/account", description: "Subscription status", icon: ShieldCheck }
];
