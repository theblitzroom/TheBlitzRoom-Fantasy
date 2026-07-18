"use client";

import { useState } from "react";
import type { FormEvent } from "react";

type EspnConnectPanelProps = {
  defaultLeagueId?: string | null;
  defaultSeason?: string | null;
};

export function EspnConnectPanel({ defaultLeagueId, defaultSeason }: EspnConnectPanelProps) {
  const [leagueId, setLeagueId] = useState(defaultLeagueId ?? "");
  const [season, setSeason] = useState(defaultSeason ?? String(new Date().getFullYear()));
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/platforms/espn/connect", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ leagueId, season })
      });
      const payload = await response.json() as { connected?: boolean; error?: string; league?: { name?: string } };

      if (!response.ok || !payload.connected) {
        throw new Error(payload.error ?? "ESPN league could not be connected.");
      }

      setMessage(`${payload.league?.name ?? "ESPN league"} connected.`);
      window.location.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "ESPN league could not be connected.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="league-connect-form account-platform-form" onSubmit={submit}>
      <label>
        <span>ESPN League ID</span>
        <input
          inputMode="numeric"
          onChange={(event) => setLeagueId(event.target.value)}
          placeholder="123456789"
          required
          value={leagueId}
        />
      </label>
      <label>
        <span>Season</span>
        <input
          inputMode="numeric"
          maxLength={4}
          onChange={(event) => setSeason(event.target.value)}
          placeholder="2026"
          required
          value={season}
        />
      </label>
      <button className="premium-button premium-button-primary" disabled={loading} type="submit">
        {loading ? "Checking..." : defaultLeagueId ? "Update ESPN" : "Connect ESPN"}
      </button>
      {message ? <p className="auth-message">{message}</p> : null}
      {error ? <p className="sync-error">{error}</p> : null}
    </form>
  );
}
