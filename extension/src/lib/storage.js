export const DEFAULT_ADVISOR_URL = "http://localhost:8787/advice";

export const DEFAULT_SETTINGS = {
  advisorUrl: DEFAULT_ADVISOR_URL,
  pollMs: 650,
  fullRefreshMs: 60000,
  recommendationLimit: 12,
  rankingMode: "auto",
  redraftRankingSource: "custom",
  rankingAffectsPlayerValue: false,
  customRankingEditTargets: [],
  themeMode: "system",
  liveModeVersion: 5
};

export async function getLocal(keys) {
  return chrome.storage.local.get(keys);
}

export async function setLocal(values) {
  return chrome.storage.local.set(values);
}

export async function removeLocal(keys) {
  return chrome.storage.local.remove(keys);
}

export async function getSettings() {
  const { settings } = await getLocal("settings");
  const merged = { ...DEFAULT_SETTINGS, ...(settings ?? {}) };
  merged.advisorUrl = sanitizeAdvisorUrl(merged.advisorUrl);
  if ((settings?.liveModeVersion ?? 0) < DEFAULT_SETTINGS.liveModeVersion && merged.pollMs > DEFAULT_SETTINGS.pollMs) {
    merged.pollMs = DEFAULT_SETTINGS.pollMs;
  }
  if ((settings?.liveModeVersion ?? 0) < DEFAULT_SETTINGS.liveModeVersion && ["ppr", "half_ppr", "superflex_dynasty", "dynasty"].includes(merged.rankingMode)) {
    merged.rankingMode = "auto";
  }
  if (settings?.advisorUrl && settings.advisorUrl !== merged.advisorUrl) {
    await setLocal({ settings: merged });
  }
  if ((settings?.liveModeVersion ?? 0) < DEFAULT_SETTINGS.liveModeVersion) {
    await setLocal({ settings: merged });
  }
  return merged;
}

export async function saveSettings(settings) {
  const merged = { ...DEFAULT_SETTINGS, ...settings };
  merged.advisorUrl = sanitizeAdvisorUrl(merged.advisorUrl);
  await setLocal({ settings: merged });
}

export function sanitizeAdvisorUrl(value) {
  try {
    const trimmed = String(value ?? "").trim();
    if (!trimmed) {
      return DEFAULT_ADVISOR_URL;
    }

    const url = new URL(trimmed);
    const hostname = url.hostname.toLowerCase();
    const isLocalHost = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(hostname);
    if (url.protocol !== "http:" || !isLocalHost) {
      return DEFAULT_ADVISOR_URL;
    }

    if (!url.port) {
      url.port = "8787";
    }
    url.pathname = "/advice";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return DEFAULT_ADVISOR_URL;
  }
}
