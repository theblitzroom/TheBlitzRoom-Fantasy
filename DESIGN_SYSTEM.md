# theblitzroom Product Design System

This rebuild establishes **Live Room** for The Blitz Room: a premium football-intelligence system built around broadcast clarity, dark technical surfaces, decisive green actions, cyan data labels, and dense sports information that remains easy to scan. The product should remain recognizable when the logo is removed.

## Product Audit

Current inventory:
- Public pages: home, pricing, extension, contact, FAQ, legal, login, account, reset password.
- Authenticated/product pages: Command Center, Draft Room, League Hub, Team Hub, Matchup, Waivers, Rosters, Power Rankings, Trade Value, Trade Calculator, Trade Finder.
- Shared components: SiteHeader, SiteFooter, ProductCommandNav, SectionShell, PreviewGate, PricingCards, football identity/player/team components, platform connection panels, and tool-specific dashboards.
- Data/tool components: LeagueHubDashboard, MyTeamOverviewTool, DraftRoomCommandCenter, PowerRankingsTool, MatchupCommandTool, WaiverWireTool, TradeMarketTool, RostersTool.

Style inconsistencies found:
- The previous stylesheet mixed several generations of tokens and page-specific overrides. `product-theme.css` now provides the final scoped product layer while the approved landing page remains isolated.
- Card treatments repeat similar gradients, borders, shadows, and radii under many names.
- Green is the only primary action and live-state color. Cyan is informational. Amber is reserved for warnings and premium/value moments.
- Input, badge, table, and row states are restyled per feature instead of sharing primitives.
- Product pages generally use shared navigation but not shared page, card, metric, table, or state components.
- Dense fantasy data often has good information, but the visual hierarchy can feel equally loud across hero panels, callouts, filters, cards, and tables.

Representative migration:
- Draft Room is the reference implementation because it is the signature product screen: live pick state, recommendation hierarchy, draft-board cells, roster build, player rows, sync state, data density, and responsive draft-night behavior.
- Homepage hero is the public proof surface and shows the real Draft Room product immediately.
- Command Center, Draft Room, League Hub, Team Hub, pricing, account surfaces, and mobile navigation now use the same shared product layer.

## Reference Translation

- Linear: application architecture, alignment, panel hierarchy, restraint, and interaction polish.
- Formula 1 Live Timing: live draft state, timing, ranking, status, and technical competition hierarchy.
- Apple Sports: sports-data simplicity, scanning speed, and mobile clarity.
- Attio: premium marketing composition, editorial typography, and real product-led storytelling.
- Tracksmith: brand character, restraint, confidence, and an editorial sports tone that feels serious instead of loud.
- Oura: recommendation hierarchy, calm verdicts, score interpretation, and recovery-style signal grouping.
- Sleeper: fantasy-football workflows only, not visual style.

Do not copy proprietary layouts, brand assets, color systems, illustrations, or exact components from any reference. The goal is to borrow principles and interaction patterns, then translate them into an ownable theblitzroom system.

## Tokens

Typography:
- Brand name: always `theblitzroom`.
- Primary font: Manrope.
- Editorial accent: Newsreader is not used in routine product UI; reserve it for rare long-form editorial moments.
- Numeric font: IBM Plex Mono for pick numbers, ADP, values, clocks, and compact labels.
- Display: 48/56, 56/60, 72/76 for public hero moments only.
- Page title: 36/42 to 48/52.
- Section title: 24/30 to 32/38.
- Card title: 16/22 to 22/28.
- Body: 14/22 to 16/26.
- Caption: 11/16 to 12/18, uppercase only for labels.
- Numeric: tabular figures for standings, scores, prices, and values.

Spacing:
- 2, 4, 6, 8, 10, 12, 16, 20, 24, 32, 40, 56, 72.
- Dense data rows use 10-14px vertical rhythm.
- Product cards use 16-24px internal padding.
- Public page sections use 56-80px vertical rhythm.

Colors:
- Canvas: #02060A with #040B12 raised areas.
- Surfaces: #07111D, #0A1725, and #0D1E2E.
- Text: #F5F9FC primary, #9EACBC secondary, #667589 tertiary.
- Action/live: #00F060. Use for primary commands, active navigation, healthy sync, and decisive recommendations.
- Data: #00DDEB. Use for labels, secondary data emphasis, and informational states.
- Warning/value: #F4B847. Use sparingly for warnings, premium context, and meaningful value signals.
- Danger: #FF6877.
- Position identity may use restrained violet, green, blue, and amber accents without filling entire cards.
- Glow is limited to live indicators, focused actions, and the strongest recommendation state.

