import http from "node:http";

const PORT = Number(process.env.PORT ?? 8787);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-4.1";
const WEB_TOOL_TYPE = process.env.OPENAI_WEB_TOOL ?? "web_search_preview";
const MAX_BODY_BYTES = 1_000_000;
const LIVE_FEED_TIMEOUT_MS = Number(process.env.LIVE_FEED_TIMEOUT_MS ?? 4500);
const X_BEARER_TOKEN = process.env.X_BEARER_TOKEN ?? process.env.TWITTER_BEARER_TOKEN ?? "";
const ADVISOR_FEEDS = parseList(process.env.ADVISOR_FEEDS ?? process.env.ADVISOR_LIVE_FEEDS ?? "");
const ROTOWIRE_NFL_NEWS_URL = process.env.ROTOWIRE_NFL_NEWS_URL ?? "https://www.rotowire.com/football/news.php";

const server = http.createServer(async (request, response) => {
  setCors(response);
  const url = new URL(request.url, `http://${request.headers.host ?? "localhost"}`);

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  if (request.method === "GET" && url.pathname === "/health") {
    sendJson(response, 200, {
      ok: true,
      model: OPENAI_MODEL,
      webTool: WEB_TOOL_TYPE,
      hasOpenAIKey: Boolean(OPENAI_API_KEY),
      xFeedEnabled: Boolean(X_BEARER_TOKEN),
      configuredFeeds: ADVISOR_FEEDS.length,
      rotowireNewsUrl: ROTOWIRE_NFL_NEWS_URL
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/news-impact") {
    try {
      const payload = JSON.parse(await readBody(request));
      const newsImpact = await getNewsImpact(payload);
      sendJson(response, 200, newsImpact);
    } catch (error) {
      sendJson(response, 500, {
        error: error.message || String(error)
      });
    }
    return;
  }

  if (request.method !== "POST" || url.pathname !== "/advice") {
    sendJson(response, 404, { error: "Use POST /advice, POST /news-impact, or GET /health." });
    return;
  }

  if (!OPENAI_API_KEY) {
    sendJson(response, 503, {
      error: "Live web check needs OPENAI_API_KEY in the terminal running advisor-server/server.js."
    });
    return;
  }

  try {
    const payload = JSON.parse(await readBody(request));
    const advice = await getWebAdvice(payload);
    sendJson(response, 200, advice);
  } catch (error) {
    sendJson(response, 500, {
      error: error.message || String(error)
    });
  }
});

server.listen(PORT, () => {
  console.log(`The Blitz Room server listening on http://localhost:${PORT}/advice`);
});

async function getWebAdvice(payload) {
  const liveFeed = await collectLiveFeed(payload);
  const openAiPayload = {
    model: OPENAI_MODEL,
    tools: [
      {
        type: WEB_TOOL_TYPE,
        search_context_size: "medium"
      }
    ],
    input: [
      {
        role: "developer",
        content: buildDeveloperPrompt()
      },
      {
        role: "user",
        content: JSON.stringify({
          ...payload,
          liveFeed
        })
      }
    ]
  };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      authorization: `Bearer ${OPENAI_API_KEY}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(openAiPayload)
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message ?? `${response.status} ${response.statusText}`);
  }

  const text = extractText(data);
  const parsed = parseJsonAdvice(text);
  const citations = collectCitations(data);

  return {
    ...parsed,
    model: OPENAI_MODEL,
    generatedAt: new Date().toISOString(),
    liveFeedStatus: liveFeed.status,
    liveFeedItems: liveFeed.items.slice(0, 8),
    citations: mergeCitations(
      parsed.citations ?? [],
      citations,
      liveFeed.items.map((item) => ({
        label: item.label ?? item.source ?? hostLabel(item.url),
        url: item.url
      }))
    )
  };
}

async function getNewsImpact(payload) {
  const liveFeed = await collectLiveFeed(payload);
  const evidenceItems = liveFeed.items
    .map((item) => newsItemToEvidence(item, payload))
    .filter(Boolean);

  return {
    updatedAt: new Date().toISOString(),
    liveFeedStatus: liveFeed.status,
    items: liveFeed.items.slice(0, 12),
    adjustments: evidenceItems.map((item) => ({
      name: item.name,
      sentiment: item.sentiment,
      weight: item.weight,
      summary: item.summary,
      source: item.source,
      url: item.url
    })),
    evidence: {
      updatedAt: new Date().toISOString(),
      items: evidenceItems
    }
  };
}

async function collectLiveFeed(payload) {
  const candidateNames = candidateNamesFromPayload(payload);
  const [rotowireResult, xResult, feedResult] = await Promise.all([
    fetchRotowireSignals(candidateNames).catch((error) => ({
      enabled: true,
      items: [],
      error: error.message || String(error)
    })),
    fetchXSignals(candidateNames).catch((error) => ({
      enabled: Boolean(X_BEARER_TOKEN),
      items: [],
      error: error.message || String(error)
    })),
    fetchConfiguredFeeds(candidateNames).catch((error) => ({
      enabled: ADVISOR_FEEDS.length > 0,
      items: [],
      error: error.message || String(error)
    }))
  ]);

  const items = [...rotowireResult.items, ...xResult.items, ...feedResult.items]
    .filter((item) => item?.url)
    .slice(0, 16);

  return {
    status: buildLiveFeedStatus({ rotowireResult, xResult, feedResult, itemCount: items.length }),
    searchedPlayers: candidateNames,
    items
  };
}

function candidateNamesFromPayload(payload) {
  const names = [];
  const candidates = [payload?.selectedCandidate, ...(payload?.topCandidates ?? [])];
  for (const candidate of candidates) {
    const name = String(candidate?.name ?? "").trim();
    if (name && !names.includes(name)) {
      names.push(name);
    }
  }
  return names.slice(0, 12);
}

function buildLiveFeedStatus({ rotowireResult, xResult, feedResult, itemCount }) {
  const parts = ["Current public news feeds checked"];
  if (rotowireResult.enabled) {
    parts.push(rotowireResult.error ? "RotoWire news unavailable" : `RotoWire news checked${rotowireResult.items.length ? ` (${rotowireResult.items.length} matches)` : ""}`);
  }
  if (xResult.enabled) {
    parts.push(xResult.error ? "X feed configured but unavailable" : `X feed checked${xResult.items.length ? ` (${xResult.items.length} matches)` : ""}`);
  } else {
    parts.push("X feed not configured");
  }

  if (feedResult.enabled) {
    parts.push(feedResult.error ? "custom feeds configured but unavailable" : `custom feeds checked${feedResult.items.length ? ` (${feedResult.items.length} matches)` : ""}`);
  } else {
    parts.push("custom feeds not configured");
  }

  parts.push(`${itemCount} direct feed match${itemCount === 1 ? "" : "es"}`);
  return `Live context: ${parts.join("; ")}.`;
}

async function fetchRotowireSignals(candidateNames) {
  if (!candidateNames.length) {
    return { enabled: true, items: [] };
  }

  const response = await fetchWithTimeout(ROTOWIRE_NFL_NEWS_URL, {
    headers: {
      accept: "text/html,application/xhtml+xml"
    }
  });
  if (!response.ok) {
    throw new Error(`RotoWire returned ${response.status}`);
  }

  const html = await response.text();
  const text = htmlToLines(html);
  const items = [];

  for (const candidateName of candidateNames) {
    const matchIndex = text.findIndex((line) => normalizeName(line).includes(normalizeName(candidateName)));
    if (matchIndex < 0) {
      continue;
    }

    const windowText = text.slice(matchIndex, Math.min(text.length, matchIndex + 9)).join(" ");
    const sentiment = scoreNewsText(windowText);
    items.push({
      source: "RotoWire",
      label: "RotoWire NFL News",
      url: ROTOWIRE_NFL_NEWS_URL,
      title: text[matchIndex + 1] && !normalizeName(text[matchIndex + 1]).includes(normalizeName(candidateName))
        ? text[matchIndex + 1]
        : "Latest RotoWire player news",
      summary: windowText,
      publishedAt: findDateInText(windowText),
      player: candidateName,
      sentiment: sentiment.sentiment,
      weight: sentiment.weight
    });
  }

  return {
    enabled: true,
    items
  };
}

function newsItemToEvidence(item, payload) {
  if (!item?.player) {
    return null;
  }

  const candidates = [payload?.selectedCandidate, ...(payload?.topCandidates ?? [])];
  const candidate = candidates.find((entry) => normalizeName(entry?.name) === normalizeName(item.player));
  const scored = item.sentiment ? item : scoreNewsItem(item);
  return {
    playerId: candidate?.playerId ?? null,
    name: item.player,
    weight: scored.weight,
    sentiment: scored.sentiment,
    summary: `${item.source ?? "Live news"}: ${summarizeNews(item.summary || item.title || "")}`,
    url: item.url,
    source: item.source ?? item.label ?? hostLabel(item.url)
  };
}

function scoreNewsItem(item) {
  return scoreNewsText(`${item.title ?? ""} ${item.summary ?? ""}`);
}

function scoreNewsText(value) {
  const text = String(value ?? "").toLowerCase();
  const negativePatterns = [
    /injur/, /knee/, /hamstring/, /ankle/, /shoulder/, /surgery/, /out\b/, /doubtful/, /questionable/,
    /limited/, /eased/, /managed/, /miss/, /absence/, /holdout/, /contract dispute/, /suspend/,
    /competition/, /backup/, /bench/, /release/, /cut\b/, /setback/, /not expected/
  ];
  const positivePatterns = [
    /clear(ed)?/, /full(y)? participant/, /starting/, /starter/, /lead/, /featured/, /first-team/,
    /healthy/, /return/, /expected to play/, /on track/, /impress/, /strong/, /extension/,
    /sign(ed|s)?/, /increased/, /workload/, /target/, /touches/
  ];

  let score = 0;
  for (const pattern of negativePatterns) {
    if (pattern.test(text)) score -= 1;
  }
  for (const pattern of positivePatterns) {
    if (pattern.test(text)) score += 1;
  }

  if (score < 0) {
    return { sentiment: "negative", weight: Math.min(4, Math.max(1, Math.abs(score))) };
  }
  return { sentiment: "positive", weight: Math.min(4, Math.max(1, score || 1)) };
}

function htmlToLines(html) {
  return stripHtml(
    String(html ?? "")
      .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/a)>/gi, "\n")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
  )
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 1);
}

function findDateInText(value) {
  return String(value ?? "").match(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},\s+\d{4}\b|\b\d{4}-\d{2}-\d{2}\b/i)?.[0] ?? "";
}

function summarizeNews(value) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > 220 ? `${text.slice(0, 217)}...` : text;
}

async function fetchXSignals(candidateNames) {
  if (!X_BEARER_TOKEN || !candidateNames.length) {
    return { enabled: false, items: [] };
  }

  const quotedNames = candidateNames
    .slice(0, 4)
    .map((name) => `"${name.replace(/"/g, "")}"`)
    .join(" OR ");
  const query = `(${quotedNames}) (fantasy OR draft OR injury OR camp OR role OR targets OR touches) lang:en -is:retweet`;
  const url = new URL("https://api.twitter.com/2/tweets/search/recent");
  url.searchParams.set("query", query);
  url.searchParams.set("max_results", "10");
  url.searchParams.set("tweet.fields", "created_at,author_id");
  url.searchParams.set("expansions", "author_id");
  url.searchParams.set("user.fields", "username,name");

  const data = await fetchJsonWithTimeout(url, {
    headers: {
      authorization: `Bearer ${X_BEARER_TOKEN}`
    }
  });
  const users = new Map(
    (data.includes?.users ?? []).map((user) => [String(user.id), user])
  );

  return {
    enabled: true,
    items: (data.data ?? [])
      .map((tweet) => {
        const user = users.get(String(tweet.author_id)) ?? {};
        const username = user.username ? String(user.username) : "";
        const matchedPlayer = findMatchedCandidate(tweet.text, candidateNames);
        return {
          source: "X",
          label: username ? `@${username}` : "X post",
          url: username ? `https://x.com/${username}/status/${tweet.id}` : `https://x.com/i/web/status/${tweet.id}`,
          title: username ? `X post by @${username}` : "X post",
          summary: tweet.text,
          publishedAt: tweet.created_at ?? "",
          player: matchedPlayer
        };
      })
      .filter((item) => item.player)
  };
}

