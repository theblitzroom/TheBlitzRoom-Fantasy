import { fetchDraft, fetchLeague, fetchLeagueUsers, fetchPicks, fetchTrending, fetchUsers, getLastCompletedNflSeason, getPlayers, getSeasonStats } from "./lib/sleeper.js";
import { blitzValueToRating, buildBlitzValueProfile, formatBlitzDelta, formatBlitzValue } from "./lib/blitzValue.js";
import { getLocal, getSettings, removeLocal, sanitizeAdvisorUrl, saveSettings, setLocal } from "./lib/storage.js";
import { applyThemeMode, bindThemeModeControl, syncThemeModeControl, watchSystemTheme } from "./lib/theme.js";
import { formatRosterNeeds, generateRecommendations } from "./lib/recommender.js";
import { applyCustomRedraftRankings, normalizeCustomRedraftBoard } from "./lib/customRankings.js";

const RANKING_FORMATS = ["ppr", "half_ppr", "superflex_dynasty", "dynasty"];
const FANTASYCALC_API_URL = "https://api.fantasycalc.com/values/current";
const FANTASYCALC_FORMAT_PARAMS = {
  ppr: { isDynasty: false, numQbs: 1, ppr: 1 },
  half_ppr: { isDynasty: false, numQbs: 1, ppr: 0.5 },
  superflex_dynasty: { isDynasty: true, numQbs: 2, ppr: 1 },
  dynasty: { isDynasty: true, numQbs: 1, ppr: 1 }
};
const VISIBLE_RECOMMENDATION_LIMIT = 3;

const elements = {
  draftName: document.querySelector("#draftName"),
  refreshButton: document.querySelector("#refreshButton"),
  draftIdInput: document.querySelector("#draftIdInput"),
  saveDraftButton: document.querySelector("#saveDraftButton"),
  pickMetric: document.querySelector("#pickMetric"),
  formatMetric: document.querySelector("#formatMetric"),
  statusMetric: document.querySelector("#statusMetric"),
  detectedRoster: document.querySelector("#detectedRoster"),
  rosterSummary: document.querySelector("#rosterSummary"),
  rankingFreshness: document.querySelector("#rankingFreshness"),
  fantasyIqSummary: document.querySelector("#fantasyIqSummary"),
  draftCoachPanel: document.querySelector("#draftCoachPanel"),
  stackAnalyzerPanel: document.querySelector("#stackAnalyzerPanel"),
  playoffFocusPanel: document.querySelector("#playoffFocusPanel"),
  draftSimulatorPanel: document.querySelector("#draftSimulatorPanel"),
  draftStrategyMeter: document.querySelector("#draftStrategyMeter"),
  pickPrediction: document.querySelector("#pickPrediction"),
  liveMomentumPanel: document.querySelector("#liveMomentumPanel"),
  assistantQuestionInput: document.querySelector("#assistantQuestionInput"),
  assistantAskButton: document.querySelector("#assistantAskButton"),
  assistantAnswer: document.querySelector("#assistantAnswer"),
  comparisonPanel: document.querySelector("#comparisonPanel"),
  draftFeed: document.querySelector("#draftFeed"),
  recommendations: document.querySelector("#recommendations"),
  picksTabButton: document.querySelector("#picksTabButton"),
  availableTabButton: document.querySelector("#availableTabButton"),
  teamsTabButton: document.querySelector("#teamsTabButton"),
  picksView: document.querySelector("#picksView"),
  availableView: document.querySelector("#availableView"),
  availableSummary: document.querySelector("#availableSummary"),
  positionFilterControls: document.querySelector("#positionFilterControls"),
  availableBoard: document.querySelector("#availableBoard"),
  teamsView: document.querySelector("#teamsView"),
  teamsSummary: document.querySelector("#teamsSummary"),
  leagueAnalyzer: document.querySelector("#leagueAnalyzer"),
  teamsList: document.querySelector("#teamsList"),
  advisorOutput: document.querySelector("#advisorOutput"),
  advisorUrlInput: document.querySelector("#advisorUrlInput"),
  rankingModeSelect: document.querySelector("#rankingModeSelect"),
  themeModeControl: document.querySelector("#themeModeControl"),
  saveSettingsButton: document.querySelector("#saveSettingsButton"),
  rankingsFile: document.querySelector("#rankingsFile"),
  evidenceFile: document.querySelector("#evidenceFile"),
  openEditorButton: document.querySelector("#openEditorButton"),
  loadSampleButton: document.querySelector("#loadSampleButton"),
  clearDataButton: document.querySelector("#clearDataButton"),
  recommendationTemplate: document.querySelector("#recommendationTemplate"),
  teamCardTemplate: document.querySelector("#teamCardTemplate")
};

const state = {
  draftId: "",
  rosterId: "",
  draft: null,
  league: null,
  leagueUsers: [],
  activeSleeperUserId: "",
  activeDraftSlot: "",
  activeDraftSlotByDraft: {},
  visibleTeamNamesByDraft: {},
  visibleTeamNames: [],
  picks: [],
  players: {},
  seasonStats: {},
  statsSeason: getLastCompletedNflSeason(),
  rankings: null,
  rankingsByFormat: {},
  customRedraftRankings: null,
  customRedraftRankingsByFormat: {},
  bundledCustomRedraftRankings: null,
  bundledRankings: {},
  playerAliases: null,
  activeRankings: null,
  activeScoringFormat: "unknown",
  activeRankingsSource: "none",
  manualTakenByDraft: {},
  manualTakenNames: [],
  evidence: null,
  trends: { adds: [], drops: [], maxAdds: 0, maxDrops: 0 },
  settings: null,
  selectedRosterByDraft: {},
  selectedRosterSourceByDraft: {},
  recommendations: null,
  availablePositionFilter: "ALL",
  liveNewsEvidence: null,
  isNewsRefreshing: false,
  newsRefreshAt: 0,
  pollTimer: null,
  fullPollTimer: null,
  liveRefreshTimers: [],
  comparePlayerIds: [],
  whatIfSimulations: { signature: "", items: [], byPlayerId: new Map() },
  pickSignature: "",
  abortController: null,
  isPicksRefreshing: false,
  isRefreshing: false,
  activeView: "picks"
};

init();

async function init() {
  bindEvents();
  const stored = await getLocal([
    "activeDraftId",
    "selectedRosterId",
    "rankingsDoc",
    "rankingsByFormat",
    "customRedraftRankings",
    "customRedraftRankingsByFormat",
    "evidenceDoc",
    "selectedRosterByDraft",
    "selectedRosterSourceByDraft",
    "manualTakenByDraft",
    "visibleTeamNamesByDraft",
    "activeSleeperUserId",
    "activeDraftSlotByDraft",
    "activeDraftSlot"
  ]);
  state.settings = await getSettings();
  applyThemeMode(state.settings.themeMode);
  syncThemeModeControl(elements.themeModeControl, state.settings.themeMode);
  watchSystemTheme(() => state.settings?.themeMode, () => applyThemeMode(state.settings?.themeMode));
  state.draftId = stored.activeDraftId ?? "";
  state.selectedRosterByDraft = stored.selectedRosterByDraft ?? {};
  state.selectedRosterSourceByDraft = stored.selectedRosterSourceByDraft ?? {};
  state.rosterId = state.selectedRosterSourceByDraft[state.draftId] === "auto"
    ? String(state.selectedRosterByDraft[state.draftId] ?? "")
    : "";
  state.activeSleeperUserId = stored.activeSleeperUserId ?? "";
  state.activeDraftSlotByDraft = stored.activeDraftSlotByDraft ?? {};
  state.activeDraftSlot = state.activeDraftSlotByDraft[state.draftId] ?? stored.activeDraftSlot ?? "";
  state.rankings = stored.rankingsDoc ?? null;
  state.rankingsByFormat = normalizeRankingsByFormat(stored.rankingsByFormat, stored.rankingsDoc);
  state.bundledCustomRedraftRankings = await loadBundledCustomRedraftRankings();
  state.customRedraftRankings = normalizeCustomRedraftBoard(stored.customRedraftRankings ?? state.bundledCustomRedraftRankings);
  state.customRedraftRankingsByFormat = normalizeCustomRedraftRankingsByFormat(stored.customRedraftRankingsByFormat, state.customRedraftRankings);
  state.evidence = stored.evidenceDoc ?? null;
  state.manualTakenByDraft = stored.manualTakenByDraft ?? {};
  state.manualTakenNames = state.manualTakenByDraft[state.draftId] ?? [];
  state.visibleTeamNamesByDraft = stored.visibleTeamNamesByDraft ?? {};
  state.visibleTeamNames = state.visibleTeamNamesByDraft[state.draftId] ?? [];
  state.bundledRankings = await loadBundledRankings();
  state.playerAliases = await loadPlayerAliases();

  elements.draftIdInput.value = state.draftId;
  elements.advisorUrlInput.value = sanitizeAdvisorUrl(state.settings.advisorUrl);
  elements.rankingModeSelect.value = state.settings.rankingMode;
  renderRankingFreshness();

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") {
      return;
    }

    if (changes.activeDraftId?.newValue) {
      const nextDraftId = String(changes.activeDraftId.newValue);
      if (nextDraftId !== state.draftId) {
        state.draftId = nextDraftId;
        state.rosterId = state.selectedRosterSourceByDraft[nextDraftId] === "auto"
          ? String(state.selectedRosterByDraft[nextDraftId] ?? "")
          : "";
        state.activeDraftSlot = state.activeDraftSlotByDraft[nextDraftId] ?? "";
        state.manualTakenNames = state.manualTakenByDraft[nextDraftId] ?? [];
        state.visibleTeamNames = state.visibleTeamNamesByDraft[nextDraftId] ?? [];
        elements.draftIdInput.value = nextDraftId;
        refreshDraft();
      }
    }

    if (changes.visibleTeamNamesByDraft?.newValue) {
      state.visibleTeamNamesByDraft = changes.visibleTeamNamesByDraft.newValue ?? {};
      state.visibleTeamNames = state.visibleTeamNamesByDraft[state.draftId] ?? [];
      renderDetectedRoster(getRosterOptions());
      renderTeams();
    }

    if (changes.activeSleeperUserId?.newValue) {
      state.activeSleeperUserId = String(changes.activeSleeperUserId.newValue);
      chooseDefaultRoster();
      buildAndRenderRecommendations();
    }

    if (changes.activeDraftSlotByDraft?.newValue) {
      state.activeDraftSlotByDraft = changes.activeDraftSlotByDraft.newValue ?? {};
      state.activeDraftSlot = state.activeDraftSlotByDraft[state.draftId] ?? state.activeDraftSlot;
      chooseDefaultRoster();
      buildAndRenderRecommendations();
    }

    if (changes.activeDraftSlot?.newValue) {
      state.activeDraftSlot = String(changes.activeDraftSlot.newValue);
      chooseDefaultRoster();
      buildAndRenderRecommendations();
    }

    if (changes.rankingsDoc) {
      state.rankings = changes.rankingsDoc.newValue ?? null;
      state.rankingsByFormat = normalizeRankingsByFormat(state.rankingsByFormat, state.rankings);
      renderRankingFreshness();
      buildAndRenderRecommendations();
    }

    if (changes.rankingsByFormat) {
      state.rankingsByFormat = normalizeRankingsByFormat(changes.rankingsByFormat.newValue, state.rankings);
      renderRankingFreshness();
      buildAndRenderRecommendations();
    }

    if (changes.customRedraftRankings) {
      state.customRedraftRankings = normalizeCustomRedraftBoard(changes.customRedraftRankings.newValue ?? state.bundledCustomRedraftRankings);
      state.customRedraftRankingsByFormat = normalizeCustomRedraftRankingsByFormat(state.customRedraftRankingsByFormat, state.customRedraftRankings);
      renderRankingFreshness();
      buildAndRenderRecommendations();
    }

    if (changes.customRedraftRankingsByFormat) {
      state.customRedraftRankingsByFormat = normalizeCustomRedraftRankingsByFormat(changes.customRedraftRankingsByFormat.newValue, state.customRedraftRankings);
      renderRankingFreshness();
      buildAndRenderRecommendations();
    }

    if (changes.settings?.newValue) {
      state.settings = { ...state.settings, ...changes.settings.newValue };
      elements.advisorUrlInput.value = sanitizeAdvisorUrl(state.settings.advisorUrl);
      elements.rankingModeSelect.value = state.settings.rankingMode;
      applyThemeMode(state.settings.themeMode);
      syncThemeModeControl(elements.themeModeControl, state.settings.themeMode);
      renderRankingFreshness();
      buildAndRenderRecommendations();
      startPolling();
    }

    const draftEvent = changes.lastDraftEvent?.newValue;
    if (draftEvent?.draftId && String(draftEvent.draftId) === String(state.draftId)) {
      scheduleLiveRefresh();
    }
  });

  await refreshDraft();
  startPolling();
}

function bindEvents() {
  elements.refreshButton.addEventListener("click", () => refreshDraft({ forcePlayers: false }));
  elements.saveDraftButton.addEventListener("click", async () => {
    const draftId = elements.draftIdInput.value.trim();
    state.draftId = draftId;
    state.rosterId = state.selectedRosterSourceByDraft[draftId] === "auto"
      ? String(state.selectedRosterByDraft[draftId] ?? "")
      : "";
    state.manualTakenNames = state.manualTakenByDraft[draftId] ?? [];
    state.visibleTeamNames = state.visibleTeamNamesByDraft[draftId] ?? [];
    await setLocal({ activeDraftId: draftId });
    await refreshDraft();
  });
  elements.draftIdInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      elements.saveDraftButton.click();
    }
  });
  elements.picksTabButton.addEventListener("click", () => setActiveView("picks"));
  elements.availableTabButton.addEventListener("click", () => setActiveView("available"));
  elements.teamsTabButton.addEventListener("click", () => setActiveView("teams"));
  elements.positionFilterControls.addEventListener("click", (event) => {
    const button = event.target.closest("[data-position-filter]");
    if (!button) return;
    state.availablePositionFilter = button.dataset.positionFilter || "ALL";
    renderAvailableBoard();
  });
  elements.assistantAskButton?.addEventListener("click", () => answerAssistantQuestion());
  elements.assistantQuestionInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      answerAssistantQuestion();
    }
  });
  bindThemeModeControl(elements.themeModeControl, async (themeMode) => {
    state.settings = { ...state.settings, themeMode };
    await saveSettings(state.settings);
    setStatus("Saved");
  });
  elements.saveSettingsButton.addEventListener("click", async () => {
    state.settings = {
      ...state.settings,
      advisorUrl: sanitizeAdvisorUrl(elements.advisorUrlInput.value.trim()),
      rankingMode: elements.rankingModeSelect.value
    };
    elements.advisorUrlInput.value = state.settings.advisorUrl;
    await saveSettings(state.settings);
    buildAndRenderRecommendations();
    setStatus("Saved");
  });
  elements.rankingsFile.addEventListener("change", () => importJsonFile(elements.rankingsFile, "rankings"));
  elements.evidenceFile.addEventListener("change", () => importJsonFile(elements.evidenceFile, "evidence"));
  elements.openEditorButton.addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("src/rankings-editor.html") });
  });
  elements.loadSampleButton.addEventListener("click", loadSampleData);
  elements.clearDataButton.addEventListener("click", clearDraftData);
}

function setActiveView(view) {
  state.activeView = view;
  const showAvailable = view === "available";
  const showTeams = view === "teams";
  elements.picksTabButton.classList.toggle("is-active", view === "picks");
  elements.availableTabButton.classList.toggle("is-active", showAvailable);
  elements.teamsTabButton.classList.toggle("is-active", showTeams);
  elements.picksView.classList.toggle("is-hidden", view !== "picks");
  elements.availableView.classList.toggle("is-hidden", !showAvailable);
  elements.teamsView.classList.toggle("is-hidden", !showTeams);
  if (showAvailable) {
    renderAvailableBoard();
  }
}

function startPolling() {
  if (state.pollTimer) {
    clearInterval(state.pollTimer);
  }
  if (state.fullPollTimer) {
    clearInterval(state.fullPollTimer);
  }
  state.pollTimer = setInterval(() => {
    if (!state.isRefreshing && !state.isPicksRefreshing) {
      refreshPicksOnly({ quiet: true });
    }
  }, state.settings.pollMs);
  state.fullPollTimer = setInterval(() => {
    if (!state.isRefreshing) {
      refreshDraft({ quiet: true });
    }
  }, state.settings.fullRefreshMs);
}

async function refreshDraft({ quiet = false, forcePlayers = false } = {}) {
  if (!state.draftId) {
    renderEmpty("Open a Sleeper draft room or paste a draft ID to start live sync.");
    return;
  }

  state.abortController?.abort();
  state.abortController = new AbortController();
  state.isRefreshing = true;
  if (!quiet) {
    setStatus("Syncing");
  }

  try {
    const signal = state.abortController.signal;
    const draft = await fetchDraft(state.draftId, signal);
    state.draft = draft;

    const leaguePromise = draft?.league_id
      ? fetchLeague(draft.league_id, signal).catch((error) => {
          console.warn("Sleeper league scoring could not be loaded", error);
          return null;
        })
      : Promise.resolve(null);
    const leagueUsersPromise = draft?.league_id
      ? fetchLeagueUsers(draft.league_id, signal).catch((error) => {
          console.warn("Sleeper league users could not be loaded", error);
          return state.leagueUsers ?? [];
        })
      : Promise.resolve([]);
    const draftUsersPromise = fetchUsers(getDraftOrderUserIds(draft), signal).catch((error) => {
      console.warn("Sleeper draft users could not be loaded", error);
      return [];
    });
    const playersPromise = getPlayers({ force: forcePlayers, signal }).catch((error) => {
      console.warn("Sleeper players could not be loaded", error);
      return state.players ?? {};
    });
    const statsSeason = getLastCompletedNflSeason();
    const statsPromise = getSeasonStats({ season: statsSeason, signal }).catch((error) => {
      console.warn("Sleeper season stats could not be loaded", error);
      return state.seasonStats ?? {};
    });
    const addsPromise = fetchTrending("add", { lookbackHours: 24, limit: 75 }, signal).catch(() => []);
    const dropsPromise = fetchTrending("drop", { lookbackHours: 24, limit: 75 }, signal).catch(() => []);
    const picks = await fetchPicks(state.draftId, signal);

    state.picks = Array.isArray(picks) ? picks : [];
    state.pickSignature = getPickSignature(state.picks);
    chooseDefaultRoster();
    renderDraftMeta();
    buildAndRenderRecommendations();
    setStatus("Live");

    const [league, leagueUsers, draftUsers, players, seasonStats, adds, drops] = await Promise.all([
      leaguePromise,
      leagueUsersPromise,
      draftUsersPromise,
      playersPromise,
      statsPromise,
      addsPromise,
      dropsPromise
    ]);

    state.league = league;
    state.leagueUsers = mergeUsers(leagueUsers, draftUsers);
    state.players = players ?? {};
    state.seasonStats = seasonStats ?? {};
    state.statsSeason = statsSeason;
    state.trends = {
      adds: Array.isArray(adds) ? adds : [],
      drops: Array.isArray(drops) ? drops : [],
      maxAdds: maxCount(adds),
      maxDrops: maxCount(drops)
    };

    chooseDefaultRoster();
    renderDraftMeta();
    buildAndRenderRecommendations();
    setStatus("Live");
  } catch (error) {
    if (error.name !== "AbortError") {
      renderError(error.message || String(error));
      setStatus("Error");
    }
  } finally {
    state.isRefreshing = false;
  }
}

async function refreshPicksOnly({ quiet = false, forceRender = false } = {}) {
  if (!state.draftId) {
    return;
  }
  if (state.isPicksRefreshing) {
    return;
  }
  if (!state.draft || !Object.keys(state.players).length) {
    await refreshDraft({ quiet: true });
    return;
  }

  state.isPicksRefreshing = true;
  try {
    const picks = await fetchPicks(state.draftId);
    const nextPicks = Array.isArray(picks) ? picks : [];
    const nextSignature = getPickSignature(nextPicks);
    if (!forceRender && nextSignature === state.pickSignature) {
      return;
    }

    state.picks = nextPicks;
    state.pickSignature = nextSignature;
    renderDraftMeta();
    buildAndRenderRecommendations();
    if (!quiet) {
      setStatus("Live");
    }
  } catch (error) {
    if (!quiet) {
      renderError(error.message || String(error));
      setStatus("Error");
    }
  } finally {
    state.isPicksRefreshing = false;
  }
}

function scheduleLiveRefresh() {
  for (const timer of state.liveRefreshTimers) {
    clearTimeout(timer);
  }

  state.liveRefreshTimers = [0, 300, 750, 1300, 2200, 3600, 5200].map((delay) =>
    setTimeout(() => {
      refreshPicksOnly({ quiet: true });
    }, delay)
  );
}

function chooseDefaultRoster() {
  const options = getRosterOptions();
  const validRosterIds = new Set(options.map((option) => option.rosterId));
  const savedForDraft = state.selectedRosterByDraft[state.draftId];
  const savedSource = state.selectedRosterSourceByDraft[state.draftId];
  const detectedRosterId = getRosterIdForSleeperUser(state.activeSleeperUserId) || getRosterIdForDraftSlot(state.activeDraftSlot);

  if (detectedRosterId && validRosterIds.has(String(detectedRosterId))) {
    state.rosterId = String(detectedRosterId);
    persistAutoRosterSelection(detectedRosterId);
  } else if (savedSource === "auto" && savedForDraft && validRosterIds.has(String(savedForDraft))) {
    state.rosterId = String(savedForDraft);
  } else {
    state.rosterId = "";
  }
  renderDetectedRoster(options);
}

function persistAutoRosterSelection(rosterId) {
  if (!state.draftId || !rosterId) {
    return;
  }
  state.selectedRosterByDraft = {
    ...state.selectedRosterByDraft,
    [state.draftId]: String(rosterId)
  };
  state.selectedRosterSourceByDraft = {
    ...state.selectedRosterSourceByDraft,
    [state.draftId]: "auto"
  };
  setLocal({
    selectedRosterId: String(rosterId),
    selectedRosterByDraft: state.selectedRosterByDraft,
    selectedRosterSourceByDraft: state.selectedRosterSourceByDraft
  }).catch((error) => console.warn("Could not persist auto roster selection", error));
}

function getRosterIdForDraftSlot(slot) {
  const numericSlot = Number(slot);
  if (!Number.isInteger(numericSlot) || numericSlot <= 0 || numericSlot > 32) {
    return "";
  }
  const slotKey = String(numericSlot);
  const rosterId = state.draft?.slot_to_roster_id?.[slotKey];
  return rosterId === undefined || rosterId === null || rosterId === "" ? slotKey : String(rosterId);
}

function getRosterIdForSleeperUser(userId) {
  const key = String(userId ?? "");
  if (!key) {
    return "";
  }

  const slot = state.draft?.draft_order?.[key];
  if (slot === undefined || slot === null || slot === "") {
    return "";
  }

  const slotKey = String(slot);
  const rosterId = state.draft?.slot_to_roster_id?.[slotKey];
  return rosterId === undefined || rosterId === null || rosterId === "" ? slotKey : String(rosterId);
}

function renderDraftMeta() {
  const name = state.draft?.metadata?.name || "Sleeper draft";
  const settings = state.draft?.settings ?? {};
  const totalPicks = Number(settings.teams ?? 0) * Number(settings.rounds ?? 0);
  const scoring = formatLeagueScoringLabel(detectScoringFormat(state.draft, state.league), state.draft, state.league);
  const draftType = state.draft?.type ?? "draft";

  elements.draftName.textContent = name;
  elements.pickMetric.textContent = totalPicks ? `${state.picks.length + 1}/${totalPicks}` : String(state.picks.length + 1);
  elements.formatMetric.textContent = `${scoring} ${draftType}`;
}

