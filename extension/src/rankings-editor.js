import { buildBlitzValueProfile, formatBlitzDelta, formatBlitzValue } from "./lib/blitzValue.js";
import {
  buildCustomRankingReview,
  customRankingsToCsv,
  normalizeCustomRedraftBoard,
  parseCustomRankingCsv,
  parseCustomRankingJson
} from "./lib/customRankings.js";
import { getLocal, getSettings, saveSettings, setLocal } from "./lib/storage.js";
import { applyThemeMode, bindThemeModeControl, syncThemeModeControl, watchSystemTheme } from "./lib/theme.js";

const elements = {
  boardNameInput: document.querySelector("#boardNameInput"),
  scoringSelect: document.querySelector("#scoringSelect"),
  searchInput: document.querySelector("#searchInput"),
  autoSaveToggle: document.querySelector("#autoSaveToggle"),
  themeModeControl: document.querySelector("#themeModeControl"),
  statusMessage: document.querySelector("#statusMessage"),
  saveButton: document.querySelector("#saveButton"),
  loadPprButton: document.querySelector("#loadPprButton"),
  loadHalfButton: document.querySelector("#loadHalfButton"),
  loadSuperflexDynastyButton: document.querySelector("#loadSuperflexDynastyButton"),
  loadDynastyButton: document.querySelector("#loadDynastyButton"),
  addRowButton: document.querySelector("#addRowButton"),
  sortButton: document.querySelector("#sortButton"),
  exportButton: document.querySelector("#exportButton"),
  importButton: document.querySelector("#importButton"),
  importFile: document.querySelector("#importFile"),
  rankingSourceControl: document.querySelector("#rankingSourceControl"),
  useCustomRankingsButton: document.querySelector("#useCustomRankingsButton"),
  useProviderRankingsButton: document.querySelector("#useProviderRankingsButton"),
  rankingAffectsValueToggle: document.querySelector("#rankingAffectsValueToggle"),
  multiFormatTargets: document.querySelector("#multiFormatTargets"),
  uploadCsvButton: document.querySelector("#uploadCsvButton"),
  uploadJsonButton: document.querySelector("#uploadJsonButton"),
  resetCustomRankingsButton: document.querySelector("#resetCustomRankingsButton"),
  exportCsvButton: document.querySelector("#exportCsvButton"),
  exportJsonButton: document.querySelector("#exportJsonButton"),
  customImportFile: document.querySelector("#customImportFile"),
  importReviewPanel: document.querySelector("#importReviewPanel"),
  validationPanel: document.querySelector("#validationPanel"),
  positionTabs: document.querySelector("#editorPositionTabs"),
  rankingsBody: document.querySelector("#rankingsBody"),
  rowCount: document.querySelector("#rowCount")
};

const RANKING_FORMATS = ["ppr", "half_ppr", "superflex_dynasty", "dynasty"];
const FANTASYCALC_BOARD_FILES = {
  ppr: "src/data/rankings.fantasycalc.ppr.json",
  half_ppr: "src/data/rankings.fantasycalc.half_ppr.json",
  superflex_dynasty: "src/data/rankings.fantasycalc.superflex_dynasty.json",
  dynasty: "src/data/rankings.fantasycalc.dynasty.json"
};
const CUSTOM_REDRAFT_BOARD_FILE = "src/data/custom-redraft-rankings.json";
const POSITIONS = ["QB", "RB", "WR", "TE", "DEF"];
const REDRAFT_FORMATS = ["ppr", "half_ppr", "standard"];

const state = {
  board: null,
  providerBoard: null,
  bundledCustomBoard: null,
  rows: [],
  query: "",
  positionViews: ["ALL"],
  rankingSource: "custom",
  activeFormat: "half_ppr",
  targetFormats: ["half_ppr"],
  pendingImportReview: null,
  pendingImportFileType: "json",
  dragIndex: null,
  settings: null,
  dirty: false,
  saveTimer: null,
  isSaving: false,
  pendingSave: false,
  activeSavePromise: null,
  changeVersion: 0,
  lastSavedAt: null
};

init();

async function init() {
  bindEvents();
  state.settings = await getSettings();
  applyThemeMode(state.settings.themeMode);
  syncThemeModeControl(elements.themeModeControl, state.settings.themeMode);
  watchSystemTheme(() => state.settings?.themeMode, () => applyThemeMode(state.settings?.themeMode));

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes.settings?.newValue) {
      return;
    }
    state.settings = { ...state.settings, ...changes.settings.newValue };
    applyThemeMode(state.settings.themeMode);
    syncThemeModeControl(elements.themeModeControl, state.settings.themeMode);
  });

  const stored = await getLocal(["rankingsDoc", "rankingsByFormat", "lastEditedRankingFormat", "customRedraftRankings", "customRedraftRankingsByFormat"]);
  const initialFormat = getInitialFormat(stored, state.settings);
  state.rankingSource = state.settings.redraftRankingSource === "provider" ? "provider" : "custom";
  state.activeFormat = normalizeScoring(initialFormat);
  state.targetFormats = normalizeTargetFormats(state.settings.customRankingEditTargets, state.activeFormat);
  state.bundledCustomBoard = await loadBundledCustomBoard();
  state.providerBoard = getStoredFantasyCalcBoard(stored, initialFormat) ?? await loadBundledBoard(initialFormat);
  const customBoard = getStoredCustomBoardForFormat(stored, initialFormat);
  const board = buildEditorBoardForSource(state.providerBoard, customBoard);
  loadBoard(board, { dirty: false });
  syncCommandCenter();
  showStatus("Ready");
}