async function fetchConfiguredFeeds(candidateNames) {
  if (!ADVISOR_FEEDS.length || !candidateNames.length) {
    return { enabled: false, items: [] };
  }

  const results = await Promise.allSettled(
    ADVISOR_FEEDS.map(async (feedUrl) => {
      const response = await fetchWithTimeout(feedUrl);
      if (!response.ok) {
        throw new Error(`${hostLabel(feedUrl)} returned ${response.status}`);
      }
      const text = await response.text();
      return parseFeedItems(text, feedUrl, candidateNames);
    })
  );
  const items = results
    .filter((result) => result.status === "fulfilled")
    .flatMap((result) => result.value);
  const errors = results
    .filter((result) => result.status === "rejected")
    .map((result) => result.reason?.message || String(result.reason));

  return {
    enabled: true,
    items: items.slice(0, 16),
    error: errors.length === ADVISOR_FEEDS.length ? errors.join("; ") : ""
  };
}

function parseFeedItems(xml, feedUrl, candidateNames) {
  const blocks = xml.match(/<item\b[\s\S]*?<\/item>|<entry\b[\s\S]*?<\/entry>/gi) ?? [];
  return blocks
    .map((block) => {
      const title = readXmlTag(block, "title");
      const summary = stripHtml(
        readXmlTag(block, "description") ||
        readXmlTag(block, "summary") ||
        readXmlTag(block, "content") ||
        readXmlTag(block, "content:encoded")
      );
      const link =
        readXmlTag(block, "link") ||
        (block.match(/<link\b[^>]*href=["']([^"']+)["']/i)?.[1] ?? "");
      const matchedPlayer = findMatchedCandidate(`${title} ${summary}`, candidateNames);
      return {
        source: hostLabel(feedUrl),
        label: hostLabel(link || feedUrl),
        url: link || feedUrl,
        title,
        summary,
        publishedAt: readXmlTag(block, "pubDate") || readXmlTag(block, "updated") || readXmlTag(block, "published"),
        player: matchedPlayer
      };
    })
    .filter((item) => item.player && item.url);
}

