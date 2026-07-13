import { NextResponse } from "next/server";
import { XMLParser } from "fast-xml-parser";
import { getSleeperNflPlayers, type SleeperPlayer } from "@/lib/sleeper/client";

const NEWS_FEEDS = [
  {
    fallbackLink: "https://www.rotowire.com/football/news.php",
    id: "rotowire",
    name: "RotoWire",
    url: "https://www.rotowire.com/rss/news.php?sport=NFL"
  },
  {
    fallbackLink: "https://www.espn.com/nfl/",
    id: "espn",
    name: "ESPN",
    url: "https://www.espn.com/espn/rss/nfl/news"
  }
] as const;

const FANTASY_NEWS_POSITIONS = new Set(["QB", "RB", "WR", "TE"]);

type RssItem = {
  description?: unknown;
  guid?: unknown;
  link?: unknown;
  pubDate?: unknown;
  title?: unknown;
};

type RssChannel = {
  item?: RssItem | RssItem[];
};

type NewsFeed = typeof NEWS_FEEDS[number];

type ParsedNewsItem = {
  description: string;
  id: string;
  publishedAt: string | null;
  source: string;
  sourceId: NewsFeed["id"];
  sourceUrl: string;
  title: string;
};

type PlayerLookup = {
  byName: Map<string, SleeperPlayer>;
  index: Array<{
    normalizedName: string;
    player: SleeperPlayer;
  }>;
};

function asArray<T>(value?: T | T[]) {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function rssText(value?: unknown): string {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return rssText(record["#text"] ?? record._text ?? record.__cdata);
  }

  return "";
}