function bindEvents() {
  elements.boardNameInput.addEventListener("input", () => markDirty());
  elements.scoringSelect.addEventListener("change", () => {
    state.activeFormat = normalizeScoring(elements.scoringSelect.value);
    state.targetFormats = normalizeTargetFormats([state.activeFormat], state.activeFormat);
    syncTargetFormatControls();
    markDirty();
  });
  elements.searchInput.addEventListener("input", () => {
    state.query = elements.searchInput.value.trim().toLowerCase();
    renderTable();
  });
  bindThemeModeControl(elements.themeModeControl, async (themeMode) => {
    const currentSettings = state.settings ?? await getSettings();
    state.settings = { ...currentSettings, themeMode };
    await saveSettings(state.settings);
    showStatus("Appearance saved");
  });

  elements.saveButton.addEventListener("click", () => saveLiveRankings({ immediate: true }));
  elements.loadPprButton.addEventListener("click", () => loadEditableBoardForFormat("ppr", "PPR"));
  elements.loadHalfButton.addEventListener("click", () => loadEditableBoardForFormat("half_ppr", "half PPR"));
  elements.loadSuperflexDynastyButton.addEventListener("click", () => loadEditableBoardForFormat("superflex_dynasty", "Superflex Dynasty"));
  elements.loadDynastyButton.addEventListener("click", () => loadEditableBoardForFormat("dynasty", "Dynasty"));
  elements.addRowButton.addEventListener("click", addRow);
  elements.sortButton.addEventListener("click", sortRowsByRank);
  elements.exportButton.addEventListener("click", () => exportCurrentRankings("json"));
  elements.importButton.addEventListener("click", () => openCustomImport("json"));
  elements.useCustomRankingsButton.addEventListener("click", () => setRankingSource("custom"));
  elements.useProviderRankingsButton.addEventListener("click", () => setRankingSource("provider"));
  elements.rankingAffectsValueToggle.addEventListener("change", saveRankingSettingFlags);
  elements.multiFormatTargets.addEventListener("change", handleTargetFormatChange);
  elements.uploadCsvButton.addEventListener("click", () => openCustomImport("csv"));
  elements.uploadJsonButton.addEventListener("click", () => openCustomImport("json"));
  elements.customImportFile.addEventListener("change", importCustomRankings);
  elements.resetCustomRankingsButton.addEventListener("click", resetCustomRankings);
  elements.exportCsvButton.addEventListener("click", () => exportCurrentRankings("csv"));
  elements.exportJsonButton.addEventListener("click", () => exportCurrentRankings("json"));

  elements.rankingsBody.addEventListener("input", handleTableInput);
  elements.rankingsBody.addEventListener("change", handleTableInput);
  elements.rankingsBody.addEventListener("click", handleTableClick);
  elements.rankingsBody.addEventListener("dragstart", handleTableDragStart);
  elements.rankingsBody.addEventListener("dragover", handleTableDragOver);
  elements.rankingsBody.addEventListener("drop", handleTableDrop);
  elements.rankingsBody.addEventListener("dragend", handleTableDragEnd);
  elements.positionTabs.addEventListener("click", (event) => {
    const button = event.target.closest("[data-position-view]");
    if (!button) {
      return;
    }
    togglePositionView(button.dataset.positionView || "ALL");
    renderTable();
  });

  window.addEventListener("beforeunload", (event) => {
    if (!state.dirty) {
      return;
    }
    flushPendingSave();
    event.preventDefault();
    event.returnValue = "";
  });
  window.addEventListener("pagehide", flushPendingSave);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      flushPendingSave();
    }
  });
}

function syncCommandCenter() {
  const source = state.rankingSource === "provider" ? "provider" : "custom";
  for (const button of elements.rankingSourceControl.querySelectorAll("button")) {
    const active = button.dataset.rankingSource === source;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  }
  elements.rankingAffectsValueToggle.checked = state.settings?.rankingAffectsPlayerValue === true;
  syncTargetFormatControls();
}

function syncTargetFormatControls() {
  const activeFormat = normalizeScoring(state.activeFormat || elements.scoringSelect.value);
  const targetFormats = normalizeTargetFormats(state.targetFormats, activeFormat);
  for (const input of elements.multiFormatTargets.querySelectorAll("input[type='checkbox']")) {
    const format = normalizeScoring(input.value);
    input.checked = targetFormats.includes(format);
    input.disabled = state.rankingSource !== "custom" || !isRedraftFormat(activeFormat);
  }
}

function handleTargetFormatChange() {
  const activeFormat = normalizeScoring(state.activeFormat || elements.scoringSelect.value);
  state.targetFormats = normalizeTargetFormats(
    [...elements.multiFormatTargets.querySelectorAll("input[type='checkbox']:checked")].map((input) => input.value),
    activeFormat
  );
  syncTargetFormatControls();
  markDirty();
}

async function setRankingSource(source) {
  const nextSource = source === "provider" ? "provider" : "custom";
  if (nextSource === state.rankingSource) {
    return;
  }
  try {
    showStatus("Switching ranking source...");
    await saveCurrentBoardBeforeSwitch();
    state.rankingSource = nextSource;
    const stored = await getLocal(["customRedraftRankings", "customRedraftRankingsByFormat"]);
    const customBoard = getStoredCustomBoardForFormat(stored, getBoardFormat(state.providerBoard));
    const board = buildEditorBoardForSource(state.providerBoard, customBoard);
    loadBoard(board, { dirty: false });
    const settings = await getSettings();
    state.settings = {
      ...settings,
      redraftRankingSource: state.rankingSource,
      rankingAffectsPlayerValue: elements.rankingAffectsValueToggle.checked === true,
      customRankingEditTargets: getTargetRedraftFormats()
    };
    await saveSettings(state.settings);
    syncCommandCenter();
    showStatus(nextSource === "custom" ? "Using TheBlitzRoom custom rankings" : "Using default provider rankings");
  } catch (error) {
    showStatus(`Could not switch source: ${error.message || error}`);
  }
}

async function saveRankingSettingFlags() {
  const settings = await getSettings();
  state.settings = {
    ...settings,
    redraftRankingSource: state.rankingSource,
    rankingAffectsPlayerValue: elements.rankingAffectsValueToggle.checked === true,
    customRankingEditTargets: getTargetRedraftFormats()
  };
  await saveSettings(state.settings);
  showStatus(elements.rankingAffectsValueToggle.checked ? "Ranking-to-value switch saved" : "Rankings and values stay separated");
}

function openCustomImport(type = "json") {
  state.pendingImportFileType = type === "csv" ? "csv" : "json";
  elements.customImportFile.accept = state.pendingImportFileType === "csv"
    ? ".csv,text/csv"
    : ".json,application/json";
  elements.customImportFile.click();
}

async function importCustomRankings() {
  const file = elements.customImportFile.files?.[0];
  if (!file) {
    return;
  }
  try {
    const text = await file.text();
    const board = state.pendingImportFileType === "csv" || /\.csv$/i.test(file.name)
      ? parseCustomRankingCsv(text)
      : parseCustomRankingJson(text);
    const review = buildCustomRankingReview(board, state.providerBoard);
    state.pendingImportReview = review;
    renderImportReview(review, file.name);
    showStatus("Review imported rankings");
  } catch (error) {
    showStatus(`Could not review import: ${error.message || error}`);
  } finally {
    elements.customImportFile.value = "";
  }
}