function findMatchedCandidate(text, candidateNames) {
  const normalized = normalizeName(text);
  return candidateNames.find((name) => normalized.includes(normalizeName(name))) ?? "";
}

async function fetchJsonWithTimeout(url, options = {}) {
  const response = await fetchWithTimeout(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || data.title || data.error || `${response.status} ${response.statusText}`);
  }
  return data;
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LIVE_FEED_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

function buildDeveloperPrompt() {
  const today = new Date().toISOString().slice(0, 10);
  return [
    "You are a fantasy football draft analyst for a live Sleeper draft.",
    `Today is ${today}. Search the current web before making claims about rankings, draft cost, injuries, camp/news, projected role, or public sentiment.`,
    "Use the included local 1-100 value scores as the baseline, then verify or challenge them with current public information.",
    "Include a few current public-discussion signals when available: fantasy analyst posts, beat-writer chatter, X/Twitter posts, Reddit/fantasy community discussion, podcast/show notes, or other public social sentiment. Do not invent social sentiment; if the search is thin, say so.",
    "Recommend the best selection by balancing best player available, roster construction, league settings, positional scarcity, current rankings, credible news, and public fantasy sentiment.",
    "Every candidate note must be specific to that player: team/offense, projected fantasy PPG/season projection when available, last-season production as a reference point, QB status or health only when there is an injury/status concern, the player's own injury/news context, and why that changes this exact pick.",
    "In dynasty drafts, age and career arc matter much more than in redraft; explain whether the player is gaining long-term value, losing long-term value, or mostly a win-now pick.",
    "Do not reuse the same sentence structure across candidates. Avoid generic lines like 'highest ranked player available' unless you immediately explain the player-specific football reason.",
    "Do not say a player is best only because of team need. Explain why current evidence supports or weakens the pick.",
    "Do not chase viral hype unless roster fit, board value, and credible football context also support it.",
    "Prefer recent, reputable fantasy football, beat writer, team, injury, projection, ranking, last-season stats, and public discussion sources. Treat unsourced viral claims as weak signals.",
    "Return compact JSON only with this shape:",
    "{",
    "  \"recommendedPlayerId\": \"string or null\",",
    "  \"recommendedName\": \"string\",",
    "  \"summary\": \"2-4 sentence recommendation\",",
    "  \"candidateNotes\": [",
    "    {",
    "      \"name\": \"string\",",
    "      \"verdict\": \"string\",",
    "      \"bullets\": [\"player-specific reason using projection/PPG, last-year stats, role/team/QB health/news/fit, including current sentiment when useful\"],",
    "      \"citations\": [{\"label\":\"source name\", \"url\":\"https://...\"}]",
    "    }",
    "  ],",
    "  \"citations\": [{\"label\":\"source name\", \"url\":\"https://...\"}]",
    "}",
    "If current evidence is thin, say that plainly and lean on the local draft engine."
  ].join("\n");
}

