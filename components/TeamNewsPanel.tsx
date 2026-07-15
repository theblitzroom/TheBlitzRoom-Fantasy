"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Newspaper, RefreshCcw } from "lucide-react";
import { TeamIdentity } from "@/components/FootballIdentity";

type TeamNewsPlayer = {
  name: string;
  position?: string;
  team?: string;
};

type NewsItem = {
  id: string;
  title: string;
  player: string;
  imageUrl: string | null;
  position: string | null;
  team: string | null;
  category: string;
  summary: string;
  publishedAt: string | null;
  source: string;
  sourceUrl: string;
};

type NewsResponse = {
  fetchedAt: string;
  source: string;
  sourceUrl: string;
  items: NewsItem[];
};

type TeamNewsPanelProps = {
  players: TeamNewsPlayer[];
};

type EnrichedNewsItem = NewsItem & {
  rosterMatch: boolean;
};

function normalizeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function formatNewsTime(value: string | null) {
  if (!value) {
    return "Recently";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Recently";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "NFL";
}

export function TeamNewsPanel({ players }: TeamNewsPanelProps) {
  const [news, setNews] = useState<NewsResponse | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState("");
  const [showRosterOnly, setShowRosterOnly] = useState(false);

  const rosterNameLookup = useMemo(() => {
    return new Set(players.map((player) => normalizeName(player.name)).filter(Boolean));
  }, [players]);

  const fetchNews = useCallback(async () => {
    setStatus("loading");
    setError("");

    try {
      const response = await fetch("/api/news/rotowire-nfl", { cache: "no-store" });

      if (!response.ok) {
        throw new Error("Player news feed is temporarily unavailable.");
      }

      const data = await response.json() as NewsResponse;
      setNews(data);
      setStatus("ready");
    } catch (caught) {
      setStatus("error");
      setError(caught instanceof Error ? caught.message : "News feed failed.");
    }
  }, []);

  useEffect(() => {
    void fetchNews();
    const interval = window.setInterval(() => {
      void fetchNews();
    }, 5 * 60 * 1000);

    return () => window.clearInterval(interval);
  }, [fetchNews]);

  const enrichedItems = useMemo(() => {
    return (news?.items ?? []).map((item) => ({
      ...item,
      rosterMatch: item.player ? rosterNameLookup.has(normalizeName(item.player)) : false
    }));
  }, [news?.items, rosterNameLookup]);
  const rosterItems = enrichedItems.filter((item) => item.rosterMatch);
  const hasRosterFilter = players.length > 0;
  const visibleItems = hasRosterFilter && showRosterOnly && rosterItems.length ? rosterItems : enrichedItems;
  const latestItems = visibleItems.slice(0, 18);
  const shouldAnimateNews = latestItems.length > 1;
  const tickerStyle = useMemo(() => ({
    "--team-news-ticker-duration": `${Math.min(108, Math.max(6, latestItems.length * 6))}s`
  }) as CSSProperties, [latestItems.length]);

  const renderNewsItem = (item: EnrichedNewsItem, duplicate = false) => (
    <article
      aria-hidden={duplicate ? true : undefined}
      className={item.rosterMatch ? "team-news-strip-item roster-match" : "team-news-strip-item"}
      key={`${duplicate ? "copy" : "item"}-${item.id}`}
      role={duplicate ? "presentation" : "listitem"}
    >
      <div className="team-news-photo" aria-hidden="true">
        {item.imageUrl ? <span style={{ backgroundImage: `url(${item.imageUrl})` }} /> : <em>{initials(item.player || item.title)}</em>}
      </div>
      <div className="team-news-strip-copy">
        <div className="team-news-strip-meta">
          <span>{item.player || item.category}</span>
          <time>{formatNewsTime(item.publishedAt)}</time>
          {item.position ? (
            <small>
              <b>{item.position}</b>
              {item.team ? <TeamIdentity team={item.team} compact /> : null}
            </small>
          ) : null}
        </div>
        <a href={item.sourceUrl} tabIndex={duplicate ? -1 : undefined} target="_blank" rel="noreferrer">{item.title}</a>
      </div>
    </article>
  );

  return (
    <section className="team-news-strip" aria-label="Player news">
      <div className="team-news-strip-label">
        <Newspaper size={16} />
        <div>
          <strong>Player news</strong>
        </div>
      </div>

      <div className="team-news-strip-scroll" role="list">
        {latestItems.length ? (
          <div className={shouldAnimateNews ? "team-news-strip-track" : "team-news-strip-track static"} key={showRosterOnly ? "my-team-news" : "all-news"} style={tickerStyle}>
            <div className="team-news-strip-group">
              {latestItems.map((item) => renderNewsItem(item))}
            </div>
            {shouldAnimateNews ? (
              <div aria-hidden="true" className="team-news-strip-group">
                {latestItems.map((item) => renderNewsItem(item, true))}
              </div>
            ) : null}
          </div>
        ) : null}

        {status === "error" ? (
          <div className="team-news-strip-item team-news-strip-empty" role="listitem">
            <div className="team-news-photo"><em>NFL</em></div>
            <div className="team-news-strip-copy">
              <strong>News feed paused</strong>
              <p>{error}</p>
            </div>
          </div>
        ) : null}

        {status === "loading" && !latestItems.length ? (
          <div className="team-news-strip-item team-news-strip-empty" role="listitem">
            <div className="team-news-photo"><em>NFL</em></div>
            <div className="team-news-strip-copy">
              <strong>Loading player news</strong>
              <p>Checking the latest NFL player updates.</p>
            </div>
          </div>
        ) : null}
      </div>

      <div className="team-news-strip-actions">
        {hasRosterFilter ? (
          <button className={showRosterOnly ? "active" : ""} onClick={() => setShowRosterOnly(true)} type="button">
            My Team
          </button>
        ) : null}
        <button className={!showRosterOnly ? "active" : ""} onClick={() => setShowRosterOnly(false)} type="button">
          All
        </button>
        <button disabled={status === "loading"} onClick={() => void fetchNews()} type="button" aria-label="Refresh player news">
          <RefreshCcw size={14} />
        </button>
      </div>
    </section>
  );
}