function renderImportReview(review, fileName = "import") {
  elements.importReviewPanel.hidden = false;
  elements.importReviewPanel.replaceChildren();
  const stats = [
    ["Rows", review.summary.totalRows],
    ["ID matched", review.summary.matched],
    ["Name fallback", review.summary.fallbackMatched],
    ["Unmatched", review.summary.unmatched],
    ["Duplicates", review.summary.duplicateRecords],
    ["Invalid", review.summary.invalidRows],
    ["Missing DB players", review.summary.missingPlayers]
  ];
  const grid = document.createElement("div");
  grid.className = "review-grid";
  for (const [label, value] of stats) {
    const stat = document.createElement("div");
    stat.className = "review-stat";
    const labelEl = document.createElement("span");
    labelEl.textContent = label;
    const valueEl = document.createElement("strong");
    valueEl.textContent = String(value);
    stat.append(labelEl, valueEl);
    grid.append(stat);
  }

  const list = document.createElement("div");
  list.className = "review-list";
  const detailRows = [
    ...review.fallbackMatched.slice(0, 6).map((item) => `Fallback match: ${item.row.playerName} (${item.row.position})`),
    ...review.unmatched.slice(0, 6).map((item) => `Unmatched: ${item.playerName} (${item.position})`),
    ...review.duplicateRecords.slice(0, 6).map((item) => `${item.reason}: ${item.playerName || item.playerId || item.overallRank}`),
    ...review.invalidRows.slice(0, 6).map((item) => `Invalid row ${item.rowNumber}: ${item.errors.join(", ")}`),
    ...review.missingPlayers.slice(0, 6).map((item) => `Missing from import: ${item.playerName} (${item.position})`)
  ];
  list.textContent = detailRows.length
    ? detailRows.join("\n")
    : `${fileName} is clean. Matched players are ready to import.`;

  const actions = document.createElement("div");
  actions.className = "review-actions";
  const cancel = document.createElement("button");
  cancel.className = "secondary-button";
  cancel.type = "button";
  cancel.textContent = "Cancel";
  cancel.addEventListener("click", cancelPendingImport);
  const apply = document.createElement("button");
  apply.className = "primary-button";
  apply.type = "button";
  apply.textContent = review.canImport ? "Apply rankings" : "Fix import first";
  apply.disabled = !review.canImport;
  apply.addEventListener("click", applyPendingImport);
  actions.append(cancel, apply);
  elements.importReviewPanel.append(grid, list, actions);
}

async function applyPendingImport() {
  const review = state.pendingImportReview;
  if (!review?.canImport) {
    showStatus("Import has duplicate or invalid rows");
    return;
  }
  state.rankingSource = "custom";
  const board = buildEditorBoardForSource(state.providerBoard, review.board);
  loadBoard(board, { dirty: true });
  elements.importReviewPanel.hidden = true;
  elements.importReviewPanel.replaceChildren();
  state.pendingImportReview = null;
  syncCommandCenter();
  const saved = await saveLiveRankings({ immediate: true });
  showStatus(saved === false ? "Imported rankings, but save failed" : "Imported custom rankings");
}

function cancelPendingImport() {
  state.pendingImportReview = null;
  elements.importReviewPanel.hidden = true;
  elements.importReviewPanel.replaceChildren();
  showStatus("Import cancelled");
}

async function resetCustomRankings() {
  try {
    showStatus("Resetting custom rankings...");
    state.bundledCustomBoard = await loadBundledCustomBoard();
    state.rankingSource = "custom";
    const board = buildEditorBoardForSource(state.providerBoard, state.bundledCustomBoard);
    loadBoard(board, { dirty: true });
    syncCommandCenter();
    const saved = await saveLiveRankings({ immediate: true });
    showStatus(saved === false ? "Reset loaded, but save failed" : "Reset to bundled custom rankings");
  } catch (error) {
    showStatus(`Could not reset: ${error.message || error}`);
  }
}

function renderValidationPanel(review) {
  if (!review || (!review.summary.duplicateRecords && !review.summary.invalidRows && !review.summary.emptyRankings)) {
    elements.validationPanel.hidden = true;
    elements.validationPanel.replaceChildren();
    return;
  }
  elements.validationPanel.hidden = false;
  elements.validationPanel.textContent = [
    review.summary.emptyRankings ? "Rankings cannot be empty." : "",
    review.summary.duplicateRecords ? `${review.summary.duplicateRecords} duplicate ranking record(s).` : "",
    review.summary.invalidRows ? `${review.summary.invalidRows} invalid row(s).` : ""
  ].filter(Boolean).join(" ");
}

