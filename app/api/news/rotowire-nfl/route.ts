import { NextResponse } from "next/server";
import { XMLParser } from "fast-xml-parser";
import { getSleeperNflPlayers, type SleeperPlayer } from "@/lib/sleeper/client";

const ROTOWIRE_NFL_RSS_URL = "https://www.rotowire.com/rss/news.php?sport=NFL";

type RssItem = {
  guid?: string;
  title?: string;
  link?: string;
  description?: string;
  pubDate?: string;
};

type RssChannel = {
  item?: RssItem | RssItem[];
  title?: string;
  link?: string;
};

function asArray<T>(value?: T | T[]) {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function cleanText(value?: string) {
  return (value ?? "")
    .replace(/\s+/g, " ")
    .replace(/Visit RotoWire\.com for more analysis on this update\./i, "")
    .trim();
}

function compactSummary(value: string) {
  return value.length > 220 ? `${value.slice(0, 217).trim()}...` : value;
}

function normalizeLink(link?: string) {
  if (!link) {
    return "https://www.rotowire.com/football/news.php";
  }

  return link.replace("https://www.rotowire.com//", "https://www.rotowire.com/");
}

function classifyNews(title: string, description: string) {
  const text = `${title} ${description}`.toLowerCase();

  if (/(injur|knee|ankle|hamstring|shoulder|limited|questionable|surgery|healthy|practic)/.test(text)) {
    return "Injury";
  }

  if (/(sign|trade|release|retire|contract|waiver|claimed|camp)/.test(text)) {
    return "Transaction";
  }

  if (/(starter|depth|role|target|carry|snap|workload|competition)/.test(text)) {
    return "Role";
  }

  return "Update";
}

function playerFromTitle(title: string) {
  return title.includes(":") ? title.split(":")[0].trim() : "";
}

function normalizeName(value?: string) {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function sleeperDisplayName(player: SleeperPlayer) {
  return player.full_name || [player.first_name, player.last_name].filter(Boolean).join(" ");
}

async function getPlayerPhotoLookup() {
  try {
    const players = await getSleeperNflPlayers();
    const lookup = new Map<string, SleeperPlayer>();

    for (const player of Object.values(players)) {
      const name = normalizeName(sleeperDisplayName(player));

      if (name && !lookup.has(name)) {
        lookup.set(name, player);
      }
    }

    return lookup;
  } catch {
    return new Map<string, SleeperPlayer>();
  }
}

export async function GET() {
  try {
    const response = await fetch(ROTOWIRE_NFL_RSS_URL, {
      headers: {
        Accept: "application/rss+xml, application/xml, text/xml"
      },
      next: { revalidate: 300 }
    });

    if (!response.ok) {
      throw new Error(`RotoWire RSS returned ${response.status}`);
    }

    const xml = await response.text();
    const parser = new XMLParser({
      ignoreAttributes: false,
      processEntities: true,
      trimValues: true
    });
    const parsed = parser.parse(xml) as { rss?: { channel?: RssChannel } };
    const channel = parsed.rss?.channel;
    const playerLookup = await getPlayerPhotoLookup();
    const items = asArray(channel?.item).slice(0, 24).map((item) => {
      const title = cleanText(item.title);
      const description = cleanText(item.description);
      const player = playerFromTitle(title);
      const sleeperPlayer = playerLookup.get(normalizeName(player));

      return {
        id: item.guid || normalizeLink(item.link) || title,
        title,
        player,
        playerId: sleeperPlayer?.player_id ?? null,
        position: sleeperPlayer?.position ?? null,
        team: sleeperPlayer?.team ?? null,
        imageUrl: sleeperPlayer?.player_id
          ? `https://sleepercdn.com/content/nfl/players/${sleeperPlayer.player_id}.jpg`
          : null,
        category: classifyNews(title, description),
        summary: compactSummary(description),
        publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : null,
        source: "RotoWire",
        sourceUrl: normalizeLink(item.link)
      };
    }).filter((item) => item.title);

    return NextResponse.json({
      source: "RotoWire",
      sourceUrl: "https://www.rotowire.com/rss/",
      feedUrl: ROTOWIRE_NFL_RSS_URL,
      fetchedAt: new Date().toISOString(),
      items
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "RotoWire NFL news failed" },
      { status: 502 }
    );
  }
}