function buildAndRenderRecommendations({ skipNewsRefresh = false } = {}) {
  if (!state.draft || !state.rosterId) {
    renderEmpty("Open your Sleeper draft page so The Blitz Room can detect your team.");
    state.recommendations = null;
    state.whatIfSimulations = { signature: "", items: [], byPlayerId: new Map() };
    elements.rosterSummary.replaceChildren();
    renderDraftIntelligence();
    renderAvailableBoard();
    renderTeams();
    return;
  }

  const rankings = getSelectedRankings();
  state.activeRankings = rankings;
  renderRankingFreshness();

  state.recommendations = generateRecommendations({
    draft: state.draft,
    picks: state.picks,
    players: state.players,
    rankings,
    evidence: mergeEvidence(state.evidence, state.liveNewsEvidence),
    trends: state.trends,
    seasonStats: state.seasonStats,
    statsSeason: state.statsSeason,
    scoringSettings: state.league?.scoring_settings ?? state.draft?.scoring_settings ?? {},
    rosterId: state.rosterId,
    limit: state.settings.recommendationLimit,
    extraDraftedNames: state.manualTakenNames
  });

  state.whatIfSimulations = buildWhatIfSimulations();
  renderRosterSummary(state.recommendations.roster, state.recommendations.slots);
  renderRecommendations(state.recommendations.candidates);
  renderDraftIntelligence();
  renderAvailableBoard();
  renderTeams();
  if (!skipNewsRefresh) {
    refreshLiveNewsImpact();
  }
}

function getRosterOptions() {
  const slotToRoster = state.draft?.slot_to_roster_id ?? {};
  const teamNames = buildTeamNameLookup();
  const ordered = Object.entries(slotToRoster)
    .map(([slot, rosterId]) => ({
      slot: Number(slot),
      rosterId: String(rosterId)
    }))
    .filter((item) => item.rosterId && item.rosterId !== "0")
    .sort((a, b) => a.slot - b.slot);

  if (ordered.length) {
    return ordered.map((item) => ({
      rosterId: item.rosterId,
      label: teamNames.get(item.rosterId) ?? teamNames.get(String(item.slot)) ?? `Slot ${item.slot}`
    }));
  }

  const teamCount = Number(state.draft?.settings?.teams ?? 0);
  if (teamCount > 0) {
    return Array.from({ length: teamCount }, (_, index) => {
      const slot = index + 1;
      const key = String(slot);
      return {
        rosterId: key,
        label: teamNames.get(key) ?? `Slot ${slot}`
      };
    });
  }

  const fromPicks = [...new Set(state.picks.map((pick) => teamKeyForPick(pick)).filter(Boolean))];
  return fromPicks.sort(sortTeamKeys).map((rosterId) => ({
    rosterId,
    label: teamNames.get(rosterId) ?? `Team ${rosterId}`
  }));
}

function renderDetectedRoster(options) {
  if (!elements.detectedRoster) {
    return;
  }

  if (!options.length) {
    elements.detectedRoster.textContent = "No teams found yet";
    elements.detectedRoster.classList.add("is-waiting");
    return;
  }

  const selected = options.find((item) => String(item.rosterId) === String(state.rosterId));
  elements.detectedRoster.textContent = selected
    ? selected.label
    : state.activeSleeperUserId || state.activeDraftSlot
      ? "Matching your Sleeper team..."
      : "Open your Sleeper draft page to detect your team";
  elements.detectedRoster.classList.toggle("is-waiting", !selected);
}

function buildTeamNameLookup() {
  const names = new Map();
  const draftOrder = state.draft?.draft_order ?? {};
  const slotToRoster = state.draft?.slot_to_roster_id ?? {};
  const usersById = new Map(
    (state.leagueUsers ?? [])
      .filter((user) => user?.user_id)
      .map((user) => [String(user.user_id), user])
  );

  for (const [userId, slotValue] of Object.entries(draftOrder)) {
    const slot = String(slotValue);
    const rosterId = slotToRoster[slot] ? String(slotToRoster[slot]) : slot;
    const user = usersById.get(String(userId));
    const label = getUserTeamName(user);
    if (label) {
      names.set(String(userId), label);
      names.set(slot, label);
      names.set(rosterId, label);
    }
  }

  for (const user of usersById.values()) {
    const label = getUserTeamName(user);
    if (label) {
      names.set(String(user.user_id), label);
    }
  }

  for (const pick of state.picks) {
    const key = teamKeyForPick(pick);
    const metadata = pick.metadata ?? {};
    const label =
      metadata.team_name ||
      metadata.owner_team_name ||
      metadata.display_name ||
      metadata.owner_name ||
      "";
    if (key && label && !names.has(key)) {
      names.set(key, label);
    }
  }

  return names;
}

function cleanVisibleTeamName(value) {
  const label = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!label || label.length < 2 || label.length > 32) {
    return "";
  }
  if (/^\d+$/.test(label)) {
    return "";
  }
  return label;
}

function getUserTeamName(user) {
  if (!user) {
    return "";
  }
  return (
    user.metadata?.team_name ||
    user.metadata?.display_name ||
    user.display_name ||
    user.username ||
    ""
  );
}

function renderRosterSummary(roster, slots) {
  const needs = formatRosterNeeds(roster, slots);
  elements.rosterSummary.replaceChildren(
    ...needs.map((need) => {
      const chip = document.createElement("span");
      chip.className = "roster-chip";
      chip.textContent = `${need.position} ${need.value}/${need.target}`;
      return chip;
    })
  );
}

function renderDraftIntelligence() {
  elements.fantasyIqSummary?.replaceChildren();
  elements.draftCoachPanel?.replaceChildren();
  elements.stackAnalyzerPanel?.replaceChildren();
  elements.playoffFocusPanel?.replaceChildren();
  elements.draftSimulatorPanel?.replaceChildren();
  elements.draftStrategyMeter?.replaceChildren();
  elements.pickPrediction?.replaceChildren();
  elements.liveMomentumPanel?.replaceChildren();
  elements.draftFeed?.replaceChildren();
  renderComparisonPanel();
  if (!state.draft || !state.recommendations || !state.rosterId) {
    return;
  }

  const iq = calculateFantasyIq();
  const cards = [
    ["Blitz IQ", `${iq.score} Blitz IQ`, `${iq.percentile} - ${iq.headline}`],
    ["Confidence", `${iq.confidence}%`, iq.confidenceReason],
    ["Draft Grade", iq.gradeLetter, iq.gradeSummary],
    ["Draft Personality", iq.personality.title, iq.personality.note],
    ["Best Value", iq.biggestSteal?.name ?? "-", iq.biggestSteal ? `${iq.biggestSteal.delta} picks after board rank` : "No ranked steal yet"],
    ["Biggest Reach", iq.biggestReach?.name ?? "-", iq.biggestReach ? `${Math.abs(iq.biggestReach.delta)} picks early` : "No major reach yet"],
    ["Team Strength", `${iq.teamStrength}/100`, iq.finishProjection],
    ["Odds", `${formatOdds(iq.playoffOdds)} playoff / ${formatOdds(iq.championshipOdds)} Champ`, "League-relative estimate from roster power and grade gaps"],
    ["You Gained", iq.latestPickGain ? formatSignedBv(iq.latestPickGain.bvDelta) : "-", iq.latestPickGain ? `${iq.latestPickGain.name}: starter value ${formatSignedDecimal(iq.latestPickGain.starterWins)} wins / champ odds ${formatSignedPercent(iq.latestPickGain.championshipOddsDelta)}` : "Your next pick will show projected value gained"]
  ];

  for (const [label, value, note] of cards) {
    const card = document.createElement("div");
    card.className = "intel-card";
    const labelEl = document.createElement("span");
    labelEl.textContent = label;
    const valueEl = document.createElement("strong");
    valueEl.textContent = value;
    const noteEl = document.createElement("small");
    noteEl.textContent = note;
    card.append(labelEl, valueEl, noteEl);
    elements.fantasyIqSummary.append(card);
  }

  renderDraftStrategyMeter(iq.strategy);
  renderDraftCoachPanel(iq);
  renderStackAnalyzerPanel(iq);
  renderPlayoffFocusPanel(iq);
  renderDraftSimulatorPanel();
  renderPickPrediction();
  renderLiveMomentumPanel();
  renderProactiveAssistantInsight(iq);
  renderDraftFeed(iq);
}

function calculateFantasyIq() {
  const rows = buildTeamRows();
  const myRow = rows.find((row) => row.rosterId === String(state.rosterId)) ?? null;
  const picks = myRow?.picks ?? [];
  const slots = state.recommendations?.slots ?? {};
  const counts = myRow?.counts ?? countPickPositions(picks);
  const format = getBoardFormat(getSelectedRankings(), getActiveDraftRankingFormat());
  let score = 72;
  let biggestSteal = null;
  let biggestReach = null;
  let eliteTeTaken = false;

  for (const pick of picks) {
    let delta = 0;
    const valueRank = pickValueRank(pick);
    if (valueRank) {
      delta = (pick.pickNo || valueRank) - valueRank;
      score += delta >= 0 ? Math.min(12, delta * 0.45) : Math.max(-15, delta * 0.38);
      if (delta >= 18) {
        score += 3;
      }
      if (delta <= -25) {
        score -= 5;
      }
      if (!biggestSteal || delta > biggestSteal.delta) {
        biggestSteal = { ...pick, delta: Math.round(delta) };
      }
      if (!biggestReach || delta < biggestReach.delta) {
        biggestReach = { ...pick, delta: Math.round(delta) };
      }
    }

    if (pick.position === "TE" && valueRank && valueRank <= 55 && !eliteTeTaken) {
      score += 6;
      eliteTeTaken = true;
    }
  }

  const rb = counts.RB ?? 0;
  const wr = counts.WR ?? 0;
  const qb = counts.QB ?? 0;
  if (picks.length >= 4 && rb >= 4 && wr <= 1) score -= 8;
  if (picks.length >= 4 && wr >= 4 && rb <= 1) score -= 7;
  if (picks.length >= 5 && qb === 0 && (slots.SUPER_FLEX ?? 0) > 0) score -= 10;
  if (picks.length >= 8 && rb >= 2 && wr >= 2) score += 5;
  if (picks.length >= 5 && picks.every((pick) => {
    const valueRank = pickValueRank(pick);
    return valueRank && valueRank <= (pick.pickNo || 999) + 18;
  })) score += 4;

  const gradeScore = myRow?.grade?.score ?? score;
  const rosterPower = teamStrengthScore(picks, counts, slots, format);
  const teamStrength = Math.round(clamp(myRow?.odds?.power ?? (score * 0.25 + gradeScore * 0.4 + rosterPower * 0.35), 0, 100));
  const orderedRows = rows
    .filter((row) => row.picks.length)
    .sort((a, b) => (b.odds?.power ?? b.grade?.score ?? 0) - (a.odds?.power ?? a.grade?.score ?? 0));
  const rank = Number(myRow?.leagueRank) || orderedRows.findIndex((row) => row.rosterId === String(state.rosterId)) + 1;
  const total = Math.max(orderedRows.length, Number(state.draft?.settings?.teams ?? 0), 1);
  const finishProjection = rank > 0 && !myRow?.grade?.pending ? `Projected league rank ${rank}/${total}` : "Waiting for 4 graded picks";
  const playoffOdds = myRow?.odds?.playoff ?? null;
  const championshipOdds = myRow?.odds?.championship ?? null;
  const latestPickGain = calculateLatestPickGain(picks, myRow, slots, format);
  const finalScore = Math.round(clamp(score, 0, 100));
  const strategy = strategyProfileForPicks(picks, counts, slots, format);
  const personality = draftPersonalityForPicks(picks, counts, finalScore, strategy);
  const confidence = draftConfidenceForIq(finalScore, picks, biggestReach, biggestSteal);

  return {
    score: finalScore,
    percentile: blitzIqPercentile(finalScore),
    headline: picks.length < 5 ? `${picks.length}/5 picks before full read` : iqHeadline(finalScore),
    confidence: confidence.percent,
    confidenceReason: confidence.reason,
    gradeLetter: myRow?.grade?.letter ?? letterGrade(finalScore),
    gradeSummary: myRow?.grade?.summary ?? gradeSummary(finalScore),
    personality,
    strategy,
    biggestSteal: biggestSteal && biggestSteal.delta > 0 ? biggestSteal : null,
    biggestReach: biggestReach && biggestReach.delta < -8 ? biggestReach : null,
    teamStrength,
    finishProjection,
    playoffOdds,
    championshipOdds,
    latestPickGain
  };
}

function calculateLatestPickGain(picks = [], row = null, slots = {}, format = "ppr") {
  const latest = [...picks]
    .filter((pick) => pick.position !== "DEF")
    .sort((left, right) => Number(right.pickNo ?? 0) - Number(left.pickNo ?? 0))[0];
  if (!latest) {
    return null;
  }

  const actualBv = Number(latest.blitzValue?.overall ?? 0);
  if (!Number.isFinite(actualBv) || actualBv <= 0) {
    return null;
  }

  const expectedBv = expectedBlitzValueForPick(latest.pickNo || latest.rank || picks.length);
  const bvDelta = Math.round(actualBv - expectedBv);
  const replacementBv = starterReplacementBv(latest.position, slots, format);
  const starterWins = round1(clamp((actualBv - replacementBv) / 1200 + bvDelta / 2200, -2.5, 3.5));
  const power = Number(row?.odds?.power ?? row?.grade?.power ?? row?.grade?.score ?? 70);
  const championshipOddsDelta = round1(clamp(starterWins * 0.9 + bvDelta / 900 + Math.max(0, power - 75) * 0.04, -6.5, 8.5));

  return {
    name: latest.name,
    position: latest.position,
    bvDelta,
    starterWins,
    championshipOddsDelta
  };
}

function expectedBlitzValueForPick(pickNo) {
  const pick = Math.max(1, Number(pickNo) || 1);
  return Math.round(interpolateRankCurve(pick, [
    [1, 9400],
    [2, 9320],
    [6, 9050],
    [12, 8650],
    [24, 8050],
    [36, 7520],
    [50, 7000],
    [72, 6350],
    [100, 5600],
    [130, 4900],
    [160, 4200],
    [200, 3400],
    [260, 2500],
    [350, 1500]
  ]));
}

function starterReplacementBv(position, slots = {}, format = "ppr") {
  const isSuperflex = format === "superflex_dynasty" || (slots.SUPER_FLEX ?? 0) > 0;
  if (position === "QB") {
    return isSuperflex ? 7600 : 6600;
  }
  if (position === "RB") return 6600;
  if (position === "WR") return 6700;
  if (position === "TE") return 5900;
  return 4200;
}

function blitzIqPercentile(score) {
  if (score >= 96) return "Top 1%";
  if (score >= 92) return "Top 3%";
  if (score >= 88) return "Top 8%";
  if (score >= 82) return "Top 18%";
  if (score >= 74) return "Top 40%";
  if (score >= 64) return "Middle pack";
  return "Needs a rally";
}

function draftConfidenceForIq(score, picks = [], biggestReach = null, biggestSteal = null) {
  if (picks.length < 4) {
    return { percent: 61, reason: "Early read; the roster needs a few more picks before every model agrees." };
  }
  const reachDrag = biggestReach?.delta < -18 ? 9 : biggestReach?.delta < -8 ? 4 : 0;
  const stealLift = biggestSteal?.delta > 20 ? 5 : biggestSteal?.delta > 8 ? 2 : 0;
  const percent = Math.round(clamp(score * 0.72 + 23 + stealLift - reachDrag, 48, 98));
  const reason =
    percent >= 92
      ? "Every model agrees."
      : percent >= 80
        ? "Strong build with only minor risk pockets."
        : percent >= 66
          ? "Solid path, but value and roster shape still need work."
          : "High upside but volatile.";
  return { percent, reason };
}

function pickValueRank(pick) {
  const rank = Number(pick?.valueRank ?? pick?.providerRank ?? pick?.adviceRank ?? pick?.rank);
  return Number.isFinite(rank) && rank > 0 ? rank : null;
}

function strategyProfileForPicks(picks = [], counts = {}, slots = {}, format = "ppr") {
  const early = picks.slice(0, 6);
  const rb = counts.RB ?? 0;
  const wr = counts.WR ?? 0;
  const qb = counts.QB ?? 0;
  const te = counts.TE ?? 0;
  const hasEliteQb = picks.some((pick) => pick.position === "QB" && Number(pickValueRank(pick)) <= (format === "superflex_dynasty" ? 36 : 70));
  const hasAnchorWr = picks.some((pick) => pick.position === "WR" && Number(pickValueRank(pick)) <= 24);
  const active = [];
  if (early.length >= 3 && early.filter((pick) => pick.position === "RB").length === 0) active.push("Zero RB");
  if (early.filter((pick) => pick.position === "RB").length === 1 && early.filter((pick) => pick.position === "WR").length >= 2) active.push("Hero RB");
  if (early.filter((pick) => pick.position === "RB").length >= 3) active.push("Robust RB");
  if (qb === 0 && picks.length >= 6) active.push("Late QB");
  if (hasEliteQb && qb > 0) active.push("Elite QB");
  if (hasAnchorWr) active.push("Anchor WR");
  if (rb >= 2 && wr >= 2 && (qb >= 1 || picks.length < 6) && te <= 1) active.push("Balanced");
  if (!active.length) active.push("Balanced");
  return {
    active,
    all: ["Zero RB", "Hero RB", "Robust RB", "Late QB", "Elite QB", "Anchor WR", "Balanced"],
    summary: active.join(" + ")
  };
}

function draftPersonalityForPicks(picks = [], counts = {}, score = 72, strategy = null) {
  const valuePicks = picks.filter((pick) => {
    const valueRank = pickValueRank(pick);
    return valueRank && (pick.pickNo || valueRank) - valueRank >= 10;
  }).length;
  const reaches = picks.filter((pick) => {
    const valueRank = pickValueRank(pick);
    return valueRank && (pick.pickNo || valueRank) - valueRank <= -12;
  }).length;
  const safePicks = picks.filter((pick) => Number(pick.playerRating) >= 82).length;
  const elitePicks = picks.filter((pick) => Number(pick.playerRating) >= 92).length;
  if (elitePicks >= 2 && score >= 86) {
    return { title: "The League Winner", note: "Elite-player start with enough structure to chase ceiling." };
  }
  if (valuePicks >= Math.max(2, Math.floor(picks.length / 4))) {
    return { title: "The Value Hunter", note: "You keep letting the room hand you board discounts." };
  }
  if (reaches >= 2) {
    return { title: "The Gambler", note: "Aggressive ceiling shots are shaping the build." };
  }
  if ((counts.RB ?? 0) >= 2 && (counts.WR ?? 0) >= 2 && strategy?.active?.includes("Balanced")) {
    return { title: "The Architect", note: "Balanced roster structure with room to attack tiers." };
  }
  if (safePicks >= Math.max(3, picks.length - 1)) {
    return { title: "The Safe Bet", note: "Stable player quality is carrying the build." };
  }
  return { title: "The Architect", note: "Still forming, but the roster is being built with structure." };
}

function renderDraftStrategyMeter(strategy) {
  if (!elements.draftStrategyMeter || !strategy) {
    return;
  }
  const title = document.createElement("div");
  title.className = "strategy-title";
  title.textContent = "Draft Strategy Meter";
  const row = document.createElement("div");
  row.className = "strategy-chip-row";
  for (const label of strategy.all ?? []) {
    const chip = document.createElement("span");
    chip.className = "strategy-chip";
    chip.classList.toggle("is-active", (strategy.active ?? []).includes(label));
    chip.textContent = label;
    row.append(chip);
  }
  elements.draftStrategyMeter.replaceChildren(title, row);
}

function renderDraftCoachPanel(iq = null) {
  const row = getMyTeamRow();
  if (!row || !elements.draftCoachPanel) {
    return;
  }
  const coach = buildDraftCoach(row, iq);
  renderInsightPanel(elements.draftCoachPanel, "AI Draft Coach", "Your draft so far", [
    ["Strength", coach.strength, coach.strengthNote],
    ["Weakness", coach.weakness, coach.weaknessNote],
    ["Recommendation", coach.recommendation, coach.recommendationNote]
  ]);
}

function renderStackAnalyzerPanel() {
  const row = getMyTeamRow();
  if (!row || !elements.stackAnalyzerPanel) {
    return;
  }
  const stack = buildStackAnalyzer(row);
  renderInsightPanel(elements.stackAnalyzerPanel, "Stack Analyzer", "Current roster and live board", [
    ["Current stacks", stack.current.value, stack.current.note],
    ["Potential stack", stack.potential.value, stack.potential.note],
    ["Game environments", stack.environment.value, stack.environment.note]
  ]);
}

function renderPlayoffFocusPanel(iq = null) {
  const row = getMyTeamRow();
  if (!row || !elements.playoffFocusPanel) {
    return;
  }
  const focus = buildPlayoffFocus(row, iq);
  renderInsightPanel(elements.playoffFocusPanel, "Playoff Focus", "Weeks 15-17", [
    ["Weeks 15-17", `${focus.balance} ${focus.score}`, `Opponent difficulty ${focus.difficulty}`],
    ["Playoff grade", focus.grade, focus.note]
  ]);

  const gradeGrid = document.createElement("div");
  gradeGrid.className = "position-grade-grid";
  for (const item of focus.positionGrades) {
    const chip = document.createElement("div");
    chip.className = "position-grade-chip";
    const label = document.createElement("span");
    label.textContent = item.label;
    const grade = document.createElement("strong");
    grade.textContent = item.grade;
    chip.append(label, grade);
    gradeGrid.append(chip);
  }
  elements.playoffFocusPanel.append(gradeGrid);
}

function renderDraftSimulatorPanel() {
  const simulation = state.whatIfSimulations;
  if (!elements.draftSimulatorPanel || !simulation?.items?.length) {
    return;
  }
  const best = simulation.items[0];
  renderInsightPanel(elements.draftSimulatorPanel, "Draft Simulator", "10,000 live what-if outcomes", [
    ["Recommended", `Draft ${best.name}`, `Average final team grade ${best.averageFinalGrade}`],
    ["Confidence", `${best.confidence}%`, best.confidenceReason]
  ]);

  const table = document.createElement("div");
  table.className = "sim-result-list";
  for (const item of simulation.items.slice(0, 3)) {
    const row = document.createElement("div");
    row.className = "sim-result-row";
    row.classList.toggle("is-best", item.playerId === best.playerId);
    const name = document.createElement("span");
    name.textContent = item.name;
    const grade = document.createElement("strong");
    grade.textContent = item.averageFinalGrade;
    const confidence = document.createElement("small");
    confidence.textContent = `${item.confidence}%`;
    row.append(name, grade, confidence);
    table.append(row);
  }
  elements.draftSimulatorPanel.append(table);
}

function renderLiveMomentumPanel() {
  if (!elements.liveMomentumPanel) {
    return;
  }
  const momentum = buildLiveDraftMomentum();
  renderInsightPanel(elements.liveMomentumPanel, "Live Draft Momentum", "League market read", [
    ["Currently overvaluing", momentum.overvalued, momentum.overvaluedNote],
    ["Current value", momentum.value, momentum.valueNote],
    ["Adaptation", momentum.action, momentum.actionNote]
  ]);
}

function renderInsightPanel(container, title, subtitle, rows = []) {
  if (!container || !rows.length) {
    return;
  }
  const heading = document.createElement("div");
  heading.className = "insight-heading";
  const titleEl = document.createElement("strong");
  titleEl.textContent = title;
  const subtitleEl = document.createElement("span");
  subtitleEl.textContent = subtitle;
  heading.append(titleEl, subtitleEl);

  const body = document.createElement("div");
  body.className = "insight-rows";
  for (const [label, value, note] of rows) {
    const item = document.createElement("div");
    item.className = "insight-row";
    const labelEl = document.createElement("span");
    labelEl.textContent = label;
    const valueEl = document.createElement("strong");
    valueEl.textContent = value || "-";
    const noteEl = document.createElement("small");
    noteEl.textContent = note || "";
    item.append(labelEl, valueEl, noteEl);
    body.append(item);
  }

  container.replaceChildren(heading, body);
}