async function loadBundledBoard(format) {
  const normalizedFormat = normalizeScoring(format);
  const url = chrome.runtime.getURL(FANTASYCALC_BOARD_FILES[normalizedFormat] ?? FANTASYCALC_BOARD_FILES.ppr);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not load ${normalizedFormat} FantasyCalc rankings`);
  }
  return response.json();
}

async function loadBundledCustomBoard() {
  const response = await fetch(chrome.runtime.getURL(CUSTOM_REDRAFT_BOARD_FILE));
  if (!response.ok) {
    throw new Error("Could not load TheBlitzRoom custom redraft rankings");
  }
  return normalizeCustomRedraftBoard(await response.json());
}

async function loadProviderBoardForFormat(format, stored = {}) {
  const normalizedFormat = normalizeScoring(format);
  if (normalizeScoring(state.providerBoard?.scoring) === normalizedFormat) {
    return state.providerBoard;
  }
  return getStoredFantasyCalcBoard(stored, normalizedFormat) ?? await loadBundledBoard(normalizedFormat);
}

function buildEditorBoardForSource(providerBoard, customBoard = null) {
  const format = normalizeScoring(providerBoard?.scoring);
  if (state.rankingSource === "custom" && isRedraftFormat(format)) {
    return applyCustomEditorRanks(providerBoard, customBoard ?? state.bundledCustomBoard);
  }
  return withProviderEditorFields(providerBoard);
}

function applyCustomEditorRanks(providerBoard, customBoard) {
  const normalizedCustom = normalizeCustomRedraftBoard(customBoard, providerBoard?.scoring);
  const customById = new Map();
  const customByNamePosition = new Map();
  for (const row of normalizedCustom.players) {
    if (row.playerId) customById.set(String(row.playerId), row);
    customByNamePosition.set(`${normalizeName(row.playerName)}|${normalizePosition(row.position)}`, row);
  }
  return {
    ...(providerBoard ?? {}),
    label: normalizedCustom.label ?? "TheBlitzRoom Custom Redraft Rankings",
    name: normalizedCustom.name ?? "TheBlitzRoom Custom Redraft Rankings",
    scoring: normalizeScoring(providerBoard?.scoring ?? normalizedCustom.scoring),
    rankingSource: providerBoard?.rankingSource ?? "fantasycalc",
    customRankingApplied: true,
    players: (providerBoard?.players ?? []).map((player, index) => {
      const id = String(player.playerId ?? player.sleeperId ?? "");
      const key = `${normalizeName(player.name ?? player.player ?? player.fullName)}|${normalizePosition(player.position)}`;
      const custom = (id && customById.get(id)) || customByNamePosition.get(key);
      return separateEditorValueFields(player, custom, index);
    }).sort((left, right) => numberForSort(left.redraftRank ?? left.rank) - numberForSort(right.redraftRank ?? right.rank))
  };
}

function withProviderEditorFields(providerBoard) {
  return {
    ...(providerBoard ?? {}),
    customRankingApplied: false,
    players: (providerBoard?.players ?? []).map((player, index) => separateEditorValueFields(player, null, index))
  };
}

function separateEditorValueFields(player = {}, custom = null, index = 0) {
  const providerRank = integerOrDefault(player.providerRank ?? player.rank ?? player.overallRank, index + 1);
  const providerPositionRank = parsePositionRank(player.providerPositionRank ?? player.positionRank ?? player.posRank);
  const providerTier = numberOrBlank(player.providerTier ?? player.positionTier ?? player.tier);
  const redraftRank = integerOrDefault(custom?.overallRank ?? player.redraftRank ?? providerRank, providerRank);
  const redraftPositionRank = integerOrBlank(custom?.positionRank ?? player.redraftPositionRank ?? providerPositionRank);
  const redraftTier = numberOrBlank(custom?.tier ?? player.redraftTier ?? providerTier);
  const baseValue = numberOrBlank(player.baseValue ?? player.fantasyCalcValue ?? player.value ?? player.redraftValue ?? player.combinedValue);
  const calculatedValue = numberOrBlank(player.calculatedValue ?? player.fantasyCalcValue ?? player.value ?? player.redraftValue ?? player.combinedValue);
  const tradeValue = numberOrBlank(player.tradeValue ?? player.dynastyValue ?? player.fantasyCalcValue ?? player.value ?? player.redraftValue);
  return {
    ...player,
    rank: redraftRank,
    overallRank: redraftRank,
    redraftRank,
    displayRank: redraftRank,
    positionRank: redraftPositionRank,
    redraftPositionRank,
    positionTier: redraftTier,
    tier: redraftTier,
    redraftTier,
    rankingNotes: custom?.notes ?? player.rankingNotes ?? player.notes ?? "",
    providerRank,
    providerOverallRank: providerRank,
    providerPositionRank,
    providerTier,
    valueRankSort: providerRank,
    valueOverallRank: providerRank,
    valuePositionRank: providerPositionRank,
    valueTier: providerTier,
    baseValue,
    calculatedValue,
    tradeValue
  };
}

async function loadEditableBoardForFormat(format, label) {
  try {
    showStatus("Saving current board...");
    await saveCurrentBoardBeforeSwitch();

    const stored = await getLocal(["rankingsDoc", "rankingsByFormat", "customRedraftRankings", "customRedraftRankingsByFormat"]);
    const savedBoard = getStoredFantasyCalcBoard(stored, format);
    state.providerBoard = savedBoard ?? await loadBundledBoard(format);
    state.activeFormat = normalizeScoring(format);
    state.targetFormats = normalizeTargetFormats([state.activeFormat], state.activeFormat);
    const customBoard = getStoredCustomBoardForFormat(stored, format);
    const board = buildEditorBoardForSource(state.providerBoard, customBoard);

    loadBoard(board, { dirty: false });
    await setLocal({ rankingsDoc: board, lastEditedRankingFormat: format });
    syncCommandCenter();
    showStatus(savedBoard ? `Loaded saved ${label} board` : `Loaded ${label} board`);
  } catch (error) {
    showStatus(`Could not load ${label}: ${error.message || error}`);
  }
}

function loadBoard(board, options = {}) {
  if (!Array.isArray(board?.players)) {
    showStatus("That rankings file needs a players list");
    return;
  }

  state.board = board;
  state.activeFormat = normalizeScoring(board.scoring);
  state.rows = board.players.map(normalizeRow).filter((row) => row.position !== "K");
  applyAutoPositionTiers(state.rows, normalizeScoring(board.scoring));
  state.dirty = Boolean(options.dirty);
  if (state.dirty) {
    state.changeVersion += 1;
  }
  elements.boardNameInput.value = board.label ?? board.name ?? "My custom board";
  elements.scoringSelect.value = state.activeFormat;
  state.targetFormats = normalizeTargetFormats(state.targetFormats, state.activeFormat);
  syncTargetFormatControls();
  renderTable();
  if (state.dirty) {
    scheduleAutoSave();
  }
}

function normalizeRow(player, index) {
  const rank = integerOrDefault(player.redraftRank ?? player.displayRank ?? player.rank ?? player.overallRank ?? player.averageRank, index + 1);
  const rawPosition = String(player.position ?? "").toUpperCase().trim();
  const positionRank = integerOrBlank(player.redraftPositionRank ?? player.positionRank ?? player.positionalRank ?? parsePositionRank(player.posRank));
  const positionTier = numberOrBlank(player.redraftTier ?? player.positionTier ?? player.posTier ?? player.positionalTier);
  return {
    ...player,
    playerId: player.playerId ?? player.player_id ?? player.sleeperId ?? player.sleeper_id ?? "",
    name: String(player.name ?? player.player ?? player.fullName ?? ""),
    team: normalizeTeam(playerTeamValue(player)),
    position: rawPosition === "K" ? "K" : normalizePosition(player.position),
    rank,
    positionRank,
    redraftPositionRank: positionRank,
    positionTier,
    redraftTier: positionTier,
    providerRank: integerOrBlank(player.providerRank ?? player.valueRankSort ?? player.rank ?? player.overallRank),
    valueRankSort: integerOrBlank(player.valueRankSort ?? player.providerRank ?? player.rank ?? player.overallRank),
    providerPositionRank: integerOrBlank(player.providerPositionRank ?? player.valuePositionRank ?? player.positionRank ?? parsePositionRank(player.posRank)),
    valuePositionRank: integerOrBlank(player.valuePositionRank ?? player.providerPositionRank ?? player.positionRank ?? parsePositionRank(player.posRank)),
    baseValue: numberOrBlank(player.baseValue ?? player.fantasyCalcValue ?? player.value ?? player.redraftValue ?? player.combinedValue),
    calculatedValue: numberOrBlank(player.calculatedValue ?? player.fantasyCalcValue ?? player.value ?? player.redraftValue ?? player.combinedValue),
    tradeValue: numberOrBlank(player.tradeValue ?? player.dynastyValue ?? player.fantasyCalcValue ?? player.value ?? player.redraftValue),
    posRank: positionRank ? `${normalizePosition(player.position)}${positionRank}` : (player.posRank ?? ""),
    averageRank: numberOrBlank(player.averageRank ?? player.avgRank ?? player.adp ?? rank),
    notes: String(player.rankingNotes ?? player.notes ?? "")
  };
}

function renderTable() {
  const rows = getVisibleRows();
  elements.rowCount.textContent = `${rows.length}/${state.rows.length} players`;
  renderPositionTabs();
  elements.rankingsBody.replaceChildren();

  if (!rows.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.className = "empty-row";
    td.colSpan = 10;
    td.textContent = "No players match that search.";
    tr.append(td);
    elements.rankingsBody.append(tr);
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const { row, index } of rows) {
    const tr = document.createElement("tr");
    tr.dataset.index = String(index);
    tr.draggable = true;
    appendCell(tr, makeDragHandle(index));
    appendCell(tr, makeRankControl(row.rank, index));
    appendCell(tr, makeBlitzValueCell(row));
    appendCell(tr, makeInput("positionRank", row.positionRank, index, { type: "number", step: "1", min: "1", inputmode: "numeric" }));
    appendCell(tr, makeInput("positionTier", row.positionTier, index, { type: "number", step: "1" }));
    appendCell(tr, makeInput("name", row.name, index));
    appendCell(tr, makePositionSelect(row.position, index));
    appendCell(tr, makeInput("team", row.team, index));
    appendCell(tr, makeTextarea("notes", row.notes, index));
    appendCell(tr, makeRemoveButton(index));
    fragment.append(tr);
  }
  elements.rankingsBody.append(fragment);
}

function makeBlitzValueCell(row) {
  const valueRank = integerOrBlank(row.valueRankSort ?? row.valueOverallRank ?? row.providerRank ?? row.rank);
  const valuePositionRank = integerOrBlank(row.valuePositionRank ?? row.providerPositionRank ?? row.positionRank);
  const profile = buildBlitzValueProfile({
    ranking: row,
    position: row.position,
    boardRank: valueRank,
    positionRank: valuePositionRank,
    marketRank: row.averageRank,
    fantasyCalcValue: row.calculatedValue ?? row.baseValue,
    draftContext: {
      isDynasty: state.board?.scoring === "superflex_dynasty" || state.board?.scoring === "dynasty",
      isSuperflex: state.board?.scoring === "superflex_dynasty"
    }
  });
  const wrap = document.createElement("div");
  wrap.className = `bv-cell value-${String(profile.trend?.status ?? "stable").toLowerCase()}`;
  const value = document.createElement("strong");
  value.textContent = formatBlitzValue(profile.overall, { compact: true, suffix: false });
  const trend = document.createElement("span");
  trend.textContent = profile.trend?.label ?? formatBlitzDelta(0, { suffix: false });
  wrap.title = [
    `Blitz Value: ${formatBlitzValue(profile.overall, { suffix: false })}`,
    `Rating: ${profile.rating}/99`,
    `Formula: Projection ${profile.components.production}, Market ${profile.components.market}, News ${profile.components.news}, Opportunity ${profile.components.opportunity}, Schedule ${profile.components.schedule}, AI ${profile.components.aiConfidence}`,
    ...(profile.reasons ?? []).map((reason) => `${reason.delta > 0 ? "+" : ""}${Math.round(reason.delta)} BV ${reason.label}`)
  ].join("\n");
  wrap.append(value, trend);
  return wrap;
}

function applyAutoPositionTiers(rows, scoring = "ppr") {
  for (const position of POSITIONS) {
    const group = rows
      .filter((row) => row.position === position)
      .sort((left, right) => numberForSort(left.rank) - numberForSort(right.rank) || String(left.name).localeCompare(String(right.name)));
    group.forEach((row, index) => {
      if (numberOrBlank(row.positionTier) !== "") {
        return;
      }
      const positionRank = integerOrBlank(row.positionRank) || parsePositionRank(row.posRank) || index + 1;
      row.positionTier = autoPositionTier(position, positionRank, scoring);
    });
  }
}

function autoPositionTier(position, positionRank, scoring = "ppr") {
  const rank = Math.max(1, Math.round(Number(positionRank) || 999));
  const breaks = positionTierBreaks(position, scoring);
  let tier = 1;
  for (const cutoff of breaks) {
    if (rank > cutoff) {
      tier += 1;
    } else {
      break;
    }
  }
  return tier;
}

function positionTierBreaks(position, scoring = "ppr") {
  const isDynasty = scoring === "superflex_dynasty" || scoring === "dynasty";
  const isSuperflex = scoring === "superflex_dynasty";
  if (position === "QB") {
    return isSuperflex ? [3, 8, 14, 22, 32, 44, 58] : [2, 5, 9, 14, 20, 28, 40];
  }
  if (position === "RB") {
    return isDynasty ? [4, 10, 18, 30, 44, 60, 82] : [4, 10, 18, 28, 40, 55, 75];
  }
  if (position === "WR") {
    return isDynasty ? [6, 15, 28, 44, 62, 84, 112] : [6, 14, 26, 42, 60, 82, 110];
  }
  if (position === "TE") {
    return isDynasty ? [2, 5, 10, 18, 28, 42, 60] : [1, 3, 7, 12, 20, 32, 48];
  }
  if (position === "DEF") {
    return [3, 8, 14, 22, 32];
  }
  return [5, 12, 24, 40, 60, 90];
}

function parsePositionRank(value) {
  const match = String(value ?? "").match(/\d+/);
  return match ? Number(match[0]) : null;
}

function getVisibleRows() {
  return state.rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => {
      if (!state.positionViews.includes("ALL") && !state.positionViews.includes(row.position)) {
        return false;
      }
      if (!state.query) {
        return true;
      }
      const haystack = `${row.name} ${row.team} ${row.position} ${row.notes}`.toLowerCase();
      return haystack.includes(state.query);
    });
}

function renderPositionTabs() {
  const positions = ["ALL", ...POSITIONS];
  const counts = new Map(positions.map((position) => [position, 0]));
  for (const row of state.rows) {
    counts.set("ALL", (counts.get("ALL") ?? 0) + 1);
    if (POSITIONS.includes(row.position)) {
      counts.set(row.position, (counts.get(row.position) ?? 0) + 1);
    }
  }

  elements.positionTabs.replaceChildren();
  for (const position of positions) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.positionView = position;
    button.className = "position-tab-button";
    button.classList.toggle("is-active", state.positionViews.includes(position));
    button.setAttribute("aria-pressed", String(state.positionViews.includes(position)));
    button.textContent = `${position === "ALL" ? "Overall" : position} ${counts.get(position) ?? 0}`;
    elements.positionTabs.append(button);
  }
}

function togglePositionView(position) {
  if (position === "ALL") {
    state.positionViews = ["ALL"];
    return;
  }

  const next = new Set(state.positionViews.filter((item) => item !== "ALL"));
  if (next.has(position)) {
    next.delete(position);
  } else if (POSITIONS.includes(position)) {
    next.add(position);
  }
  state.positionViews = next.size ? [...next] : ["ALL"];
}

function appendCell(tr, child) {
  const td = document.createElement("td");
  td.append(child);
  tr.append(td);
}

function makeDragHandle(index) {
  const button = document.createElement("button");
  button.className = "drag-handle";
  button.type = "button";
  button.dataset.index = String(index);
  button.title = "Drag to reorder";
  button.setAttribute("aria-label", "Drag to reorder");
  button.textContent = "::";
  return button;
}

function makeRankControl(value, index) {
  const wrap = document.createElement("div");
  wrap.className = "rank-control";

  const minus = document.createElement("button");
  minus.className = "rank-step-button";
  minus.type = "button";
  minus.dataset.index = String(index);
  minus.dataset.step = "-1";
  minus.title = "Move up one rank";
  minus.setAttribute("aria-label", "Move up one rank");
  minus.textContent = "-";

  const input = makeInput("rank", integerOrDefault(value, index + 1), index, {
    type: "number",
    step: "1",
    min: "1",
    inputmode: "numeric"
  });
  input.className = "rank-input";

  const plus = document.createElement("button");
  plus.className = "rank-step-button";
  plus.type = "button";
  plus.dataset.index = String(index);
  plus.dataset.step = "1";
  plus.title = "Move down one rank";
  plus.setAttribute("aria-label", "Move down one rank");
  plus.textContent = "+";

  wrap.append(minus, input, plus);
  return wrap;
}

function makeInput(field, value, index, options = {}) {
  const input = document.createElement("input");
  input.dataset.index = String(index);
  input.dataset.field = field;
  input.type = options.type ?? "text";
  input.step = options.step ?? "any";
  if (options.min) {
    input.min = options.min;
  }
  if (options.inputmode) {
    input.inputMode = options.inputmode;
  }
  input.value = value ?? "";
  return input;
}

function makeTextarea(field, value, index) {
  const textarea = document.createElement("textarea");
  textarea.dataset.index = String(index);
  textarea.dataset.field = field;
  textarea.value = value ?? "";
  return textarea;
}

function makePositionSelect(value, index) {
  const select = document.createElement("select");
  select.dataset.index = String(index);
  select.dataset.field = "position";
  for (const position of POSITIONS) {
    const option = document.createElement("option");
    option.value = position;
    option.textContent = position;
    option.selected = position === normalizePosition(value);
    select.append(option);
  }
  return select;
}

function makeRemoveButton(index) {
  const button = document.createElement("button");
  button.className = "danger-button remove-row-button";
  button.type = "button";
  button.dataset.index = String(index);
  button.textContent = "Remove";
  return button;
}

function handleTableInput(event) {
  const target = event.target;
  if (!target?.dataset?.field) {
    return;
  }
  const index = Number(target.dataset.index);
  const field = target.dataset.field;
  if (!state.rows[index]) {
    return;
  }

  if (field === "rank") {
    const nextRank = integerOrDefault(target.value, state.rows[index].rank || index + 1);
    state.rows[index].rank = nextRank;
    target.value = String(nextRank);
    if (event.type === "change") {
      moveRowToRank(index, nextRank);
      renderTable();
    }
    markDirty();
    return;
  }

  state.rows[index][field] = coerceFieldValue(field, target.value);
  if (field === "positionRank") {
    state.rows[index].redraftPositionRank = state.rows[index].positionRank;
    state.rows[index].posRank = state.rows[index].positionRank ? `${state.rows[index].position}${state.rows[index].positionRank}` : "";
  }
  if (field === "positionTier") {
    state.rows[index].redraftTier = state.rows[index].positionTier;
  }
  markDirty();
}

function handleTableClick(event) {
  const rankButton = event.target.closest(".rank-step-button");
  if (rankButton) {
    const index = Number(rankButton.dataset.index);
    const step = Number(rankButton.dataset.step);
    moveRowByStep(index, step);
    markDirty();
    renderTable();
    return;
  }

  const button = event.target.closest(".remove-row-button");
  if (!button) {
    return;
  }
  const index = Number(button.dataset.index);
  if (!state.rows[index]) {
    return;
  }
  state.rows.splice(index, 1);
  renumberRows();
  markDirty();
  renderTable();
}

function handleTableDragStart(event) {
  const row = event.target.closest("tr[data-index]");
  if (!row) {
    return;
  }
  state.dragIndex = Number(row.dataset.index);
  row.classList.add("is-dragging");
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", String(state.dragIndex));
}

function handleTableDragOver(event) {
  if (state.dragIndex === null) {
    return;
  }
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
}

function handleTableDrop(event) {
  const row = event.target.closest("tr[data-index]");
  if (!row || state.dragIndex === null) {
    return;
  }
  event.preventDefault();
  const fromIndex = state.dragIndex;
  const toIndex = Number(row.dataset.index);
  state.dragIndex = null;
  moveRowToAbsoluteIndex(fromIndex, toIndex);
  markDirty();
  renderTable();
}

function handleTableDragEnd() {
  state.dragIndex = null;
  for (const row of elements.rankingsBody.querySelectorAll(".is-dragging")) {
    row.classList.remove("is-dragging");
  }
}

function addRow() {
  const nextRank = Math.max(0, ...state.rows.map((row) => integerOrDefault(row.rank, 0))) + 1;
  state.rows.push({
    playerId: "",
    name: "",
    team: "",
    position: "RB",
    rank: nextRank,
    positionRank: "",
    positionTier: "",
    averageRank: "",
    notes: "",
    sources: []
  });
  state.query = "";
  state.positionViews = ["ALL"];
  elements.searchInput.value = "";
  markDirty();
  renderTable();
}

function sortRowsByRank() {
  sortRowsSilently();
  markDirty();
  renderTable();
}

function moveRowByStep(index, step) {
  const row = state.rows[index];
  if (!row) {
    return;
  }
  sortRowsSilently();
  const currentIndex = state.rows.indexOf(row);
  const nextIndex = clamp(currentIndex + step, 0, state.rows.length - 1);
  if (currentIndex === nextIndex) {
    renumberRows();
    return;
  }
  state.rows.splice(currentIndex, 1);
  state.rows.splice(nextIndex, 0, row);
  renumberRows();
}

function moveRowToRank(index, rank) {
  const row = state.rows[index];
  if (!row) {
    return;
  }
  sortRowsSilently();
  const currentIndex = state.rows.indexOf(row);
  const nextIndex = clamp(integerOrDefault(rank, currentIndex + 1) - 1, 0, state.rows.length - 1);
  state.rows.splice(currentIndex, 1);
  state.rows.splice(nextIndex, 0, row);
  renumberRows();
}

function moveRowToAbsoluteIndex(fromIndex, toIndex) {
  if (!state.rows[fromIndex] || !state.rows[toIndex] || fromIndex === toIndex) {
    return;
  }
  const [row] = state.rows.splice(fromIndex, 1);
  const insertIndex = fromIndex < toIndex ? toIndex - 1 : toIndex;
  state.rows.splice(clamp(insertIndex, 0, state.rows.length), 0, row);
  renumberRows();
}

function sortRowsSilently() {
  state.rows.sort((left, right) => {
    const rankDiff = numberForSort(left.rank) - numberForSort(right.rank);
    if (rankDiff !== 0) {
      return rankDiff;
    }
    return String(left.name).localeCompare(String(right.name));
  });
  renumberRows();
}

function renumberRows() {
  state.rows.forEach((row, index) => {
    row.rank = index + 1;
  });
}

function markDirty() {
  state.dirty = true;
  state.changeVersion += 1;
  showStatus(elements.autoSaveToggle.checked ? "Saving..." : "Unsaved changes");
  scheduleAutoSave();
}

function scheduleAutoSave() {
  if (!elements.autoSaveToggle.checked) {
    return;
  }
  clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(() => saveLiveRankings(), 700);
}

async function saveCurrentBoardBeforeSwitch() {
  clearTimeout(state.saveTimer);
  if (state.activeSavePromise) {
    const activeSaved = await state.activeSavePromise;
    if (activeSaved === false) {
      throw new Error("current board did not save");
    }
  }
  if (state.dirty) {
    const saved = await saveLiveRankings({ immediate: true });
    if (saved === false) {
      throw new Error("current board did not save");
    }
  }
  if (state.activeSavePromise) {
    const finalSaved = await state.activeSavePromise;
    if (finalSaved === false) {
      throw new Error("current board did not save");
    }
  }
}

async function saveLiveRankings(options = {}) {
  if (state.isSaving) {
    state.pendingSave = true;
    return state.activeSavePromise;
  }
  if (options.immediate) {
    clearTimeout(state.saveTimer);
  }

  const savePromise = doSaveLiveRankings();
  state.activeSavePromise = savePromise;
  try {
    return await savePromise;
  } finally {
    if (state.activeSavePromise === savePromise) {
      state.activeSavePromise = null;
    }
  }
}

async function doSaveLiveRankings() {
  state.isSaving = true;
  const savingVersion = state.changeVersion;
  showStatus("Saving...");
  try {
    const isCustomRedraft = isCustomRedraftMode();
    const targetFormats = isCustomRedraft ? getTargetRedraftFormats() : [];
    const customBoards = new Map(targetFormats.map((format) => [format, buildCustomRedraftBoard(format)]));
    const activeFormat = normalizeScoring(elements.scoringSelect.value);
    const activeCustomBoard = customBoards.get(activeFormat) ?? [...customBoards.values()][0] ?? null;
    if (activeCustomBoard) {
      const review = buildCustomRankingReview(activeCustomBoard, state.providerBoard);
      renderValidationPanel(review);
      if (!review.canImport) {
        showStatus("Fix duplicate or invalid ranking rows before saving");
        return false;
      }
    } else {
      renderValidationPanel(null);
    }
    const stored = await getLocal(["rankingsByFormat", "customRedraftRankingsByFormat"]);
    let board = null;
    const nextByFormat = { ...(stored.rankingsByFormat ?? {}) };

    if (customBoards.size) {
      const nextCustomByFormat = { ...(stored.customRedraftRankingsByFormat ?? {}) };
      for (const [format, customBoard] of customBoards) {
        const providerBoard = await loadProviderBoardForFormat(format, stored);
        const editorBoard = buildEditorBoardForSource(providerBoard, customBoard);
        nextCustomByFormat[format] = customBoard;
        nextByFormat[format] = editorBoard;
        if (format === activeFormat || !board) {
          board = editorBoard;
        }
      }
      const legacyBoard = customBoards.get(activeFormat) ?? [...customBoards.values()][0];
      const storagePayload = {
        rankingsDoc: board,
        rankingsByFormat: nextByFormat,
        customRedraftRankingsByFormat: nextCustomByFormat,
        customRedraftRankings: legacyBoard,
        lastEditedRankingFormat: getBoardFormat(board)
      };
      await setLocal(storagePayload);
    } else {
      board = buildBoard();
      nextByFormat[getBoardFormat(board)] = board;
      await setLocal({
        rankingsDoc: board,
        rankingsByFormat: nextByFormat,
        lastEditedRankingFormat: getBoardFormat(board)
      });
    }
    const format = getBoardFormat(board);
    const settings = await getSettings();
    state.settings = {
      ...settings,
      rankingMode: "custom",
      redraftRankingSource: state.rankingSource,
      rankingAffectsPlayerValue: elements.rankingAffectsValueToggle.checked === true,
      customRankingEditTargets: targetFormats.length ? targetFormats : state.targetFormats
    };
    await saveSettings(state.settings);
    state.board = board;
    state.rows = board.players.map(normalizeRow).filter((row) => row.position !== "K");
    if (state.changeVersion === savingVersion) {
      state.dirty = false;
    }
    state.lastSavedAt = new Date();
    showStatus(targetFormats.length > 1 ? `Saved live to ${targetFormats.map(formatScoringLabel).join(" + ")}` : "Saved live");
    return true;
  } catch (error) {
    showStatus(`Could not save: ${error.message || error}`);
    return false;
  } finally {
    state.isSaving = false;
    if (state.pendingSave || (state.dirty && elements.autoSaveToggle.checked)) {
      state.pendingSave = false;
      scheduleAutoSave();
    }
  }
}

function flushPendingSave() {
  if (!state.dirty || !elements.autoSaveToggle.checked) {
    return;
  }
  saveLiveRankings({ immediate: true }).catch((error) => {
    console.warn("Could not flush rankings before closing", error);
  });
}

function buildBoard() {
  const updatedAt = new Date().toISOString().slice(0, 10);
  return {
    ...(state.board ?? {}),
    label: elements.boardNameInput.value.trim() || "My custom board",
    scoring: elements.scoringSelect.value,
    updatedAt,
    sourceFile: "Rankings Editor",
    rankingSource: state.board?.rankingSource?.startsWith("fantasycalc") ? state.board.rankingSource : "fantasycalc-editor",
    players: state.rows.map((row, index) => ({
      ...row,
      name: String(row.name ?? "").trim(),
      team: normalizeTeam(row.team),
      position: normalizePosition(row.position),
      rank: integerOrDefault(row.rank, index + 1),
      positionRank: integerOrBlank(row.positionRank),
      redraftRank: integerOrDefault(row.rank, index + 1),
      redraftPositionRank: integerOrBlank(row.positionRank),
      redraftTier: numberOrBlank(row.positionTier),
      providerRank: integerOrBlank(row.providerRank),
      valueRankSort: integerOrBlank(row.valueRankSort ?? row.providerRank),
      baseValue: numberOrBlank(row.baseValue),
      calculatedValue: numberOrBlank(row.calculatedValue),
      tradeValue: numberOrBlank(row.tradeValue),
      positionTier: numberOrBlank(row.positionTier),
      averageRank: numberOrBlank(row.averageRank),
      notes: String(row.notes ?? "").trim()
    })).filter((row) => row.position !== "K")
  };
}

function buildCustomRedraftBoard(scoring = elements.scoringSelect.value) {
  const normalizedScoring = normalizeScoring(scoring);
  const updatedAt = new Date().toISOString().slice(0, 10);
  return normalizeCustomRedraftBoard({
    label: elements.boardNameInput.value.trim() || "TheBlitzRoom Custom Redraft Rankings",
    name: elements.boardNameInput.value.trim() || "TheBlitzRoom Custom Redraft Rankings",
    scoring: normalizedScoring,
    sourceFile: CUSTOM_REDRAFT_BOARD_FILE,
    updatedAt,
    players: state.rows.map((row, index) => ({
      playerId: String(row.playerId ?? row.sleeperId ?? "").trim(),
      playerName: String(row.name ?? row.player ?? row.fullName ?? "").trim(),
      position: normalizePosition(row.position),
      overallRank: integerOrDefault(row.rank, index + 1),
      positionRank: integerOrBlank(row.positionRank),
      tier: numberOrBlank(row.positionTier),
      notes: String(row.notes ?? row.rankingNotes ?? "").trim()
    })).filter((row) => row.playerName && row.position !== "K")
  }, normalizedScoring);
}

function exportCurrentRankings(format = "json") {
  const board = isCustomRedraftMode() ? buildCustomRedraftBoard() : buildBoard();
  const payload = format === "csv" ? customRankingsToCsv(board) : JSON.stringify(board, null, 2);
  const type = format === "csv" ? "text/csv" : "application/json";
  const blob = new Blob([payload], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${slugify(board.label)}.${format}`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showStatus(`Exported ${format.toUpperCase()}`);
}

