"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, Newspaper, Radio, RefreshCcw, Sparkles } from "lucide-react";

type TeamNewsPlayer = {
  name: string;
  position?: string;
  team?: string;
};

type NewsItem = {
  id: string;
  title: string;
  player: string;
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

function categoryClass(category: string) {
  return `team-news-category category-${category.toLowerCase()}`;
}

export function TeamNewsPanel({ players }: TeamNewsPanelProps) {
  const [news, setNews] = useState<NewsResponse | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState("");
  const [showRosterOnly, setShowRosterOnly] = useState(true);

  const rosterNameLookup = useMemo(() => {
    return new Set(players.map((player) => normalizeName(player.name)).filter(Boolean));
  }, [players]);

  const fetchNews = useCallback(async () => {
    setStatus("loading");
    setError("");

    try {
      const response = await fetch("/api/news/rotowire-nfl", { cache: "no-store" });

      if (!response.ok) {
        throw new Error("RotoWire news feed is temporarily unavailable.");
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
  const visibleItems = showRosterOnly && rosterItems.length ? rosterItems : enrichedItems;
  const latestItems = visibleItems.slice(0, 8);

  return (
    <section className="team-news-panel">
      <div className="league-card-header">
        <div>
          <span className="eyebrow">Live player news</span>
          <h2>RotoWire NFL updates</h2>
        </div>
        <span className={`team-news-status status-${status}`}>
          <Radio size={14} />
          {status === "loading" ? "Refreshing" : status === "error" ? "Issue" : "Live feed"}
        </span>
      </div>

      <div className="team-news-toolbar">
        <div className="team-news-source">
          <Newspaper size={16} />
          <span>Source: RotoWire public NFL RSS</span>
          <a href="https://www.rotowire.com/rss/" target="_blank" rel="noreferrer">Feed details <ExternalLink size={13} /></a>
        </div>
        <div className="team-news-actions">
          <button className={showRosterOnly ? "team-news-toggle active" : "team-news-toggle"} onClick={() => setShowRosterOnly(true)} type="button">
            Roster watch {rosterItems.length ? `(${rosterItems.length})` : ""}
          </button>
          <button className={!showRosterOnly ? "team-news-toggle active" : "team-news-toggle"} onClick={() => setShowRosterOnly(false)} type="button">
            All NFL
          </button>
          <button className="team-news-refresh" disabled={status === "loading"} onClick={() => void fetchNews()} type="button" aria-label="Refresh player news">
            <RefreshCcw size={15} />
          </button>
        </div>
      </div>

      {error ? (
        <div className="team-news-empty">
          <strong>News feed paused</strong>
          <span>{error}</span>
        </div>
      ) : null}

      {!error && showRosterOnly && !rosterItems.length && enrichedItems.length ? (
        <div className="team-news-empty">
          <Sparkles size={16} />
          <span>No direct roster hits right now, so showing the latest NFL fantasy updates.</span>
        </div>
      ) : null}

      <div className="team-news-list">
        {latestItems.map((item) => (
          <article className={item.rosterMatch ? "team-news-item roster-match" : "team-news-item"} key={item.id}>
            <div className="team-news-item-top">
              <span className={categoryClass(item.category)}>{item.category}</span>
              <time>{formatNewsTime(item.publishedAt)}</time>
            </div>
            <h3>{item.title}</h3>
            <p>{item.summary}</p>
            <div className="team-news-item-footer">
              {item.rosterMatch ? <span className="team-news-roster-pill">On roster</span> : <span>{item.player || "NFL update"}</span>}
              <a href={item.sourceUrl} target="_blank" rel="noreferrer">
                Read on RotoWire <ExternalLink size={13} />
              </a>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