function cleanText(value?: unknown) {
  return rssText(value)
    .replace(/^Copy of\s+/i, "")
    .replace(/^[^A-Za-z0-9$"']+\s*/, "")
    .replace(/\s+/g, " ")
    .replace(/Visit RotoWire\.com for more analysis on this update\./i, "")
    .trim();
}

function parseNewsDate(value?: unknown) {
  const rawDate = cleanText(value);

  if (!rawDate) {
    return null;
  }

  const date = new Date(rawDate);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function compactSummary(value: string) {
  return value.length > 220 ? `${value.slice(0, 217).trim()}...` : value;
}

function normalizeLink(link: unknown, fallbackLink: string) {
  const rawLink = cleanText(link);

  if (!rawLink) {
    return fallbackLink;
  }

  return rawLink.replace("https://www.rotowire.com//", "https://www.rotowire.com/");
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

function playerFromTitle(title: string, sourceId: NewsFeed["id"]) {
  if (sourceId !== "rotowire" || !title.includes(":")) {
    return "";
  }

  return title.split(":")[0].trim();
}

function normalizeName(value?: string) {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function sleeperDisplayName(player: SleeperPlayer) {
  return player.full_name || [player.first_name, player.last_name].filter(Boolean).join(" ");
}

function isFantasyNewsPlayer(player: SleeperPlayer) {
  return Boolean(player.position && FANTASY_NEWS_POSITIONS.has(player.position));
}

async function getPlayerPhotoLookup(): Promise<PlayerLookup> {
  try {
    const players = await getSleeperNflPlayers();
    const byName = new Map<string, SleeperPlayer>();
    const index: PlayerLookup["index"] = [];

    for (const player of Object.values(players)) {
      if (!isFantasyNewsPlayer(player)) {
        continue;
      }

      const displayName = sleeperDisplayName(player);
      const name = normalizeName(displayName);

      if (name && !byName.has(name)) {
        byName.set(name, player);
      }

      if (name.length >= 6 && displayName.trim().includes(" ")) {
        index.push({ normalizedName: name, player });
      }
    }

    index.sort((left, right) => right.normalizedName.length - left.normalizedName.length);

    return { byName, index };
  } catch {
    return { byName: new Map<string, SleeperPlayer>(), index: [] };
  }
}

function findSleeperPlayer(text: string, playerLookup: PlayerLookup, preferredName?: string) {
  const preferredPlayer = preferredName ? playerLookup.byName.get(normalizeName(preferredName)) : null;

  if (preferredPlayer) {
    return preferredPlayer;
  }

  const normalizedText = normalizeName(text);
  return playerLookup.index.find((entry) => normalizedText.includes(entry.normalizedName))?.player ?? null;
}

async function fetchNewsFeed(feed: NewsFeed): Promise<ParsedNewsItem[]> {
  const response = await fetch(feed.url, {
    headers: {
      Accept: "application/rss+xml, application/xml, text/xml",
      "User-Agent": "TheBlitzRoomFantasy/1.0"
    },
    next: { revalidate: 300 }
  });

  if (!response.ok) {
    throw new Error(`${feed.name} RSS returned ${response.status}`);
  }

  const xml = await response.text();
  const parser = new XMLParser({
    ignoreAttributes: false,
    processEntities: true,
    trimValues: true
  });
  const parsed = parser.parse(xml) as { rss?: { channel?: RssChannel } };
  const channel = parsed.rss?.channel;

  return asArray(channel?.item).slice(0, 24).map((item) => {
    const title = cleanText(item.title);
    const description = cleanText(item.description);
    const sourceUrl = normalizeLink(item.link, feed.fallbackLink);

    return {
      description,
      id: `${feed.id}-${cleanText(item.guid) || sourceUrl || title}`,
      publishedAt: parseNewsDate(item.pubDate),
      source: feed.name,
      sourceId: feed.id,
      sourceUrl,
      title
    };
  }).filter((item) => item.title);
}

export async function GET() {
  try {
    const playerLookup = await getPlayerPhotoLookup();
    const feedResults = await Promise.allSettled(NEWS_FEEDS.map((feed) => fetchNewsFeed(feed)));
    const rawItems = feedResults.flatMap((result) => result.status === "fulfilled" ? result.value : []);
    const seenTitles = new Set<string>();
    const items = rawItems
      .sort((left, right) => {
        const leftTime = left.publishedAt ? new Date(left.publishedAt).getTime() : 0;
        const rightTime = right.publishedAt ? new Date(right.publishedAt).getTime() : 0;
        return rightTime - leftTime;
      })
      .filter((item) => {
        const key = normalizeName(item.title);

        if (!key || seenTitles.has(key)) {
          return false;
        }

        seenTitles.add(key);
        return true;
      })
      .map((item) => {
        const preferredPlayerName = playerFromTitle(item.title, item.sourceId);
        const sleeperPlayer = findSleeperPlayer(`${item.title} ${item.description}`, playerLookup, preferredPlayerName);
        const player = sleeperPlayer ? sleeperDisplayName(sleeperPlayer) : preferredPlayerName;

        return {
          category: classifyNews(item.title, item.description),
          id: item.id,
          imageUrl: sleeperPlayer?.player_id
            ? `https://sleepercdn.com/content/nfl/players/${sleeperPlayer.player_id}.jpg`
            : null,
          player,
          playerId: sleeperPlayer?.player_id ?? null,
          position: sleeperPlayer?.position ?? null,
          publishedAt: item.publishedAt,
          source: item.source,
          sourceUrl: item.sourceUrl,
          summary: compactSummary(item.description),
          team: sleeperPlayer?.team ?? null,
          title: item.title
        };
      })
      .sort((left, right) => {
        const leftPlayerScore = left.playerId ? 2 : left.player ? 1 : 0;
        const rightPlayerScore = right.playerId ? 2 : right.player ? 1 : 0;
        const leftTime = left.publishedAt ? new Date(left.publishedAt).getTime() : 0;
        const rightTime = right.publishedAt ? new Date(right.publishedAt).getTime() : 0;

        return rightPlayerScore - leftPlayerScore || rightTime - leftTime;
      })
      .slice(0, 36);

    if (!items.length) {
      throw new Error("Player news feeds returned no stories.");
    }

    return NextResponse.json({
      feedUrls: NEWS_FEEDS.map((feed) => feed.url),
      fetchedAt: new Date().toISOString(),
      items,
      source: "Player news",
      sourceUrl: "https://www.rotowire.com/rss/"
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Player news failed" },
      { status: 502 }
    );
  }
}