async function importBoard() {
  const file = elements.importFile.files?.[0];
  if (!file) {
    return;
  }

  try {
    showStatus("Saving current board...");
    await saveCurrentBoardBeforeSwitch();
    const board = JSON.parse(await file.text());
    loadBoard(board, { dirty: true });
    const saved = await saveLiveRankings({ immediate: true });
    showStatus(saved === false ? "Imported board, but save failed" : "Imported and saved board");
  } catch (error) {
    showStatus(`Could not import: ${error.message || error}`);
  } finally {
    elements.importFile.value = "";
  }
}

function showStatus(message) {
  elements.statusMessage.textContent = message;
}

function normalizeScoring(value) {
  if (value === "half_ppr" || value === "superflex_dynasty" || value === "dynasty" || value === "standard") {
    return value;
  }
  return "ppr";
}

function getInitialFormat(stored, settings) {
  const lastEditedFormat = getStoredRankingFormat(stored?.lastEditedRankingFormat);
  if (lastEditedFormat && getStoredFantasyCalcBoard(stored, lastEditedFormat)) {
    return lastEditedFormat;
  }
  const latestFormat = Array.isArray(stored?.rankingsDoc?.players) ? getBoardFormat(stored.rankingsDoc) : "";
  if (latestFormat && getStoredFantasyCalcBoard(stored, latestFormat)) {
    return latestFormat;
  }
  if (RANKING_FORMATS.includes(settings?.rankingMode)) {
    return settings.rankingMode;
  }
  const legacyFormat = getBoardFormat(stored?.rankingsDoc);
  if (getStoredFantasyCalcBoard(stored, legacyFormat)) {
    return legacyFormat;
  }
  return "ppr";
}

