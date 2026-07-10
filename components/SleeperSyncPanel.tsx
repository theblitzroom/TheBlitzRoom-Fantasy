"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCcw, Radio, ShieldCheck } from "lucide-react";
import type { SleeperPick } from "@/lib/sleeper/client";

type SyncStatus = "idle" | "syncing" | "synced" | "error";

const STORAGE_KEY = "twobros-fantasy.sleeper-sync";
const POLL_MS = 1000;

type SavedSyncState = {
  draftId: string;
  enabled: boolean;
};

function readSavedState(): SavedSyncState {
  if (typeof window === "undefined") {
    return { draftId: "", enabled: false };
  }

  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) as SavedSyncState : { draftId: "", enabled: false };
  } catch {
    return { draftId: "", enabled: false };
  }
}

export function SleeperSyncPanel() {
  const [draftId, setDraftId] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [error, setError] = useState("");
  const [picks, setPicks] = useState<SleeperPick[]>([]);
  const lastPickNo = picks.reduce((max, pick) => Math.max(max, pick.pick_no ?? 0), 0);
  const inFlight = useRef<AbortController | null>(null);

  useEffect(() => {
    const saved = readSavedState();
    setDraftId(saved.draftId);
    setEnabled(saved.enabled);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ draftId, enabled }));
  }, [draftId, enabled]);

  const syncNow = useCallback(async () => {
    if (!draftId.trim()) {
      setStatus("error");
      setError("Enter a Sleeper draft ID to start live sync.");
      return;
    }

    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    setStatus("syncing");
    setError("");

    try {
      const response = await fetch(`/api/sleeper/draft/${encodeURIComponent(draftId.trim())}/picks`, {
        cache: "no-store",
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`Sleeper returned ${response.status}`);
      }

      const data = await response.json() as { picks: SleeperPick[] };
      const deduped = Array.from(new Map(data.picks.map((pick) => [pick.pick_no, pick])).values())
        .sort((a, b) => a.pick_no - b.pick_no);
      setPicks(deduped);
      setStatus("synced");
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") {
        return;
      }

      setStatus("error");
      setError(caught instanceof Error ? caught.message : "Sync failed");
    }
  }, [draftId]);

  useEffect(() => {
    if (!enabled) {
      inFlight.current?.abort();
      setStatus("idle");
      return;
    }

    void syncNow();
    const interval = window.setInterval(() => {
      void syncNow();
    }, POLL_MS);

    return () => {
      window.clearInterval(interval);
      inFlight.current?.abort();
    };
  }, [enabled, syncNow]);

  return (
    <div className="sync-panel">
      <div className="sync-panel-header">
        <div>
          <span className="eyebrow">Sleeper live sync</span>
          <h2>Official read-only draft sync</h2>
        </div>
        <span className={`sync-status sync-status-${status}`}>
          <Radio size={14} />
          {status}
        </span>
      </div>

      <div className="sync-controls">
        <label>
          <span>Sleeper draft ID</span>
          <input
            value={draftId}
            onChange={(event) => setDraftId(event.target.value)}
            placeholder="Paste draft ID"
            autoComplete="off"
          />
        </label>
        <button className="premium-button premium-button-secondary" onClick={() => setEnabled((value) => !value)}>
          {enabled ? "Pause sync" : "Start 1s sync"}
        </button>
        <button className="premium-button premium-button-primary" onClick={() => void syncNow()}>
          <RefreshCcw size={16} />
          Sync now
        </button>
      </div>

      <div className="sync-stat-row">
        <span><strong>{POLL_MS / 1000}s</strong><small>Poll rate</small></span>
        <span><strong>{lastPickNo || "-"}</strong><small>Last pick</small></span>
        <span><strong>{picks.length}</strong><small>Synced picks</small></span>
      </div>

      {error ? <p className="sync-error">{error}</p> : null}

      <div className="data-card">
        <div className="card-title">
          <ShieldCheck size={18} />
          Recent picks
        </div>
        <table>
          <thead>
            <tr><th>Pick</th><th>Player</th><th>Pos</th><th>Team</th></tr>
          </thead>
          <tbody>
            {picks.slice(-8).reverse().map((pick) => (
              <tr key={pick.pick_no}>
                <td>{pick.pick_no}</td>
                <td>{[pick.metadata?.first_name, pick.metadata?.last_name].filter(Boolean).join(" ") || pick.player_id || "Unknown"}</td>
                <td>{pick.metadata?.position ?? "-"}</td>
                <td>{pick.metadata?.team ?? "-"}</td>
              </tr>
            ))}
            {!picks.length ? (
              <tr>
                <td colSpan={4}>No Sleeper picks synced yet.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
