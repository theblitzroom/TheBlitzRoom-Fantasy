const VALID_POSITIONS = new Set(["QB", "RB", "WR", "TE", "DEF"]);
const CUSTOM_RANKING_SOURCE = "theblitzroom-custom-redraft";

export function normalizeCustomRedraftBoard(board = {}, fallbackScoring = "half_ppr") {
  const players = Array.isArray(board?.players) ? board.players : Array.isArray(board) ? board : [];
  return {
    label: board?.label ?? board?.name ?? "TheBlitzRoom Custom Redraft Rankings",
    name: board?.name ?? board?.label ?? "TheBlitzRoom Custom Redraft Rankings",
    scoring: normalizeScoring(board?.scoring ?? fallbackScoring),
    rosterType: "redraft",
    rankingSource: CUSTOM_RANKING_SOURCE,
    sourceFile: board?.sourceFile ?? "src/data/custom-redraft-rankings.json",
    updatedAt: board?.updatedAt ?? "",
    players: players
      .map((row, index) => normalizeCustomRankingRow(row, index))
      .filter((row) => row.playerName && VALID_POSITIONS.has(row.position))
      .sort((left, right) => numberForSort(left.overallRank) - numberForSort(right.overallRank) || left.playerName.localeCompare(right.playerName))
  };
}

export function normalizeCustomRankingRow(row = {}, index = 0) {
  const position = normalizePosition(row.position);
  const overallRank = integerOrNull(row.overallRank ?? row.rank ?? row.redraftRank) ?? index + 1;
  const positionRank = integerOrNull(row.positionRank ?? row.redraftPositionRank ?? row.posRank);
  const tier = integerOrNull(row.tier ?? row.redraftTier ?? row.positionTier);
  const playerName = String(row.playerName ?? row.name ?? row.player ?? row.fullName ?? "").trim();
  const playerId = firstNonBlank(row.playerId, row.sleeperId, row.sleeper_id, row.id);
  return {
    playerId: playerId ? String(playerId) : "",
    playerName,
    name: playerName,
    position,
    overallRank,
    positionRank,
    tier,
    notes: String(row.notes ?? row.rankingNotes ?? "").trim()
  };
}

export function applyCustomRedraftRankings(providerBoard = null, customBoard = null, options = {}) {
  if (!providerBoard || !Array.isArray(providerBoard.players)) {
    return providerBoard;
  }
  const normalizedCustom = normalizeCustomRedraftBoard(customBoard, providerBoard.scoring);
  const useCustom = shouldUseCustomRedraftRankings(providerBoard, normalizedCustom, options);
  if (!useCustom) {
    return withSeparatedValueFields(providerBoard, options);
  }

  const index = buildCustomRankingIndex(normalizedCustom);
  const players = providerBoard.players.map((player, indexNumber) => {
    const match = findCustomMatch(player, index);
    return mergeCustomRankingIntoProviderPlayer(player, match?.row, {
      ...options,
      scoring: providerBoard.scoring,
      fallbackRank: indexNumber + 1,
      matchSource: match?.source ?? ""
    });
  });

  return {
    ...providerBoard,
    label: `${providerBoard.label ?? providerBoard.name ?? "Provider"} + TheBlitzRoom Custom Ranks`,
    rankingSource: providerBoard.rankingSource ?? "provider",
    customRankingSource: CUSTOM_RANKING_SOURCE,
    customRankingApplied: true,
    rankingAffectsPlayerValue: options.rankingAffectsPlayerValue === true,
    players: players.sort((left, right) => numberForSort(left.redraftRank ?? left.rank) - numberForSort(right.redraftRank ?? right.rank))
  };
}

export function withSeparatedValueFields(board = null, options = {}) {
  if (!board || !Array.isArray(board.players)) {
    return board;
  }
  return {
    ...board,
    rankingAffectsPlayerValue: options.rankingAffectsPlayerValue === true,
    players: board.players.map((player, index) => mergeCustomRankingIntoProviderPlayer(player, null, {
      ...options,
      scoring: board.scoring,
      fallbackRank: index + 1
    }))
  };
}

function shouldUseCustomRedraftRankings(providerBoard, customBoard, options = {}) {
  const source = options.redraftRankingSource ?? options.customRedraftRankingSource ?? "custom";
  const scoring = normalizeScoring(providerBoard?.scoring);
  return source === "custom" &&
    isRedraftScoring(scoring) &&
    Array.isArray(customBoard?.players) &&
    customBoard.players.length > 0;
}

