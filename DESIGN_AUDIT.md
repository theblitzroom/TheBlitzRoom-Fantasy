# theblitzroom Premium Redesign Audit

## Scope

This audit supports the Phase 3 vertical slice for **The Broadcast War Room** design language. The implemented redesign intentionally covers:

- Public homepage hero
- Draft Room

The following areas are inventoried but not fully migrated in this pass: Rankings, Trade tools, Command Center, League Hub, Team Hub, Account, Pricing, Onboarding, and legal/support pages.

## Route Inventory

Public and account routes:

- `/`
- `/pricing`
- `/extension`
- `/faq`
- `/contact`
- `/login`
- `/reset-password`
- `/account`
- `/privacy`
- `/terms`
- `/refund-policy`
- `/test-checkout`

Product routes:

- `/command-center`
- `/draft-room`
- `/league-hub`
- `/team-hub`
- `/team-hub/my-team`
- `/matchup`
- `/waivers`
- `/rosters`
- `/power-rankings`
- `/trade-value`
- `/trade-calculator`
- `/trade-finder`

## Component Inventory

Global shell:

- `SiteHeader`
- `SiteFooter`
- `ProductCommandNav`
- `SectionShell`
- `PreviewGate`

Design primitives introduced in this pass:

- `ProductBadge`
- `SurfaceCard`
- `AppHero`
- `MetricTile`
- `StateCallout`
- `SegmentControl`
- `PremiumActionButton`

Fantasy identity and product tools:

- `FootballIdentity`
- `DraftRoomPreview`
- `DraftRoomCommandCenter`
- `LeagueHubDashboard`
- `MyTeamOverviewTool`
- `MatchupCommandTool`
- `WaiverWireTool`
- `PowerRankingsTool`
- `RostersTool`
- `TradeMarketTool`
- `SleeperSyncPanel`
- `TeamNewsPanel`

Account, billing, and platform components:

- `AuthPanel`
- `ResetPasswordPanel`
- `CheckoutButton`
- `PricingCards`
- `PricingCheckoutLauncher`
- `ManageBillingButton`
- `SignOutButton`
- `ExtensionConnectPanel`
- `EspnConnectPanel`

## Design Issues Found

- The original global CSS mixes design tokens, route-specific styles, auth forms, public marketing, product dashboards, and dense sports tables in one large stylesheet.
- Many pages use unique card classes instead of shared primitives, creating uneven radius, spacing, border, and shadow treatment.
- Purple and gold were previously used too often as decoration. The new system restricts violet to interaction and champagne to rare premium/value moments.
- Some labels and product names used older brand casing. Product-facing references are being moved to exact `theblitzroom` casing.
- Several product pages still feel like collections of equal-weight cards. The Draft Room now establishes the preferred operating-surface hierarchy.
- Mobile layouts outside the redesigned slice still need more purpose-built prioritization.

## Visual Direction

Creative concept:

- **The Broadcast War Room**
- Private professional draft room
- Live sports broadcast data hierarchy
- Premium analytical-terminal precision
- Refined consumer sports clarity
- Restrained editorial sports confidence

Reference translation:

- Linear: structure, density, navigation, restraint
- Formula 1 Live Timing: compact status, timing, room pressure, and ranking hierarchy
- Apple Sports: fast sports-data scanning
- Attio: editorial public-page composition
- Tracksmith: restrained sports confidence and less ad-like brand character
- Oura: recommendation hierarchy with a calm verdict, supporting signals, and confidence context
- Sleeper: fantasy workflows only

## Foundation Implemented

- Instrument Sans loaded via `next/font/google` for interface and editorial text.
- Geist Mono loaded via `next/font/google` for pick numbers, ranks, values, metadata, and clocks.
- Shared CSS tokens added for colors, spacing, radii, shadows, typography, transitions, and breakpoints.
- Shared React primitives added in `components/DesignPrimitives.tsx`.
- Homepage hero now shows real product context immediately instead of a generic marketing mockup.
- Draft Room now includes the signature components:
  - Room Status Rail
  - Pick Card
  - War Room Grid
  - Blitz Score
  - Tier Cliff Indicator
  - Player Dossier preview
  - Draft Clock
  - Build Identity
  - Recommendation Confidence
  - Next-Pick Availability
- Homepage now adds a Live Timing Strip, Read Stack, and operating-principles band so the brand is recognizable without relying on the logo.
- Primary buttons now use violet as the interaction color. Champagne is reserved for premium/value states and rare highlights.

## Accessibility Improvements In Scope

- Stronger text contrast on redesigned surfaces.
- More restrained status colors with text labels, not color alone.
- Consistent focus-visible treatment through shared button and input styles.
- More semantic status and recommendation group labels on the homepage preview and Draft Room.
- Reduced-motion behavior remains respected through global motion rules.

## Responsive Improvements In Scope

- Homepage hero becomes an editorial split composition on desktop and a product-first stacked view on mobile.
- Draft Room preserves the board as a horizontal data surface instead of crushing it into unreadable cards.
- Recommendation and roster context move below the board on narrower screens while keeping the primary pick readable.

## Functional Areas Preserved

No changes were made to:

- Draft logic
- Recommendation formulas
- Player-value formulas
- Custom ranking logic
- Authentication behavior
- Billing behavior
- API contracts
- Database models
- Extension behavior
- Import/export behavior
- Storage architecture

## Remaining Design Debt

- Migrate Rankings to the shared player-row, tier, table, and dossier patterns.
- Convert Trade tools to a verdict-first Mercury-style layout.
- Rework Command Center into a Raycast-style operational console.
- Replace legacy card classes across League Hub, Team Hub, Pricing, and Account with shared primitives.
- Split route-specific CSS into smaller files or component-scoped modules once the visual language is approved.
- Add explicit loading, empty, error, locked, syncing, unmatched-player, and disconnected states to every product surface.

## Visual QA Results

Screenshots were captured for the homepage and Draft Room at:

- 1440x1000
- 1280x900
- 1024x900
- 768x900
- 390x844
- 375x812

Screenshot output:

- `design-qa/screenshots/home-1440.png`
- `design-qa/screenshots/home-1280.png`
- `design-qa/screenshots/home-1024.png`
- `design-qa/screenshots/home-768.png`
- `design-qa/screenshots/home-390.png`
- `design-qa/screenshots/home-375.png`
- `design-qa/screenshots/draft-room-1440.png`
- `design-qa/screenshots/draft-room-1280.png`
- `design-qa/screenshots/draft-room-1024.png`
- `design-qa/screenshots/draft-room-768.png`
- `design-qa/screenshots/draft-room-390.png`
- `design-qa/screenshots/draft-room-375.png`

Automated checks passed:

- No browser console errors on either redesigned route.
- No page-level horizontal overflow at any tested viewport.
- Homepage contains `theblitzroom`, `Own the room.`, `The pick`, `Blitz Score`, Room Status Rail, Pick Card, and War Room preview.
- Draft Room contains `theblitzroom`, Room Status Rail, full draft grid, `The pick`, `Blitz Score`, and War Room board context.
