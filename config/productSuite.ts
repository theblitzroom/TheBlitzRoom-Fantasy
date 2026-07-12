import {
  BarChart3,
  ClipboardList,
  Command,
  Crosshair,
  Gauge,
  LineChart,
  ListPlus,
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
        description: "League scan, tool launcher, and live workflow hub.",
        icon: Command
      },
      {
        label: "Draft Room",
        href: "/draft-room",
        description: "Sleeper sync, live picks, and draft decision support.",
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
        label: "Research Signals",
        href: "/power-rankings",
        description: "News, trends, tiers, and positional leverage signals.",
        icon: LineChart
      }
    ]
  }
];

export const productCommandNav = [
  { label: "Team", href: "/team-hub/my-team", description: "My roster" },
  { label: "Matchup", href: "/matchup", description: "Weekly edge" },
  { label: "Waivers", href: "/waivers", description: "Add/drop" },
  { label: "League", href: "/league-hub", description: "Room context" },
  { label: "Trades", href: "/trade-value", description: "Market value" },
  { label: "Draft", href: "/draft-room", description: "Live sync" },
  { label: "Command", href: "/command-center", description: "Launch pad" }
];