function mergeCustomRankingIntoProviderPlayer(player = {}, custom = null, options = {}) {
  const baseRank = integerOrNull(player.baseRank ?? player.providerRank ?? player.rank ?? player.overallRank) ?? options.fallbackRank ?? 9999;
  const basePositionRank = integerOrNull(player.basePositionRank ?? player.providerPositionRank ?? player.positionRank ?? player.posRank);
  const baseTier = integerOrNull(player.baseTier ?? player.providerTier ?? player.positionTier ?? player.tier);
  const redraftRank = integerOrNull(custom?.overallRank) ?? baseRank;
  const redraftPositionRank = integerOrNull(custom?.positionRank) ?? basePositionRank;
  const redraftTier = integerOrNull(custom?.tier) ?? baseTier;
  const rankingAffectsValue = options.rankingAffectsPlayerValue === true;
  const valueFields = rankingAdjustmentFields({
    rankingAffectsValue,
    baseRank,
    basePositionRank,
    baseTier,
    redraftRank,
    redraftPositionRank,
    redraftTier
  });
  const position = normalizePosition(custom?.position ?? player.position);
  const scoring = normalizeScoring(options.scoring ?? player.scoring);
  const formatValue = formatSpecificValue(player, scoring);
  const baseValue = numberOrNull(player.baseValue ?? formatValue);
  const calculatedValue = numberOrNull(player.calculatedValue ?? formatValue);
  const tradeValue = numberOrNull(player.tradeValue ?? (isDynastyScoring(scoring) ? player.dynastyValue : player.redraftValue) ?? formatValue);

  return {
    ...player,
    playerId: String(player.playerId ?? player.sleeperId ?? custom?.playerId ?? ""),
    sleeperId: String(player.sleeperId ?? player.playerId ?? custom?.playerId ?? ""),
    name: String(player.name ?? player.player ?? player.fullName ?? custom?.playerName ?? "").trim(),
    player: String(player.player ?? player.name ?? player.fullName ?? custom?.playerName ?? "").trim(),
    fullName: String(player.fullName ?? player.name ?? player.player ?? custom?.playerName ?? "").trim(),
    position,
    rank: redraftRank,
    overallRank: redraftRank,
    redraftRank,
    displayRank: redraftRank,
    positionRank: redraftPositionRank,
    redraftPositionRank,
    posRank: redraftPositionRank ? `${position}${redraftPositionRank}` : (player.posRank ?? ""),
    positionTier: redraftTier,
    tier: redraftTier,
    redraftTier,
    rankingNotes: custom?.notes ?? player.rankingNotes ?? "",
    customRankApplied: Boolean(custom),
    customRankMatchSource: options.matchSource ?? "",
    providerRank: baseRank,
    providerOverallRank: baseRank,
    providerPositionRank: basePositionRank,
    providerTier: baseTier,
    baseValue,
    calculatedValue,
    tradeValue,
    ...valueFields
  };
}

export function rankingAdjustmentFields({
  rankingAffectsValue = false,
  baseRank,
  basePositionRank,
  baseTier,
  redraftRank,
  redraftPositionRank,
  redraftTier
} = {}) {
  return {
    valueRankSort: rankingAffectsValue ? redraftRank : baseRank,
    valueOverallRank: rankingAffectsValue ? redraftRank : baseRank,
    valuePositionRank: rankingAffectsValue ? redraftPositionRank : basePositionRank,
    valueTier: rankingAffectsValue ? redraftTier : baseTier
  };
}