function parseJsonAdvice(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        // Fall through to raw text.
      }
    }
  }

  return {
    recommendedPlayerId: null,
    recommendedName: "",
    summary: "The advisor returned text instead of JSON.",
    raw: text,
    candidateNotes: []
  };
}

function extractText(data) {
  if (data.output_text) {
    return data.output_text;
  }

  const chunks = [];
  for (const item of data.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.text) {
        chunks.push(content.text);
      }
    }
  }
  return chunks.join("\n").trim();
}

function collectCitations(value, results = []) {
  if (!value || typeof value !== "object") {
    return results;
  }

  if (typeof value.url === "string") {
    results.push({
      label: value.title ?? value.source ?? hostLabel(value.url),
      url: value.url
    });
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectCitations(item, results);
    }
  } else {
    for (const item of Object.values(value)) {
      collectCitations(item, results);
    }
  }

  return results;
}

function mergeCitations(...sets) {
  const seen = new Set();
  const citations = [];
  for (const set of sets.flat()) {
    if (!set?.url || seen.has(set.url)) {
      continue;
    }
    seen.add(set.url);
    citations.push({
      label: set.label ?? hostLabel(set.url),
      url: set.url
    });
  }
  return citations.slice(0, 12);
}

function hostLabel(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Source";
  }
}

function parseList(value) {
  return String(value ?? "")
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function readXmlTag(block, tag) {
  const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = block.match(new RegExp(`<${escapedTag}\\b[^>]*>([\\s\\S]*?)<\\/${escapedTag}>`, "i"));
  if (!match) {
    return "";
  }
  return decodeXml(match[1]).trim();
}

function decodeXml(value) {
  return String(value ?? "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function stripHtml(value) {
  return decodeXml(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeName(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(jr|sr|ii|iii|iv|v)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      size += Buffer.byteLength(chunk);
      if (size > MAX_BODY_BYTES) {
        reject(new Error("Request body is too large."));
        request.destroy();
        return;
      }
      body += chunk;
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function setCors(response) {
  response.setHeader("access-control-allow-origin", "*");
  response.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
  response.setHeader("access-control-allow-headers", "content-type");
}

function sendJson(response, status, value) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(value));
}