function getStoredRankingFormat(value) {
  const format = String(value ?? "").trim();
  return RANKING_FORMATS.includes(format) ? format : "";
}

function getLegacyBoardForFormat(board, format) {
  if (!Array.isArray(board?.players)) {
    return null;
  }
  return getBoardFormat(board) === format && isFantasyCalcBoard(board) ? board : null;
}

function getStoredFantasyCalcBoard(stored, format) {
  const normalizedFormat = getStoredRankingFormat(format);
  if (!normalizedFormat) {
    return null;
  }
  const board = stored?.rankingsByFormat?.[normalizedFormat];
  if (Array.isArray(board?.players) && isFantasyCalcBoard(board)) {
    return board;
  }
  return getLegacyBoardForFormat(stored?.rankingsDoc, normalizedFormat);
}

function getStoredCustomBoardForFormat(stored = {}, format = "half_ppr") {
  const normalizedFormat = normalizeScoring(format);
  const byFormat = stored?.customRedraftRankingsByFormat ?? {};
  const board = byFormat[normalizedFormat] ?? byFormat[format];
  return normalizeCustomRedraftBoard(board ?? stored?.customRedraftRankings ?? state.bundledCustomBoard, normalizedFormat);
}

function isFantasyCalcBoard(board) {
  const source = String(board?.rankingSource ?? board?.sourceFile ?? board?.label ?? "").toLowerCase();
  return Array.isArray(board?.players) && source.includes("fantasycalc");
}

