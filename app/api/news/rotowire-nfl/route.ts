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

const NBC_PLAYER_NEWS_URL = "https://www.nbcsports.com/fantasy/football/player-news";
const FANTASY_NEWS_POSITIONS = new Set(["QB", "RB", "WR", "TE"]);
const NEWS_WINDOW_DAYS = 3;
const NEWS_WINDOW_MS = NEWS_WINDOW_DAYS * 24 * 60 * 60 * 1000;
const POSITION_LABELS: Record<string, string> = {
  Quarterback: "QB",
  "Running Back": "RB",
  "Tight End": "TE",
  "Wide Receiver": "WR"
};

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

type NewsFeed = (typeof NEWS_FEEDS)[number];
type NewsSourceId = NewsFeed["id"] | "nbc";

type ParsedNewsItem = {
  description: string;
  id: string;
  publishedAt: string | null;
  source: string;
  sourceId: NewsSourceId;
  sourceUrl: string;
  title: string;
  playerName?: string;
  position?: string;
  team?: string;
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

function stripTags(value: string) {
  return value.replace(/<[^>]*>/g, " ");
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/\u2019/g, "'")
    .replace(/\u2018/g, "'")
    .replace(/\u201c/g, "\"")
    .replace(/\u201d/g, "\"")
    .replace(/\u2013/g, "-")
    .replace(/\u2014/g, "-")
    .replace(/\u00e2\u0080\u0099/g, "'")
    .replace(/\u00e2\u0080\u0098/g, "'")
    .replace(/\u00e2\u0080\u009c/g, "\"")
    .replace(/\u00e2\u0080\u009d/g, "\"")
    .replace(/\u00e2\u0080\u0093/g, "-")
    .replace(/\u00e2\u0080\u0094/g, "-")
    .replace(/\u00e2\u20ac\u2122/g, "'")
    .replace(/\u00e2\u20ac\u02dc/g, "'")
    .replace(/\u00e2\u20ac\u0153/g, "\"")
    .replace(/\u00e2\u20ac\u009d/g, "\"")
    .replace(/\u00e2\u20ac\u201c/g, "-")
    .replace(/\u00e2\u20ac\u201d/g, "-")
    .replace(/\u00c2/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, "\"")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function cleanHtmlText(value: string) {
  return decodeHtmlEntities(stripTags(value)).replace(/\s+/g, " ").trim();
}

function parseNewsDate(value?: unknown) {
  const rawDate = cleanText(value);

  if (!rawDate) {
    return null;
  }

  const date = new Date(rawDate);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function isWithinNewsWindow(value: string | null) {
  if (!value) {
    return false;
  }

  const publishedAt = new Date(value).getTime();

  if (Number.isNaN(publishedAt)) {
    return false;
  }

  return publishedAt >= Date.now() - NEWS_WINDOW_MS;
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

function playerFromTitle(title: string, sourceId: NewsSourceId) {
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

  return asArray(channel?.item)
    .slice(0, 24)
    .map((item) => {
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
    })
    .filter((item) => item.title);
}

function matchHtml(value: string, pattern: RegExp) {
  return pattern.exec(value)?.[1] ?? "";
}

function parseNbcPlayerNewsHtml(html: string): ParsedNewsItem[] {
  const blocks = html.match(/<li class="PlayerNewsModuleList-item">[\s\S]*?(?=<li class="PlayerNewsModuleList-item">|<\/ul>)/g) ?? [];

  return blocks
    .map((block) => {
      const firstName = cleanHtmlText(matchHtml(block, /<span class="PlayerNewsPost-firstName">([\s\S]*?)<\/span>/));
      const lastName = cleanHtmlText(matchHtml(block, /<span class="PlayerNewsPost-lastName">([\s\S]*?)<\/span>/));
      const playerName = [firstName, lastName].filter(Boolean).join(" ");
      const positionLabel = cleanHtmlText(matchHtml(block, /<span class="PlayerNewsPost-position">([\s\S]*?)<\/span>/));
      const position = POSITION_LABELS[positionLabel] ?? "";
      const team = cleanHtmlText(matchHtml(block, /<span class="PlayerNewsPost-team-abbr">([\s\S]*?)<\/span>/));
      const title = cleanHtmlText(matchHtml(block, /<h3 class="PlayerNewsPost-headline">([\s\S]*?)<\/h3>/));
      const description = cleanHtmlText(matchHtml(block, /<div class="PlayerNewsPost-analysis">([\s\S]*?)<div class="PlayerNewsPost-author">/));
      const publishedAt = parseNewsDate(matchHtml(block, /data-date="([^"]+)"/));
      const shareUrl = decodeHtmlEntities(matchHtml(block, /data-share-url="([^"]+)"/));

      return {
        description,
        id: `nbc-${shareUrl || playerName}-${publishedAt || title}`,
        playerName,
        position,
        publishedAt,
        source: "NBC Sports",
        sourceId: "nbc" as const,
        sourceUrl: shareUrl || NBC_PLAYER_NEWS_URL,
        team,
        title
      };
    })
    .filter((item) => item.playerName && item.position && item.title);
}

async function fetchNbcPlayerNews(): Promise<ParsedNewsItem[]> {
  const response = await fetch(NBC_PLAYER_NEWS_URL, {
    headers: {
      Accept: "text/html",
      "User-Agent": "TheBlitzRoomFantasy/1.0"
    },
    next: { revalidate: 300 }
  });

  if (!response.ok) {
    throw new Error(`NBC Sports player news returned ${response.status}`);
  }

  return parseNbcPlayerNewsHtml(await response.text());
}

export async function GET() {
  try {
    const playerLookup = await getPlayerPhotoLookup();
    const feedResults = await Promise.allSettled([
      ...NEWS_FEEDS.map((feed) => fetchNewsFeed(feed)),
      fetchNbcPlayerNews()
    ]);
    const rawItems = feedResults.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
    const seenTitles = new Set<string>();
    const items = rawItems
      .sort((left, right) => {
        const leftTime = left.publishedAt ? new Date(left.publishedAt).getTime() : 0;
        const rightTime = right.publishedAt ? new Date(right.publishedAt).getTime() : 0;
        return rightTime - leftTime;
      })
      .filter((item) => {
        const key = normalizeName(item.title);

        if (!key || seenTitles.has(key) || !isWithinNewsWindow(item.publishedAt)) {
          return false;
        }

        seenTitles.add(key);
        return true;
      })
      .map((item) => {
        const preferredPlayerName = item.playerName || playerFromTitle(item.title, item.sourceId);
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
          position: sleeperPlayer?.position ?? item.position ?? null,
          publishedAt: item.publishedAt,
          source: item.source,
          sourceUrl: item.sourceUrl,
          summary: compactSummary(item.description),
          team: sleeperPlayer?.team ?? item.team ?? null,
          title: item.title
        };
      })
      .filter((item) => item.playerId)
      .sort((left, right) => {
        const leftTime = left.publishedAt ? new Date(left.publishedAt).getTime() : 0;
        const rightTime = right.publishedAt ? new Date(right.publishedAt).getTime() : 0;

        return rightTime - leftTime;
      })
      .slice(0, 36);

    if (!items.length) {
      throw new Error(`Player news feeds returned no fantasy player stories from the last ${NEWS_WINDOW_DAYS} days.`);
    }

    return NextResponse.json({
      dateWindowDays: NEWS_WINDOW_DAYS,
      feedUrls: [...NEWS_FEEDS.map((feed) => feed.url), NBC_PLAYER_NEWS_URL],
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
