import {
  BarChart3,
  ClipboardList,
  Command,
  Crosshair,
  Gauge,
  GitCompareArrows,
  LineChart,
  ListPlus,
  Search,
  Swords,
  Trophy,
  Users
} from "lucide-react";

export const productSuiteGroups = [
  {
    label: "Command",
    description: "Start here during draft prep and live rooms.",
    items: [
      {
        label: "Command Center",
        href: "/command-center",
        description: "Active league ops, next moves, and tool routing.",
        icon: Command
      },
      {
        label: "Draft Room",
        href: "/draft-room",
        description: "Sleeper sync, live picks, and draft decision support.",
        icon: Gauge
      },
      {
        label: "Extension",
        href: "/extension",
        description: "Connect the local Chrome companion to the website.",
        icon: Gauge
      }
    ]
  },
  {
    label: "Team",
    description: "Understand your own roster and build window.",
    items: [
      {
        label: "Team Hub",
        href: "/team-hub/my-team",
        description: "Roster overview, asset tiers, age curve, and position value.",
        icon: Users
      },
      {
        label: "Matchup Command",
        href: "/matchup",
        description: "Weekly edge, opponent pressure, and matchup leverage.",
        icon: Crosshair
      },
      {
        label: "Waiver Wire",
        href: "/waivers",
        description: "Roster-fit adds, drop pressure, and available-player scoring.",
        icon: ListPlus
      },
      {
        label: "Rosters",
        href: "/rosters",
        description: "Compare roster depth, starters, and build priorities.",
        icon: ClipboardList
      }
    ]
  },
  {
    label: "League",
    description: "Read the room before you make moves.",
    items: [
      {
        label: "League Hub",
        href: "/league-hub",
        description: "Settings, rankings, team tiers, and league economy.",
        icon: Trophy
      },
      {
        label: "Power Rankings",
        href: "/power-rankings",
        description: "Rank every team by production, depth, and trajectory.",
        icon: BarChart3
      }
    ]
  },
  {
    label: "Market",
    description: "Turn roster value into better decisions.",
    items: [
      {
        label: "Trade Value",
        href: "/trade-value",
        description: "Dynasty market lens, windows, and asset decisions.",
        icon: Swords
      },
      {
        label: "Trade Calculator",
        href: "/trade-calculator",
        description: "Compare both sides with players, picks, and fairness scoring.",
        icon: GitCompareArrows
      },
      {
        label: "Trade Finder",
        href: "/trade-finder",
        description: "Find partner fits from roster need and surplus signals.",
        icon: Search
      },
      {
        label: "Research Signals",
        href: "/power-rankings",
        description: "News, trends, tiers, and positional leverage signals.",
        icon: LineChart
      }
    ]
  }
];

export const productCommandNav = [
  { label: "Command", href: "/command-center", description: "Decision desk", icon: Command },
  { label: "Draft Room", href: "/draft-room", description: "Live sync", icon: Gauge },
  { label: "My Team", href: "/team-hub/my-team", description: "Roster view", icon: Users },
  { label: "League Hub", href: "/league-hub", description: "League context", icon: Trophy },
  { label: "Matchups", href: "/matchup", description: "Weekly edge", icon: Crosshair },
  { label: "Waivers", href: "/waivers", description: "Add/drop", icon: ListPlus },
  { label: "Market", href: "/trade-value", description: "Player values", icon: Swords },
  { label: "Calculator", href: "/trade-calculator", description: "Deal math", icon: GitCompareArrows },
  { label: "Trade Finder", href: "/trade-finder", description: "Targets", icon: Search },
  { label: "Extension", href: "/extension", description: "Companion", icon: Gauge }
];
