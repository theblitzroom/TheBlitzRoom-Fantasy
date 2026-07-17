"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, CircleAlert, ExternalLink, Gauge, PlugZap, RefreshCcw } from "lucide-react";

type ExtensionStatus = {
  ok?: boolean;
  name?: string;
  version?: string;
  activeDraftId?: string;
  activeDraftSlot?: string;
  activeSleeperUrl?: string;
  error?: string;
};

type BridgeState = "checking" | "connected" | "missing";

const SITE_SOURCE = "the-blitz-room-site";
const EXTENSION_SOURCE = "the-blitz-room-extension";

export function ExtensionConnectPanel() {
  const [bridgeState, setBridgeState] = useState<BridgeState>("checking");
  const [status, setStatus] = useState<ExtensionStatus | null>(null);
  const [panelMessage, setPanelMessage] = useState("");

  const statusCopy = useMemo(() => {
    if (bridgeState === "connected") {
      return {
        label: "Connected",
        detail: "The local extension is active on this website.",
        icon: CheckCircle2,
        className: "synced"
      };
    }

    if (bridgeState === "missing") {
      return {
        label: "Not detected",
        detail: "Reload the unpacked extension, then refresh this page.",
        icon: CircleAlert,
        className: "error"
      };
    }

    return {
      label: "Checking",
      detail: "Looking for the local Chrome extension bridge.",
      icon: RefreshCcw,
      className: "syncing"
    };
  }, [bridgeState]);

  useEffect(() => {
    let settled = false;
    let attempts = 0;
    const timers: number[] = [];

    function handleMessage(event: MessageEvent) {
      if (event.source !== window || event.data?.source !== EXTENSION_SOURCE) {
        return;
      }

      if (event.data.type === "EXTENSION_READY" || event.data.type === "EXTENSION_STATUS") {
        settled = true;
        setBridgeState("connected");
        setStatus({
          ok: event.data.ok,
          name: event.data.name,
          version: event.data.version,
          activeDraftId: event.data.activeDraftId,
          activeDraftSlot: event.data.activeDraftSlot,
          activeSleeperUrl: event.data.activeSleeperUrl,
          error: event.data.error
        });
      }

      if (event.data.type === "OPEN_EXTENSION_PANEL_RESULT") {
        setPanelMessage(event.data.ok ? "Extension panel opened." : event.data.error || "Chrome blocked the panel open. Click the extension icon instead.");
      }
    }

    function ping() {
      attempts += 1;
      window.postMessage({ source: SITE_SOURCE, type: "PING_EXTENSION" }, window.location.origin);

      if (!settled && attempts < 8) {
        timers.push(window.setTimeout(ping, 450));
      }
    }

    window.addEventListener("message", handleMessage);
    ping();
    timers.push(window.setTimeout(() => {
      if (!settled) {
        setBridgeState("missing");
      }
    }, 4200));

    return () => {
      window.removeEventListener("message", handleMessage);
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  function openExtensionPanel() {
    setPanelMessage("");
    window.postMessage({ source: SITE_SOURCE, type: "OPEN_EXTENSION_PANEL" }, window.location.origin);
  }

  const StatusIcon = statusCopy.icon;

  return (
    <div className="extension-connect-page">
      <section className="league-command-panel extension-hero-panel">
        <div className="league-command-copy">
          <span className="badge badge-premium"><PlugZap size={14} /> Local companion</span>
          <h2>Connect the PC extension to TheBlitzRoom.</h2>
          <p>
            This page checks whether the locally loaded Chrome extension can see the website. Once connected, the extension can hand draft context back into the web workspace.
          </p>
          <div className={`extension-status-card ${statusCopy.className}`}>
            <StatusIcon size={20} />
            <span>
              <strong>{statusCopy.label}</strong>
              <small>{statusCopy.detail}</small>
            </span>
          </div>
        </div>

        <div className="league-stat-grid extension-stat-grid">
          <div className="league-stat"><span>Extension</span><strong>{status?.name ?? "Blitz"}</strong><small>{status?.version ? `v${status.version}` : "Waiting"}</small></div>
          <div className="league-stat"><span>Draft ID</span><strong>{status?.activeDraftId || "-"}</strong><small>Last synced room</small></div>
          <div className="league-stat"><span>Slot</span><strong>{status?.activeDraftSlot || "-"}</strong><small>Detected draft slot</small></div>
          <div className="league-stat"><span>Status</span><strong>{bridgeState === "connected" ? "Live" : "-"}</strong><small>Website bridge</small></div>
        </div>
      </section>

      <section className="extension-action-grid">
        <article className="extension-action-card">
          <div className="league-team-icon"><Gauge size={20} /></div>
          <span className="eyebrow">Step 1</span>
          <h3>Reload the local extension</h3>
          <p>Open Chrome extensions, reload The Blitz Room extension, then come back to this page. The bridge only activates after the extension is refreshed.</p>
          <a className="league-inline-link" href="chrome://extensions" target="_blank" rel="noreferrer">Open Chrome extensions <ExternalLink size={14} /></a>
        </article>

        <article className="extension-action-card">
          <div className="league-team-icon"><PlugZap size={20} /></div>
          <span className="eyebrow">Step 2</span>
          <h3>Use this page as the connection check</h3>
          <p>If the status says Connected, the website can see the extension. If it says Not detected, reload the extension and refresh this page.</p>
          <button className="premium-button premium-button-secondary" onClick={() => window.location.reload()} type="button">
            <RefreshCcw size={16} /> Recheck
          </button>
        </article>

        <article className="extension-action-card">
          <div className="league-team-icon"><CheckCircle2 size={20} /></div>
          <span className="eyebrow">Step 3</span>
          <h3>Open the extension panel</h3>
          <p>When Chrome allows it, this button opens the side panel. If Chrome blocks it, click The Blitz Room extension icon in the browser toolbar.</p>
          <button className="premium-button premium-button-primary" disabled={bridgeState !== "connected"} onClick={openExtensionPanel} type="button">
            Open extension panel
          </button>
          {panelMessage ? <small className="extension-panel-message">{panelMessage}</small> : null}
        </article>
      </section>
    </div>
  );
}
