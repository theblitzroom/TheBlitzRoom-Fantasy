# theblitzroom Design Refresh Audit

## Creative Direction

The rebuilt design language is **Private Club**.

theblitzroom should feel like a private modern sports club with a live intelligence desk: warm, confident, analytical, decisive, and unmistakably purpose-built. The product should be recognizable through its editorial typography, warm-ivory base, soft-white dashboards, charcoal text, deep field-green actions, champagne value moments, compact room navigation, and tightly ordered recommendation hierarchy even when the logo is removed.

Reference translation:

- Linear: authenticated product structure, dense surfaces, navigation, tables, side panels, and calm controls.
- Formula 1 Live Timing: compact telemetry, live draft status, clock pressure, ranking movement, and room tension.
- Apple Sports: mobile clarity, real-time sports-data priority, and fast scanning.
- Attio: editorial homepage composition and product-led storytelling.
- Tracksmith-style editorial direction: restrained sports confidence and less ad-like tone.
- Mercury: value comparison hierarchy for trade and numerical decision screens.
- Raycast: command palette and Command Center direction.
- Stripe: onboarding, billing, import validation, pricing, and recovery states.
- Sleeper: fantasy workflows only, not visual identity.

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

Foundation primitives:

- `ProductBadge`
- `SurfaceCard`
- `AppHero`
- `MetricTile`
- `StateCallout`
- `SegmentControl`
- `PremiumActionButton`

Product and fantasy surfaces:

- `DraftRoomPreview`
- `DraftRoomCommandCenter`
- `FootballIdentity`
- `LeagueHubDashboard`
- `MyTeamOverviewTool`
- `PowerRankingsTool`
- `MatchupCommandTool`
- `WaiverWireTool`
- `TradeMarketTool`
- `RostersTool`
- `SleeperSyncPanel`
- `TeamNewsPanel`

Account, billing, and platform surfaces:

- `AuthPanel`
- `ResetPasswordPanel`
- `CheckoutButton`
- `PricingCards`
- `PricingCheckoutLauncher`
- `ManageBillingButton`
- `SignOutButton`
- `ExtensionConnectPanel`
- `EspnConnectPanel`

## Legacy Issues Removed

- The legacy global stylesheet and the previous refresh override were removed from the render path.
- Several pages still use unique card classes instead of shared primitives.
- Older public sections leaned too heavily on repeated card grids.
- Champagne/gold had been used as a normal action color in places; it is now being reserved for premium/value states.
- Draft Room previously had The Pick, but not a complete structured Player Dossier.
- Alternatives were too numerous for the desired hierarchy; they have been reduced to a value read and a ceiling read.
- The public homepage had a marketing-template cadence instead of a product-led decision narrative.

## Foundation Implemented From Scratch

- Warm ivory canvas, soft-white surfaces, charcoal text, deep field-green interaction, restrained violet fantasy indicators, and rare champagne value signals.
- Manrope for product UI and data-dense surfaces.
- Newsreader for rare editorial emphasis, never routine product labels.
- IBM Plex Mono for clocks, pick numbers, ranks, values, probabilities, and operational metadata.
- Shared primitives for badges, surfaces, metrics, states, segmented controls, and buttons.
- Primary buttons use deep field green; champagne is reserved for premium membership and consequential value states.

## Product-System Rollout

The original signature slice established the direction on the homepage and Draft Room. The current pass extends the same system across the complete shared application shell and every route that uses the league, roster, rankings, waiver, matchup, trade, pricing, account, authentication, and policy primitives.

Core surfaces refreshed in this pass:

- Homepage hero and first product storytelling sections.
- Draft Room operating surface.
- Player Dossier panel inside Draft Room.
- Global header, account control, mega navigation, mobile navigation, and footer.
- Product workspace switcher shared by authenticated tools.
- Route headings and live-workspace framing.
- League Hub, Team Hub, Power Rankings, Rosters, Matchups, and Waivers.
- Trade Value, Trade Calculator, and Trade Finder.
- Pricing, login, account, extension, policy, and support surfaces.
- Shared forms, buttons, cards, tables, player rows, metrics, statuses, and responsive rules.

Signature components now represented:

- Room Status Rail
- The Pick
- Blitz Score
- Tier Cliff Indicator
- Player Dossier
- Draft Tape
- Build Identity
- Next-Pick Availability
- Live Draft Board
- Recommendation Alternatives
- Data Source Status

## Accessibility Improvements

- Product sections use semantic regions and labels where appropriate.
- Dossier factor list uses table roles for screen-reader structure.
- Status is represented with text labels, not color alone.
- Focus and contrast remain tied to shared token rules.
- Mobile layouts avoid page-level horizontal overflow.

## Functional Areas Preserved

No changes were made to:

- Draft recommendation logic
- Player-value formulas
- Ranking calculations
- Custom ranking behavior
- League settings
- Authentication
- Billing logic
- Database models
- API contracts
- Extension behavior
- Import/export behavior
- Storage architecture

## Remaining Design Debt

- Capture and approve permanent visual-regression baselines for every route.
- Move legacy route-specific CSS into smaller modules as product components are naturally revisited.
- Add expandable player dossiers to rankings and roster tables without changing ranking logic.
- Add a keyboard command palette to Command Center as a dedicated interaction project.
- Add explicit loading, empty, error, offline, paused, complete, unmatched, duplicate, and import-failure states across the full product.
- Create the browser-extension UI version of Private Club after the website system is approved.
- Add formal visual regression snapshots to CI once the design direction is stable.

## Performance Notes

- No new runtime dependencies were added.
- Fonts are loaded through `next/font`.
- The homepage adds lightweight markup and CSS only.
- Draft Room additions use existing data and do not add new API calls.
- The live draft sync path and polling behavior are untouched.

## Visual QA Results

Validated routes:

- `/`
- `/draft-room`
- `/league-hub`
- `/team-hub/my-team`
- `/pricing`

Validated widths:

- 1440px
- 1280px
- 1024px
- 768px
- 390px
- 375px

Results:

- No browser console errors on the refreshed routes.
- No page-level horizontal overflow at any tested width.
- Shared data tables and workspace tabs retain their own intentional horizontal scrolling on narrow screens.
- Homepage includes the real Draft Room preview in the first viewport, Live Draft Intelligence positioning, proof/timing rail, warm editorial explanation section, and recommendation read stack.
- Draft Room includes Room Status Rail, The Pick, Blitz Score, Live Draft Board, two recommendation alternatives, Draft Tape, roster build context, and the new Player Dossier.

Screenshots:

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
