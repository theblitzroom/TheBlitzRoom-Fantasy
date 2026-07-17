(() => {
  const EVENT_THROTTLE_MS = 900;
  let lastDraftId = null;
  let lastHref = "";
  let lastEventAt = 0;

  function detectDraftId() {
    const candidates = [
      location.pathname,
      location.hash,
      location.href
    ];

    for (const value of candidates) {
      const match =
        value.match(/\/draft\/(?:nfl\/)?([0-9]{8,})/i) ||
        value.match(/[?&]draft_id=([0-9]{8,})/i) ||
        value.match(/draftId["'=:%2F]+([0-9]{8,})/i);
      if (match?.[1]) {
        return match[1];
      }
    }

    const embedded = document.body?.innerText?.match(/draft[_\s-]?id["'\s:]+([0-9]{8,})/i);
    return embedded?.[1] ?? null;
  }

  function publishIfChanged() {
    if (location.href === lastHref && lastDraftId) {
      return;
    }

    lastHref = location.href;
    const draftId = detectDraftId();
    if (!draftId || draftId === lastDraftId) {
      return;
    }

    lastDraftId = draftId;
    chrome.runtime.sendMessage({
      type: "SLEEPER_DRAFT_DETECTED",
      draftId,
      sleeperUserId: detectCurrentUserId(),
      draftSlot: detectCurrentDraftSlot(draftId),
      visibleTeamNames: collectVisibleTeamNames()
    });
    publishDraftEvent("draft-detected");
  }

  function publishDraftEvent(reason) {
    const now = Date.now();
    if (now - lastEventAt < EVENT_THROTTLE_MS) {
      return;
    }

    const draftId = lastDraftId ?? detectDraftId();
    if (!draftId) {
      return;
    }

    lastDraftId = draftId;
    lastEventAt = now;
    chrome.runtime.sendMessage({
      type: "SLEEPER_DRAFT_EVENT",
      draftId,
      reason,
      observedAt: now,
      sleeperUserId: detectCurrentUserId(),
      draftSlot: detectCurrentDraftSlot(draftId),
      visibleTeamNames: collectVisibleTeamNames()
    });
  }

  function detectCurrentUserId() {
    const storageValues = [];
    for (const storage of [localStorage, sessionStorage]) {
      try {
        for (let index = 0; index < storage.length; index += 1) {
          const key = storage.key(index) ?? "";
          const value = storage.getItem(key) ?? "";
          if (/user|account|session|auth|sleeper/i.test(key) || /user_id|userId|uid/i.test(value)) {
            storageValues.push(`${key} ${value}`);
            storageValues.push(value);
          }
        }
      } catch {
        // Some browser privacy settings can block storage inspection.
      }
    }

    storageValues.push(document.cookie ?? "");
    for (const script of document.querySelectorAll("script")) {
      const text = script.textContent ?? "";
      if (/user_id|userId|uid|currentUser|viewer/i.test(text)) {
        storageValues.push(text.slice(0, 250000));
      }
    }

    for (const value of storageValues) {
      const parsed = parseUserIdFromText(value);
      if (parsed) {
        return parsed;
      }
    }
    return "";
  }

  function parseUserIdFromText(value) {
    const text = String(value ?? "");
    const patterns = [
      /"user_id"\s*:\s*"?([a-z0-9_-]{4,})"?/i,
      /"userId"\s*:\s*"?([a-z0-9_-]{4,})"?/i,
      /"uid"\s*:\s*"?([a-z0-9_-]{4,})"?/i,
      /"currentUserId"\s*:\s*"?([a-z0-9_-]{4,})"?/i,
      /\buser_id["'=:\s]+([a-z0-9_-]{4,})/i,
      /\buserId["'=:\s]+([a-z0-9_-]{4,})/i,
      /\buid["'=:\s]+([a-z0-9_-]{4,})/i
    ];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      const userId = cleanUserId(match?.[1]);
      if (userId) {
        return userId;
      }
    }

    try {
      const parsed = JSON.parse(text);
      return findUserIdInObject(parsed);
    } catch {
      return "";
    }
  }

  function findUserIdInObject(value, depth = 0) {
    if (!value || depth > 7) {
      return "";
    }
    if (typeof value === "string") {
      return cleanUserId(value);
    }
    if (typeof value !== "object") {
      return "";
    }

    for (const key of ["user_id", "userId", "uid", "currentUserId"]) {
      const userId = cleanUserId(value[key]);
      if (userId) {
        return userId;
      }
    }

    for (const [key, item] of Object.entries(value)) {
      if (/user|account|session|auth|viewer/i.test(key)) {
        const userId = findUserIdInObject(item, depth + 1);
        if (userId) {
          return userId;
        }
      }
    }

    return "";
  }

  function cleanUserId(value) {
    const text = String(value ?? "").trim();
    if (!/^[a-z0-9_-]{4,}$/i.test(text)) {
      return "";
    }
    if (/^(null|undefined|true|false|guest|anonymous|token|session|user|account)$/i.test(text)) {
      return "";
    }
    return text;
  }

  function detectCurrentDraftSlot(draftId) {
    const visibleSlot = detectDraftSlotFromPage();
    if (visibleSlot) {
      return visibleSlot;
    }

    for (const storage of [localStorage, sessionStorage]) {
      try {
        for (let index = 0; index < storage.length; index += 1) {
          const value = storage.getItem(storage.key(index) ?? "") ?? "";
          const slot = extractDraftSlotFromText(value, draftId);
          if (slot) {
            return slot;
          }
        }
      } catch {
        // Some browser privacy settings can block storage inspection.
      }
    }
    return "";
  }

  function detectDraftSlotFromPage() {
    const text = document.body?.innerText?.slice(0, 120000) ?? "";
    const patterns = [
      /\b(?:your|my)\s+(?:draft\s+)?(?:slot|position|pick)\s*:?\s*(\d{1,2})(?:st|nd|rd|th)?\b/i,
      /\b(?:draft\s+)?(?:slot|position)\s*:?\s*(\d{1,2})(?:st|nd|rd|th)?\b/i,
      /\bpicking\s+(\d{1,2})(?:st|nd|rd|th)?\b/i
    ];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      const slot = normalizeDraftSlot(match?.[1]);
      if (slot) {
        return slot;
      }
    }
    return "";
  }

  function extractDraftSlotFromText(value, draftId) {
    const text = String(value ?? "");
    if (!draftId || !text.includes(String(draftId))) {
      return "";
    }

    const regexPatterns = [
      /"draft_slot"\s*:\s*"?(\d{1,2})"?/i,
      /"draftSlot"\s*:\s*"?(\d{1,2})"?/i,
      /"draft_position"\s*:\s*"?(\d{1,2})"?/i,
      /"draftPosition"\s*:\s*"?(\d{1,2})"?/i,
      /"slot"\s*:\s*"?(\d{1,2})"?/i
    ];
    for (const pattern of regexPatterns) {
      const slot = normalizeDraftSlot(text.match(pattern)?.[1]);
      if (slot) {
        return slot;
      }
    }

    try {
      const parsed = JSON.parse(text);
      return findDraftSlotInObject(parsed, String(draftId));
    } catch {
      return "";
    }
  }

  function findDraftSlotInObject(value, draftId, depth = 0) {
    if (!value || depth > 6 || typeof value !== "object") {
      return "";
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        const slot = findDraftSlotInObject(item, draftId, depth + 1);
        if (slot) return slot;
      }
      return "";
    }

    const hasDraftId = objectContainsDraftId(value, draftId);
    if (hasDraftId) {
      for (const key of ["draft_slot", "draftSlot", "draft_position", "draftPosition", "slot"]) {
        const slot = normalizeDraftSlot(value[key]);
        if (slot) return slot;
      }
    }

    for (const item of Object.values(value)) {
      const slot = findDraftSlotInObject(item, draftId, depth + 1);
      if (slot) return slot;
    }
    return "";
  }

  function objectContainsDraftId(value, draftId) {
    if (!value || typeof value !== "object") {
      return false;
    }
    for (const [key, item] of Object.entries(value)) {
      if (/draft/i.test(key) && String(item) === draftId) {
        return true;
      }
    }
    return false;
  }

  function normalizeDraftSlot(value) {
    const slot = Number(value);
    return Number.isInteger(slot) && slot >= 1 && slot <= 32 ? String(slot) : "";
  }

  function collectVisibleTeamNames() {
    const candidates = [];
    const selector = [
      "[class*='team' i]",
      "[class*='owner' i]",
      "[class*='user' i]",
      "[class*='username' i]",
      "[class*='roster' i]",
      "[class*='slot' i]",
      "[title]",
      "[aria-label]"
    ].join(",");

    for (const element of document.querySelectorAll(selector)) {
      if (!isVisible(element)) {
        continue;
      }

      const rect = element.getBoundingClientRect();
      if (rect.top > Math.max(780, window.innerHeight * 0.65)) {
        continue;
      }

      const labels = [
        element.getAttribute("title"),
        element.getAttribute("aria-label"),
        element.textContent
      ];

      for (const rawLabel of labels) {
        const label = cleanTeamLabel(rawLabel);
        if (!label) {
          continue;
        }
        candidates.push({
          label,
          x: Math.round(rect.left),
          y: Math.round(rect.top)
        });
      }
    }

    return dedupeTeamNames(candidates)
      .sort((a, b) => a.y - b.y || a.x - b.x)
      .slice(0, 24);
  }

  function isVisible(element) {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return (
      rect.width > 8 &&
      rect.height > 8 &&
      style.visibility !== "hidden" &&
      style.display !== "none" &&
      Number(style.opacity || 1) > 0
    );
  }

  function cleanTeamLabel(value) {
    const label = String(value ?? "")
      .replace(/\s+/g, " ")
      .replace(/^(team|owner|user|manager|slot|roster)\s*:?\s*/i, "")
      .trim();
    if (!label || label.length < 2 || label.length > 32) {
      return "";
    }
    if (/^\d+$/.test(label)) {
      return "";
    }
    if (/\b(qb|rb|wr|te|def|dst|k|pick|round|queue|draft|available|taken|roster|team needs|best picks)\b/i.test(label)) {
      return "";
    }
    if (label.split(" ").length > 5) {
      return "";
    }
    return label;
  }

  function dedupeTeamNames(candidates) {
    const seen = new Set();
    return candidates.filter((candidate) => {
      const key = candidate.label.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  function patchHistoryMethod(name) {
    const original = history[name];
    history[name] = function patchedHistoryMethod(...args) {
      const result = original.apply(this, args);
      setTimeout(publishIfChanged, 250);
      return result;
    };
  }

  patchHistoryMethod("pushState");
  patchHistoryMethod("replaceState");
  window.addEventListener("popstate", () => setTimeout(publishIfChanged, 250));
  document.addEventListener(
    "click",
    () => setTimeout(() => publishDraftEvent("click"), 250),
    true
  );
  document.addEventListener(
    "visibilitychange",
    () => {
      if (!document.hidden) {
        publishDraftEvent("visible");
      }
    },
    true
  );
  new MutationObserver(() => {
    publishIfChanged();
    publishDraftEvent("page-mutation");
  }).observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  publishIfChanged();
  publishDraftEvent("loaded");
  setInterval(publishIfChanged, 5000);
  setInterval(() => publishDraftEvent("heartbeat"), 5000);
})();