function getMyTeamRow() {
  return buildTeamRows().find((row) => row.rosterId === String(state.rosterId)) ?? null;
}

function buildDraftCoach(row, iq = null) {
  const slots = state.recommendations?.slots ?? {};
  const format = getBoardFormat(getSelectedRankings(), getActiveDraftRankingFormat());
  const grades = buildRosterPositionGrades(row.picks, slots, format);
  const strength = strongestRosterGrade(grades);
  const weakness = weakestRosterGrade(grades, row.counts, slots);
  const target = coachTargetPosition(row, weakness, slots);
  const top = state.recommendations?.candidates?.[0];
  const recommendation = target.candidate
    ? `Target ${target.position} in the next two rounds`
    : top?.name
      ? `Stay value-first with ${top.name}`
      : "Keep building around the next tier break";

  return {
    strength: strength.title,
    strengthNote: strength.note,
    weakness: weakness.title,
    weaknessNote: weakness.note,
    recommendation,
    recommendationNote: target.candidate
      ? `${target.candidate.name} is the best live answer; ${shortAssistantWhy(target.candidate)}`
      : `${iq?.personality?.title ?? "Build"} profile: protect value while filling the weakest starter/flex lane.`
  };
}

function strongestRosterGrade(grades = []) {
  const best = [...grades].filter((item) => item.label !== "Bench").sort((a, b) => b.score - a.score)[0];
  if (!best) {
    return { title: "Still forming", note: "Need more picks before a real strength appears." };
  }
  const prefix = best.score >= 90 ? "Elite" : best.score >= 82 ? "Strong" : best.score >= 74 ? "Solid" : "Developing";
  return {
    title: `${prefix} ${best.label} room`,
    note: `${best.grade} grade from starter quality and usable depth.`
  };
}

function weakestRosterGrade(grades = [], counts = {}, slots = {}) {
  const structural = [
    { label: "RB", title: "RB depth", active: (counts.RB ?? 0) < Math.max(1, slots.RB ?? 1) },
    { label: "WR", title: "WR depth", active: (counts.WR ?? 0) < Math.max(2, slots.WR ?? 2) },
    { label: "QB", title: "QB2", active: (slots.SUPER_FLEX ?? 0) > 0 && (counts.QB ?? 0) < 2 },
    { label: "TE", title: "TE slot", active: (counts.TE ?? 0) === 0 && ((counts.RB ?? 0) + (counts.WR ?? 0)) >= 5 }
  ].find((item) => item.active);
  if (structural) {
    return {
      label: structural.label,
      title: structural.title,
      note: "Roster construction is asking for this position before luxury depth."
    };
  }
  const weakest = [...grades].filter((item) => item.label !== "Bench").sort((a, b) => a.score - b.score)[0];
  return weakest
    ? { label: weakest.label, title: `${weakest.label} depth`, note: `${weakest.grade} grade is the lowest starter lane.` }
    : { label: "FLEX", title: "Flex depth", note: "No major structural hole yet." };
}

function coachTargetPosition(row, weakness, slots = {}) {
  const candidates = state.recommendations?.candidates ?? [];
  const position = weakness?.label && weakness.label !== "Bench" ? weakness.label : bestFlexTarget(row.counts, slots);
  const candidate = candidates.find((item) => item.position === position) ??
    candidates.find((item) => ["RB", "WR"].includes(item.position)) ??
    candidates[0] ??
    null;
  return {
    position: positionFullName(position),
    candidate
  };
}

function bestFlexTarget(counts = {}, slots = {}) {
  const rbGap = Math.max(0, Math.max(2, slots.RB ?? 2) - (counts.RB ?? 0));
  const wrGap = Math.max(0, Math.max(2, slots.WR ?? 2) - (counts.WR ?? 0));
  return rbGap >= wrGap ? "RB" : "WR";
}

function buildStackAnalyzer(row) {
  const current = currentStackSummary(row.picks);
  const potential = potentialStackSummary(row.picks, state.recommendations?.candidates ?? []);
  const environment = gameEnvironmentSummary(row.picks, state.recommendations?.candidates ?? []);
  return { current, potential, environment };
}

function currentStackSummary(picks = []) {
  const stacks = [];
  for (const left of picks) {
    for (const right of picks) {
      if (left.playerId === right.playerId || !left.team || left.team !== right.team) {
        continue;
      }
      const boost = stackBoostForPair(left, right);
      if (boost <= 0) {
        continue;
      }
      const key = [left.playerId, right.playerId].sort().join("|");
      if (stacks.some((item) => item.key === key)) {
        continue;
      }
      stacks.push({
        key,
        value: `${shortPlayerName(left.name)} + ${shortPlayerName(right.name)} +${boost}%`,
        note: `${left.team} correlation already on your roster.`,
        boost
      });
    }
  }
  const best = stacks.sort((a, b) => b.boost - a.boost)[0];
  return best ?? {
    value: "None yet",
    note: "No same-team QB/skill or game-environment stack on your roster."
  };
}

function potentialStackSummary(picks = [], candidates = []) {
  const potentials = [];
  for (const candidate of candidates.slice(0, 12)) {
    for (const pick of picks) {
      if (!candidate.team || candidate.team !== pick.team || candidate.playerId === pick.playerId) {
        continue;
      }
      const boost = stackBoostForPair(candidate, pick);
      if (boost <= 0) {
        continue;
      }
      potentials.push({
        value: `${shortPlayerName(candidate.name)} + ${shortPlayerName(pick.name)} +${boost}%`,
        note: `${candidate.name} adds ${candidate.team} correlation without forcing a low-grade pick.`,
        boost,
        score: boost * 10 + assistantCandidateScore(candidate)
      });
    }
  }
  const best = potentials.sort((a, b) => b.score - a.score)[0];
  return best ?? {
    value: "No clean stack",
    note: "The board is not offering a stack that beats pure value yet."
  };
}

function gameEnvironmentSummary(picks = [], candidates = []) {
  const byTeam = new Map();
  for (const item of [...picks, ...candidates.slice(0, 18)]) {
    if (!item.team || !["QB", "RB", "WR", "TE"].includes(item.position)) {
      continue;
    }
    const current = byTeam.get(item.team) ?? { team: item.team, count: 0, score: 0, names: [] };
    current.count += 1;
    current.score += Number(item.playerRating ?? item.totalScore ?? 60);
    current.names.push(shortPlayerName(item.name));
    byTeam.set(item.team, current);
  }
  const best = [...byTeam.values()]
    .filter((item) => item.count >= 2)
    .sort((a, b) => b.score - a.score)[0];
  if (!best) {
    return {
      value: "No clear boost",
      note: "No offense has enough live pieces to matter more than player value."
    };
  }
  const boost = best.score >= 175 ? 4 : 3;
  return {
    value: `${best.team} +${boost}%`,
    note: `${best.names.slice(0, 3).join(", ")} create the best available game environment.`
  };
}

function stackBoostForPair(left, right) {
  const positions = new Set([left.position, right.position]);
  if (positions.has("DEF")) return 0;
  if (positions.has("QB")) {
    if (positions.has("WR")) return 7;
    if (positions.has("TE")) return 5;
    if (positions.has("RB")) return 4;
  }
  if (["RB", "WR", "TE"].includes(left.position) && ["RB", "WR", "TE"].includes(right.position)) {
    return 3;
  }
  return 0;
}

function buildPlayoffFocus(row, iq = null) {
  const slots = state.recommendations?.slots ?? {};
  const format = getBoardFormat(getSelectedRankings(), getActiveDraftRankingFormat());
  const grades = buildRosterPositionGrades(row.picks, slots, format);
  const gradeAverage = average(grades.map((item) => item.score));
  const balancePenalty = Math.max(0, 78 - Math.min(...grades.map((item) => item.score))) * 0.12;
  const score = Math.round(clamp((iq?.teamStrength ?? row.grade?.teamStrength ?? 72) * 0.58 + gradeAverage * 0.42 - balancePenalty, 45, 99));
  const difficulty = score >= 86 ? "Easy" : score >= 75 ? "Balanced" : "Hard";
  const balance = Math.min(...grades.map((item) => item.score)) >= 76 ? "Balanced" : "Uneven";
  return {
    score,
    balance,
    difficulty,
    grade: letterGrade(score),
    note: "Built from projected starter strength, bench insulation, and position balance.",
    positionGrades: grades.map((item) => ({ label: item.label, grade: item.grade }))
  };
}

function buildRosterPositionGrades(picks = [], slots = {}, format = "ppr") {
  const byPosition = new Map(["QB", "RB", "WR", "TE"].map((position) => [position, []]));
  for (const pick of picks) {
    if (byPosition.has(pick.position)) {
      byPosition.get(pick.position).push(pick);
    }
  }
  for (const group of byPosition.values()) {
    group.sort((left, right) => Number(right.playerRating ?? 0) - Number(left.playerRating ?? 0));
  }
  const positionTargets = {
    QB: format === "superflex_dynasty" || (slots.SUPER_FLEX ?? 0) > 0 ? 2 : 1,
    RB: Math.max(1, Number(slots.RB ?? 2)),
    WR: Math.max(2, Number(slots.WR ?? 2)),
    TE: Math.max(1, Number(slots.TE ?? 1))
  };
  const grades = ["QB", "RB", "WR", "TE"].map((position) => {
    const group = byPosition.get(position) ?? [];
    const target = positionTargets[position] ?? 1;
    const starters = group.slice(0, target);
    const avg = average(starters.map((pick) => Number(pick.playerRating)));
    const depth = average(group.slice(target, target + 2).map((pick) => Number(pick.playerRating)));
    const score = Math.round(clamp((avg || 56) + (depth ? (depth - 62) * 0.05 : 0) - Math.max(0, target - group.length) * 8, 35, 99));
    return {
      label: position,
      score,
      grade: letterGrade(score)
    };
  });
  const lineup = buildProjectedLineup(picks, slots);
  const benchScore = Math.round(clamp(average(lineup.bench.slice(0, 4).map((pick) => Number(pick.playerRating))) || 55, 35, 99));
  grades.push({ label: "Bench", score: benchScore, grade: letterGrade(benchScore) });
  return grades;
}

function buildLiveDraftMomentum() {
  const rankingLookup = buildRankingLookup(getSelectedRankings());
  const recent = state.picks
    .slice(-24)
    .map((pick) => getPickDetails(pick, rankingLookup))
    .filter((pick) => ["QB", "RB", "WR", "TE"].includes(pick.position));
  if (recent.length < 8) {
    return {
      overvalued: "Still forming",
      overvaluedNote: `${Math.max(0, 8 - recent.length)} more picks until a live market read.`,
      value: state.recommendations?.candidates?.[0]?.position ? positionFullName(state.recommendations.candidates[0].position) : "-",
      valueNote: "Early draft, so trust board value first.",
      action: "Stay flexible",
      actionNote: "The room has not declared a clear position run yet."
    };
  }

  const stats = positionMomentumStats(recent);
  const overvalued = stats.sort((a, b) => b.overScore - a.overScore)[0];
  const value = currentValuePosition(overvalued?.position);
  return {
    overvalued: positionFullName(overvalued?.position),
    overvaluedNote: `${positionFullName(overvalued?.position)} are going ${Math.abs(Math.round(overvalued?.avgDelta ?? 0))} picks ahead of value on average.`,
    value: positionFullName(value.position),
    valueNote: value.note,
    action: value.position ? `Lean ${positionFullName(value.position)}` : "Stay value-first",
    actionNote: "This updates from recent picks plus the live available board."
  };
}

function positionMomentumStats(picks = []) {
  return ["QB", "RB", "WR", "TE"].map((position) => {
    const group = picks.filter((pick) => pick.position === position && pickValueRank(pick));
    const avgDelta = group.length
      ? group.reduce((total, pick) => {
        const valueRank = pickValueRank(pick);
        return total + ((pick.pickNo || valueRank) - valueRank);
      }, 0) / group.length
      : 0;
    return {
      position,
      count: group.length,
      avgDelta,
      overScore: group.length * 1.5 + Math.max(0, -avgDelta) * 1.3
    };
  });
}

function currentValuePosition(overvaluedPosition = "") {
  const currentPick = state.recommendations?.currentPick ?? state.picks.length + 1;
  const board = (state.recommendations?.availableBoard ?? []).filter((candidate) => ["QB", "RB", "WR", "TE"].includes(candidate.position)).slice(0, 48);
  const values = ["QB", "RB", "WR", "TE"].map((position) => {
    const group = board.filter((candidate) => candidate.position === position).slice(0, 8);
    const score = average(group.map((candidate) =>
      Number(candidate.pickGrade ?? candidate.totalScore ?? 60) +
      clamp((currentPick - Number(candidate.rankSort ?? currentPick)) * 0.12, -5, 8) +
      (candidate.position === overvaluedPosition ? -4 : 0)
    ));
    return { position, score };
  }).sort((a, b) => b.score - a.score)[0];
  return {
    position: values?.position ?? "",
    note: values?.position ? `${positionFullName(values.position)} have the best blend of grade, discount, and availability right now.` : "No position has separated yet."
  };
}

function buildWhatIfSimulations() {
  if (!state.recommendations?.candidates?.length || !state.rosterId) {
    return { signature: "", items: [], byPlayerId: new Map() };
  }
  const candidates = state.recommendations.candidates.slice(0, VISIBLE_RECOMMENDATION_LIMIT);
  const signature = [
    state.pickSignature,
    state.rosterId,
    state.recommendations.currentPick,
    candidates.map((candidate) => candidate.playerId).join(",")
  ].join("|");
  if (state.whatIfSimulations?.signature === signature) {
    return state.whatIfSimulations;
  }

  const row = buildTeamRows().find((item) => item.rosterId === String(state.rosterId));
  if (!row) {
    return { signature, items: [], byPlayerId: new Map() };
  }

  const slots = state.recommendations.slots ?? {};
  const format = getBoardFormat(getSelectedRankings(), getActiveDraftRankingFormat());
  const board = (state.recommendations.availableBoard ?? [])
    .filter((candidate) => candidate.position !== "DEF")
    .slice(0, 90);
  const items = candidates.map((candidate, index) =>
    simulateCandidateOutcome(candidate, row, slots, format, board, hashString(`${signature}:${index}`))
  ).sort((left, right) => right.averageFinalGrade - left.averageFinalGrade);
  const best = items[0];
  const second = items[1];
  for (const item of items) {
    const comparison = item.playerId === best?.playerId ? (item.averageFinalGrade - (second?.averageFinalGrade ?? item.averageFinalGrade)) : (item.averageFinalGrade - (best?.averageFinalGrade ?? item.averageFinalGrade));
    item.confidence = Math.round(clamp(62 + item.averageFinalGrade * 0.22 + comparison * 8 + (item.baseConfidence ?? 0) * 0.1, 45, 98));
    item.confidenceReason = item.playerId === best?.playerId
      ? `Best average roster outcome by ${Math.max(0.1, Math.round(comparison * 10) / 10)} grade points.`
      : `Trails the top what-if outcome by ${Math.max(0.1, Math.round(Math.abs(comparison) * 10) / 10)} grade points.`;
  }
  return {
    signature,
    items,
    byPlayerId: new Map(items.map((item) => [String(item.playerId), item]))
  };
}

function simulateCandidateOutcome(candidate, row, slots = {}, format = "ppr", board = [], seed = 1) {
  const iterations = 10000;
  const futurePickNumbers = futurePickNumbersForRoster(state.rosterId, (state.recommendations?.currentPick ?? state.picks.length + 1) + 1, 6);
  const targetPicks = Math.max(projectedStarterCount(slots) + 5, Math.min(Number(state.draft?.settings?.rounds ?? 16), 15));
  const futureTurns = Math.min(futurePickNumbers.length || 6, Math.max(2, targetPicks - row.picks.length - 1));
  const basePick = candidateToProjectedPick(candidate, state.recommendations?.currentPick ?? state.picks.length + 1);
  let totalGrade = 0;
  let totalPlayoff = 0;
  let starterHits = 0;

  for (let run = 0; run < iterations; run += 1) {
    const rng = seededRng(seed + run * 7919);
    const simPicks = [...row.picks, basePick];
    const used = new Set(simPicks.map((pick) => String(pick.playerId)).filter(Boolean));
    const counts = countPickPositions(simPicks);
    for (let turn = 0; turn < futureTurns; turn += 1) {
      const pickNo = futurePickNumbers[turn] ?? ((state.recommendations?.currentPick ?? state.picks.length + 1) + (turn + 1) * Math.max(1, Number(slots.teams ?? 12)));
      const next = selectSimFuturePick(board, used, counts, slots, pickNo, format, rng);
      if (!next) {
        continue;
      }
      const projected = candidateToProjectedPick(next, pickNo);
      simPicks.push(projected);
      used.add(String(projected.playerId));
      counts[projected.position] = (counts[projected.position] ?? 0) + 1;
    }
    const evaluation = evaluateTeamDraft(simPicks, counts, slots, format);
    totalGrade += evaluation.score;
    totalPlayoff += clamp(evaluation.teamStrength * 0.6 + evaluation.score * 0.4, 45, 99);
    if (buildProjectedLineup(simPicks, slots).starters.some((pick) => pick.playerId === basePick.playerId)) {
      starterHits += 1;
    }
  }

  return {
    playerId: String(candidate.playerId),
    name: candidate.name,
    position: candidate.position,
    averageFinalGrade: round1(totalGrade / iterations),
    playoffGrade: round1(totalPlayoff / iterations),
    starterRate: Math.round(starterHits / iterations * 100),
    baseConfidence: Number(candidate.confidence?.percent ?? 70)
  };
}

function futurePickNumbersForRoster(rosterId, fromPick, count = 6) {
  const numbers = [];
  let searchFrom = Math.max(1, Number(fromPick) || 1);
  while (numbers.length < count) {
    const next = nextPickForRoster(rosterId, searchFrom);
    if (!next || numbers.includes(next)) {
      break;
    }
    numbers.push(next);
    searchFrom = next + 1;
  }
  return numbers;
}