function getBoardFormat(board) {
  const scoring = normalizeScoring(board?.scoring);
  return RANKING_FORMATS.includes(scoring) ? scoring : "ppr";
}

function isRedraftFormat(format) {
  const scoring = normalizeScoring(format);
  return scoring === "ppr" || scoring === "half_ppr" || scoring === "standard";
}

function isCustomRedraftMode() {
  return state.rankingSource === "custom" && isRedraftFormat(getBoardFormat(state.board));
}

function normalizeTargetFormats(value, activeFormat = "half_ppr") {
  const active = normalizeScoring(activeFormat);
  if (!isRedraftFormat(active)) {
    return [];
  }
  const values = Array.isArray(value) ? value : [value];
  const targets = values
    .map((format) => normalizeScoring(format))
    .filter((format) => REDRAFT_FORMATS.includes(format));
  if (!targets.includes(active)) {
    targets.unshift(active);
  }
  return [...new Set(targets)];
}

function getTargetRedraftFormats() {
  const active = normalizeScoring(state.activeFormat || elements.scoringSelect.value);
  return normalizeTargetFormats(
    [...elements.multiFormatTargets.querySelectorAll("input[type='checkbox']:checked")].map((input) => input.value),
    active
  );
}

function formatScoringLabel(format) {
  const scoring = normalizeScoring(format);
  if (scoring === "half_ppr") return "Half PPR";
  if (scoring === "ppr") return "PPR";
  if (scoring === "standard") return "Standard";
  if (scoring === "superflex_dynasty") return "SF Dynasty";
  if (scoring === "dynasty") return "Dynasty";
  return scoring;
}

