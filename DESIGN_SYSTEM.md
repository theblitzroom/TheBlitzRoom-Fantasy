# theblitzroom Product Design System

This test rebuild establishes **Private Club** for theblitzroom: a premium football intelligence system with quiet luxury, editorial sports character, clear decision hierarchy, and a warm visual language that does not rely on the logo for recognition.

## Product Audit

Current inventory:
- Public pages: home, pricing, extension, contact, FAQ, legal, login, account, reset password.
- Authenticated/product pages: Command Center, Draft Room, League Hub, Team Hub, Matchup, Waivers, Rosters, Power Rankings, Trade Value, Trade Calculator, Trade Finder.
- Shared components: SiteHeader, SiteFooter, ProductCommandNav, SectionShell, PreviewGate, PricingCards, football identity/player/team components, platform connection panels, and tool-specific dashboards.
- Data/tool components: LeagueHubDashboard, MyTeamOverviewTool, DraftRoomCommandCenter, PowerRankingsTool, MatchupCommandTool, WaiverWireTool, TradeMarketTool, RostersTool.

Style inconsistencies found:
- The previous stylesheet mixed several generations of tokens and page-specific overrides. It has been replaced by one coherent foundation with explicit sections for primitives, shell, public pages, and product surfaces.
- Card treatments repeat similar gradients, borders, shadows, and radii under many names.
- Gold is used as both an action color and a premium/value color, which weakens hierarchy.
- Input, badge, table, and row states are restyled per feature instead of sharing primitives.
- Product pages generally use shared navigation but not shared page, card, metric, table, or state components.
- Dense fantasy data often has good information, but the visual hierarchy can feel equally loud across hero panels, callouts, filters, cards, and tables.

Representative migration:
- Draft Room is the reference implementation because it is the signature product screen: live pick state, recommendation hierarchy, draft-board cells, roster build, player rows, sync state, data density, and responsive draft-night behavior.
- Homepage hero is the public proof surface and shows the real Draft Room product immediately.
- League Hub has an early migrated preview layer from the initial foundation pass and should be revisited after Draft Room and the homepage hero establish the final pattern.

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
- Editorial accent: Newsreader, used only for selective emphasis.
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
- 90% warm neutral: #F7F4EC canvas, #FFFEFA surfaces, #171717 text, and #E7E0D2 soft-stone structure.
- 8% deep field green: primary actions, active navigation, live readiness, focus, and decision confidence.
- 2% champagne gold: premium membership, elite tiers, exceptional value, plan highlights, and rare win signals.
- Violet is secondary only: charts, position identity, and select fantasy indicators.
- Avoid loud fantasy-football color blocks, neon glow, gradient borders, and constant champagne outlines.

Borders:
- Default border: soft stone.
- Strong border: field-green or deeper stone for active/focus states.
- Gold border: premium or featured states only.

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
- Primary: deep field green, for main product actions.
- Secondary: soft-white with stone border, for normal actions.
- Ghost: transparent, for low-emphasis navigation.
- Danger: restrained red, for destructive actions.
- Champagne is reserved for premium/high-value states, not ordinary buttons.

Inputs:
- Soft-white surface, subtle stone border, 44-48px height, clear field-green focus ring, compact labels.
- Disabled states should look unavailable without disappearing.

Cards:
- App card: Linear-like elevated dark surface.
- Data card: Mercury-like numeric hierarchy.
- Sports card: Sleeper-inspired identity/position/tier treatment.
- Premium card: gold border/highlight used sparingly.

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
- Premium/high confidence: gold accent only when it changes decision priority.

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

1. Add shared CSS tokens and primitive utility classes.
2. Add small React primitives for cards, hero panels, badges, metrics, callouts, and segmented controls.
3. Redesign only the public homepage hero and Draft Room as the premium vertical slice.
4. Run visual QA at desktop, tablet, and mobile widths.
5. After approval, apply the system to Rankings, Trade and value tools, Command Center, Account, onboarding, pricing, and remaining pages.

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
