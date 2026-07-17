# The Blitz Room

Loadable Chrome/Edge extension for live Sleeper fantasy football drafts.

## What it does

- Detects a Sleeper draft page and syncs the `draft_id`.
- Polls Sleeper's public read-only draft API for draft settings and picks, with one-second pick checks during live drafts.
- Listens for Sleeper draft-room page changes and immediately rechecks picks after a selection.
- Caches Sleeper NFL player metadata once per day.
- Includes bundled 2026 redraft PPR, half-PPR, and Superflex Dynasty boards from your CSV rankings.
- Includes a local rankings editor that live-saves separate PPR, half-PPR, and Superflex Dynasty custom boards into the extension.
- Supports System, Light, and Dark appearance modes with a purple/gold accent palette.
- Automatically selects PPR, half-PPR, or Superflex Dynasty rankings from the synced Sleeper draft format when available.
- Separates Player Rating from Pick Grade: Player Rating is expected player quality on a 99-to-0 curve, while Pick Grade is the value/team-fit score for this exact draft pick.
- Shows short player-specific reasoning for each suggested pick, including projection/PPG context, last-season stat references when available, injury/status context only when flagged, and nuclear-year upside paths.
- Runs a 1000-path ADP-first local draft simulation from the current Sleeper room so recommendations know who is likely gone before your next pick.
- Adds best available, positional scarcity, future tier cliffs, team needs, bye week conflict checks, stacking opportunities, sleeper values, roster construction, and ADP/current-pick value into the pick grade.
- The AI Draft Assistant understands common player nicknames and shorthand, and loose last-name matches are limited to players who are actually in the current draft window.
- Weights age for Superflex Dynasty recommendations only; redraft advice and grades ignore age as a value input.
- Keeps the written advice focused on projection, last-year production, board value, roster build, injuries/status concerns, and credible live news instead of generic role filler.
- Adds an **Available** tab with position filters for QB/RB/WR/TE/DEF so you can see who is still available and where they rank on the active draft board.
- Tracks every roster in a Teams tab and shows a draft grade once a team has four picks, with a final-draft curve so the best completed roster grades like the best team in that room.
- Removes kickers from recommendations, roster needs, ranking editors, and team counts.
- Optionally calls a local advisor service that can use live web search for stronger, cited reasoning.

## Install the extension

1. Open Chrome or Edge.
2. Go to `chrome://extensions`.
3. Enable **Developer mode**.
4. Choose **Load unpacked**.
5. Select the `extension` folder from this repo.
6. Open a Sleeper draft room, then click the extension icon to open the side panel.

## First run

1. Open a Sleeper draft URL.
2. The extension should fill in the draft ID automatically. If it does not, paste the draft ID manually.
3. Keep the Sleeper draft page open so the extension can detect your Sleeper user/team automatically.
4. Leave **Settings -> Ranking board** on **Auto from synced draft format** unless you need to force PPR, force half-PPR, force Superflex Dynasty, or use an imported custom board.
5. Use **Settings -> Appearance** to choose **System**, **Light**, or **Dark** mode.

## Live rankings editor

Open the side panel, expand **Settings**, then choose **Open rankings editor**.

- Edit rank, position tier, player, position, team, and notes in the table. Average rank/ADP stays saved behind the scenes for draft simulation.
- Draft assistance uses position tiers only. If `Pos Tier` is blank, the assistant auto-builds position tiers from positional rank so RB/WR/QB/TE cliff decisions are not driven by overall ADP tiers.
- In dynasty and superflex, draft assistance anchors heavily to ADP/average rank. QB position-tier pressure is capped unless the QB is also a market value, so young RB/WR assets can beat QB scarcity when the price is better.
- Team grades now blend market value, starter strength, roster construction, dynasty age risk, and format fit instead of grading only steals and reaches.
- Use the `-` and `+` buttons in the Rank column to move players up or down one spot with whole-number ranks.
- Leave **Live save** on if you want edits to update the extension as you type.
- Saving sets the side panel to **Use imported custom board** and saves the edit under that board's scoring format, so Superflex Dynasty edits stay separate from redraft PPR and half-PPR edits.
- Use **Load PPR**, **Load half PPR**, or **Load SF dynasty** to switch boards. The editor saves the current board first, then opens your saved board for that format or the bundled board if you have not edited that format yet.
- Use **Export JSON** to back up a board or move it to another browser profile.

The bundled PPR and half-PPR boards came from:

- `2026_Redraft_PPR_Rankings - Main Rankings.csv`
- `2026_redraft_half_ppr_RANKINGS - Main Rankings.csv`
- `superflex_dynasty_sf_rankings - Main_Edit_Board.csv`

The included sample ranking file remains only a schema example.

## Optional live web advisor

The extension works without this service. Start it when you want the **Web check** button to verify picks against current web/news/social context.

1. Install Node.js 20+.
2. Double-click `start-advisor-server.cmd`.
3. Paste your OpenAI API key when it asks.

Or run it manually:

```powershell
$env:OPENAI_API_KEY="your_key_here"
node advisor-server/server.js
```

4. In the extension settings, leave the advisor URL as `http://localhost:8787/advice`.
5. Click **Web check** on a recommendation.

The service sends only draft context, top candidate names, and the local 1-100 value scores to OpenAI. Your key stays on your machine, not in the browser extension.

Optional stronger live feeds:

- RotoWire NFL news is checked by default by the local advisor server and can add or subtract from the recommendation signal when it matches a top candidate.
- Set `X_BEARER_TOKEN` if you have access to the X/Twitter API and want recent public posts checked.
- Set `ADVISOR_FEEDS` to one or more RSS/Atom feed URLs, separated by commas, to include fantasy news feeds you trust.
- Open `http://localhost:8787/health` to confirm whether the advisor server sees your API key, X feed, and configured feeds.
- After updating these extension files, go to `chrome://extensions` and click **Reload** on The Blitz Room so Chrome picks up the localhost advisor permission.

If the server or key is missing, the **Web check** button now shows that setup message instead of failing silently.

## Sleeper draft research limits

Sleeper's public API can load drafts for a known user, drafts for a known league, a specific draft, and the picks in that draft. It does not provide a public global endpoint for every Sleeper draft, so the extension generates 1000 local draft paths from the active room, room ADP/average rank, tiers, and roster settings instead. Past-draft redraft comps can be added from supplied user IDs, league IDs, or draft IDs.

## Data sources

- Sleeper public API for draft, picks, player metadata, and trending add/drop data.
- Your imported rankings/evidence JSON.
- Optional OpenAI Responses API web search through the local advisor service.

## Ranking JSON schema

```json
{
  "updatedAt": "2026-07-09",
  "scoring": "ppr",
  "players": [
    {
      "playerId": "string optional",
      "name": "Ja'Marr Chase",
      "team": "CIN",
      "position": "WR",
      "rank": 1,
      "positionTier": 1,
      "averageRank": 2.4,
      "projection": 312.5,
      "notes": "Elite target share and weekly ceiling.",
      "sources": [
        {
          "label": "Your ranking source",
          "url": "https://example.com",
          "summary": "Why this ranking is supported."
        }
      ]
    }
  ]
}
```

## Evidence JSON schema

```json
{
  "updatedAt": "2026-07-09",
  "items": [
    {
      "playerId": "string optional",
      "name": "Bijan Robinson",
      "weight": 2,
      "sentiment": "positive",
      "summary": "Role and usage reports support a first-round grade.",
      "url": "https://example.com/article",
      "source": "Example Source"
    }
  ]
}
```