function normalizePosition(value) {
  const normalized = String(value ?? "").toUpperCase();
  if (normalized === "DST" || normalized === "D/ST") {
    return "DEF";
  }
  return POSITIONS.includes(normalized) ? normalized : "RB";
}

function playerTeamValue(player = {}) {
  return [
    player.team,
    player.Team,
    player.tm,
    player.Tm,
    player.nflTeam,
    player.NFLTeam,
    player.playerTeam,
    player.proTeam,
    player.teamAbbr,
    player.team_abbr,
    player.metadata?.team,
    player.metadata?.team_abbr
  ].find((value) => String(value ?? "").trim());
}

function normalizeTeam(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}

function normalizeName(value = "") {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(jr|sr|ii|iii|iv|v)\b/g, "")
    .replace(/[.'\u2019]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, "");
}

function coerceFieldValue(field, value) {
  if (field === "rank") {
    return integerOrDefault(value, 1);
  }
  if (field === "positionRank") {
    return integerOrBlank(value);
  }
  if (field === "positionTier" || field === "averageRank") {
    return numberOrBlank(value);
  }
  if (field === "team") {
    return normalizeTeam(value);
  }
  if (field === "position") {
    return normalizePosition(value);
  }
  return String(value ?? "");
}

function numberOrBlank(value) {
  if (value === "" || value === null || value === undefined) {
    return "";
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : "";
}

function integerOrBlank(value) {
  if (value === "" || value === null || value === undefined) {
    return "";
  }
  const match = String(value).match(/\d+/);
  const number = match ? Number(match[0]) : Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : "";
}

function integerOrDefault(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return Math.max(1, Math.round(Number(fallback) || 1));
  }
  return Math.max(1, Math.round(number));
}

function numberForSort(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 9999;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function slugify(value) {
  return String(value ?? "rankings")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "rankings";
}
