# TheBlitzRoom Ranking Methodology

TheBlitzRoom uses an internal format-aware model instead of copying proprietary ranking tables.

## Inputs

- Sleeper league settings: roster slots, superflex/2QB, scoring, reception value, and TE premium signals.
- Sleeper player metadata: position, team, age, years of experience, injury status, active status, and search rank when available.
- Public market anchors: a small maintained set of high-end dynasty/redraft player anchors used to keep elite tiers realistic.
- Roster context: starters, bench, taxi/reserve, position counts, league size, potential points, current points, and build direction.

## Supported Formats

- Redraft
- Dynasty
- Superflex Dynasty
- Standard, Half PPR, Full PPR
- TE premium, including Sleeper-style bonus TE reception settings

## Core Logic

- Superflex and 2QB formats raise quarterback replacement value and position targets.
- Full PPR increases WR, pass-catching RB, and TE value; Half PPR applies a smaller boost.
- TE premium raises TE value and increases TE roster targets.
- Dynasty mode applies age curves by position. RBs peak earlier, WRs/TEs keep longer insulation, and QBs receive a longer prime window.
- Redraft mode weighs near-term role and market rank more heavily than long-term age insulation.
- Draft recommendations blend best-player-available value, position scarcity, roster need, and tier confidence.
- Waiver scores blend available-player value, league format, age/upside, health status, and roster need.
- Trade values blend dynasty market anchors, format scoring, role, age curve, and pick value.

## League Hub Calculations

- Every League Hub view starts from one shared roster asset profile so the Power Board, position-value tables, and League Economy do not disagree because of separate proxy formulas.
- Dynasty position values sum the format-adjusted values of the actual QB, RB, WR, and TE assets on each roster. The All view also includes owned rookie-pick capital.
- Redraft position values use the same players with current-season age, role, scoring, Superflex, and TE-premium adjustments. Draft picks are excluded.
- Rookie-pick ownership is reconstructed from each roster's original picks plus Sleeper's traded-pick records. The model includes 1st-3rd round picks across the next three available draft classes and discounts future seasons.
- Power scores blend current roster value, dynasty roster value, season production when available, and pick capital. Every input is scaled against the league average so a small pick difference cannot overpower a large player-value difference.
- League Economy compares each team's current-season roster value with its dynasty player value plus owned pick capital. Quadrants are determined against the room average.

## Public-Source Guardrails

The model is designed around public fantasy-football concepts used across the market:

- Consensus and ADP style ranking aggregation
- Value-based drafting and replacement-value scarcity
- Superflex quarterback scarcity
- PPR and TE-premium scoring adjustments
- Dynasty age curves and future-pick optionality
- Crowd/market value logic for trade calculation

The app does not scrape private data, auto-draft, or copy proprietary rankings. If we later license a rankings or projection API, it can feed this model as a data source.