Borders:
- Default border: rgba(116, 153, 194, 0.16).
- Strong border: rgba(135, 177, 222, 0.26).
- Focus border: green at 50-74% opacity.
- Amber border: premium or warning states only.

Shadows:
- Level 1: subtle card elevation.
- Level 2: popover/dropdown elevation.
- Level 3: modal/command elevation.

Radius:
- xs: 6px for compact controls.
- sm: 8px for buttons and dense rows.
- md: 10px for panels and cards.
- lg: 12px for major surfaces.
- xl: 14px for dialogs and drawers.
- pill: 999px only for statuses, filters, tags, and segmented controls.

Buttons:
- Primary: bright field green with near-black text.
- Secondary: deep blue-black surface with a cool border.
- Ghost: transparent, for low-emphasis navigation.
- Danger: restrained red, for destructive actions.
- Amber is reserved for premium/high-value states, not ordinary buttons.

Inputs:
- Blue-black surface, subtle cool border, 44-48px height, clear green focus ring, compact labels.
- Disabled states should look unavailable without disappearing.

Cards:
- App card: blue-black elevated surface with subtle top-lighting.
- Data card: Mercury-like numeric hierarchy.
- Sports card: Sleeper-inspired identity/position/tier treatment.
- Premium card: green decision emphasis or amber premium emphasis, never both at once.

Tables:
- Sticky or visually anchored headers when possible.
- Compact rows with readable line-height.
- Row hover state should be subtle and confident.
- First column should carry identity, not decorative noise.

Player and team rows:
- Avatar/logo at left.
- Primary name readable without truncating too early.
- Team/position/status metadata grouped below or beside the name.
- Position badges use restrained color, not full-card color blocks.

Tier treatments:
- Contender: restrained emerald/purple blend.
- Builder: muted violet.
- Middle/Neutral: cool gray.
- Premium/high confidence: green accent when it changes decision priority; amber remains a paid-tier or warning cue.

Loading, empty, and error:
- Loading: quiet skeleton or status row.
- Empty: one sentence plus one next action.
- Error: clear text, red accent, no dramatic styling.

Motion:
- 160-220ms transitions.
- Hover lift: 1-2px maximum.
- Use transform/opacity/border-color only.
- Respect reduced-motion with shorter/no transform transitions.

Breakpoints:
- Mobile: up to 620px.
- Tablet: 621-980px.
- Desktop: 981px+.
- Wide: 1220px max content width unless a draft board requires horizontal overflow.

## Migration Plan

1. Keep landing-specific styles isolated under `.mock-home`.
2. Build all product pages from `globals.css`, `clubhouse.css`, and the final `product-theme.css` layer.
3. Use shared React primitives for cards, hero panels, badges, metrics, callouts, and segmented controls.
4. Verify Command Center, Draft Room, League Hub, Team Hub, pricing, account, and mobile navigation after shared style changes.
5. Preserve rankings logic, live-sync behavior, auth, payments, and data models during visual work.

## Signature Components

- Room Status Rail: persistent compact draft context with live state, round, pick, clock, league format, picks until user selection, and connection health.
- Pick Card: the dominant recommended-player object with player identity, tier urgency, Blitz Score, confidence, future availability, roster fit, and risk.
- Player Dossier: structured scouting read for market position, value, roster fit, tier pressure, future availability, risk, notes, and comparables.
- Tier Cliff Indicator: restrained warning treatment that breaks ranking scans only when the decision consequence is material.
- Blitz Score: branded recommendation score using typography and small confidence cues instead of loud progress bars.
- War Room Grid: board-level draft state that exposes room pressure, current pick, team columns, and positional pockets.
- Draft Clock: IBM Plex Mono, tabular, compact, and tied to room state.
- Build Identity: roster-construction label such as Anchor QB, Hero RB, Balanced, Win Now, or Productive Struggle.
- Recommendation Confidence: compact confidence read paired with reasoning, never a decorative badge alone.
- Next-Pick Availability: probability-like read that explains whether the player likely survives the next turn.
- Live Timing Strip: homepage and draft-room status strip that communicates current room state with compact, broadcast-like precision.
- Read Stack: recommendation explanation sequence with one dominant verdict followed by evidence and discipline reads.
