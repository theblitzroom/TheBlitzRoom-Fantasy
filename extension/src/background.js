const SLEEPER_HOSTS = new Set(["sleeper.com", "sleeper.app"]);

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.warn("Unable to set panel behavior", error));
});

chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (!tab.url || (info.status !== "loading" && info.status !== "complete")) {
    return;
  }

  const isSleeper = isSleeperUrl(tab.url);
  await chrome.sidePanel.setOptions({
    tabId,
    path: "src/sidepanel.html",
    enabled: isSleeper
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "SLEEPER_DRAFT_DETECTED" && message.draftId) {
    const tabId = sender.tab?.id ?? null;
    storeDraftState(String(message.draftId), message.visibleTeamNames, {
        activeDraftId: String(message.draftId),
        activeSleeperTabId: tabId,
        activeSleeperUrl: sender.tab?.url ?? null,
        detectedAt: Date.now()
      },
      message.sleeperUserId ? { activeSleeperUserId: String(message.sleeperUserId) } : {},
      message.draftSlot)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }

  if (message?.type === "SLEEPER_DRAFT_EVENT" && message.draftId) {
    storeDraftState(String(message.draftId), message.visibleTeamNames, {
        lastDraftEvent: {
          draftId: String(message.draftId),
          reason: message.reason ?? "draft-page",
          observedAt: message.observedAt ?? Date.now(),
          tabId: sender.tab?.id ?? null
        }
      },
      message.sleeperUserId ? { activeSleeperUserId: String(message.sleeperUserId) } : {},
      message.draftSlot)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }

  if (message?.type === "GET_ACTIVE_TAB") {
    chrome.tabs
      .query({ active: true, currentWindow: true })
      .then(([tab]) => sendResponse({ tab }))
      .catch((error) => sendResponse({ error: String(error) }));
    return true;
  }

  return false;
});

async function storeDraftState(draftId, visibleTeamNames, values, optionalValues = {}, draftSlot = "") {
  const payload = { ...values, ...optionalValues };
  const normalizedDraftSlot = normalizeDraftSlot(draftSlot);
  if (normalizedDraftSlot) {
    const { activeDraftSlotByDraft } = await chrome.storage.local.get("activeDraftSlotByDraft");
    payload.activeDraftSlot = normalizedDraftSlot;
    payload.activeDraftSlotByDraft = {
      ...(activeDraftSlotByDraft ?? {}),
      [draftId]: normalizedDraftSlot
    };
  }
  if (Array.isArray(visibleTeamNames) && visibleTeamNames.length) {
    const { visibleTeamNamesByDraft } = await chrome.storage.local.get("visibleTeamNamesByDraft");
    payload.visibleTeamNamesByDraft = {
      ...(visibleTeamNamesByDraft ?? {}),
      [draftId]: visibleTeamNames
    };
  }
  await chrome.storage.local.set(payload);
}

function normalizeDraftSlot(value) {
  const slot = Number(value);
  return Number.isInteger(slot) && slot >= 1 && slot <= 32 ? String(slot) : "";
}

function isSleeperUrl(urlString) {
  try {
    const url = new URL(urlString);
    return SLEEPER_HOSTS.has(url.hostname.replace(/^www\./, ""));
  } catch {
    return false;
  }
}