export function buildCustomRankingReview(importedBoard = {}, providerBoard = {}, players = {}) {
  const normalized = normalizeCustomRedraftBoard(importedBoard, providerBoard?.scoring ?? "half_ppr");
  const providerIndex = buildProviderIndex(providerBoard, players);
  const seenIds = new Map();
  const seenRanks = new Map();
  const seenKeys = new Map();
  const matched = [];
  const fallbackMatched = [];
  const unmatched = [];
  const duplicates = [];
  const invalidRows = [];

  normalized.players.forEach((row, index) => {
    const rowNumber = index + 1;
    const errors = [];
    if (!row.playerName) errors.push("Missing player name");
    if (!VALID_POSITIONS.has(row.position)) errors.push("Invalid position");
    if (!row.overallRank) errors.push("Missing overall rank");
    if (row.playerId && seenIds.has(row.playerId)) {
      duplicates.push({ rowNumber, reason: "Duplicate player ID", playerName: row.playerName, playerId: row.playerId });
    }
    if (row.overallRank && seenRanks.has(row.overallRank)) {
      duplicates.push({ rowNumber, reason: "Duplicate overall rank", playerName: row.playerName, overallRank: row.overallRank });
    }
    const playerKey = `${normalizeName(row.playerName)}|${row.position}`;
    if (seenKeys.has(playerKey)) {
      duplicates.push({ rowNumber, reason: "Player included more than once", playerName: row.playerName, position: row.position });
    }
    seenIds.set(row.playerId, rowNumber);
    seenRanks.set(row.overallRank, rowNumber);
    seenKeys.set(playerKey, rowNumber);

    if (errors.length) {
      invalidRows.push({ rowNumber, playerName: row.playerName, errors });
      return;
    }

    const match = findProviderMatch(row, providerIndex);
    if (match?.source === "id") {
      matched.push({ row, provider: match.player, source: "id" });
    } else if (match?.source === "name") {
      fallbackMatched.push({ row, provider: match.player, source: "name" });
    } else {
      unmatched.push(row);
    }
  });

  const importedIds = new Set(normalized.players.map((row) => row.playerId).filter(Boolean));
  const importedNames = new Set(normalized.players.map((row) => `${normalizeName(row.playerName)}|${row.position}`));
  const providerPlayers = Array.isArray(providerBoard?.players) ? providerBoard.players : Object.entries(players ?? {}).map(([playerId, player]) => ({
    ...player,
    playerId,
    name: displayName(player),
    position: normalizePosition(player.position ?? player.fantasy_positions?.[0])
  }));
  const missingPlayers = providerPlayers
    .filter((player) => VALID_POSITIONS.has(normalizePosition(player.position)))
    .filter((player) => {
      const id = String(player.playerId ?? player.sleeperId ?? "");
      const key = `${normalizeName(player.name ?? player.player ?? player.fullName ?? displayName(player))}|${normalizePosition(player.position)}`;
      return !importedIds.has(id) && !importedNames.has(key);
    })
    .slice(0, 250)
    .map((player) => ({
      playerId: String(player.playerId ?? player.sleeperId ?? ""),
      playerName: player.name ?? player.player ?? player.fullName ?? displayName(player),
      position: normalizePosition(player.position)
    }));

  return {
    board: normalized,
    summary: {
      totalRows: normalized.players.length,
      matched: matched.length,
      fallbackMatched: fallbackMatched.length,
      unmatched: unmatched.length,
      duplicateRecords: duplicates.length,
      invalidRows: invalidRows.length,
      missingPlayers: missingPlayers.length,
      emptyRankings: normalized.players.length === 0
    },
    matched,
    fallbackMatched,
    unmatched,
    duplicateRecords: duplicates,
    invalidRows,
    missingPlayers,
    canImport: normalized.players.length > 0 && invalidRows.length === 0 && duplicates.length === 0
  };
}

export function parseCustomRankingJson(text) {
  const parsed = JSON.parse(text);
  return normalizeCustomRedraftBoard(parsed);
}

export function parseCustomRankingCsv(text) {
  const rows = parseCsv(text);
  if (!rows.length) {
    return normalizeCustomRedraftBoard({ players: [] });
  }
  const headers = rows[0].map((header) => normalizeHeader(header));
  const data = rows.slice(1).map((cells) => {
    const row = {};
    headers.forEach((header, index) => {
      row[header] = cells[index] ?? "";
    });
    return {
      playerId: firstNonBlank(row.playerid, row.sleeperid, row.id),
      playerName: firstNonBlank(row.playername, row.name, row.player, row.fullname),
      position: row.position,
      overallRank: firstNonBlank(row.overallrank, row.rank, row.redraftrank),
      positionRank: firstNonBlank(row.positionrank, row.posrank, row.redraftpositionrank),
      tier: firstNonBlank(row.tier, row.redrafttier, row.positiontier),
      notes: firstNonBlank(row.notes, row.note)
    };
  });
  return normalizeCustomRedraftBoard({ players: data });
}

export function customRankingsToCsv(board = {}) {
  const normalized = normalizeCustomRedraftBoard(board);
  const header = ["playerId", "playerName", "position", "overallRank", "positionRank", "tier", "notes"];
  const lines = [header.join(",")];
  for (const row of normalized.players) {
    lines.push([
      row.playerId,
      row.playerName,
      row.position,
      row.overallRank,
      row.positionRank ?? "",
      row.tier ?? "",
      row.notes ?? ""
    ].map(csvEscape).join(","));
  }
  return lines.join("\n");
}

