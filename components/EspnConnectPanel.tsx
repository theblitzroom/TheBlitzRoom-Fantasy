"use client";

import { useState } from "react";
import type { FormEvent } from "react";

type EspnConnectPanelProps = {
  defaultLeagueId?: string | null;
  defaultSeason?: string | null;
  defaultPrivate?: boolean;
};

export function EspnConnectPanel({ defaultLeagueId, defaultSeason, defaultPrivate = false }: EspnConnectPanelProps) {
  const [leagueId, setLeagueId] = useState(defaultLeagueId ?? "");
  const [season, setSeason] = useState(defaultSeason ?? String(new Date().getFullYear()));
  const [isPrivate, setIsPrivate] = useState(defaultPrivate);
  const [swid, setSwid] = useState("");
  const [espnS2, setEspnS2] = useState("");
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
        body: JSON.stringify({
          leagueId,
          season,
          isPrivate,
          swid: swid.trim() || undefined,
          espnS2: espnS2.trim() || undefined
        })
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
      <label className="account-private-toggle">
        <input
          checked={isPrivate}
          onChange={(event) => setIsPrivate(event.target.checked)}
          type="checkbox"
        />
        <span>Private league</span>
      </label>
      {isPrivate ? (
        <div className="account-private-fields">
          <p>
            ESPN private leagues need your `SWID` and `espn_s2` values from your own logged-in ESPN browser session. We never ask for your ESPN password.
            {defaultPrivate ? " Leave these blank to reuse the encrypted values already saved." : ""}
          </p>
          <label>
            <span>SWID</span>
            <input
              autoComplete="off"
              onChange={(event) => setSwid(event.target.value)}
              placeholder="{XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX}"
              value={swid}
            />
          </label>
          <label>
            <span>espn_s2</span>
            <input
              autoComplete="off"
              onChange={(event) => setEspnS2(event.target.value)}
              placeholder="Paste espn_s2 value"
              type="password"
              value={espnS2}
            />
          </label>
        </div>
      ) : null}
      {message ? <p className="auth-message">{message}</p> : null}
      {error ? <p className="sync-error">{error}</p> : null}
    </form>
  );
}