function selectSimFuturePick(board = [], used = new Set(), counts = {}, slots = {}, pickNo = 1, format = "ppr", rng = Math.random) {
  let best = null;
  let bestScore = -Infinity;
  for (const candidate of board) {
    if (used.has(String(candidate.playerId))) {
      continue;
    }
    if (rng() > estimatedAvailabilityAtPick(candidate, pickNo)) {
      continue;
    }
    const score = simFuturePickScore(candidate, counts, slots, pickNo, format) + (rng() + rng() - 1) * 8;
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return best ?? board.find((candidate) => !used.has(String(candidate.playerId))) ?? null;
}

function simFuturePickScore(candidate, counts = {}, slots = {}, pickNo = 1, format = "ppr") {
  const rating = Number(candidate.playerRating ?? candidate.totalScore ?? 60);
  const roomRank = Number(candidate.marketRank ?? candidate.platformRank ?? candidate.rankSort ?? pickNo);
  const value = clamp((pickNo - roomRank) * 0.16, -8, 8);
  const position = candidate.position;
  const isSuperflex = format === "superflex_dynasty" || (slots.SUPER_FLEX ?? 0) > 0;
  let need = 0;
  if (position === "RB") {
    need += Math.max(0, 3 - (counts.RB ?? 0)) * 6;
    if ((counts.WR ?? 0) >= 4 && (counts.RB ?? 0) <= 2) need += 8;
  }
  if (position === "WR") {
    need += Math.max(0, 4 - (counts.WR ?? 0)) * 5;
    if ((counts.RB ?? 0) >= 4 && (counts.WR ?? 0) <= 2) need += 8;
  }
  if (position === "QB") {
    const target = isSuperflex ? 2 : 1;
    need += Math.max(0, target - (counts.QB ?? 0)) * (isSuperflex ? 8 : 4);
    if (!isSuperflex && (counts.QB ?? 0) >= 2) need -= 20;
  }
  if (position === "TE") {
    need += (counts.TE ?? 0) === 0 ? 6 : -8;
    if ((counts.TE ?? 0) >= 2) need -= 14;
  }
  return rating + value + need + Number(candidate.components?.tier ?? 0);
}

function estimatedAvailabilityAtPick(candidate, pickNo = 1) {
  const roomRank = Number(candidate.marketRank ?? candidate.platformRank ?? candidate.rankSort ?? pickNo);
  const gap = roomRank - pickNo;
  if (gap <= -30) return 0.02;
  if (gap <= -16) return 0.08;
  if (gap <= -6) return 0.18;
  if (gap <= 0) return 0.32;
  if (gap <= 10) return 0.62;
  if (gap <= 24) return 0.82;
  return 0.94;
}

function candidateToProjectedPick(candidate, pickNo = 1) {
  const displayRank = Number(candidate.rankSort ?? candidate.ranking?.rank ?? 0) || null;
  const valueRank = Number(candidate.valueRankSort ?? candidate.ranking?.valueRankSort ?? candidate.ranking?.valueOverallRank ?? candidate.ranking?.providerRank ?? 0) || displayRank;
  return {
    pickNo,
    playerId: String(candidate.playerId),
    name: candidate.name,
    position: candidate.position,
    team: candidate.team,
    rank: displayRank,
    valueRank,
    providerRank: valueRank,
    marketRank: Number(candidate.marketRank ?? candidate.platformRank ?? candidate.ranking?.adp ?? 0) || null,
    adviceRank: Number(candidate.adviceRank ?? 0) || null,
    tier: Number(candidate.tier ?? candidate.positionTier ?? 0) || null,
    age: Number(candidate.player?.age ?? candidate.ranking?.age ?? 0) || null,
    fantasyCalcValue: Number(candidate.fantasyCalcValue ?? candidate.calculatedValue ?? candidate.ranking?.calculatedValue ?? candidate.ranking?.fantasyCalcValue ?? candidate.ranking?.value ?? 0) || null,
    blitzValue: candidate.blitzValue,
    playerRating: Number(candidate.playerRating ?? candidate.totalScore ?? 60)
  };
}

function hashString(text = "") {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRng(seed = 1) {
  let value = (Number(seed) || 1) % 2147483647;
  if (value <= 0) value += 2147483646;
  return () => {
    value = value * 16807 % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function positionFullName(position = "") {
  return {
    QB: "Quarterbacks",
    RB: "Running backs",
    WR: "Wide receivers",
    TE: "Tight ends",
    FLEX: "Flex options"
  }[position] ?? position ?? "-";
}

function shortPlayerName(name = "") {
  const parts = String(name).split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return parts[0] ?? "";
  return parts[parts.length - 1];
}

function iqHeadline(score) {
  if (score >= 90) return "Sharp value and strong build";
  if (score >= 82) return "Good value discipline";
  if (score >= 74) return "Solid, still needs hits";
  if (score >= 64) return "Some recovery picks needed";
  return "Draft needs a value reset";
}

function renderPickPrediction() {
  const predictions = predictNextPicks();
  if (!predictions.length) {
    return;
  }

  const title = document.createElement("div");
  title.className = "prediction-title";
  title.textContent = "Likely next 5 picks";
  elements.pickPrediction.append(title);

  for (const item of predictions) {
    const row = document.createElement("div");
    row.className = "prediction-row";
    const odds = document.createElement("strong");
    odds.textContent = `${item.probability}%`;
    const text = document.createElement("span");
    text.textContent = `${item.position} - ${item.name} (${item.teamLabel})`;
    row.append(odds, text);
    elements.pickPrediction.append(row);
  }
}

function renderProactiveAssistantInsight(iq = null) {
  if (!elements.assistantAnswer || elements.assistantQuestionInput?.value?.trim()) {
    return;
  }
  const insight = buildProactiveAssistantInsight(iq);
  elements.assistantAnswer.textContent = insight ? `The Blitz Assistant: ${insight}` : "";
}

function buildProactiveAssistantInsight(iq = null) {
  const top = state.recommendations?.candidates?.[0];
  const board = state.recommendations?.availableBoard ?? [];
  if (!top || !board.length) {
    return "";
  }

  const qb = topAvailableCandidateAtPosition("QB");
  const qbNeedCount = countTeamsAheadNeeding("QB");
  const qbGone = Number(qb?.draftSim?.takenBeforeNextPct ?? 0);
  if (qb && qbNeedCount >= 2 && (qbGone >= 55 || qb.rankSort <= (state.recommendations?.currentPick ?? state.picks.length + 1) + 12)) {
    return `${qbNeedCount} teams ahead of you still need a quarterback. If you are targeting ${qb.name}, there is a high chance he will not make it back.`;
  }

  const rb = topAvailableCandidateAtPosition("RB");
  const wr = topAvailableCandidateAtPosition("WR");
  const gap = positionValueGap(rb, wr);
  if (gap && gap.percent >= 12) {
    const waitingPosition = gap.weaker.position;
    const strongerPosition = gap.stronger.position;
    const availableNext = Number(gap.weaker.draftSim?.availableNextPct ?? 58);
    const waitPhrase = availableNext >= 55
      ? `Waiting one round for ${waitingPosition} is likely to maximize expected value.`
      : `${waitingPosition} may not fully wait, so compare the tier break before passing.`;
    return `The value gap between the top remaining ${strongerPosition} and ${waitingPosition} is ${gap.percent}%. ${waitPhrase}`;
  }

  const bestSim = state.whatIfSimulations?.items?.[0];
  if (bestSim) {
    return `Out of 10,000 simulated draft paths from this spot, drafting ${bestSim.name} produced the strongest average final roster grade (${bestSim.averageFinalGrade}) with ${bestSim.confidence}% confidence.`;
  }

  const danger = board
    .filter((candidate) => Number(candidate.draftSim?.takenBeforeNextPct ?? 0) >= 70)
    .sort((left, right) => assistantCandidateScore(right) - assistantCandidateScore(left))[0];
  if (danger) {
    return `${danger.name} is ${danger.draftSim.takenBeforeNextPct}% likely to be gone by your next pick. If he fits your build, this is probably the decision point.`;
  }

  if (iq?.latestPickGain) {
    return `Your last pick added ${formatSignedBv(iq.latestPickGain.bvDelta)} and about ${formatSignedDecimal(iq.latestPickGain.starterWins)} projected starter wins. Next, protect the biggest RB/WR tier drop on the board.`;
  }

  return `${top.name} is the current lean because ${shortAssistantWhy(top)}`;
}

function topAvailableCandidateAtPosition(position) {
  return (state.recommendations?.availableBoard ?? [])
    .filter((candidate) => candidate.position === position)
    .sort((left, right) => assistantCandidateScore(right) - assistantCandidateScore(left) || left.rankSort - right.rankSort)[0] ?? null;
}

function positionValueGap(left, right) {
  if (!left || !right) {
    return null;
  }
  const leftValue = candidateValueForGap(left);
  const rightValue = candidateValueForGap(right);
  const stronger = leftValue >= rightValue ? left : right;
  const weaker = stronger === left ? right : left;
  const strongValue = Math.max(leftValue, rightValue);
  const weakValue = Math.max(1, Math.min(leftValue, rightValue));
  const percent = Math.round((strongValue - weakValue) / weakValue * 100);
  return percent > 0 ? { stronger, weaker, percent } : null;
}

function candidateValueForGap(candidate) {
  const bv = Number(candidate.blitzValue?.overall);
  if (Number.isFinite(bv) && bv > 0) {
    return bv;
  }
  return Number(candidate.pickGrade ?? candidate.totalScore ?? 0) * 100;
}

function countTeamsAheadNeeding(position) {
  const rows = buildTeamRows();
  const rowByRoster = new Map(rows.map((row) => [row.rosterId, row]));
  const slots = state.recommendations?.slots ?? {};
  const currentPick = state.picks.length + 1;
  const currentRoster = rosterIdForPickNumber(currentPick);
  const searchFrom = String(currentRoster) === String(state.rosterId) ? currentPick + 1 : currentPick;
  const nextMine = nextPickForRoster(state.rosterId, searchFrom);
  if (!nextMine) {
    return 0;
  }

  const seen = new Set();
  let count = 0;
  for (let pickNo = searchFrom; pickNo < nextMine; pickNo += 1) {
    const rosterId = rosterIdForPickNumber(pickNo);
    if (!rosterId || rosterId === String(state.rosterId) || seen.has(rosterId)) {
      continue;
    }
    seen.add(rosterId);
    const row = rowByRoster.get(rosterId);
    if (row && teamNeedsPosition(position, row.counts, slots, row.picks.length)) {
      count += 1;
    }
  }
  return count;
}

function nextPickForRoster(rosterId, fromPick) {
  const totalPicks = Math.max(
    Number(state.draft?.settings?.teams ?? 0) * Number(state.draft?.settings?.rounds ?? 0),
    fromPick + 80
  );
  for (let pickNo = Math.max(1, Number(fromPick) || 1); pickNo <= totalPicks; pickNo += 1) {
    if (String(rosterIdForPickNumber(pickNo)) === String(rosterId)) {
      return pickNo;
    }
  }
  return null;
}

function teamNeedsPosition(position, counts = {}, slots = {}, pickCount = 0) {
  if (position === "QB") {
    const target = (slots.SUPER_FLEX ?? 0) > 0 ? 2 : 1;
    return (counts.QB ?? 0) < target;
  }
  if (position === "RB") {
    return (counts.RB ?? 0) < Math.max(2, slots.RB ?? 2) || ((counts.WR ?? 0) >= 4 && (counts.RB ?? 0) <= 2);
  }
  if (position === "WR") {
    return (counts.WR ?? 0) < Math.max(2, slots.WR ?? 2) || ((counts.RB ?? 0) >= 4 && (counts.WR ?? 0) <= 2);
  }
  if (position === "TE") {
    return (counts.TE ?? 0) === 0 && pickCount >= 4;
  }
  return false;
}

function predictNextPicks() {
  const board = (state.recommendations?.availableBoard ?? []).filter((player) => player.position !== "DEF").slice(0, 40);
  const rows = buildTeamRows();
  const rowByRoster = new Map(rows.map((row) => [row.rosterId, row]));
  const slots = state.recommendations?.slots ?? {};
  const used = new Set();
  const predictions = [];
  const currentPick = state.picks.length + 1;

  for (let pickNo = currentPick; pickNo < currentPick + 5 && board.length; pickNo += 1) {
    const rosterId = rosterIdForPickNumber(pickNo);
    const row = rowByRoster.get(rosterId) ?? null;
    const best = board
      .filter((candidate) => !used.has(candidate.playerId))
      .map((candidate) => ({
        candidate,
        fit: predictionFit(candidate.position, row?.counts ?? {}, slots, row?.picks?.length ?? 0)
      }))
      .sort((left, right) => {
        const leftScore = left.candidate.rankSort - left.fit * 0.42 + riskPredictionPenalty(left.candidate);
        const rightScore = right.candidate.rankSort - right.fit * 0.42 + riskPredictionPenalty(right.candidate);
        return leftScore - rightScore;
      })[0];

    if (!best) {
      break;
    }

    used.add(best.candidate.playerId);
    const teamLabel = row?.label?.replace(" (You)", "") ?? `Pick ${pickNo}`;
    const rankGap = Math.max(0, best.candidate.rankSort - pickNo);
    const probability = Math.round(clamp(93 - predictions.length * 5 - rankGap * 0.28 + Math.min(10, best.fit * 0.18), 52, 96));
    predictions.push({
      name: best.candidate.name,
      position: best.candidate.position,
      probability,
      teamLabel
    });
  }

  return predictions;
}

function renderDraftFeed(iq = null) {
  if (!elements.draftFeed) {
    return;
  }
  elements.draftFeed.replaceChildren();
  const rankingLookup = buildRankingLookup(getSelectedRankings());
  const picks = state.picks
    .slice(-8)
    .map((pick) => getPickDetails(pick, rankingLookup))
    .filter((pick) => pick.name && pick.name !== "Unknown player" && pick.position !== "K");
  if (!picks.length) {
    return;
  }

  const title = document.createElement("div");
  title.className = "draft-feed-title";
  title.textContent = "Animated Draft Feed";
  elements.draftFeed.append(title);

  for (const pick of picks.reverse()) {
    const signal = classifyDraftPick(pick);
    const row = document.createElement("div");
    row.className = `feed-row ${signal.className}`;
    const badge = document.createElement("strong");
    badge.textContent = signal.label;
    const text = document.createElement("span");
    const rankText = pick.rank ? `board #${Math.round(pick.rank)}` : "unranked";
    text.textContent = `#${pick.pickNo || "-"} ${pick.name} (${pick.position}, ${rankText})`;
    row.append(badge, text);
    elements.draftFeed.append(row);
  }

  const replay = buildDraftReplaySummary(iq);
  if (replay) {
    const replayBox = document.createElement("div");
    replayBox.className = "draft-replay";
    replayBox.textContent = replay;
    elements.draftFeed.append(replayBox);
  }
}

function classifyDraftPick(pick) {
  const valueRank = pickValueRank(pick);
  const delta = valueRank ? (pick.pickNo || valueRank) - valueRank : 0;
  if (pick.position === "DEF" && (pick.pickNo || 999) < 120) {
    return { label: "High Risk", className: "feed-risk" };
  }
  if (delta >= 16) {
    return { label: "Great Value", className: "feed-value" };
  }
  if (delta <= -16) {
    return { label: "Reach", className: "feed-reach" };
  }
  if (Number(pick.playerRating) >= 92 && delta >= -6) {
    return { label: "League Winner Potential", className: "feed-winner" };
  }
  return { label: "Fair Pick", className: "feed-fair" };
}

function buildDraftReplaySummary(iq = null) {
  const rows = buildTeamRows();
  const myRow = rows.find((row) => row.rosterId === String(state.rosterId));
  const picks = myRow?.picks ?? [];
  if (!picks.length) {
    return "";
  }
  const valueGained = picks.reduce((total, pick) => {
    const valueRank = pickValueRank(pick);
    if (!valueRank) return total;
    return total + clamp((pick.pickNo || valueRank) - valueRank, -25, 25);
  }, 0);
  const misses = picks.filter((pick) => {
    const valueRank = pickValueRank(pick);
    return valueRank && (pick.pickNo || valueRank) - valueRank <= -16;
  }).length;
  const topLive = state.recommendations?.candidates?.[0];
  const liveHint = topLive?.name ? ` Next film note: compare ${topLive.name} before passing.` : "";
  return `Draft Replay: ${picks.length} picks logged, value gained ${Math.round(valueGained)}, ${misses} major mistake${misses === 1 ? "" : "s"}, ${iq?.personality?.title ?? "identity still forming"}.${liveHint}`;
}

function rosterIdForPickNumber(pickNo) {
  const teams = Number(state.draft?.settings?.teams ?? 0);
  if (!teams) {
    return "";
  }
  const round = Math.ceil(pickNo / teams);
  const roundPick = ((pickNo - 1) % teams) + 1;
  const isSnake = String(state.draft?.type ?? "").toLowerCase() === "snake";
  const slot = isSnake && round % 2 === 0 ? teams - roundPick + 1 : roundPick;
  const rosterId = state.draft?.slot_to_roster_id?.[String(slot)];
  return rosterId === undefined || rosterId === null || rosterId === "" ? String(slot) : String(rosterId);
}

function predictionFit(position, counts = {}, slots = {}, pickCount = 0) {
  let score = 0;
  if (position === "QB") {
    const target = (slots.SUPER_FLEX ?? 0) > 0 ? 2 : 1;
    score += Math.max(0, target - (counts.QB ?? 0)) * 24;
    if ((counts.QB ?? 0) >= target) score -= 18;
  }
  if (position === "RB") {
    score += Math.max(0, 2 - (counts.RB ?? 0)) * 18;
    if ((counts.WR ?? 0) >= 4 && (counts.RB ?? 0) <= 2) score += 18;
  }
  if (position === "WR") {
    score += Math.max(0, 3 - (counts.WR ?? 0)) * 15;
    if ((counts.RB ?? 0) >= 4 && (counts.WR ?? 0) <= 2) score += 16;
  }
  if (position === "TE") {
    score += (counts.TE ?? 0) === 0 ? 14 : -12;
  }
  if (pickCount < 7 && position === "DEF") {
    score -= 28;
  }
  return score;
}

function riskPredictionPenalty(candidate) {
  if (candidate.riskMeter?.level === "High") return 6;
  if (candidate.riskMeter?.level === "Moderate") return 2;
  if (candidate.valueMeter?.status === "Rising") return -2;
  return 0;
}

function renderLeagueAnalyzer(rows) {
  elements.leagueAnalyzer?.replaceChildren();
  if (!elements.leagueAnalyzer || !rows.length) {
    return;
  }

  const analyzer = buildLeagueAnalyzer(rows);
  const items = [
    ["Strongest", analyzer.strongest],
    ["Weakest", analyzer.weakest],
    ["Needs RB", analyzer.needsRb],
    ["Needs QB", analyzer.needsQb],
    ["Reaching", analyzer.reaching],
    ["Stealing Value", analyzer.stealing],
    ["League Trend", analyzer.tendency]
  ];

  for (const [label, value] of items) {
    const item = document.createElement("div");
    item.className = "analyzer-item";
    const labelEl = document.createElement("span");
    labelEl.textContent = label;
    const valueEl = document.createElement("strong");
    valueEl.textContent = value || "-";
    item.append(labelEl, valueEl);
    elements.leagueAnalyzer.append(item);
  }
}

function buildLeagueAnalyzer(rows) {
  const activeRows = rows.filter((row) => row.picks.length && !row.grade?.pending);
  const strongest = [...activeRows].sort((a, b) => (b.grade?.score ?? 0) - (a.grade?.score ?? 0))[0];
  const weakest = [...activeRows].sort((a, b) => (a.grade?.score ?? 0) - (b.grade?.score ?? 0))[0];
  const needsRb = rows
    .filter((row) => row.picks.length >= 3 && (row.counts.RB ?? 0) <= 1)
    .slice(0, 2)
    .map((row) => cleanTeamLabel(row.label))
    .join(", ");
  const needsQb = rows
    .filter((row) => row.picks.length >= ((state.recommendations?.slots?.SUPER_FLEX ?? 0) > 0 ? 3 : 7) && (row.counts.QB ?? 0) === 0)
    .slice(0, 2)
    .map((row) => cleanTeamLabel(row.label))
    .join(", ");
  const valuePicks = rows.flatMap((row) =>
    row.picks
      .filter((pick) => pickValueRank(pick))
      .map((pick) => ({
        row,
        pick,
        delta: (pick.pickNo || pickValueRank(pick)) - pickValueRank(pick)
      }))
  );
  const reach = [...valuePicks].sort((a, b) => a.delta - b.delta)[0];
  const steal = [...valuePicks].sort((a, b) => b.delta - a.delta)[0];

  return {
    strongest: strongest ? `${cleanTeamLabel(strongest.label)} (${strongest.grade.letter}${strongest.odds ? `, ${formatOdds(strongest.odds.championship)} champ` : ""})` : "",
    weakest: weakest ? `${cleanTeamLabel(weakest.label)} (${weakest.grade.letter}${weakest.odds ? `, ${formatOdds(weakest.odds.championship)} champ` : ""})` : "",
    needsRb,
    needsQb,
    reaching: reach && reach.delta < -8 ? `${cleanTeamLabel(reach.row.label)}: ${reach.pick.name}` : "No major reach yet",
    stealing: steal && steal.delta > 8 ? `${cleanTeamLabel(steal.row.label)}: ${steal.pick.name}` : "No clear steal yet",
    tendency: leagueTendency()
  };
}

function leagueTendency() {
  const rankingLookup = buildRankingLookup(getSelectedRankings());
  const firstTwenty = state.picks
    .slice(0, 20)
    .map((pick) => getPickDetails(pick, rankingLookup))
    .filter((pick) => pick.position && pick.position !== "K");
  if (firstTwenty.length < 20) {
    return `${20 - firstTwenty.length} picks until tendency read`;
  }
  const counts = countPickPositions(firstTwenty);
  const isSuperflex = (state.recommendations?.slots?.SUPER_FLEX ?? 0) > 0;
  if ((counts.RB ?? 0) >= 9) return "This league drafts RBs early";
  if ((counts.WR ?? 0) >= 10) return "This league is WR-heavy early";
  if ((counts.QB ?? 0) >= (isSuperflex ? 8 : 4)) return "QB prices are running hot";
  if ((counts.TE ?? 0) >= 4) return "Elite TE is being pushed up";
  const ranked = firstTwenty.filter((pick) => pickValueRank(pick));
  const avgDelta = ranked.length
    ? ranked.reduce((total, pick) => {
      const valueRank = pickValueRank(pick);
      return total + ((pick.pickNo || valueRank) - valueRank);
    }, 0) / ranked.length
    : 0;
  if (avgDelta < -7) return "Room is reaching above the board";
  if (avgDelta > 7) return "Value is falling to patient teams";
  return "Balanced room so far";
}

function cleanTeamLabel(label) {
  return String(label ?? "").replace(/\s+\(You\)$/i, "");
}

function answerAssistantQuestion() {
  const question = elements.assistantQuestionInput?.value?.trim() ?? "";
  if (!question) {
    renderAssistantAnswer("Ask about two players, like: Should I take Bowers or London?");
    return;
  }

  const board = state.recommendations?.availableBoard ?? [];
  const choices = findMentionedCandidates(question, board).slice(0, 4);
  if (!choices.length) {
    const contextual = contextualAssistantAnswer(question);
    if (contextual) {
      renderAssistantAnswer(contextual);
      return;
    }
    const top = state.recommendations?.candidates?.[0];
    if (!top) {
      renderAssistantAnswer("Sync a draft first, then ask about the players on your board.");
      return;
    }
    renderAssistantAnswer(`I cannot confidently match those names on the available board. My top live lean is ${top.name}: ${assistantReason(top)}`);
    return;
  }

  const sorted = [...choices].sort((left, right) => assistantCandidateScore(right) - assistantCandidateScore(left));
  const pick = sorted[0];
  const alternatives = sorted.slice(1, 3).map((candidate) => candidate.name).join(", ");
  const alternativeText = alternatives ? ` I would take him over ${alternatives} from this live board.` : "";
  renderAssistantAnswer(`Recommendation: ${pick.name}.${alternativeText} ${assistantReason(pick)}`);
}

function contextualAssistantAnswer(question) {
  const text = String(question ?? "").toLowerCase();
  const top = state.recommendations?.candidates?.[0];
  const counts = state.recommendations?.roster?.counts ?? {};
  const slots = state.recommendations?.slots ?? {};
  const rb = topCandidateAtPosition("RB");
  const wr = topCandidateAtPosition("WR");
  const qb = topCandidateAtPosition("QB");
  const te = topCandidateAtPosition("TE");

  if (/should i (go|take|draft).*\brb\b|\brb here\b/.test(text)) {
    if (!rb) return "I do not see a strong RB option on the live board right now.";
    const wrText = wr ? ` The best WR counter is ${wr.name} at ${wr.pickGrade ?? wr.totalScore}/100.` : "";
    return `RB lean: ${rb.name} is the RB to compare because ${shortAssistantWhy(rb)}${wrText}`;
  }
  if (/should i (go|take|draft).*\bwr\b|\bwr here\b/.test(text)) {
    if (!wr) return "I do not see a strong WR option on the live board right now.";
    const rbText = rb ? ` The best RB counter is ${rb.name} at ${rb.pickGrade ?? rb.totalScore}/100.` : "";
    return `WR lean: ${wr.name} is the WR to compare because ${shortAssistantWhy(wr)}${rbText}`;
  }
  if (/who fits|fit my roster|fits my team|team fit|who fits/.test(text)) {
    const fit = [...(state.recommendations?.candidates ?? [])]
      .sort((left, right) => (right.components?.fit ?? 0) - (left.components?.fit ?? 0) || assistantCandidateScore(right) - assistantCandidateScore(left))[0] ?? top;
    return fit ? `Best fit: ${fit.name}. ${shortAssistantWhy(fit)} Your current build is QB ${counts.QB ?? 0}, RB ${counts.RB ?? 0}, WR ${counts.WR ?? 0}, TE ${counts.TE ?? 0}.` : "";
  }
  if (/weakness|weaknesses|what am i missing|what do i need/.test(text)) {
    return rosterWeaknessAnswer(counts, slots);
  }
  if (/trade|trading|what if i trade/.test(text)) {
    return "Trade mode: use the board like leverage, not as a panic button. Move only if the deal turns a flat tier into an elite tier, or if it gets you two shots before a RB/WR tier cliff.";
  }
  if (/qb here|go qb|take qb/.test(text)) {
    if (!qb) return "I would not force QB from this board unless the room is about to close a tier.";
    return `QB check: ${qb.name} is the best QB case, but only take him if his ${qb.pickGrade ?? qb.totalScore}/100 pick score beats the RB/WR tier drop. ${shortAssistantWhy(qb)}`;
  }
  if (/te here|go te|take te/.test(text)) {
    if (!te) return "I would not force TE unless the last useful tier is about to dry up.";
    return `TE check: ${te.name} is the best TE case. ${shortAssistantWhy(te)}`;
  }
  return "";
}

function topCandidateAtPosition(position) {
  return (state.recommendations?.candidates ?? [])
    .filter((candidate) => candidate.position === position)
    .sort((left, right) => assistantCandidateScore(right) - assistantCandidateScore(left))[0] ?? null;
}

function shortAssistantWhy(candidate) {
  const ai = String(candidate.aiRecommendation ?? "").trim();
  if (ai) {
    return ai;
  }
  const confidence = candidate.confidence ? `confidence ${candidate.confidence.percent}%` : `pick score ${candidate.pickGrade ?? candidate.totalScore}/100`;
  const next = candidate.draftSim?.takenBeforeNextPct !== undefined ? ` and ${candidate.draftSim.takenBeforeNextPct}% gone by your next pick` : "";
  return `${confidence}${next}.`;
}

function rosterWeaknessAnswer(counts = {}, slots = {}) {
  const flexTarget = Math.max(1, (slots.RB ?? 0) + (slots.WR ?? 0) + (slots.TE ?? 0) + (slots.FLEX ?? 0) + (slots.REC_FLEX ?? 0));
  const flexCovered = (counts.RB ?? 0) + (counts.WR ?? 0) + (counts.TE ?? 0);
  const needs = [];
  if ((counts.RB ?? 0) < Math.max(1, slots.RB ?? 1)) needs.push("RB");
  if ((counts.WR ?? 0) < Math.max(2, slots.WR ?? 2)) needs.push("WR");
  if ((slots.SUPER_FLEX ?? 0) > 0 && (counts.QB ?? 0) < 2) needs.push("QB2");
  if ((counts.TE ?? 0) === 0 && flexCovered >= 5) needs.push("TE");
  if (flexCovered < flexTarget) needs.push("flex depth");
  const top = state.recommendations?.candidates?.[0];
  return `Weakness read: ${needs.length ? needs.join(", ") : "no major structural hole yet"}. Best live answer is ${top?.name ?? "the top board value"} because ${top ? shortAssistantWhy(top) : "the synced board is still loading."}`;
}

function findMentionedCandidates(question, board) {
  const normalizedQuestion = normalizeName(question);
  const wordSet = assistantWordSet(question);
  const scored = [];
  const seen = new Set();

  for (const candidate of board) {
    const match = scoreAssistantNameMatch(candidate, normalizedQuestion, wordSet);
    if (!match || !isReasonableAssistantMatch(candidate, match)) {
      continue;
    }
    if (!seen.has(candidate.playerId)) {
      scored.push({ candidate, match });
      seen.add(candidate.playerId);
    }
  }

  const exactLastNames = new Set(scored.filter((item) => item.match.score >= 850).map((item) => item.match.last).filter(Boolean));
  return scored
    .filter((item) => !(item.match.kind === "last" && exactLastNames.has(item.match.last)))
    .sort((left, right) => right.match.score - left.match.score || left.candidate.rankSort - right.candidate.rankSort)
    .map((item) => item.candidate);
}

function assistantWordSet(question) {
  return new Set(
    String(question ?? "")
      .split(/[^a-zA-Z0-9']+/)
      .map((word) => normalizeName(word))
      .filter((word) => word.length >= 2)
  );
}

function scoreAssistantNameMatch(candidate, normalizedQuestion, wordSet) {
  const parts = assistantNameParts(candidate.name);
  const first = parts[0] ?? "";
  const last = parts[parts.length - 1] ?? "";
  const full = normalizeName(candidate.name);
  const firstLast = first && last ? `${first}${last}` : full;

  if (full && normalizedQuestion.includes(full)) {
    return { kind: "full", score: 1000, last };
  }
  if (firstLast && normalizedQuestion.includes(firstLast)) {
    return { kind: "full", score: 980, last };
  }
  if (first && last && wordSet.has(first) && wordSet.has(last)) {
    return { kind: "full", score: 940, last };
  }

  const alias = bestAssistantAliasMatch(candidate, normalizedQuestion, wordSet);
  if (alias) {
    return { kind: "alias", score: 900 + Math.min(60, alias.length), last };
  }

  if (last.length >= 4 && wordSet.has(last)) {
    return { kind: "last", score: 360 - assistantDraftDistancePenalty(candidate), last };
  }

  return null;
}

function assistantNameParts(name) {
  return String(name ?? "")
    .split(/[^a-zA-Z0-9']+/)
    .map((word) => normalizeName(word))
    .filter((word) => word && !["jr", "sr", "ii", "iii", "iv", "v"].includes(word));
}

function bestAssistantAliasMatch(candidate, normalizedQuestion, wordSet) {
  const aliases = assistantAliasesForCandidate(candidate);
  let best = "";
  for (const alias of aliases) {
    const normalizedAlias = normalizeName(alias);
    if (!normalizedAlias || normalizedAlias.length < 2) {
      continue;
    }
    const aliasWords = assistantNameParts(alias);
    const matched =
      normalizedQuestion.includes(normalizedAlias) ||
      (aliasWords.length > 1 && aliasWords.every((word) => wordSet.has(word))) ||
      (normalizedAlias.length <= 4 && wordSet.has(normalizedAlias));
    if (matched && normalizedAlias.length > best.length) {
      best = normalizedAlias;
    }
  }
  return best;
}

function assistantAliasesForCandidate(candidate) {
  const byName = state.playerAliases?.byName;
  if (!byName) {
    return [];
  }
  const keys = [
    candidate.name,
    candidate.ranking?.name,
    candidate.ranking?.player,
    candidate.ranking?.fullName
  ]
    .map((name) => normalizeName(name))
    .filter(Boolean);
  const aliases = [];
  for (const key of keys) {
    aliases.push(...(byName.get(key) ?? []));
  }
  return aliases;
}

function isReasonableAssistantMatch(candidate, match) {
  if (match.kind === "full" || match.kind === "alias") {
    return true;
  }
  const rank = Number(candidate.adjustedRank ?? candidate.rankSort ?? 999);
  const currentPick = state.recommendations?.currentPick ?? state.picks.length + 1;
  const window = currentPick <= 24 ? 48 : currentPick <= 72 ? 60 : currentPick <= 120 ? 78 : 110;
  return rank <= currentPick + window || (candidate.totalScore ?? 0) >= 82;
}

function assistantDraftDistancePenalty(candidate) {
  const rank = Number(candidate.adjustedRank ?? candidate.rankSort ?? 999);
  const currentPick = state.recommendations?.currentPick ?? state.picks.length + 1;
  return Math.max(0, rank - currentPick) * 0.65;
}

function assistantCandidateScore(candidate) {
  const riskPenalty = candidate.riskMeter?.level === "High" ? 10 : candidate.riskMeter?.level === "Moderate" ? 4 : 0;
  const valueLift = candidate.valueMeter?.status === "Rising" ? 4 : candidate.valueMeter?.status === "Falling" ? -5 : 0;
  return (candidate.totalScore ?? 0) + valueLift - riskPenalty - Math.max(0, (candidate.adjustedRank ?? candidate.rankSort) - candidate.rankSort) * 0.2;
}

function assistantReason(candidate) {
  if (candidate.aiRecommendation) {
    return candidate.aiRecommendation;
  }
  const production = candidate.production ?? {};
  const pickGrade = candidate.pickGrade ?? candidate.totalScore ?? "-";
  const projected = production.projectedPpg ? `${production.projectedPpg} projected PPG` : "projection is estimated from rank";
  const risk = candidate.riskMeter ? `${candidate.riskMeter.level.toLowerCase()} risk` : "moderate risk";
  const fit = teamFitPhrase(candidate.position, state.recommendations?.roster?.counts ?? {}, state.recommendations?.slots ?? {});
  const injuryNote = candidate.riskMeter?.reasons?.find((reason) => /injury|status/i.test(reason));
  return `${candidate.name} grades ${pickGrade}/100 with ${projected} and ${risk}; ${fit}${injuryNote ? ` Injury note: ${injuryNote}.` : ""}`;
}

function teamFitPhrase(position, counts = {}, slots = {}) {
  if (position === "RB" && (counts.WR ?? 0) >= 4 && (counts.RB ?? 0) <= 2) {
    return "Your build is WR-heavy, so RB helps balance starters and flex spots.";
  }
  if (position === "WR" && (counts.RB ?? 0) >= 4 && (counts.WR ?? 0) <= 2) {
    return "Your build is RB-heavy, so WR helps keep the lineup from becoming one-dimensional.";
  }
  if (position === "QB" && (slots.SUPER_FLEX ?? 0) > 0 && (counts.QB ?? 0) < 2) {
    return "Superflex makes the second QB a real weekly leverage point.";
  }
  if (position === "TE" && (counts.TE ?? 0) === 0) {
    return "TE also fills a unique starter slot before replacement options flatten out.";
  }
  return "The pick is mostly about BPA value with roster fit as the tiebreaker.";
}

function renderAssistantAnswer(message) {
  if (!elements.assistantAnswer) {
    return;
  }
  elements.assistantAnswer.textContent = message;
}

function renderTeams() {
  elements.teamsList.replaceChildren();
  if (!state.draft) {
    elements.teamsSummary.textContent = "-";
    elements.leagueAnalyzer?.replaceChildren();
    return;
  }

  const rows = buildTeamRows();
  const pickedTeams = rows.filter((row) => row.picks.length > 0).length;
  elements.teamsSummary.textContent = `${pickedTeams}/${rows.length} active`;
  renderLeagueAnalyzer(rows);

  if (!rows.length) {
    const box = document.createElement("div");
    box.className = "empty-state";
    box.textContent = "No teams found yet.";
    elements.teamsList.append(box);
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const row of rows) {
    const node = elements.teamCardTemplate.content.cloneNode(true);
    const card = node.querySelector(".team-card");
    card.classList.toggle("is-you", row.rosterId === String(state.rosterId));
    node.querySelector(".team-name").textContent = row.label;
    node.querySelector(".team-subtitle").textContent = row.grade.summary;
    const grade = node.querySelector(".grade-pill");
    grade.textContent = row.grade.letter;
    grade.classList.toggle("pending", row.grade.pending);
    const odds = document.createElement("div");
    odds.className = "team-odds";
    odds.textContent = teamOddsText(row);
    node.querySelector(".team-counts").before(odds);
    const strategy = document.createElement("div");
    strategy.className = "team-strategy";
    strategy.textContent = `Strategy: ${row.strategy?.summary ?? "Balanced"}`;
    node.querySelector(".team-counts").before(strategy);
    renderTeamCounts(node.querySelector(".team-counts"), row.counts);
    renderTeamPicks(node.querySelector(".team-picks"), row.picks);
    fragment.append(node);
  }

  elements.teamsList.append(fragment);
}

function buildTeamRows() {
  const options = getRosterOptions();
  const rosterIds = new Set(options.map((option) => option.rosterId));
  for (const pick of state.picks) {
    const key = teamKeyForPick(pick);
    if (key) {
      rosterIds.add(key);
    }
  }

  const optionLabels = new Map(options.map((option) => [option.rosterId, option.label]));
  const slots = state.recommendations?.slots ?? {};
  const selectedRankings = getSelectedRankings();
  const rankingLookup = buildRankingLookup(selectedRankings);
  const format = getBoardFormat(selectedRankings, getActiveDraftRankingFormat());
  const rows = [...rosterIds]
    .sort(sortTeamKeys)
    .map((rosterId) => {
      const picks = state.picks
        .filter((pick) => teamKeyForPick(pick) === String(rosterId))
        .sort((a, b) => Number(a.pick_no ?? 0) - Number(b.pick_no ?? 0))
        .map((pick) => getPickDetails(pick, rankingLookup))
        .filter((pick) => pick.position !== "K");
      const counts = countPickPositions(picks);
      const label = `${optionLabels.get(rosterId) ?? `Roster ${rosterId}`}${String(rosterId) === String(state.rosterId) ? " (You)" : ""}`;
      return {
        rosterId: String(rosterId),
        label,
        picks,
        counts,
        strategy: strategyProfileForPicks(picks, counts, slots, format),
        grade: gradeTeamDraft(picks, counts, slots, format)
      };
    });
  return applyLeagueContext(rows);
}

function teamOddsText(row) {
  if (!row.odds) {
    return row.grade?.pending ? "Odds unlock after 4 picks" : "Odds pending";
  }
  const bv = row.grade?.components?.blitzValue;
  const bvText = bv ? ` - ${formatBlitzValue(bv)}` : "";
  return `Power ${row.odds.power}/100${bvText} - ${formatOdds(row.odds.playoff)} playoff - ${formatOdds(row.odds.championship)} champ`;
}

function renderTeamCounts(container, counts) {
  const positions = ["QB", "RB", "WR", "TE", "DEF"];
  container.replaceChildren(
    ...positions.map((position) => {
      const chip = document.createElement("span");
      chip.className = "roster-chip";
      chip.textContent = `${position} ${counts[position] ?? 0}`;
      return chip;
    })
  );
}

function renderTeamPicks(container, picks) {
  container.replaceChildren();
  if (!picks.length) {
    const item = document.createElement("li");
    item.textContent = "No picks yet";
    container.append(item);
    return;
  }

  for (const pick of picks) {
    const item = document.createElement("li");
    const rankText = pick.rank ? `, board ${pick.rank}` : "";
    item.textContent = `#${pick.pickNo || "-"} ${pick.name} (${pick.position || "?"}${rankText})`;
    container.append(item);
  }
}

function renderRecommendations(candidates) {
  elements.recommendations.replaceChildren();
  const visibleCandidates = candidates.slice(0, VISIBLE_RECOMMENDATION_LIMIT);

  if (!visibleCandidates.length) {
    renderEmpty("No available players found. Import current rankings if the Sleeper fallback is too thin.");
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const candidate of visibleCandidates) {
    const node = elements.recommendationTemplate.content.cloneNode(true);
    const card = node.querySelector(".player-card");
    card.classList.add(heatClassForCandidate(candidate));
    const skipTooltip = skipPlanTooltip(candidate);
    if (skipTooltip) {
      card.title = skipTooltip;
    }
    node.querySelector(".player-name").textContent = candidate.name;
    const teamLabel = candidate.team || (candidate.isRankingOnly ? "ranking board" : "FA");
    const tierLabel = candidate.tier ? ` - pos tier ${candidate.tier}` : "";
    const marketLabel = candidate.marketRank ? ` - market #${Math.round(candidate.marketRank)}` : "";
    const simLabel = candidate.draftSim?.takenBeforeNextPct !== undefined ? ` - ${candidate.draftSim.takenBeforeNextPct}% gone by next` : "";
    const blitzLabel = candidate.blitzValue?.overall ? ` - value ${formatBlitzValue(candidate.blitzValue.overall, { suffix: false })}` : "";
    node.querySelector(".player-subtitle").textContent = `${candidate.position} - ${teamLabel} - board #${Math.round(candidate.rankSort)}${marketLabel}${tierLabel}${blitzLabel} - pick ${candidate.pickGrade ?? candidate.totalScore}/100${simLabel}`;
    const scorePill = node.querySelector(".score-pill");
    scorePill.textContent = candidate.blitzValue?.overall ? formatBlitzValue(candidate.blitzValue.overall, { compact: true, suffix: false }) : String(candidate.playerRating ?? candidate.totalScore);
    scorePill.title = blitzValueTitle(candidate);
    const quickReason = document.createElement("p");
    quickReason.className = "ai-recommendation";
    quickReason.textContent = `AI Recommendation: ${candidate.aiRecommendation ?? candidate.reasons?.[0]?.replace(/^AI Recommendation:\s*/i, "") ?? "This is the best live value from the synced board."}`;
    node.querySelector(".player-card-header").after(quickReason);
    const sim = state.whatIfSimulations?.byPlayerId?.get(String(candidate.playerId));
    if (sim) {
      const simNote = document.createElement("p");
      simNote.className = "sim-recommendation";
      simNote.textContent = `What-if: ${sim.averageFinalGrade} average final team grade, ${sim.playoffGrade} playoff grade, ${sim.confidence}% confidence.`;
      quickReason.after(simNote);
    }
    bindPlayerDetailsToggle(node);
    renderScoreBars(node.querySelector(".score-bars"), candidate.components);
    renderPlayerMeters(node.querySelector(".player-meters"), candidate);
    renderReasons(node.querySelector(".reason-list"), candidate.reasons);
    renderSources(node.querySelector(".source-list"), candidate.sources);
    const actions = node.querySelector(".card-actions");
    const compareButton = document.createElement("button");
    compareButton.className = "compare-button secondary-button";
    compareButton.type = "button";
    compareButton.textContent = state.comparePlayerIds.includes(candidate.playerId) ? "Comparing" : "Compare";
    compareButton.addEventListener("click", () => toggleCompareCandidate(candidate));
    actions.prepend(compareButton);
    const webButton = node.querySelector(".web-check-button");
    webButton.addEventListener("click", () => runAdvisor(candidate, webButton));
    node.querySelector(".mark-taken-button").addEventListener("click", () => markCandidateTaken(candidate));
    fragment.append(node);
  }

  elements.recommendations.append(fragment);
  renderComparisonPanel();
}

function bindPlayerDetailsToggle(node) {
  const button = node.querySelector(".details-toggle-button");
  const details = node.querySelector(".player-details");
  if (!button || !details) {
    return;
  }
  button.addEventListener("click", () => {
    const expanded = button.getAttribute("aria-expanded") === "true";
    const nextExpanded = !expanded;
    button.setAttribute("aria-expanded", String(nextExpanded));
    button.textContent = nextExpanded ? "^" : "v";
    button.setAttribute("aria-label", nextExpanded ? "Hide player details" : "Show player details");
    details.classList.toggle("is-collapsed", !nextExpanded);
  });
}

function renderAvailableBoard() {
  const board = state.recommendations?.availableBoard ?? [];
  const positions = ["ALL", "QB", "RB", "WR", "TE", "DEF"];
  const counts = new Map(positions.map((position) => [position, 0]));
  counts.set("ALL", board.length);
  for (const player of board) {
    counts.set(player.position, (counts.get(player.position) ?? 0) + 1);
  }

  elements.positionFilterControls.replaceChildren();
  for (const position of positions) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "position-filter-button";
    button.dataset.positionFilter = position;
    button.classList.toggle("is-active", state.availablePositionFilter === position);
    button.textContent = `${position} ${counts.get(position) ?? 0}`;
    button.setAttribute("aria-pressed", String(state.availablePositionFilter === position));
    elements.positionFilterControls.append(button);
  }

  const filtered = state.availablePositionFilter === "ALL"
    ? board
    : board.filter((player) => player.position === state.availablePositionFilter);
  elements.availableSummary.textContent = board.length ? `${filtered.length}/${board.length} available` : "-";
  elements.availableBoard.replaceChildren();

  if (!board.length) {
    const box = document.createElement("div");
    box.className = "empty-state";
    box.textContent = "No available board yet. Sync a draft and open Sleeper so your team can be detected.";
    elements.availableBoard.append(box);
    return;
  }

  if (!filtered.length) {
    const box = document.createElement("div");
    box.className = "empty-state";
    box.textContent = `No ${state.availablePositionFilter} left on the active board.`;
    elements.availableBoard.append(box);
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const player of filtered.slice(0, 90)) {
    const row = document.createElement("div");
    row.className = `available-player-row ${heatClassForCandidate(player)}`;
    row.classList.toggle("is-comparing", state.comparePlayerIds.includes(player.playerId));
    const skipTooltip = skipPlanTooltip(player);
    row.title = skipTooltip || "Click to compare this player";
    row.addEventListener("click", () => toggleCompareCandidate(player));
    const rank = document.createElement("strong");
    rank.className = "available-rank";
    rank.textContent = `#${Math.round(player.rankSort)}`;
    const main = document.createElement("div");
    main.className = "available-player-main";
    const name = document.createElement("span");
    name.className = "available-player-name";
    name.textContent = player.name;
    const meta = document.createElement("span");
    meta.className = "available-player-meta";
    meta.textContent = availablePlayerMeta(player);
    main.append(name, meta);
    const score = document.createElement("span");
    score.className = "available-score";
    score.textContent = player.blitzValue?.overall ? formatBlitzValue(player.blitzValue.overall, { compact: true, suffix: false }) : String(player.playerRating ?? player.totalScore);
    score.title = blitzValueTitle(player);
    row.append(rank, main, score);
    elements.availableBoard.append(row);
  }

  if (filtered.length > 90) {
    const more = document.createElement("div");
    more.className = "available-more";
    more.textContent = `${filtered.length - 90} more available below this board view`;
    fragment.append(more);
  }

  elements.availableBoard.append(fragment);
}

function availablePlayerMeta(player) {
  const parts = [
    player.position,
    player.team || "FA",
    player.ranking?.posRank || "",
    player.blitzValue?.overall ? `Value ${formatBlitzValue(player.blitzValue.overall, { suffix: false })}` : "",
    player.blitzValue?.trend?.label ? player.blitzValue.trend.label : "",
    player.marketRank ? `Market #${Math.round(player.marketRank)}` : "",
    player.pickGrade || player.totalScore ? `Pick ${player.pickGrade ?? player.totalScore}` : "",
    player.adjustedRank && Math.round(player.adjustedRank) !== Math.round(player.rankSort) ? `Adj #${Math.round(player.adjustedRank)}` : "",
    player.valueMeter?.status ? `${player.valueMeter.status} value` : "",
    player.riskMeter?.level ? `${player.riskMeter.level} risk` : "",
    player.tier ? `Pos Tier ${player.tier}` : "",
    player.production?.projectedPpg ? `${player.production.projectedPpg} proj PPG` : ""
  ].filter(Boolean);
  return parts.join(" - ");
}

function blitzValueTitle(candidate) {
  const blitz = candidate?.blitzValue;
  if (!blitz?.overall) {
    return "Player rating: expected fantasy quality out of 99";
  }
  const components = blitz.components ?? {};
  const reasons = (blitz.reasons ?? [])
    .map((reason) => `${reason.delta > 0 ? "+" : ""}${Math.round(reason.delta)} BV ${reason.label}`)
    .join("; ");
  return [
    `Blitz Value: ${formatBlitzValue(blitz.overall)}`,
    `Trend: ${blitz.trend?.label ?? formatBlitzDelta(0)}`,
    `Floor/Ceiling: ${formatBlitzValue(blitz.floor)} / ${formatBlitzValue(blitz.ceiling)}`,
    `Formula: Projection ${components.production ?? "-"}, Market ${components.market ?? "-"}, News ${components.news ?? "-"}, Opportunity ${components.opportunity ?? "-"}, Schedule ${components.schedule ?? "-"}, AI ${components.aiConfidence ?? "-"}`,
    reasons ? `Movement: ${reasons}` : ""
  ].filter(Boolean).join("\n");
}

function heatClassForCandidate(candidate) {
  const grade = Number(candidate.pickGrade ?? candidate.totalScore ?? 0);
  const sleeperLevel = candidate.sleeperValue?.level ?? "";
  const gone = Number(candidate.draftSim?.takenBeforeNextPct ?? 0);
  if (sleeperLevel === "strong" || grade >= 88 || (grade >= 82 && gone >= 70)) {
    return "heat-green";
  }
  if (sleeperLevel === "reach" || grade <= 58) {
    return "heat-red";
  }
  return "heat-yellow";
}

function skipPlanTooltip(candidate) {
  const plan = candidate?.skipPlan;
  if (!plan?.alternatives?.length) {
    return "";
  }
  const lines = [
    "If you skip him...",
    "You are likely to get:",
    ...plan.alternatives.map((item) => `- ${item.name} (${item.probability}%)`),
    `Expected value: ${formatSignedDecimal(plan.expectedValue)}`
  ];
  return lines.join("\n");
}

function formatSignedDecimal(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return "-";
  }
  const rounded = Math.round(number * 10) / 10;
  return rounded > 0 ? `+${rounded}` : String(rounded);
}

function formatSignedBv(value) {
  const number = Math.round(Number(value));
  if (!Number.isFinite(number)) {
    return "-";
  }
  return `${number > 0 ? "+" : ""}${number.toLocaleString()} BV`;
}

function formatSignedPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return "-";
  }
  const rounded = round1(number);
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
}

function round1(value) {
  return Math.round(Number(value) * 10) / 10;
}

function toggleCompareCandidate(candidate) {
  if (!candidate?.playerId) {
    return;
  }
  const ids = state.comparePlayerIds.filter((id) => id !== candidate.playerId);
  if (ids.length === state.comparePlayerIds.length) {
    ids.push(candidate.playerId);
  }
  state.comparePlayerIds = ids.slice(-2);
  renderComparisonPanel();
  renderRecommendations(state.recommendations?.candidates ?? []);
  renderAvailableBoard();
}

function renderComparisonPanel() {
  if (!elements.comparisonPanel) {
    return;
  }
  const selected = state.comparePlayerIds
    .map((id) => findCandidateById(id))
    .filter(Boolean);
  if (!selected.length) {
    elements.comparisonPanel.classList.add("is-hidden");
    elements.comparisonPanel.replaceChildren();
    return;
  }

  elements.comparisonPanel.classList.remove("is-hidden");
  const title = document.createElement("div");
  title.className = "comparison-title";
  title.textContent = selected.length === 1 ? "Pick Comparison: choose one more player" : "Pick Comparison";
  const columns = document.createElement("div");
  columns.className = "comparison-columns";
  for (const candidate of selected) {
    const column = document.createElement("div");
    column.className = "comparison-column";
    const name = document.createElement("strong");
    name.textContent = candidate.name;
    const meta = document.createElement("span");
    meta.textContent = `${candidate.position} - ${candidate.team || "FA"} - ${candidate.blitzValue?.overall ? formatBlitzValue(candidate.blitzValue.overall) : `${candidate.playerRating ?? candidate.totalScore ?? "-"} rating`}`;
    column.append(name, meta);
    columns.append(column);
  }

  const table = document.createElement("div");
  table.className = "comparison-grid";
  const rows = [
    ["Blitz Value", "blitzValue"],
    ["Projected Points", "projectedPoints"],
    ["Upside", "upside"],
    ["Floor", "floor"],
    ["Target Share", "targetShare"],
    ["Red Zone", "redZone"],
    ["Age", "age"],
    ["SOS", "sos"],
    ["Bye", "bye"],
    ["Risk", "risk"],
    ["Market Rank", "adp"],
    ["Trade Value", "tradeValue"],
    ["Dynasty Value", "dynastyValue"]
  ];
  for (const [label, key] of rows) {
    const labelEl = document.createElement("span");
    labelEl.className = "comparison-label";
    labelEl.textContent = label;
    table.append(labelEl);
    for (const candidate of selected) {
      const value = document.createElement("span");
      value.textContent = comparisonMetric(candidate, key);
      table.append(value);
    }
    if (selected.length === 1) {
      const blank = document.createElement("span");
      blank.textContent = "-";
      table.append(blank);
    }
  }

  elements.comparisonPanel.replaceChildren(title, columns, table);
}

function findCandidateById(playerId) {
  const id = String(playerId);
  const boards = [
    ...(state.recommendations?.candidates ?? []),
    ...(state.recommendations?.availableBoard ?? [])
  ];
  return boards.find((candidate) => String(candidate.playerId) === id) ?? null;
}

function comparisonMetric(candidate, key) {
  const production = candidate.production ?? {};
  const ranking = candidate.ranking ?? {};
  const rating = Number(candidate.playerRating ?? candidate.totalScore ?? 0);
  if (key === "projectedPoints") {
    return String(Math.round(Number(production.projectedTotal ?? ranking.projection ?? rating * 2.35) || 0));
  }
  if (key === "blitzValue") {
    return candidate.blitzValue?.overall ? `${formatBlitzValue(candidate.blitzValue.overall)} (${candidate.blitzValue.trend?.label ?? "Flat 0 BV"})` : "-";
  }
  if (key === "upside") {
    if (candidate.blitzValue?.ceiling) {
      return `${formatBlitzValue(candidate.blitzValue.ceiling)} ceiling`;
    }
    const ceiling = Number(production.ceilingPpg) || estimatedUiPpg(candidate, rating) + 2.4;
    return `${Math.round(ceiling * 17)} pts`;
  }
  if (key === "floor") {
    if (candidate.blitzValue?.floor) {
      return `${formatBlitzValue(candidate.blitzValue.floor)} floor`;
    }
    const floor = Number(production.lastYearPpg) || Math.max(4, estimatedUiPpg(candidate, rating) - 2.1);
    return `${Math.round(floor * 17)} pts`;
  }
  if (key === "targetShare") {
    return targetShareEstimate(candidate);
  }
  if (key === "redZone") {
    return redZoneEstimate(candidate);
  }
  if (key === "age") {
    return candidate.player?.age || ranking.age || "-";
  }
  if (key === "sos") {
    return ranking.sos ?? ranking.strengthOfSchedule ?? "Neutral";
  }
  if (key === "bye") {
    return candidate.byeWeek?.week ? `Week ${candidate.byeWeek.week}` : ranking.bye || ranking.byeWeek || "-";
  }
  if (key === "risk") {
    return candidate.riskMeter ? `${candidate.riskMeter.level} ${candidate.riskMeter.score}/100` : "Moderate";
  }
  if (key === "adp") {
    return candidate.marketRank ? `#${Math.round(candidate.marketRank)}` : "-";
  }
  if (key === "tradeValue") {
    return candidate.blitzValue?.overall ? formatBlitzValue(candidate.blitzValue.overall) : `${candidate.valueMeter?.currentValue ?? candidate.pickGrade ?? candidate.totalScore ?? "-"} /100`;
  }
  if (key === "dynastyValue") {
    return candidate.blitzValue?.dynastyValue ? `${formatBlitzValue(candidate.blitzValue.dynastyValue, { suffix: false })} DV` : `${dynastyValueEstimate(candidate)} /100`;
  }
  return "-";
}

function estimatedUiPpg(candidate, rating = 60) {
  const base = { QB: 12, RB: 7, WR: 7.2, TE: 5.2, DEF: 4.5 }[candidate.position] ?? 6;
  return base + (Number(rating) || 60) * (candidate.position === "QB" ? 0.12 : 0.09);
}

function targetShareEstimate(candidate) {
  const rank = Number(candidate.positionRank ?? parseInt(String(candidate.ranking?.posRank ?? "").replace(/\D+/g, ""), 10));
  if (candidate.position === "WR") {
    return `${Math.round(clamp(30 - (rank || 30) * 0.32, 12, 31))}%`;
  }
  if (candidate.position === "TE") {
    return `${Math.round(clamp(24 - (rank || 18) * 0.38, 9, 25))}%`;
  }
  if (candidate.position === "RB") {
    return rank && rank <= 12 ? "High touches" : rank && rank <= 30 ? "Useful touches" : "Role bet";
  }
  if (candidate.position === "QB") {
    return "Team pass/rush volume";
  }
  return "-";
}

function redZoneEstimate(candidate) {
  const rank = Number(candidate.positionRank ?? 99);
  if (candidate.position === "RB" && rank <= 18) return "High";
  if (candidate.position === "TE" && rank <= 8) return "High";
  if (candidate.position === "WR" && rank <= 24) return "Med-high";
  if (candidate.position === "QB") return "TD equity";
  return "Medium";
}

function dynastyValueEstimate(candidate) {
  const rating = Number(candidate.playerRating ?? candidate.totalScore ?? 50);
  const age = Number(candidate.player?.age ?? candidate.ranking?.age ?? 0);
  let ageAdjustment = 0;
  if (age) {
    if (candidate.position === "RB") ageAdjustment = age <= 24 ? 7 : age >= 28 ? -9 : age >= 27 ? -4 : 2;
    if (candidate.position === "WR") ageAdjustment = age <= 26 ? 7 : age >= 31 ? -8 : age >= 29 ? -3 : 3;
    if (candidate.position === "QB") ageAdjustment = age <= 31 ? 5 : age >= 38 ? -6 : 1;
    if (candidate.position === "TE") ageAdjustment = age <= 29 ? 4 : age >= 33 ? -6 : 1;
  }
  return Math.round(clamp(rating + ageAdjustment, 1, 100));
}

function renderPlayerMeters(container, candidate) {
  container.replaceChildren();
  const blitz = candidate.blitzValue;
  if (blitz?.overall) {
    const pill = document.createElement("span");
    pill.className = `meter-pill value-${String(blitz.trend?.status ?? "stable").toLowerCase()}`;
    pill.textContent = `BV ${formatBlitzValue(blitz.overall, { suffix: false })}`;
    pill.title = blitzValueTitle(candidate);
    container.append(pill);

    const trend = document.createElement("span");
    trend.className = `meter-pill value-${String(blitz.trend?.status ?? "stable").toLowerCase()}`;
    trend.textContent = blitz.trend?.label ?? formatBlitzDelta(0);
    trend.title = (blitz.reasons ?? []).map((reason) => `${reason.delta > 0 ? "+" : ""}${Math.round(reason.delta)} BV ${reason.label}`).join("; ");
    container.append(trend);

    const range = document.createElement("span");
    range.className = "meter-pill pick-grade";
    range.textContent = `Floor ${formatBlitzValue(blitz.floor, { suffix: false })} / Ceiling ${formatBlitzValue(blitz.ceiling, { suffix: false })}`;
    range.title = `Volatility: ${blitz.volatility}. Championship Impact: ${blitz.championshipImpact}/100.`;
    container.append(range);
  }

  if (candidate.confidence) {
    const pill = document.createElement("span");
    pill.className = `meter-pill confidence-${confidenceLevel(candidate.confidence.percent)}`;
    pill.textContent = `Confidence ${candidate.confidence.percent}%`;
    pill.title = candidate.confidence.reason ?? "Pick confidence from board value, fit, tier pressure, and next-pick availability";
    container.append(pill);
  }
  const simulation = state.whatIfSimulations?.byPlayerId?.get(String(candidate.playerId));
  if (simulation) {
    const pill = document.createElement("span");
    pill.className = `meter-pill confidence-${confidenceLevel(simulation.confidence)}`;
    pill.textContent = `Sim grade ${simulation.averageFinalGrade}`;
    pill.title = `10,000-outcome what-if: playoff grade ${simulation.playoffGrade}, starter rate ${simulation.starterRate}%, confidence ${simulation.confidence}%.`;
    container.append(pill);
  }
  const pickGrade = candidate.pickGrade ?? candidate.totalScore;
  if (pickGrade) {
    const pill = document.createElement("span");
    pill.className = "meter-pill pick-grade";
    pill.textContent = `Pick grade ${pickGrade}/100`;
    pill.title = "Value and team-fit score for this exact draft pick";
    container.append(pill);
  }
  const value = candidate.valueMeter;
  const risk = candidate.riskMeter;
  if (!value && !risk) {
    return;
  }

  if (value && !blitz?.overall) {
    const pill = document.createElement("span");
    pill.className = `meter-pill value-${String(value.status ?? "stable").toLowerCase()}`;
    pill.textContent = value.currentValue > 100
      ? `${value.status ?? "Stable"} value ${formatBlitzValue(value.currentValue)}`
      : `${value.status ?? "Stable"} value ${value.currentValue ?? "-"}/100`;
    pill.title = (value.reasons ?? []).join("; ");
    container.append(pill);
  }

  if (risk) {
    const pill = document.createElement("span");
    pill.className = `meter-pill risk-${String(risk.level ?? "moderate").toLowerCase()}`;
    pill.textContent = `${risk.level ?? "Moderate"} risk ${risk.score ?? "-"}/100`;
    pill.title = (risk.reasons ?? []).join("; ");
    container.append(pill);
  }
}

function confidenceLevel(percent) {
  const value = Number(percent) || 0;
  if (value >= 86) return "high";
  if (value >= 68) return "medium";
  return "low";
}

function renderScoreBars(container, components) {
  container.replaceChildren();
  const blitz = components?.blitzComponents;
  if (blitz) {
    const rows = [
      ["Prod", blitz.production ?? 0, 100, "#7c3aed"],
      ["Market", blitz.market ?? 0, 100, "#d8a72c"],
      ["News", blitz.news ?? 0, 100, "#a78bfa"],
      ["Opp", blitz.opportunity ?? 0, 100, "#22c55e"],
      ["Sched", blitz.schedule ?? 0, 100, "#38bdf8"],
      ["AI", blitz.aiConfidence ?? 0, 100, "#f59e0b"],
      ["Talent", blitz.talent ?? 0, 100, "#7c3aed"],
      ["Risk", blitz.risk ?? 0, 100, "#dc2626"]
    ];
    renderBarRows(container, rows);
    return;
  }

  const rows = [
    ["Board", components.board ?? components.bpa ?? 0, components.boardMax ?? 88, "#7c3aed"],
    ...(components.ageMax ? [["Age", components.age ?? 0, components.ageMax, "#fbbf24"]] : []),
    ["Fit", components.fit ?? components.need ?? 0, components.fitMax ?? 2, "#d97706"],
    ["Pos Tier", components.tier ?? components.scarcity ?? 0, components.tierMax ?? 6, "#f59e0b"],
    ...(components.simMax ? [["Sim", components.sim ?? 0, components.simMax, "#22c55e"]] : []),
    ["Signal", components.news ?? components.market ?? 0, 5, "#a78bfa"],
    ["Safe", components.safety ?? Math.max(0, 3 - (components.risk ?? 0)), 3, "#a16207"]
  ];

  renderBarRows(container, rows);
}

function renderBarRows(container, rows) {
  for (const [label, value, max, color] of rows) {
    const row = document.createElement("div");
    row.className = "score-row";
    const labelEl = document.createElement("span");
    labelEl.textContent = label;
    const track = document.createElement("div");
    track.className = "bar-track";
    const fill = document.createElement("div");
    fill.className = "bar-fill";
    fill.style.width = `${Math.min(100, Math.max(0, value / max * 100))}%`;
    fill.style.background = color;
    track.append(fill);
    const valueEl = document.createElement("span");
    valueEl.textContent = String(value);
    row.append(labelEl, track, valueEl);
    container.append(row);
  }
}

function renderReasons(container, reasons) {
  container.replaceChildren();
  for (const reason of reasons) {
    const item = document.createElement("li");
    item.textContent = reason;
    container.append(item);
  }
}

function renderSources(container, sources) {
  container.replaceChildren();
  container.classList.add("is-hidden");
}

async function markCandidateTaken(candidate) {
  const name = candidate.name;
  if (!name || state.manualTakenNames.includes(name)) {
    return;
  }
  state.manualTakenNames = [...state.manualTakenNames, name];
  state.manualTakenByDraft = {
    ...state.manualTakenByDraft,
    [state.draftId]: state.manualTakenNames
  };
  await setLocal({ manualTakenByDraft: state.manualTakenByDraft });
  buildAndRenderRecommendations();
  setStatus("Hidden");
}

async function runAdvisor(candidate, button = null) {
  if (!state.recommendations) {
    return;
  }

  const advisorUrl = normalizeAdvisorUrl(elements.advisorUrlInput.value.trim() || state.settings.advisorUrl);
  if (elements.advisorUrlInput.value.trim() !== advisorUrl || state.settings.advisorUrl !== advisorUrl) {
    elements.advisorUrlInput.value = advisorUrl;
    state.settings = { ...state.settings, advisorUrl };
    await saveSettings(state.settings);
  }
  const originalButtonText = button?.textContent ?? "";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  if (button) {
    button.disabled = true;
    button.textContent = "Checking";
  }
  setStatus("Web check");
  elements.advisorOutput.classList.remove("is-hidden");
  elements.advisorOutput.textContent = "Checking live web and public fantasy context...";

  const payload = {
    draft: {
      id: state.draftId,
      name: state.draft?.metadata?.name,
      scoring: state.draft?.metadata?.scoring_type,
      type: state.draft?.type,
      status: state.draft?.status,
      settings: state.draft?.settings
    },
    currentPick: state.recommendations.currentPick,
    roster: {
      rosterId: state.rosterId,
      counts: state.recommendations.roster.counts,
      slots: state.recommendations.slots
    },
    selectedCandidate: slimCandidate(candidate),
    topCandidates: state.recommendations.candidates.slice(0, 6).map(slimCandidate)
  };

  try {
    const health = await fetchAdvisorHealth(advisorUrl, controller.signal);
    if (health && health.hasOpenAIKey === false) {
      throw new Error("Advisor server is running, but OPENAI_API_KEY is missing in that server window. Close it, rerun start-advisor-server.cmd, and paste your key.");
    }

    const response = await fetch(advisorUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    const advice = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(advice?.error || `${response.status} ${response.statusText}`);
    }

    renderAdvisorOutput(advice);
    setStatus("Live");
  } catch (error) {
    const message =
      error.name === "AbortError"
        ? "Live web check timed out. The local advisor server may still be searching; try again or shorten the candidate list."
        : `Advisor unavailable: ${formatAdvisorError(error, advisorUrl)}`;
    renderAdvisorError(message);
    setStatus("Advisor off");
  } finally {
    clearTimeout(timeout);
    if (button) {
      button.disabled = false;
      button.textContent = originalButtonText;
    }
  }
}

function normalizeAdvisorUrl(value) {
  return sanitizeAdvisorUrl(value);
}

async function fetchAdvisorHealth(advisorUrl, signal) {
  const url = new URL(advisorUrl);
  url.pathname = "/health";
  url.search = "";
  url.hash = "";

  try {
    const response = await fetch(url.toString(), { signal });
    if (!response.ok) {
      throw new Error(`Health check returned ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    if (error.name === "AbortError") {
      throw error;
    }
    throw new Error(`Could not reach the local advisor server at ${url}. Double-click start-advisor-server.cmd, leave that window open, then reload the extension. Browser detail: ${error.message || error}`);
  }
}

function formatAdvisorError(error, advisorUrl) {
  const message = String(error.message || error);
  if (/failed to fetch/i.test(message)) {
    return `Chrome could not connect to ${advisorUrl}. Make sure start-advisor-server.cmd is running, then reload the unpacked extension so the localhost permission update takes effect.`;
  }
  return `${message}`;
}

function renderAdvisorError(message) {
  elements.advisorOutput.innerHTML = "";
  const errorBox = document.createElement("div");
  errorBox.className = "error-state";
  errorBox.textContent = message;
  elements.advisorOutput.append(errorBox);
}

function slimCandidate(candidate) {
  return {
    playerId: candidate.playerId,
    name: candidate.name,
    team: candidate.team,
    position: candidate.position,
    score: candidate.totalScore,
    pickGrade: candidate.pickGrade ?? candidate.totalScore,
    playerRating: candidate.playerRating ?? null,
    rank: candidate.rankSort,
    valueRank: candidate.valueRankSort ?? null,
    providerRank: candidate.valueRankSort ?? null,
    adjustedRank: candidate.adjustedRank ?? null,
    adviceRank: candidate.adviceRank ?? null,
    marketRank: candidate.marketRank ?? null,
    marketRankLabel: candidate.marketRankLabel ?? null,
    tier: candidate.tier,
    positionTier: candidate.positionTier ?? candidate.tier ?? null,
    positionTierSource: candidate.positionTierSource ?? null,
    tierPressure: candidate.tierPressure ?? null,
    reasons: candidate.reasons,
    sources: candidate.sources,
    injuryStatus: candidate.player?.injury_status ?? null,
    playerContext: candidate.playerContext ?? null,
    production: candidate.production ?? null,
    blitzValue: candidate.blitzValue ?? null,
    valueMeter: candidate.valueMeter ?? null,
    riskMeter: candidate.riskMeter ?? null
  };
}

function renderAdvisorOutput(advice = {}) {
  advice = advice ?? {};
  elements.advisorOutput.innerHTML = "";
  const title = document.createElement("h2");
  title.textContent = advice.recommendedName ? `Web check: ${advice.recommendedName}` : "Web check";
  const summary = document.createElement("p");
  summary.textContent = advice.summary ?? advice.raw ?? "No summary returned.";
  elements.advisorOutput.append(title, summary);

  if (advice.liveFeedStatus) {
    const meta = document.createElement("p");
    meta.className = "advisor-meta";
    meta.textContent = advice.liveFeedStatus;
    elements.advisorOutput.append(meta);
  }

  if (advice.citations?.length) {
    const citationList = document.createElement("div");
    citationList.className = "source-list";
    renderSources(citationList, advice.citations);
    elements.advisorOutput.append(citationList);
  }

  for (const note of advice.candidateNotes ?? []) {
    const block = document.createElement("div");
    block.className = "advisor-note";
    const heading = document.createElement("p");
    heading.innerHTML = "";
    const strong = document.createElement("strong");
    strong.textContent = note.name ?? "Candidate";
    heading.append(strong, document.createTextNode(note.verdict ? ` - ${note.verdict}` : ""));
    block.append(heading);

    const list = document.createElement("ul");
    for (const bullet of note.bullets ?? []) {
      const item = document.createElement("li");
      item.textContent = bullet;
      list.append(item);
    }
    block.append(list);

    const sourceList = document.createElement("div");
    sourceList.className = "source-list";
    renderSources(sourceList, note.citations ?? []);
    block.append(sourceList);
    elements.advisorOutput.append(block);
  }
}

async function refreshLiveNewsImpact() {
  if (state.isNewsRefreshing || !state.recommendations?.candidates?.length) {
    return;
  }
  if (Date.now() - state.newsRefreshAt < 90000) {
    return;
  }

  const advisorUrl = normalizeAdvisorUrl(elements.advisorUrlInput.value.trim() || state.settings.advisorUrl);
  const newsUrl = new URL(advisorUrl);
  newsUrl.pathname = "/news-impact";
  newsUrl.search = "";
  newsUrl.hash = "";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);
  state.isNewsRefreshing = true;

  try {
    const response = await fetch(newsUrl.toString(), {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        currentPick: state.recommendations.currentPick,
        selectedCandidate: slimCandidate(state.recommendations.candidates[0]),
        topCandidates: state.recommendations.candidates.slice(0, 12).map(slimCandidate)
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      return;
    }

    const news = await response.json();
    const nextEvidence = news?.evidence?.items?.length ? news.evidence : null;
    const previous = JSON.stringify(state.liveNewsEvidence?.items ?? []);
    const next = JSON.stringify(nextEvidence?.items ?? []);
    state.newsRefreshAt = Date.now();
    if (previous !== next) {
      state.liveNewsEvidence = nextEvidence;
      buildAndRenderRecommendations({ skipNewsRefresh: true });
    }
  } catch {
    // The local advisor server is optional; the board still works without live news.
  } finally {
    clearTimeout(timeout);
    state.isNewsRefreshing = false;
  }
}

function mergeEvidence(...docs) {
  const items = docs.flatMap((doc) => Array.isArray(doc?.items) ? doc.items : []);
  if (!items.length) {
    return null;
  }
  return {
    updatedAt: new Date().toISOString(),
    items
  };
}

async function importJsonFile(input, kind) {
  const file = input.files?.[0];
  if (!file) {
    return;
  }

  try {
    const text = await file.text();
    const json = JSON.parse(text);
    if (kind === "rankings") {
      const format = getBoardFormat(json, getActiveDraftRankingFormat());
      state.rankings = json;
      state.rankingsByFormat = {
        ...state.rankingsByFormat,
        [format]: json
      };
      state.settings = { ...state.settings, rankingMode: "custom" };
      elements.rankingModeSelect.value = "custom";
      await setLocal({ rankingsDoc: json, rankingsByFormat: state.rankingsByFormat, lastEditedRankingFormat: format });
      await saveSettings(state.settings);
    } else {
      state.evidence = json;
      await setLocal({ evidenceDoc: json });
    }
    renderRankingFreshness();
    buildAndRenderRecommendations();
    setStatus("Imported");
  } catch (error) {
    renderError(`Could not import ${kind}: ${error.message || error}`);
  } finally {
    input.value = "";
  }
}

async function loadSampleData() {
  const [rankings, evidence] = await Promise.all([
    fetch(chrome.runtime.getURL("src/data/rankings.sample.json")).then((response) => response.json()),
    fetch(chrome.runtime.getURL("src/data/evidence.sample.json")).then((response) => response.json())
  ]);
  const sampleFormat = getBoardFormat(rankings, "ppr");
  state.rankings = rankings;
  state.rankingsByFormat = {
    ...state.rankingsByFormat,
    [sampleFormat]: rankings
  };
  state.settings = { ...state.settings, rankingMode: "custom" };
  elements.rankingModeSelect.value = "custom";
  state.evidence = evidence;
  await setLocal({
    rankingsDoc: rankings,
    rankingsByFormat: state.rankingsByFormat,
    lastEditedRankingFormat: sampleFormat,
    evidenceDoc: evidence
  });
  await saveSettings(state.settings);
  renderRankingFreshness();
  buildAndRenderRecommendations();
  setStatus("Sample loaded");
}

async function clearDraftData() {
  await removeLocal([
    "activeDraftId",
    "selectedRosterId",
    "selectedRosterByDraft",
    "selectedRosterSourceByDraft",
    "activeDraftSlot",
    "activeDraftSlotByDraft",
    "rankingsDoc",
    "rankingsByFormat",
    "lastEditedRankingFormat",
    "evidenceDoc",
    "manualTakenByDraft"
  ]);
  state.draftId = "";
  state.rosterId = "";
  state.selectedRosterByDraft = {};
  state.selectedRosterSourceByDraft = {};
  state.activeDraftSlot = "";
  state.activeDraftSlotByDraft = {};
  state.rankings = null;
  state.rankingsByFormat = {};
  state.activeRankings = null;
  state.manualTakenByDraft = {};
  state.manualTakenNames = [];
  state.evidence = null;
  elements.draftIdInput.value = "";
  renderRankingFreshness();
  renderEmpty("Draft data cleared. Open a Sleeper draft room or paste a draft ID to start again.");
  setStatus("Idle");
}

function renderRankingFreshness() {
  const rankings = getSelectedRankings();
  if (!rankings) {
    elements.rankingFreshness.textContent = "No ranking board loaded";
    return;
  }
  const mode = state.settings?.rankingMode === "auto" ? "auto" : state.settings?.rankingMode === "custom" ? "custom" : "manual";
  const format = state.activeScoringFormat !== "unknown" ? state.activeScoringFormat : getBoardFormat(rankings, "ppr");
  const scoring = `${formatScoringLabel(format)} `;
  const date = rankings.updatedAt ? `updated ${rankings.updatedAt}` : "custom board";
  const source =
    state.activeRankingsSource === "custom-redraft"
      ? "custom redraft rank / provider value"
      : state.activeRankingsSource === "fantasycalc"
      ? "FantasyCalc value"
      : state.activeRankingsSource === "custom"
        ? "edited"
        : "loaded";
  elements.rankingFreshness.textContent = `${scoring}${source} board ${date} (${mode})`;
}

function renderEmpty(message) {
  elements.recommendations.replaceChildren();
  const box = document.createElement("div");
  box.className = "empty-state";
  box.textContent = message;
  elements.recommendations.append(box);
}

function renderError(message) {
  elements.recommendations.replaceChildren();
  const box = document.createElement("div");
  box.className = "error-state";
  box.textContent = message;
  elements.recommendations.append(box);
}

function setStatus(label) {
  elements.statusMetric.textContent = label;
}

function maxCount(items) {
  return Math.max(0, ...(Array.isArray(items) ? items.map((item) => Number(item.count) || 0) : []));
}

function getDraftOrderUserIds(draft) {
  return Object.keys(draft?.draft_order ?? {}).filter(Boolean);
}

function mergeUsers(...sets) {
  const byId = new Map();
  for (const user of sets.flat()) {
    if (user?.user_id) {
      byId.set(String(user.user_id), user);
    }
  }
  return [...byId.values()];
}

function buildRankingLookup(rankings) {
  const lookup = {
    byId: new Map(),
    byNamePosition: new Map(),
    byName: new Map()
  };

  for (const player of rankings?.players ?? []) {
    const name = player.name ?? player.player ?? player.fullName ?? "";
    const position = normalizePosition(player.position);
    const nameKey = normalizeName(name);
    const positionKey = `${nameKey}|${position}`;
    if (!nameKey) {
      continue;
    }

    if (player.playerId || player.player_id || player.sleeperId || player.sleeper_id) {
      lookup.byId.set(String(player.playerId ?? player.player_id ?? player.sleeperId ?? player.sleeper_id), player);
    }
    if (position) {
      setBestRanking(lookup.byNamePosition, positionKey, player);
    }
    setBestRanking(lookup.byName, nameKey, player);
  }

  return lookup;
}

function setBestRanking(map, key, player) {
  if (!key) {
    return;
  }
  const current = map.get(key);
  const playerRank = Number(player.redraftRank ?? player.displayRank ?? player.rank ?? 9999);
  const currentRank = Number(current?.redraftRank ?? current?.displayRank ?? current?.rank ?? 9999);
  if (!current || playerRank < currentRank) {
    map.set(key, player);
  }
}

function getPickDetails(pick, rankingLookup) {
  const player = state.players[String(pick.player_id)] ?? {};
  const metadata = pick.metadata ?? {};
  const name = getPickName(pick, player);
  const position = getPickPosition(pick, player);
  const ranking =
    rankingLookup.byId.get(String(pick.player_id)) ??
    rankingLookup.byNamePosition.get(`${normalizeName(name)}|${position}`) ??
    rankingLookup.byName.get(normalizeName(name)) ??
    null;
  const marketRank = Number(player.search_rank ?? ranking?.adp ?? ranking?.averageRank ?? ranking?.avgRank ?? 0) || null;
  const rank = Number(ranking?.redraftRank ?? ranking?.displayRank ?? ranking?.rank ?? ranking?.overallRank ?? 0) || null;
  const valueRank = Number(ranking?.valueRankSort ?? ranking?.valueOverallRank ?? ranking?.providerRank ?? ranking?.rank ?? ranking?.overallRank ?? 0) || rank;
  const valuePositionRank = Number(ranking?.valuePositionRank ?? ranking?.providerPositionRank ?? ranking?.positionRank ?? 0) || null;
  const blitzValue = buildBlitzValueProfile({
    player,
    ranking,
    position,
    team: metadata.team ?? player.team ?? "",
    marketRank,
    boardRank: valueRank,
    positionRank: valuePositionRank,
    draftContext: {
      isDynasty: isDynastyFormat(getActiveDraftRankingFormat()),
      isSuperflex: getActiveDraftRankingFormat() === "superflex_dynasty" || Number(state.draft?.settings?.slots_super_flex ?? 0) > 0
    }
  });

  return {
    pickNo: Number(pick.pick_no ?? pick.round_pick_no ?? 0),
    round: Number(pick.round ?? 0),
    rosterId: String(pick.roster_id ?? ""),
    playerId: String(pick.player_id ?? ""),
    name,
    position,
    team: metadata.team ?? player.team ?? "",
    rank,
    valueRank,
    providerRank: valueRank,
    marketRank,
    adviceRank: gradeAdviceRank(ranking, player, position),
    tier: Number(ranking?.redraftTier ?? ranking?.positionTier ?? ranking?.posTier ?? ranking?.positionalTier ?? 0) || null,
    age: Number(ranking?.age ?? player.age ?? player.metadata?.age ?? 0) || null,
    fantasyCalcValue: Number(ranking?.calculatedValue ?? ranking?.fantasyCalcValue ?? ranking?.value ?? ranking?.redraftValue ?? ranking?.combinedValue ?? 0) || null,
    blitzValue,
    playerRating: blitzValue?.rating ?? playerRatingFromRanking(ranking)
  };
}

function getPickName(pick, player) {
  const metadata = pick.metadata ?? {};
  const firstLast = `${metadata.first_name ?? ""} ${metadata.last_name ?? ""}`.trim();
  return [
    metadata.player_name ??
      metadata.full_name ??
      metadata.player_full_name ??
      metadata.name ??
      metadata.player ??
      pick.player_name ??
      pick.full_name ??
      pick.name,
    firstLast,
    displayName(player)
  ].find((value) => String(value ?? "").trim()) || "Unknown player";
}

function getPickPosition(pick, player) {
  const metadata = pick.metadata ?? {};
  return normalizePosition(metadata.position ?? player.position ?? player.fantasy_positions?.[0]);
}

function countPickPositions(picks) {
  const counts = { QB: 0, RB: 0, WR: 0, TE: 0, DEF: 0 };
  for (const pick of picks) {
    if (counts[pick.position] !== undefined) {
      counts[pick.position] += 1;
    }
  }
  return counts;
}

function gradeTeamDraft(picks, counts, slots, format = "ppr") {
  if (!picks.length) {
    return {
      letter: "-",
      pending: true,
      summary: "No picks yet"
    };
  }

  const minimumGradePicks = 4;
  if (picks.length < minimumGradePicks) {
    return {
      letter: "-",
      pending: true,
      summary: `${picks.length}/4 picks before grade`
    };
  }

  const evaluation = evaluateTeamDraft(picks, counts, slots, format);
  const score = evaluation.score;

  return {
    score,
    power: evaluation.power,
    teamStrength: evaluation.teamStrength,
    components: evaluation.components,
    letter: letterGrade(score),
    pending: false,
    summary: `${picks.length} pick${picks.length === 1 ? "" : "s"} - ${gradeSummary(score)}`
  };
}

function evaluateTeamDraft(picks, counts, slots = {}, format = "ppr") {
  const teamStrength = teamStrengthScore(picks, counts, slots, format);
  const blitzPower = rosterBlitzPowerScore(picks, slots);
  const blitzValue = rosterBlitzValue(picks, slots);
  const valueScore = draftValueScore(picks, format);
  const constructionScore = rosterConstructionGradeScore(counts, slots, picks.length, format);
  const futureScore = isDynastyFormat(format) ? dynastyFutureScore(picks) : 0;
  const riskScore = draftRiskScore(picks, format);
  const score = Math.round(clamp(
    71 +
      (teamStrength - 75) * 0.48 +
      (blitzPower - 75) * 0.42 +
      constructionScore * 0.42 +
      valueScore * 0.24 +
      futureScore * 0.22 +
      riskScore,
    45,
    99
  ));
  const power = Math.round(clamp(
    teamStrength * 0.38 +
      blitzPower * 0.42 +
      score * 0.2 +
      constructionScore * 0.12 +
      valueScore * 0.08,
    1,
    99
  ));

  return {
    score,
    power,
    teamStrength,
    components: {
      starterStrength: teamStrength,
      blitzPower,
      blitzValue,
      construction: Math.round(constructionScore),
      value: Math.round(valueScore),
      future: Math.round(futureScore),
      risk: Math.round(riskScore)
    }
  };
}

function teamStrengthScore(picks, counts, slots = {}, format = "ppr") {
  const lineup = buildProjectedLineup(picks, slots);
  const starters = lineup.starters;
  if (!starters.length) {
    return 65;
  }

  const starterAverage = weightedAverageRatings(starters);
  const starterElite = starters.filter((pick) => Number(pick.playerRating) >= 92).length;
  const starterStrong = starters.filter((pick) => Number(pick.playerRating) >= 86).length;
  const benchDepth = average(lineup.bench.map((pick) => Number(pick.playerRating)));
  let score = starterAverage + starterElite * 1.5 + starterStrong * 0.45;
  if (benchDepth) score += clamp((benchDepth - 62) * 0.06, -2, 3);

  if (isDynastyFormat(format)) {
    score += dynastyFutureScore(starters) * 0.2;
  }
  if ((slots.SUPER_FLEX ?? 0) > 0 && (counts.QB ?? 0) === 0 && picks.length >= 5) {
    score -= 6;
  }
  if ((slots.SUPER_FLEX ?? 0) === 0 && (counts.QB ?? 0) > 1 && picks.length < 10) {
    score -= 4;
  }

  return Math.round(clamp(score, 35, 99));
}

function rosterBlitzValue(picks, slots = {}) {
  const lineup = buildProjectedLineup(picks, slots);
  const starters = lineup.starters.length ? lineup.starters : picks.filter((pick) => pick.position !== "DEF");
  const starterValue = starters.reduce((total, pick, index) => total + blitzOverallForPick(pick) * Math.max(0.72, 1.14 - index * 0.05), 0);
  const benchValue = lineup.bench.slice(0, 4).reduce((total, pick, index) => total + blitzOverallForPick(pick) * Math.max(0.18, 0.35 - index * 0.04), 0);
  return Math.round(starterValue + benchValue);
}

function rosterBlitzPowerScore(picks, slots = {}) {
  const lineup = buildProjectedLineup(picks, slots);
  const starters = lineup.starters;
  if (!starters.length) {
    return 65;
  }
  let weightedValue = 0;
  let weightTotal = 0;
  starters.forEach((pick, index) => {
    const weight = Math.max(0.7, 1.18 - index * 0.06);
    weightedValue += blitzOverallForPick(pick) * weight;
    weightTotal += weight;
  });
  const averageBv = weightTotal ? weightedValue / weightTotal : 6200;
  const base = blitzValueToRating(averageBv) ?? 65;
  const elite = starters.filter((pick) => blitzOverallForPick(pick) >= 9200).length;
  const strong = starters.filter((pick) => blitzOverallForPick(pick) >= 8600).length;
  const benchDepth = average(lineup.bench.slice(0, 4).map((pick) => blitzValueToRating(blitzOverallForPick(pick)) ?? 0));
  let score = base + elite * 1.8 + strong * 0.55;
  if (benchDepth) {
    score += clamp((benchDepth - 64) * 0.05, -2, 3);
  }
  return Math.round(clamp(score, 35, 99));
}

function blitzOverallForPick(pick) {
  const value = Number(pick?.blitzValue?.overall ?? pick?.blitzValueOverall);
  if (Number.isFinite(value) && value > 0) {
    return value;
  }
  const rating = Number(pick?.playerRating);
  if (Number.isFinite(rating) && rating > 0) {
    return rating * 100;
  }
  return 5200;
}

function buildProjectedLineup(picks, slots = {}) {
  const available = picks
    .filter((pick) => pick.position !== "DEF" && Number.isFinite(Number(pick.playerRating)))
    .sort((left, right) => Number(right.playerRating) - Number(left.playerRating));
  const starters = [];
  const takeBest = (positions, count) => {
    const normalized = new Set(positions);
    for (let taken = 0; taken < count; taken += 1) {
      const index = available.findIndex((pick) => normalized.has(pick.position));
      if (index < 0) break;
      starters.push(available.splice(index, 1)[0]);
    }
  };

  takeBest(["QB"], Number(slots.QB ?? 1));
  takeBest(["RB"], Number(slots.RB ?? 2));
  takeBest(["WR"], Number(slots.WR ?? 2));
  takeBest(["TE"], Number(slots.TE ?? 1));
  takeBest(["RB", "WR", "TE"], Number(slots.FLEX ?? 1));
  takeBest(["WR", "TE"], Number(slots.REC_FLEX ?? 0));
  takeBest(["QB", "RB", "WR", "TE"], Number(slots.SUPER_FLEX ?? 0));

  const starterTarget = Math.min(projectedStarterCount(slots), picks.filter((pick) => pick.position !== "DEF").length);
  while (starters.length < starterTarget && available.length) {
    starters.push(available.shift());
  }

  return {
    starters,
    bench: available.slice(0, 4)
  };
}

function draftValueScore(picks, format = "ppr") {
  let score = 0;
  let reachCount = 0;
  let stealCount = 0;
  for (const pick of picks) {
    const expectedRank = expectedPickRank(pick, format);
    if (!expectedRank) {
      score -= 1.5;
      continue;
    }
    const pickNo = Number(pick.pickNo) || 0;
    const value = pickNo - expectedRank;
    const weight = pickNo <= 36 ? 1.15 : pickNo <= 84 ? 0.95 : 0.72;
    score += clamp(value * 0.18 * weight, -8, 6);

    const expectedRating = playerRatingFromRank(pickNo);
    const rating = Number(pick.playerRating);
    if (Number.isFinite(rating) && expectedRating !== null && Number.isFinite(Number(expectedRating))) {
      score += clamp((rating - Number(expectedRating)) * 0.18, -3, 5);
    }

    const marketRank = Number(pick.marketRank);
    if (Number.isFinite(marketRank) && marketRank > 0) {
      const marketGap = pickNo - marketRank;
      if (marketGap <= -24) score -= pick.position === "QB" ? 3.5 : 2;
      else if (marketGap <= -12) score -= pick.position === "QB" ? 2 : 1;
    }

    if (value >= 14) stealCount += 1;
    if (value <= -14) reachCount += 1;
    if (value <= -28) score -= 2.5;
  }
  if (stealCount >= 2) score += 1;
  if (reachCount >= 2) score -= 3.5;
  return clamp(score, -22, 15);
}

function expectedPickRank(pick, format = "ppr") {
  const boardRank = Number(pick.valueRank ?? pick.providerRank ?? pick.rank);
  const marketRank = Number(pick.marketRank);
  const adviceRank = Number(pick.adviceRank);
  if (Number.isFinite(boardRank) && boardRank > 0 && Number.isFinite(marketRank) && marketRank > 0) {
    const marketWeight = marketWeightForPickAdvice(pick.position, boardRank, marketRank, format);
    return boardRank * (1 - marketWeight) + marketRank * marketWeight;
  }
  if (Number.isFinite(adviceRank) && adviceRank > 0) return adviceRank;
  if (Number.isFinite(marketRank) && marketRank > 0) return marketRank;
  if (Number.isFinite(boardRank) && boardRank > 0) return boardRank;
  return null;
}

function gradeAdviceRank(ranking, player = {}, position = "") {
  if (!ranking) return null;
  const boardRank = Number(ranking.valueRankSort ?? ranking.valueOverallRank ?? ranking.providerRank ?? ranking.rank ?? ranking.overallRank);
  const marketRank = Number(player.search_rank ?? ranking.adp ?? ranking.averageRank ?? ranking.avgRank);
  if (Number.isFinite(boardRank) && boardRank > 0 && Number.isFinite(marketRank) && marketRank > 0) {
    const marketWeight = marketWeightForPickAdvice(position || ranking.position, boardRank, marketRank);
    return boardRank * (1 - marketWeight) + marketRank * marketWeight;
  }
  if (Number.isFinite(marketRank) && marketRank > 0) return marketRank;
  if (Number.isFinite(boardRank) && boardRank > 0) return boardRank;
  return null;
}

function marketWeightForPickAdvice(position = "", boardRank, marketRank, format = "ppr") {
  const pos = normalizePosition(position);
  const boardToMarketGap = Number(marketRank) - Number(boardRank);
  let marketWeight = isDynastyFormat(format) ? 0.58 : 0.38;
  if (pos === "QB") {
    marketWeight = isDynastyFormat(format) ? 0.62 : 0.5;
    if (boardToMarketGap >= 12) marketWeight += 0.08;
    if (boardToMarketGap >= 24) marketWeight += 0.06;
    if (boardToMarketGap >= 36) marketWeight += 0.04;
  } else if (boardToMarketGap >= 18) {
    marketWeight += 0.05;
  } else if (boardToMarketGap <= -18) {
    marketWeight -= 0.05;
  }
  return clamp(marketWeight, 0.3, 0.78);
}

function weightedAverageRatings(picks) {
  let total = 0;
  let weightTotal = 0;
  picks.forEach((pick, index) => {
    const rating = Number(pick.playerRating);
    if (!Number.isFinite(rating)) return;
    const weight = Math.max(0.62, 1.18 - index * 0.06);
    total += rating * weight;
    weightTotal += weight;
  });
  return weightTotal ? total / weightTotal : 0;
}

function rosterConstructionGradeScore(counts, slots = {}, pickCount = 0, format = "ppr") {
  const rb = counts.RB ?? 0;
  const wr = counts.WR ?? 0;
  const qb = counts.QB ?? 0;
  const te = counts.TE ?? 0;
  const def = counts.DEF ?? 0;
  const flexTarget = Math.max(1, (slots.RB ?? 0) + (slots.WR ?? 0) + (slots.TE ?? 0) + (slots.FLEX ?? 0) + (slots.REC_FLEX ?? 0));
  const flexCovered = rb + wr + te;
  const rbTarget = Math.max(slots.RB ?? 0, Math.round(flexTarget * 0.42));
  const wrTarget = Math.max(slots.WR ?? 0, Math.round(flexTarget * 0.5));
  const isDynasty = isDynastyFormat(format);
  const isSuperflex = format === "superflex_dynasty" || (slots.SUPER_FLEX ?? 0) > 0;
  let score = 0;

  score += clamp((flexCovered - Math.min(flexTarget, pickCount)) * 1.2, -5, 4);
  if (pickCount >= 4) {
    if (rb >= 1 && wr >= 2) score += 4;
    if (rb >= 2 && wr >= 2) score += 4;
    if (wr >= Math.min(wrTarget, 3)) score += format === "ppr" || format === "half_ppr" ? 3 : 2;
    if (rb === 0) score -= pickCount >= 6 ? 10 : 6;
    if (wr === 0) score -= pickCount >= 6 ? 11 : 7;
    if (rb >= 4 && wr <= 1) score -= 8;
    if (wr >= 5 && rb <= 1) score -= 8;
  }

  if (isSuperflex) {
    if (qb === 0 && pickCount >= 6) score -= 7;
    if (qb >= 2) score += isDynasty ? 1 : 3;
    if (qb >= 3 && pickCount < 9) score -= 5;
  } else if (qb > 1 && pickCount < 10) {
    score -= 8;
  }

  if (te === 0 && pickCount >= Math.max(6, flexTarget)) score -= 3;
  if (te > 1 && pickCount < 10) score -= 4;
  if (def > 0 && pickCount < 12) score -= 10;
  if (rb >= rbTarget && wr >= wrTarget) score += 3;

  return clamp(score, -18, 18);
}

function draftRiskScore(picks, format = "ppr") {
  if (!isDynastyFormat(format)) {
    return 0;
  }

  let score = 0;
  for (const pick of picks) {
    const age = Number(pick.age);
    if (!Number.isFinite(age) || !age) continue;
    if (pick.position === "RB" && age >= 28) score -= 2.2;
    if (pick.position === "WR" && age >= 31) score -= 1.8;
    if (pick.position === "TE" && age >= 33) score -= 1.4;
    if (pick.position === "QB" && age >= 38) score -= 1.2;
  }
  return clamp(score, -8, 2);
}

function projectedStarterCount(slots = {}) {
  return Math.max(
    5,
    Number(slots.QB ?? 1) +
      Number(slots.RB ?? 2) +
      Number(slots.WR ?? 2) +
      Number(slots.TE ?? 1) +
      Number(slots.FLEX ?? 1) +
      Number(slots.REC_FLEX ?? 0) +
      Number(slots.SUPER_FLEX ?? 0)
  );
}

function dynastyFutureScore(picks) {
  let score = 0;
  for (const pick of picks) {
    const age = Number(pick.age);
    const rating = Number(pick.playerRating) || 0;
    if (!Number.isFinite(age) || !age || rating < 70) {
      continue;
    }
    if (pick.position === "RB") {
      score += age <= 24 ? 2 : age >= 28 ? -3 : age >= 27 ? -1 : 1;
    } else if (pick.position === "WR") {
      score += age <= 26 ? 2 : age >= 31 ? -2 : age >= 29 ? -1 : 1;
    } else if (pick.position === "QB") {
      score += age <= 31 ? 2 : age >= 38 ? -2 : 1;
    } else if (pick.position === "TE") {
      score += age <= 29 ? 1 : age >= 33 ? -2 : 0;
    }
  }
  return clamp(score, -7, 8);
}

function playerRatingFromRank(rank) {
  const numericRank = Number(rank);
  if (!Number.isFinite(numericRank) || numericRank <= 0) {
    return null;
  }
  const curve = [
    [1, 99],
    [2, 98],
    [3, 97],
    [5, 96],
    [8, 94],
    [12, 92],
    [18, 89],
    [24, 86],
    [36, 81],
    [50, 76],
    [72, 69],
    [100, 61],
    [130, 54],
    [160, 47],
    [200, 39],
    [260, 30],
    [350, 20],
    [500, 10],
    [700, 3]
  ];
  return Math.round(clamp(interpolateRankCurve(numericRank, curve), 0, 99));
}

function playerRatingFromRanking(ranking) {
  if (!ranking) return null;
  const valueRank = Number(ranking.valueRankSort ?? ranking.valueOverallRank ?? ranking.providerRank ?? ranking.rank ?? ranking.overallRank ?? 0) || null;
  const valuePositionRank = Number(ranking.valuePositionRank ?? ranking.providerPositionRank ?? ranking.positionRank ?? 0) || null;
  const blitzValue = buildBlitzValueProfile({
    ranking,
    position: ranking.position,
    boardRank: valueRank,
    positionRank: valuePositionRank
  });
  if (Number.isFinite(Number(blitzValue?.rating))) {
    return blitzValue.rating;
  }
  const value = Number(ranking.calculatedValue ?? ranking.fantasyCalcValue ?? ranking.value ?? ranking.redraftValue ?? ranking.combinedValue);
  const maxValue = Number(ranking.maxFantasyCalcValue);
  if (Number.isFinite(value) && value > 0 && Number.isFinite(maxValue) && maxValue > 0) {
    const valuePercent = clamp(value / maxValue, 0, 1);
    return Math.round(clamp(Math.pow(valuePercent, 0.72) * 99, 0, 99));
  }
  return playerRatingFromRank(valueRank);
}

function interpolateRankCurve(rank, curve) {
  if (rank <= curve[0][0]) {
    return curve[0][1];
  }
  for (let index = 1; index < curve.length; index += 1) {
    const [rightRank, rightValue] = curve[index];
    const [leftRank, leftValue] = curve[index - 1];
    if (rank <= rightRank) {
      const percent = (rank - leftRank) / Math.max(1, rightRank - leftRank);
      return leftValue + (rightValue - leftValue) * percent;
    }
  }
  return curve[curve.length - 1][1];
}

function average(values = []) {
  const numbers = values.map(Number).filter(Number.isFinite);
  if (!numbers.length) {
    return 0;
  }
  return numbers.reduce((total, value) => total + value, 0) / numbers.length;
}

function applyLeagueContext(rows) {
  const teamCount = Math.max(rows.length, Number(state.draft?.settings?.teams ?? 0), 1);
  const playoffTeams = estimatePlayoffTeams(teamCount, state.league);
  const totalPicks = Number(state.draft?.settings?.teams ?? 0) * Number(state.draft?.settings?.rounds ?? 0);
  const isComplete =
    ["complete", "completed"].includes(String(state.draft?.status ?? "").toLowerCase()) ||
    (totalPicks > 0 && state.picks.length >= totalPicks);
  const gradable = rows
    .filter((row) => !row.grade?.pending && row.picks.length >= 4)
    .sort((a, b) => leaguePowerScore(b) - leaguePowerScore(a));
  if (gradable.length < 2) {
    return rows.map((row) => ({ ...row, odds: null }));
  }

  const averagePickCount = average(gradable.map((row) => row.picks.length));
  const matureRead = isComplete || averagePickCount >= 7;
  const gradeFloors = isComplete
    ? [92, 88, 84, 80, 76, 72, 69, 66]
    : matureRead
      ? [91, 87, 83, 79, 75, 72, 69, 66]
      : [87, 83, 79, 75, 72, 69, 66, 63];
  const powerFloors = isComplete
    ? [93, 89, 85, 81, 77, 73, 69, 65]
    : matureRead
      ? [91, 87, 83, 79, 75, 71, 67, 63]
      : [86, 82, 78, 74, 70, 66, 63, 60];
  const contextByRoster = new Map();

  gradable.forEach((row, index) => {
    const percentile = gradable.length <= 1 ? 1 : 1 - index / (gradable.length - 1);
    const gradeFloor =
      gradeFloors[index] ??
      (percentile >= 0.5 ? (matureRead ? 73 : 70) : percentile >= 0.25 ? 67 : 61);
    const powerFloor =
      powerFloors[index] ??
      (percentile >= 0.5 ? (matureRead ? 72 : 68) : percentile >= 0.25 ? 64 : 58);
    const baseGrade = Number(row.grade?.score) || 0;
    const basePower = leaguePowerScore(row);
    const adjustedGrade = Math.round(clamp(Math.max(baseGrade, gradeFloor, basePower >= 86 ? 88 : basePower >= 80 ? 83 : 0), 45, 99));
    const adjustedPower = Math.round(clamp(Math.max(basePower, powerFloor, adjustedGrade - 2), 1, 99));
    contextByRoster.set(row.rosterId, {
      rank: index + 1,
      grade: {
        ...row.grade,
        score: adjustedGrade,
        power: adjustedPower,
        letter: letterGrade(adjustedGrade),
        pending: false,
        summary: `${row.picks.length} picks - ${gradeSummary(adjustedGrade)}`
      }
    });
  });

  const contextualRows = rows.map((row) => {
    const context = contextByRoster.get(row.rosterId);
    return context ? { ...row, grade: context.grade, leagueRank: context.rank } : { ...row, odds: null };
  });
  const contextualGradable = contextualRows.filter((row) => !row.grade?.pending && row.picks.length >= 4);
  const powers = contextualGradable.map((row) => row.grade?.power ?? leaguePowerScore(row));
  const averagePower = average(powers);
  const sortedPowers = [...powers].sort((a, b) => b - a);
  const cutoffPower = sortedPowers[Math.min(Math.max(0, playoffTeams - 1), sortedPowers.length - 1)] ?? averagePower;
  const champWeights = contextualGradable.map((row) => Math.exp(clamp(((row.grade?.power ?? leaguePowerScore(row)) - averagePower) / 5.2, -7, 7)));
  const totalChampWeight = champWeights.reduce((total, value) => total + value, 0) || 1;
  const oddsByRoster = new Map();

  contextualGradable.forEach((row, index) => {
    const power = row.grade?.power ?? leaguePowerScore(row);
    const playoff = 100 / (1 + Math.exp(-(power - cutoffPower) / 4.4));
    const championship = champWeights[index] / totalChampWeight * 100;
    oddsByRoster.set(row.rosterId, {
      power: Math.round(clamp(power, 0, 100)),
      playoff: roundOdds(clamp(playoff, 2, 98)),
      championship: roundOdds(clamp(championship, 0.1, 70))
    });
  });

  return contextualRows.map((row) => ({
    ...row,
    odds: oddsByRoster.get(row.rosterId) ?? row.odds ?? null
  }));
}

function leaguePowerScore(row) {
  const gradeScore = Number(row.grade?.score);
  const gradePower = Number(row.grade?.power);
  const teamStrength = Number(row.grade?.teamStrength);
  const blitzPower = Number(row.grade?.components?.blitzPower);
  const picks = row.picks ?? [];
  const eliteCount = picks.filter((pick) => Number(pick.playerRating) >= 92).length;
  const strongCount = picks.filter((pick) => Number(pick.playerRating) >= 86).length;
  const usableGrade = Number.isFinite(gradeScore) ? gradeScore : 55;
  const usableStrength = Number.isFinite(teamStrength) ? teamStrength : usableGrade;
  if (Number.isFinite(gradePower)) {
    return clamp(gradePower, 1, 100);
  }
  return clamp(
    usableStrength * 0.4 +
      (Number.isFinite(blitzPower) ? blitzPower : usableStrength) * 0.32 +
      usableGrade * 0.22 +
      eliteCount * 1.5 +
      strongCount * 0.6,
    1,
    100
  );
}

function estimatePlayoffTeams(teamCount, league = null) {
  const configured = Number(league?.settings?.playoff_teams ?? league?.settings?.playoffTeams);
  if (Number.isFinite(configured) && configured > 1) {
    return Math.min(teamCount, Math.max(2, Math.round(configured)));
  }
  if (teamCount <= 8) return 4;
  if (teamCount <= 10) return 4;
  if (teamCount <= 12) return 6;
  return Math.max(6, Math.round(teamCount / 2));
}

function roundOdds(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return null;
  }
  return number < 10 ? Math.round(number * 10) / 10 : Math.round(number);
}

function formatOdds(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return "-";
  }
  const text = number < 10 && number % 1 !== 0 ? number.toFixed(1) : String(Math.round(number));
  return `${text}%`;
}

function teamKeyForPick(pick) {
  const slotToRoster = state.draft?.slot_to_roster_id ?? {};
  const draftOrder = state.draft?.draft_order ?? {};
  if (pick?.roster_id) {
    return String(pick.roster_id);
  }
  if (pick?.draft_slot) {
    const slot = String(pick.draft_slot);
    return slotToRoster[slot] ? String(slotToRoster[slot]) : slot;
  }
  if (pick?.picked_by) {
    const slot = draftOrder[String(pick.picked_by)] ? String(draftOrder[String(pick.picked_by)]) : "";
    if (slot) {
      return slotToRoster[slot] ? String(slotToRoster[slot]) : slot;
    }
    return String(pick.picked_by);
  }
  const key = pick?.draft_slot_id;
  return key === undefined || key === null || key === "" ? "" : String(key);
}

function sortTeamKeys(a, b) {
  const left = Number(a);
  const right = Number(b);
  if (Number.isFinite(left) && Number.isFinite(right)) {
    return left - right;
  }
  return String(a).localeCompare(String(b));
}

function letterGrade(score) {
  if (score >= 96) return "A+";
  if (score >= 92) return "A";
  if (score >= 89) return "A-";
  if (score >= 86) return "B+";
  if (score >= 82) return "B";
  if (score >= 79) return "B-";
  if (score >= 75) return "C+";
  if (score >= 71) return "C";
  if (score >= 68) return "C-";
  if (score >= 62) return "D";
  return "F";
}

function gradeSummary(score) {
  if (score >= 89) return "excellent value and team fit";
  if (score >= 82) return "good value and usable build";
  if (score >= 75) return "mixed value, build still live";
  if (score >= 68) return "needs value and fit recovery";
  return "reaches or structure need fixing";
}

function normalizePosition(position) {
  const value = String(position ?? "").trim().toUpperCase();
  if (["DST", "D/ST", "DEFENSE"].includes(value)) {
    return "DEF";
  }
  return value;
}

function normalizeName(name) {
  return String(name ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(jr|sr|ii|iii|iv|v)\b/g, "")
    .replace(/[.'’]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function displayName(player = {}) {
  const first = player.first_name ?? "";
  const last = player.last_name ?? "";
  const full = `${first} ${last}`.trim();
  if (full) return full;
  if (player.full_name) return player.full_name;
  if (player.team && normalizePosition(player.position) === "DEF") return `${player.team} D/ST`;
  return "Unknown player";
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getPickSignature(picks) {
  return picks
    .map((pick) =>
      [
        pick.pick_no,
        pick.player_id,
        pick.roster_id,
        pick.draft_slot,
        pick.metadata?.player_name,
        pick.metadata?.position
      ]
        .filter((value) => value !== undefined && value !== null)
        .join(":")
    )
    .join("|");
}

async function loadBundledRankings() {
  const files = {
    ppr: "src/data/rankings.fantasycalc.ppr.json",
    half_ppr: "src/data/rankings.fantasycalc.half_ppr.json",
    superflex_dynasty: "src/data/rankings.fantasycalc.superflex_dynasty.json",
    dynasty: "src/data/rankings.fantasycalc.dynasty.json"
  };
  const fallbackFiles = {
    ppr: "src/data/rankings.ppr.json",
    half_ppr: "src/data/rankings.half_ppr.json",
    superflex_dynasty: "src/data/rankings.superflex_dynasty.json"
  };
  const loaded = {};

  for (const format of RANKING_FORMATS) {
    try {
      loaded[format] = await fetch(chrome.runtime.getURL(files[format])).then((response) => response.json());
      continue;
    } catch (error) {
      console.warn(`Could not load bundled FantasyCalc ${format} rankings`, error);
    }

    try {
      loaded[format] = await fetchFantasyCalcRankings(format);
      continue;
    } catch (error) {
      console.warn(`Could not load live FantasyCalc ${format} values`, error);
    }

    const file = fallbackFiles[format];
    if (!file) {
      continue;
    }
    try {
      loaded[format] = await fetch(chrome.runtime.getURL(file)).then((response) => response.json());
    } catch (error) {
      console.warn(`Could not load bundled ${format} rankings`, error);
    }
  }

  return loaded;
}

async function loadBundledCustomRedraftRankings() {
  try {
    const payload = await fetch(chrome.runtime.getURL("src/data/custom-redraft-rankings.json")).then((response) => response.json());
    return normalizeCustomRedraftBoard(payload);
  } catch (error) {
    console.warn("Could not load bundled custom redraft rankings", error);
    return normalizeCustomRedraftBoard({ players: [] });
  }
}

async function fetchFantasyCalcRankings(format) {
  const normalizedFormat = normalizeRankingFormat(format);
  const url = fantasyCalcUrlForFormat(normalizedFormat);
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`FantasyCalc returned ${response.status}`);
  }
  const payload = await response.json();
  const rows = Array.isArray(payload) ? payload : payload?.players ?? [];
  if (!rows.length) {
    throw new Error("FantasyCalc returned no players");
  }
  return normalizeFantasyCalcRankings(normalizedFormat, rows, url);
}

function fantasyCalcUrlForFormat(format) {
  const params = FANTASYCALC_FORMAT_PARAMS[normalizeRankingFormat(format)] ?? FANTASYCALC_FORMAT_PARAMS.ppr;
  const query = new URLSearchParams({
    isDynasty: String(params.isDynasty),
    numQbs: String(params.numQbs),
    numTeams: "12",
    ppr: String(params.ppr)
  });
  return `${FANTASYCALC_API_URL}?${query.toString()}`;
}

function normalizeFantasyCalcRankings(format, rows, url) {
  const maxFantasyCalcValue = rows.reduce((max, item) => {
    const value = Number(fantasyCalcItemValue(item, format) ?? 0);
    return Number.isFinite(value) ? Math.max(max, value) : max;
  }, 0);
  const updatedAt = new Date().toISOString().slice(0, 10);
  const players = rows
    .map((item) => normalizeFantasyCalcPlayer(item, format, maxFantasyCalcValue, url))
    .filter(Boolean)
    .sort((left, right) => Number(left.rank ?? 9999) - Number(right.rank ?? 9999));

  return {
    name: `FantasyCalc ${formatScoringLabel(format)} Values`,
    label: formatScoringLabel(format),
    scoring: format,
    rosterType: isDynastyFormat(format) ? "dynasty" : "redraft",
    rankingSource: "fantasycalc",
    sourceFile: "FantasyCalc live values",
    updatedAt,
    sourceUrl: url,
    players
  };
}

function normalizeFantasyCalcPlayer(item, format, maxFantasyCalcValue, url) {
  const player = item?.player ?? {};
  const name = String(player.name ?? item?.name ?? "").trim();
  const position = normalizePosition(player.position ?? item?.position);
  if (!name || !["QB", "RB", "WR", "TE", "DEF"].includes(position)) {
    return null;
  }

  const rank = Number(item?.overallRank ?? item?.rank);
  const positionRank = Number(item?.positionRank ?? item?.posRank);
  const value = Number(fantasyCalcItemValue(item, format));
  const tier = Number(item?.maybeTier ?? item?.tier);
  const sleeperId = player.sleeperId ?? player.sleeper_id ?? item?.sleeperId ?? item?.sleeper_id;
  const age = Number(player.maybeAge ?? player.age ?? item?.age);
  const trend30Day = Number(item?.trend30Day ?? item?.trend);
  const rosterPercent = Number(item?.maybeRosterPercent ?? item?.rosterPercent);

  return {
    playerId: sleeperId ? String(sleeperId) : "",
    sleeperId: sleeperId ? String(sleeperId) : "",
    name,
    player: name,
    fullName: name,
    team: String(player.maybeTeam ?? player.team ?? item?.team ?? "").trim(),
    position,
    rank: Number.isFinite(rank) && rank > 0 ? rank : null,
    overallRank: Number.isFinite(rank) && rank > 0 ? rank : null,
    valueRankLabel: "Room ADP",
    positionRank: Number.isFinite(positionRank) && positionRank > 0 ? positionRank : null,
    posRank: Number.isFinite(positionRank) && positionRank > 0 ? `${position}${positionRank}` : "",
    positionTier: Number.isFinite(tier) && tier > 0 ? tier : null,
    fantasyCalcValue: Number.isFinite(value) && value > 0 ? value : null,
    value: Number.isFinite(value) && value > 0 ? value : null,
    baseValue: Number.isFinite(value) && value > 0 ? value : null,
    calculatedValue: Number.isFinite(value) && value > 0 ? value : null,
    tradeValue: Number.isFinite(Number(item?.tradeValue ?? (isDynastyFormat(format) ? item?.dynastyValue : item?.redraftValue) ?? value)) ? Number(item?.tradeValue ?? (isDynastyFormat(format) ? item?.dynastyValue : item?.redraftValue) ?? value) : null,
    redraftValue: Number.isFinite(Number(item?.redraftValue)) ? Number(item.redraftValue) : null,
    dynastyValue: Number.isFinite(Number(item?.dynastyValue)) ? Number(item.dynastyValue) : null,
    valueField: isDynastyFormat(format) ? "dynastyValue" : "redraftValue",
    maxFantasyCalcValue,
    trend30Day: Number.isFinite(trend30Day) ? trend30Day : null,
    rosterPercent: Number.isFinite(rosterPercent) ? rosterPercent : null,
    age: Number.isFinite(age) && age > 0 ? age : null,
    scoring: format,
    rankingSource: "fantasycalc",
    sourceRanks: Number.isFinite(rank) && rank > 0 ? { Value: rank } : {},
    sources: []
  };
}

function fantasyCalcItemValue(item = {}, format = "ppr") {
  if (isDynastyFormat(format)) {
    return item?.dynastyValue ?? item?.value ?? item?.combinedValue ?? item?.redraftValue;
  }
  return item?.redraftValue ?? item?.value ?? item?.combinedValue ?? item?.dynastyValue;
}

async function loadPlayerAliases() {
  try {
    const payload = await fetch(chrome.runtime.getURL("src/data/player-aliases.json")).then((response) => response.json());
    const byName = new Map();
    for (const item of payload?.players ?? []) {
      const key = normalizeName(item.name);
      if (!key) {
        continue;
      }
      byName.set(key, (item.aliases ?? []).map((alias) => String(alias ?? "").trim()).filter(Boolean));
    }
    return {
      updatedAt: payload?.updatedAt ?? "",
      byName
    };
  } catch (error) {
    console.warn("Could not load player aliases", error);
    return { updatedAt: "", byName: new Map() };
  }
}

function getSelectedRankings() {
  const mode = state.settings?.rankingMode ?? "auto";
  const detectedFormat = getActiveDraftRankingFormat();
  if (mode === "custom") {
    return selectRankingsForFormat(detectedFormat, { allowLegacyFallback: true, preferCustom: true });
  }
  if (RANKING_FORMATS.includes(mode)) {
    return selectRankingsForFormat(mode, { allowLegacyFallback: false });
  }

  return selectRankingsForFormat(detectedFormat, { allowLegacyFallback: true });
}

function selectRankingsForFormat(format, { allowLegacyFallback, preferCustom = false } = {}) {
  const normalizedFormat = normalizeRankingFormat(format);
  const customRankings = getCustomRankingsForFormat(normalizedFormat);
  state.activeScoringFormat = normalizedFormat;
  let selected = null;
  let selectedSource = "none";
  if (preferCustom && customRankings) {
    selected = customRankings;
    selectedSource = "custom";
  }

  if (!selected) {
    const bundled = state.bundledRankings[normalizedFormat] ?? null;
    if (bundled) {
      selected = bundled;
      selectedSource = String(bundled.rankingSource ?? "").startsWith("fantasycalc") ? "fantasycalc" : "bundled";
    }
  }

  if (!selected && customRankings) {
    selected = customRankings;
    selectedSource = "custom";
  }

  if (!selected && allowLegacyFallback && state.rankings) {
    selected = state.rankings;
    selectedSource = "custom";
  }

  const withCustomRedraft = applyCustomRedraftRankings(selected, getActiveCustomRedraftRankings(normalizedFormat), {
    redraftRankingSource: state.settings?.redraftRankingSource ?? "custom",
    rankingAffectsPlayerValue: state.settings?.rankingAffectsPlayerValue === true
  });
  state.activeRankingsSource = withCustomRedraft?.customRankingApplied ? "custom-redraft" : selectedSource;
  return withCustomRedraft ?? null;
}

function getActiveCustomRedraftRankings(format) {
  const normalizedFormat = normalizeRankingFormat(format);
  return state.customRedraftRankingsByFormat?.[normalizedFormat] ?? state.customRedraftRankings ?? state.bundledCustomRedraftRankings;
}

function normalizeCustomRedraftRankingsByFormat(value = {}, fallbackBoard = null) {
  const output = {};
  for (const format of ["ppr", "half_ppr", "standard"]) {
    const board = value?.[format];
    if (Array.isArray(board?.players)) {
      output[format] = normalizeCustomRedraftBoard(board, format);
    }
  }
  if (!output.half_ppr && fallbackBoard) {
    output.half_ppr = normalizeCustomRedraftBoard(fallbackBoard, "half_ppr");
  }
  return output;
}

function getCustomRankingsForFormat(format) {
  const board = state.rankingsByFormat?.[format];
  if (Array.isArray(board?.players) && isFantasyCalcBoard(board)) {
    return board;
  }
  if (Array.isArray(state.rankings?.players) && getBoardFormat(state.rankings, format) === format && isFantasyCalcBoard(state.rankings)) {
    return state.rankings;
  }
  return null;
}

function isFantasyCalcBoard(board) {
  const source = String(board?.rankingSource ?? board?.sourceFile ?? board?.label ?? "").toLowerCase();
  return Array.isArray(board?.players) && source.includes("fantasycalc");
}

function getActiveDraftRankingFormat() {
  return normalizeRankingFormat(detectScoringFormat(state.draft, state.league));
}

function getBoardFormat(board, fallback = "ppr") {
  return normalizeRankingFormat(board?.scoring ?? fallback);
}

function normalizeRankingFormat(format) {
  const value = String(format ?? "").trim().toLowerCase();
  if (RANKING_FORMATS.includes(value)) return value;
  if (["dynasty_1qb", "1qb_dynasty", "one_qb_dynasty", "non_superflex_dynasty"].includes(value)) return "dynasty";
  if (["sf_dynasty", "dynasty_superflex", "super_flex_dynasty"].includes(value)) return "superflex_dynasty";
  if (["half", "0.5_ppr", "half-point-ppr", "half point ppr"].includes(value)) return "half_ppr";
  return value === "standard" ? "ppr" : "ppr";
}

function isDynastyFormat(format) {
  return normalizeRankingFormat(format) === "dynasty" || normalizeRankingFormat(format) === "superflex_dynasty";
}

function normalizeRankingsByFormat(value, legacyRankings) {
  const byFormat = {};
  for (const format of RANKING_FORMATS) {
    const board = value?.[format];
    if (Array.isArray(board?.players)) {
      byFormat[format] = board;
    }
  }

  if (Array.isArray(legacyRankings?.players)) {
    const format = getBoardFormat(legacyRankings, "ppr");
    byFormat[format] = byFormat[format] ?? legacyRankings;
  }

  return byFormat;
}

function detectScoringFormat(draft, league) {
  const metadataText = [
    draft?.metadata?.scoring_type,
    draft?.metadata?.draft_type,
    draft?.metadata?.league_type,
    draft?.metadata?.name,
    draft?.metadata?.description,
    league?.name,
    league?.settings?.type
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const hasSuperflex =
    Number(draft?.settings?.slots_super_flex ?? 0) > 0 ||
    /\bsuper[\s_-]*flex\b|\bsf\b|\b2qb\b|\b2[\s_-]*qb\b/.test(metadataText);
  const hasDynasty = /\bdynasty\b|\bkeeper\b/.test(metadataText) || Number(league?.settings?.type ?? 0) === 2;
  if (hasDynasty && hasSuperflex) {
    return "superflex_dynasty";
  }
  if (hasDynasty) {
    return "dynasty";
  }
  if (hasSuperflex) {
    return "superflex_dynasty";
  }

  const recScore = Number(
    league?.scoring_settings?.rec ??
      league?.scoring_settings?.reception ??
      draft?.scoring_settings?.rec ??
      draft?.settings?.rec
  );

  if (Number.isFinite(recScore)) {
    if (recScore > 0 && recScore < 0.75) {
      return "half_ppr";
    }
    if (recScore >= 0.75) {
      return "ppr";
    }
    return "standard";
  }

  if (/\bhalf[\s_-]*ppr\b|\b0\.5[\s_-]*ppr\b|\bhalf[\s_-]*point\b/.test(metadataText)) {
    return "half_ppr";
  }
  if (/\bppr\b|point per reception|full[\s_-]*ppr/.test(metadataText)) {
    return "ppr";
  }
  return "ppr";
}

function formatLeagueScoringLabel(format, draft, league) {
  const label = formatScoringLabel(format);
  return detectTightEndPremium(draft, league).isTep ? `${label} TEP` : label;
}

function detectTightEndPremium(draft, league) {
  const scoring = {
    ...(draft?.scoring_settings ?? {}),
    ...(league?.scoring_settings ?? {})
  };
  const metadataText = [
    draft?.metadata?.scoring_type,
    draft?.metadata?.draft_type,
    draft?.metadata?.league_type,
    draft?.metadata?.name,
    draft?.metadata?.description,
    league?.name
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const rec = Number(scoring.rec ?? scoring.reception ?? 0);
  const absoluteKeys = ["rec_te", "te_rec", "reception_te", "te_reception"];
  const bonusKeys = ["bonus_rec_te", "bonus_te_rec", "rec_bonus_te", "te_rec_bonus", "te_premium", "tep"];
  const absolutePremium = absoluteKeys
    .map((key) => Number(scoring[key]))
    .filter(Number.isFinite)
    .reduce((max, value) => Math.max(max, value - rec), 0);
  const bonusPremium = bonusKeys
    .map((key) => Number(scoring[key]))
    .filter(Number.isFinite)
    .reduce((max, value) => Math.max(max, value), 0);
  const premium = Math.max(absolutePremium, bonusPremium, /\btep\b|tight end premium|te premium/.test(metadataText) ? 0.5 : 0);
  return {
    isTep: premium > 0,
    premium
  };
}

function formatScoringLabel(format) {
  if (format === "superflex_dynasty") {
    return "Superflex Dynasty";
  }
  if (format === "dynasty") {
    return "Dynasty";
  }
  if (format === "half_ppr") {
    return "Half PPR";
  }
  if (format === "ppr") {
    return "PPR";
  }
  if (format === "standard") {
    return "Standard";
  }
  return "Scoring";
}