function buildCustomRankingIndex(board = {}) {
  const byId = new Map();
  const byNamePosition = new Map();
  for (const row of board.players ?? []) {
    if (row.playerId) {
      byId.set(String(row.playerId), row);
    }
    const key = `${normalizeName(row.playerName)}|${row.position}`;
    if (!byNamePosition.has(key)) {
      byNamePosition.set(key, row);
    }
  }
  return { byId, byNamePosition };
}

function findCustomMatch(player = {}, index) {
  const ids = [player.playerId, player.sleeperId, player.sleeper_id].map((value) => String(value ?? "")).filter(Boolean);
  for (const id of ids) {
    const row = index.byId.get(id);
    if (row) {
      return { row, source: "id" };
    }
  }
  const name = normalizeName(player.name ?? player.player ?? player.fullName);
  const position = normalizePosition(player.position);
  const row = index.byNamePosition.get(`${name}|${position}`);
  return row ? { row, source: "name" } : null;
}

function buildProviderIndex(providerBoard = {}, players = {}) {
  const providerPlayers = Array.isArray(providerBoard?.players) ? providerBoard.players : [];
  const byId = new Map();
  const byNamePosition = new Map();
  for (const player of providerPlayers) {
    const id = String(player.playerId ?? player.sleeperId ?? "");
    const position = normalizePosition(player.position);
    const name = normalizeName(player.name ?? player.player ?? player.fullName);
    if (id) byId.set(id, player);
    if (name && position) byNamePosition.set(`${name}|${position}`, player);
  }
  for (const [playerId, player] of Object.entries(players ?? {})) {
    const position = normalizePosition(player.position ?? player.fantasy_positions?.[0]);
    const name = normalizeName(displayName(player));
    if (playerId) byId.set(String(playerId), { ...player, playerId, name: displayName(player), position });
    if (name && position && !byNamePosition.has(`${name}|${position}`)) {
      byNamePosition.set(`${name}|${position}`, { ...player, playerId, name: displayName(player), position });
    }
  }
  return { byId, byNamePosition };
}

function findProviderMatch(row, index) {
  if (row.playerId && index.byId.has(String(row.playerId))) {
    return { player: index.byId.get(String(row.playerId)), source: "id" };
  }
  const key = `${normalizeName(row.playerName)}|${row.position}`;
  if (index.byNamePosition.has(key)) {
    return { player: index.byNamePosition.get(key), source: "name" };
  }
  return null;
}

function parseCsv(text = "") {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => String(value).trim())) rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += char;
  }
  row.push(cell);
  if (row.some((value) => String(value).trim())) rows.push(row);
  return rows;
}

function normalizeHeader(value = "") {
  return String(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function csvEscape(value = "") {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function normalizeScoring(value = "half_ppr") {
  const text = String(value ?? "").toLowerCase().trim();
  if (text === "ppr" || text === "half_ppr" || text === "standard" || text === "dynasty" || text === "superflex_dynasty") return text;
  if (["sf_dynasty", "dynasty_superflex", "super_flex_dynasty"].includes(text)) return "superflex_dynasty";
  if (["dynasty_1qb", "1qb_dynasty", "one_qb_dynasty", "non_superflex_dynasty"].includes(text)) return "dynasty";
  return "half_ppr";
}

function isDynastyScoring(value = "") {
  return String(value).includes("dynasty");
}

function isRedraftScoring(value = "") {
  return ["ppr", "half_ppr", "standard"].includes(normalizeScoring(value));
}

function formatSpecificValue(player = {}, scoring = "half_ppr") {
  if (isDynastyScoring(scoring)) {
    return player.dynastyValue ?? player.fantasyCalcValue ?? player.value ?? player.combinedValue;
  }
  return player.redraftValue ?? player.fantasyCalcValue ?? player.value ?? player.combinedValue;
}

function normalizePosition(value = "") {
  const text = String(value ?? "").toUpperCase().trim();
  if (text === "DST" || text === "D/ST" || text === "DEFENSE") return "DEF";
  return VALID_POSITIONS.has(text) ? text : "";
}

function normalizeName(value = "") {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(jr|sr|ii|iii|iv|v)\b/g, "")
    .replace(/[.'’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, "");
}

function displayName(player = {}) {
  const firstLast = `${player.first_name ?? ""} ${player.last_name ?? ""}`.trim();
  return String(player.full_name ?? firstLast ?? player.name ?? "").trim();
}

function firstNonBlank(...values) {
  return values.find((value) => String(value ?? "").trim()) ?? "";
}

function integerOrNull(value) {
  const match = String(value ?? "").match(/\d+/);
  const number = match ? Number(match[0]) : Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : null;
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function numberForSort(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 999999;
}
