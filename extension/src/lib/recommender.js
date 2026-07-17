import { buildBlitzValueProfile, formatBlitzValue } from "./blitzValue.js";

const CORE_POSITIONS = new Set(["QB", "RB", "WR", "TE", "DEF"]);
const FLEX_POSITIONS = new Set(["RB", "WR", "TE"]);
const REC_FLEX_POSITIONS = new Set(["WR", "TE"]);
const INVALID_DRAFT_TEAMS = new Set(["FA", "NULL", "NONE", "N/A", "NA", "TBD", "UND", "UNKNOWN", "UNSIGNED", "RETIRED", "0"]);

export function generateRecommendations({
  draft,
  picks = [],
  players = {},
  rankings = null,
  evidence = null,
  trends = {},
  seasonStats = {},
  statsSeason = null,
  scoringSettings = {},
  rosterId,
  limit = 12,
  extraDraftedNames = []
}) {
  const currentPick = picks.length + 1;
  const draftedIds = new Set(picks.map((pick) => String(pick.player_id)).filter(Boolean));
  const draftedKeys = buildDraftedKeys(picks, players);
  for (const name of extraDraftedNames) {
    const key = nameOnlyKey(name);
    if (key) {
      draftedKeys.add(key);
    }
  }
  const rankingEntries = hydrateRankings(rankings, players);
  const evidenceIndex = indexEvidence(evidence, players);
  const trendIndex = indexTrends(trends);
  const slots = getSlotTargets(draft?.settings ?? {});
  const draftContext = buildDraftContext(draft, rankings, scoringSettings);
  const roster = summarizeRoster(picks, players, rosterId, draft);
  const available = buildAvailablePlayers({
    players,
    rankingEntries,
    draftedIds,
    draftedKeys
  });

  applyPositionTierFallbacks(available, draftContext);
  const byPosition = groupByPosition(available);
  const teamContexts = buildTeamContexts(players);
  const draftSimulation = buildDraftSimulation({
    draft,
    picks,
    players,
    available,
    roster,
    slots,
    currentPick,
    draftContext
  });
  const scored = available.map((candidate) =>
    scoreCandidate({
      candidate,
      currentPick,
      draft,
      players,
      roster,
      slots,
      evidenceItems: evidenceIndex.get(candidate.playerId) ?? [],
      trend: trendIndex.get(candidate.playerId) ?? {},
      byPosition,
      available,
      teamContext: teamContexts.get(normalizeTeam(candidate.team)) ?? null,
      seasonStats,
      statsSeason,
      scoringSettings,
      draftContext,
      draftSimulation
    })
  );

  scored.sort((a, b) =>
    b.totalScore - a.totalScore ||
    (b.blitzValue?.overall ?? 0) - (a.blitzValue?.overall ?? 0) ||
    (a.adviceRank ?? a.rankSort) - (b.adviceRank ?? b.rankSort) ||
    a.rankSort - b.rankSort
  );
  const availableBoard = [...scored].sort((a, b) => a.rankSort - b.rankSort || b.totalScore - a.totalScore);
  const candidates = filterRedraftDepthSuggestions(scored, roster, slots, draftContext, currentPick, limit);

  return {
    candidates,
    availableBoard,
    roster,
    slots,
    availableCount: available.length,
    currentPick
  };
}

function filterRedraftDepthSuggestions(scored = [], roster = {}, slots = {}, draftContext = {}, currentPick = 1, limit = 12) {
  const round = draftRound(currentPick, slots);
  const counts = roster?.counts ?? emptyCounts();
  const isRedraft = draftContext?.isDynasty !== true;
  const isSingleQb = draftContext?.isSuperflex !== true && (slots.SUPER_FLEX ?? 0) <= 0;
  const shouldHoldExtraQb = isRedraft && isSingleQb && (counts.QB ?? 0) >= 2 && round < 15;
  const shouldHoldExtraTe = isRedraft && (counts.TE ?? 0) >= 2 && round < 15;

  if (!shouldHoldExtraQb && !shouldHoldExtraTe) {
    return scored.slice(0, limit);
  }

  const filtered = scored.filter((candidate) => {
    if (shouldHoldExtraQb && candidate.position === "QB") {
      return false;
    }
    if (shouldHoldExtraTe && candidate.position === "TE") {
      return false;
    }
    return true;
  });

  if (filtered.length >= Math.min(limit, 3)) {
    return filtered.slice(0, limit);
  }

  const seen = new Set(filtered.map((candidate) => candidate.playerId));
  const fallback = scored.filter((candidate) => !seen.has(candidate.playerId));
  return [...filtered, ...fallback].slice(0, limit);
}

export function summarizeRoster(picks = [], players = {}, rosterId, draft = null) {
  const counts = emptyCounts();
  const rosterPicks = picks.filter((pick) => teamKeyForPick(pick, draft) === String(rosterId));
  for (const pick of rosterPicks) {
    const player = players[String(pick.player_id)] ?? {};
    const position = normalizePosition(pick.metadata?.position ?? player.position ?? player.fantasy_positions?.[0]);
    if (position && counts[position] !== undefined) {
      counts[position] += 1;
    }
  }

  return {
    rosterId: rosterId ? String(rosterId) : "",
    picks: rosterPicks,
    counts
  };
}

export function getSlotTargets(settings = {}) {
  return {
    QB: numberSetting(settings.slots_qb),
    RB: numberSetting(settings.slots_rb),
    WR: numberSetting(settings.slots_wr),
    TE: numberSetting(settings.slots_te),
    DEF: numberSetting(settings.slots_def),
    FLEX: numberSetting(settings.slots_flex) + numberSetting(settings.slots_wr_rb_flex),
    REC_FLEX: numberSetting(settings.slots_rec_flex),
    SUPER_FLEX: numberSetting(settings.slots_super_flex),
    BN: numberSetting(settings.slots_bn),
    teams: numberSetting(settings.teams),
    rounds: numberSetting(settings.rounds)
  };
}

export function formatRosterNeeds(roster, slots) {
  const counts = roster?.counts ?? emptyCounts();
  return ["QB", "RB", "WR", "TE", "FLEX", "DEF"].map((position) => {
    if (position === "FLEX") {
      const flexEligible = counts.RB + counts.WR + counts.TE;
      const target = slots.RB + slots.WR + slots.TE + slots.FLEX + slots.REC_FLEX;
      return { position, value: flexEligible, target };
    }

    return {
      position,
      value: counts[position] ?? 0,
      target: slots[position] ?? 0
    };
  });
}

function scoreCandidate({
  candidate,
  currentPick,
  draft,
  players,
  roster,
  slots,
  evidenceItems,
  trend,
  byPosition,
  available,
  teamContext,
  seasonStats,
  statsSeason,
  scoringSettings,
  draftContext,
  draftSimulation
}) {
  const production = buildProductionSnapshot(candidate, seasonStats, statsSeason, scoringSettings);
  const rank = candidate.rankSort;
  const valueRank = asNumber(candidate.platformRank ?? candidate.ranking?.adp ?? candidate.ranking?.averageRank ?? candidate.ranking?.avgRank);
  const valueRankLabel = candidate.platformRank ? (candidate.platformRankLabel ?? "room ADP") : candidate.ranking?.valueRankLabel ?? (candidate.ranking?.adp ? "ADP" : "value rank");
  const adviceRank = adviceRankForCandidate(candidate, valueRank, draftContext);
  const bpaScore = clamp(126 - adviceRank * 1.05, 0, 126);
  const valueScore = valueRank ? clamp((currentPick - valueRank) * 1.85, -34, 32) : 0;
  const need = scoreNeed(candidate.position, roster.counts, slots, currentPick, roster.picks.length, draftContext);
  const tierPressure = analyzePositionTierPressure(candidate, byPosition, currentPick, draft, roster);
  const scarcity = scoreScarcity(candidate, byPosition, tierPressure, draftContext, currentPick, valueRank);
  const market = scoreMarket(trend);
  const evidenceScore = scoreEvidence(evidenceItems);
  const ageValue = scoreAgeValue(candidate, draftContext);
  const risk = scoreRisk(candidate.player);
  const earlySpecialTeamsPenalty = scoreSpecialTeamsTiming(candidate.position, draft?.settings ?? {}, currentPick);
  const simulation = draftSimulation?.players?.get(candidate.playerId) ?? null;
  const formatBuild = scoreFormatBuild(candidate, roster.counts, slots, currentPick, roster.picks.length, draftContext, draft?.settings ?? {}, valueRank, simulation);
  const byeWeek = analyzeByeWeek(candidate, roster, players);
  const stacking = analyzeStacking(candidate, roster, players);
  const sleeperValue = analyzeSleeperValue(candidate, currentPick, valueRank);
  const construction = analyzeRosterConstruction(candidate, roster.counts, slots, currentPick, draftContext);
  const balance = analyzeTeamBalance(candidate, roster, players, slots, currentPick, draftContext, valueRank, simulation, tierPressure);
  const simulationScore = scoreDraftSimulation(simulation, tierPressure);
  const byeScore = scoreByeWeek(byeWeek);
  const stackScore = scoreStacking(stacking);
  const blitzValue = buildBlitzValueProfile({
    candidate,
    ranking: candidate.valueRanking ?? candidate.ranking,
    production,
    trend,
    evidenceItems,
    draftContext,
    boardRank: candidate.valueRankSort ?? candidate.rankSort,
    positionRank: candidate.valuePositionRank ?? candidate.positionRank,
    marketRank: valueRank,
    currentPick,
    position: candidate.position
  });
  const playerRating = blitzValue.rating ?? buildPlayerRating(candidate);
  const siteAdpScore = scoreSiteAdpDiscipline(candidate, currentPick, valueRank, draftContext, simulation, tierPressure);
  const valueBreakdown = buildValueScore({
    bpaScore,
    valueScore,
    need,
    scarcity,
    market,
    evidenceScore,
    ageValue,
    formatBuild,
    draftContext,
    risk,
    earlySpecialTeamsPenalty,
    simulationScore,
    byeScore,
    stackScore,
    constructionScore: construction.score,
    balanceScore: balance.score,
    scoreCap: balance.scoreCap,
    playerRating,
    blitzValue,
    siteAdpScore,
    rosterPickCount: roster.picks.length
  });
  const valueMeter = buildValueMeter(candidate, trend, evidenceItems, production, draftContext, playerRating, blitzValue);
  const riskMeter = buildBustRiskMeter(candidate, production, draftContext, teamContext, risk, evidenceItems);
  const adjustedRank = buildAdjustedRank(candidate.rankSort, valueMeter, riskMeter);
  const skipPlan = buildSkipPlan(candidate, available, draftSimulation, playerRating);
  const confidence = buildPickConfidence({
    candidate,
    totalScore: valueBreakdown.totalScore,
    components: valueBreakdown.components,
    draftSim: simulation,
    tierPressure,
    riskMeter,
    valueMeter,
    sleeperValue,
    construction
  });
  const aiRecommendation = buildAiRecommendation({
    candidate,
    playerRating,
    production,
    byPosition,
    draftSim: simulation,
    tierPressure,
    skipPlan,
    draftContext,
    components: valueBreakdown.components,
    currentPick,
    valueRank
  });

  return {
    ...candidate,
    totalScore: valueBreakdown.totalScore,
    pickGrade: valueBreakdown.totalScore,
    playerRating,
    blitzValue,
    components: valueBreakdown.components,
    production,
    playerContext: summarizePlayerContext(candidate, teamContext, production),
    valueMeter,
    riskMeter,
    adjustedRank,
    byeWeek,
    stacking,
    sleeperValue,
    construction,
    balance,
    draftSim: publicDraftSimulation(simulation),
    skipPlan,
    confidence,
    aiRecommendation,
    positionRank: candidate.positionRank ?? null,
    positionTier: candidate.tier ?? null,
    positionTierSource: candidate.positionTierSource ?? null,
    marketRank: valueRank ?? null,
    marketRankLabel: valueRank ? valueRankLabel : null,
    platformRank: candidate.platformRank ?? null,
    platformRankLabel: candidate.platformRankLabel ?? null,
    fantasyCalcValue: asNumber(candidate.ranking?.fantasyCalcValue ?? candidate.ranking?.value) ?? null,
    adviceRank,
    tierPressure,
    reasons: buildReasons({
      candidate,
      playerRating,
      totalScore: valueBreakdown.totalScore,
      components: valueBreakdown.components,
      currentPick,
      valueRank,
      valueRankLabel,
      need,
      scarcity,
      tierPressure,
      market,
      evidenceItems,
      trend,
      risk,
      earlySpecialTeamsPenalty,
      slots,
      roster,
      byPosition,
      available,
      teamContext,
      production,
      draftContext,
      byeWeek,
      stacking,
      sleeperValue,
      construction,
      balance,
      draftSim: simulation,
      aiRecommendation,
      blitzValue
    }),
    sources: buildSources(candidate, evidenceItems, trend)
  };
}

function buildPlayerRating(candidate) {
  const valueRanking = candidate.valueRanking ?? candidate.ranking;
  const blitzValue = buildBlitzValueProfile({
    candidate,
    ranking: valueRanking,
    boardRank: candidate.valueRankSort ?? candidate.rankSort,
    positionRank: candidate.valuePositionRank ?? candidate.positionRank
  });
  if (Number.isFinite(Number(blitzValue?.rating))) {
    return blitzValue.rating;
  }

  const value = asNumber(valueRanking?.calculatedValue ?? valueRanking?.fantasyCalcValue ?? valueRanking?.value ?? valueRanking?.redraftValue ?? valueRanking?.combinedValue);
  const maxValue = asNumber(valueRanking?.maxFantasyCalcValue);
  if (value && maxValue) {
    const valuePercent = clamp(value / maxValue, 0, 1);
    return Math.round(clamp(Math.pow(valuePercent, 0.72) * 99, 0, 99));
  }

  const rank = asNumber(candidate.valueRankSort ?? valueRanking?.rank ?? valueRanking?.overallRank ?? candidate.rankSort) ?? 999;
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
  return Math.round(clamp(interpolateRankCurve(rank, curve), 0, 99));
}

function adviceRankForCandidate(candidate, valueRank, draftContext = {}) {
  const boardRank = asNumber(candidate.rankSort) ?? asNumber(candidate.ranking?.rank ?? candidate.ranking?.overallRank) ?? 999;
  const marketRank = asNumber(valueRank ?? candidate.ranking?.averageRank ?? candidate.ranking?.avgRank ?? candidate.ranking?.adp);
  if (!marketRank) {
    return boardRank;
  }

  const marketWeight = marketWeightForAdvice(candidate.position, boardRank, marketRank, draftContext);
  return boardRank * (1 - marketWeight) + marketRank * marketWeight;
}

function marketWeightForAdvice(position, boardRank, marketRank, draftContext = {}) {
  const boardToMarketGap = marketRank - boardRank;
  let marketWeight = draftContext?.isDynasty ? 0.64 : 0.45;

  if (position === "QB") {
    marketWeight = draftContext?.isDynasty ? 0.68 : 0.52;
    if (boardToMarketGap >= 12) marketWeight += 0.12;
    if (boardToMarketGap >= 24) marketWeight += 0.08;
    if (boardToMarketGap >= 36) marketWeight += 0.06;
  } else if (boardToMarketGap >= 18) {
    marketWeight += 0.08;
  } else if (boardToMarketGap <= -18) {
    marketWeight -= 0.05;
  }

  if (position === "TE" && draftContext?.isTep) {
    marketWeight -= 0.04;
  }

  return clamp(marketWeight, 0.35, 0.92);
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

function buildValueScore({
  bpaScore,
  valueScore,
  need,
  scarcity,
  market,
  evidenceScore,
  ageValue,
  formatBuild,
  draftContext,
  risk,
  earlySpecialTeamsPenalty,
  simulationScore = 0,
  byeScore = 0,
  stackScore = 0,
  constructionScore = 0,
  balanceScore = 0,
  scoreCap = 100,
  playerRating = null,
  blitzValue = null,
  siteAdpScore = 0,
  rosterPickCount = 0
}) {
  const liveSignal = market + evidenceScore;
  const riskPenalty = risk + earlySpecialTeamsPenalty;
  const isDynasty = draftContext?.isDynasty === true;
  const isSuperflexDynasty = isDynasty && draftContext?.isSuperflex === true;
  const boardMax = isDynasty ? 74 : 82;
  const ageMax = isSuperflexDynasty ? 10 : isDynasty ? 8 : 0;
  const ageMin = isDynasty ? -10 : 0;
  const tierMax = 6;
  const fitMax = rosterPickCount >= 8 ? 6 : rosterPickCount >= 5 ? 4 : 2;
  const board = clamp(Math.round((bpaScore + valueScore + 42) / 200 * boardMax), 0, boardMax);
  const age = clamp(Math.round(ageValue), ageMin, ageMax);
  const fit = clamp(Math.round(Math.max(0, need) / 72 * fitMax), 0, fitMax);
  const tier = clamp(Math.round(scarcity / 32 * tierMax), 0, tierMax);
  const news = clamp(Math.round(3 + liveSignal * 0.5), -5, 5);
  const safety = clamp(Math.round(3 - riskPenalty / 44 * 3), 0, 3);
  const format = clamp(Math.round(formatBuild), -26, 26);
  const sim = clamp(Math.round(simulationScore), -3, 8);
  const bye = clamp(Math.round(byeScore), -3, 1);
  const stack = clamp(Math.round(stackScore), 0, 3);
  const construction = clamp(Math.round(constructionScore), -8, 10);
  const balance = clamp(Math.round(balanceScore), -24, 18);
  const normalizedRating = Number.isFinite(Number(playerRating)) ? Number(playerRating) : null;
  const playerValue = normalizedRating === null ? 0 : clamp(Math.round((normalizedRating - 72) / 3.4), -7, 8);
  const siteAdp = clamp(Math.round(siteAdpScore), -24, isSuperflexDynasty ? 6 : 4);
  const rawScore = board + playerValue + siteAdp + age + fit + tier + news + safety + format + sim + bye + stack + construction + balance;
  const totalScore = clamp(Math.min(rawScore, Number.isFinite(Number(scoreCap)) ? Number(scoreCap) : 100), 1, 100);

  return {
    totalScore,
    components: {
      board,
      boardMax,
      age,
      ageMax,
      ageMin,
      fit,
      fitMax,
      tier,
      tierMax,
      news,
      safety,
      format,
      sim,
      simMax: 8,
      bye,
      stack,
      construction,
      balance,
      scoreCap,
      playerValue,
      playerRating: normalizedRating,
      blitzValue: blitzValue?.overall ?? null,
      blitzRating: blitzValue?.rating ?? normalizedRating,
      blitzComponents: blitzValue?.components ?? null,
      blitzTrend: blitzValue?.trend ?? null,
      siteAdp,
      bpa: board,
      need: fit,
      scarcity: tier,
      market: news,
      risk: Math.max(0, 3 - safety)
    }
  };
}

function buildValueMeter(candidate, trend = {}, evidenceItems = [], production = {}, draftContext = {}, totalScore = 50, blitzValue = null) {
  if (blitzValue?.overall) {
    return {
      currentValue: blitzValue.overall,
      currentScore: blitzValue.rating,
      movement: clamp(Math.round((blitzValue.trend?.delta ?? 0) / 90), -7, 7),
      delta: blitzValue.trend?.delta ?? 0,
      deltaLabel: blitzValue.trend?.label ?? "",
      status: blitzValue.trend?.status ?? "Stable",
      floor: blitzValue.floor ?? null,
      ceiling: blitzValue.ceiling ?? null,
      volatility: blitzValue.volatility ?? null,
      confidence: blitzValue.confidence ?? null,
      championshipImpact: blitzValue.championshipImpact ?? null,
      redraftValue: blitzValue.redraftValue ?? null,
      dynastyValue: blitzValue.dynastyValue ?? null,
      components: blitzValue.components ?? null,
      reasons: (blitzValue.reasons ?? [])
        .map((reason) => `${reason.delta > 0 ? "+" : ""}${Math.round(reason.delta)} BV ${reason.label}`)
        .slice(0, 4)
    };
  }

  const reasons = [];
  let movement = 0;
  const age = asNumber(candidate.player?.age);
  const isDynasty = draftContext?.isDynasty === true;

  if (trend?.adds && trend?.maxAdds) {
    const addShare = trend.adds / Math.max(1, trend.maxAdds);
    if (addShare >= 0.32) {
      movement += 2;
      reasons.push("recent market movement is positive");
    } else if (addShare >= 0.14) {
      movement += 1;
    }
  }
  if (trend?.drops && trend?.maxDrops) {
    const dropShare = trend.drops / Math.max(1, trend.maxDrops);
    if (dropShare >= 0.32) {
      movement -= 2;
      reasons.push("recent market movement is negative");
    } else if (dropShare >= 0.14) {
      movement -= 1;
    }
  }

  const evidenceScore = scoreEvidence(evidenceItems);
  if (evidenceScore >= 8) {
    movement += 2;
    reasons.push("loaded news/context is pushing value up");
  } else if (evidenceScore >= 3) {
    movement += 1;
  } else if (evidenceScore <= -8) {
    movement -= 2;
    reasons.push("loaded news/context is pushing value down");
  } else if (evidenceScore <= -3) {
    movement -= 1;
  }

  const keywordScore = newsKeywordScore(evidenceItems);
  if (keywordScore > 0) {
    movement += Math.min(2, keywordScore);
    reasons.push("role or team news points in the right direction");
  } else if (keywordScore < 0) {
    movement += Math.max(-2, keywordScore);
    reasons.push("role or team news adds caution");
  }

  if (hasNegativeHealthFlag(candidate)) {
    movement -= 3;
    reasons.push("injury/status flag needs a value discount");
  }

  if (production?.projectedPpg && production?.lastYearPpg) {
    const change = production.projectedPpg - production.lastYearPpg;
    if (change >= 2.2) {
      movement += 1;
      reasons.push("projection is meaningfully above last year's scoring pace");
    } else if (change <= -2.2) {
      movement -= 1;
      reasons.push("projection is below last year's scoring pace");
    }
  }

  if (isDynasty && age) {
    if ((candidate.position === "RB" && age <= 24) || (candidate.position === "WR" && age <= 26) || (candidate.position === "QB" && age <= 31) || (candidate.position === "TE" && age <= 29)) {
      movement += 2;
      reasons.push("age profile helps dynasty trade value");
    }
    if ((candidate.position === "RB" && age >= 28) || (candidate.position === "WR" && age >= 31) || (candidate.position === "TE" && age >= 33) || (candidate.position === "QB" && age >= 38)) {
      movement -= 2;
      reasons.push("age curve lowers dynasty trade value");
    }
  }

  const status = movement >= 3 ? "Rising" : movement <= -3 ? "Falling" : "Stable";
  const currentValue = clamp(Math.round(totalScore + movement * 3), 1, 100);
  return {
    currentValue,
    movement,
    status,
    reasons: dedupePlainReasons(reasons).slice(0, 3)
  };
}

function buildBustRiskMeter(candidate, production = {}, draftContext = {}, teamContext = null, injuryRisk = 0, evidenceItems = []) {
  const reasons = [];
  let score = 18;
  const age = asNumber(candidate.player?.age);
  const years = asNumber(candidate.player?.years_exp);
  const isDynasty = draftContext?.isDynasty === true;

  if (injuryRisk >= 24 || hasNegativeHealthFlag(candidate)) {
    score += 28;
    reasons.push("active injury/status flag");
  } else if (injuryRisk > 0) {
    score += 12;
    reasons.push("minor health volatility");
  }

  if (!production?.hasLastYearStats && !candidate.isRankingOnly && candidate.position !== "DEF") {
    score += 8;
    reasons.push("less recent NFL production loaded");
  }

  if (production?.lastYearPpg && production?.projectedPpg) {
    const growthAsk = production.projectedPpg - production.lastYearPpg;
    if (growthAsk >= 3.4) {
      score += 8;
      reasons.push("projection asks for a real scoring jump");
    } else if (growthAsk <= -1.5) {
      score += 4;
      reasons.push("projection points to a softer scoring pace");
    }
  }

  if (age) {
    if (candidate.position === "RB" && age >= (isDynasty ? 27 : 29)) {
      score += isDynasty ? 16 : 10;
      reasons.push("RB age curve is part of the risk");
    }
    if ((candidate.position === "WR" || candidate.position === "TE") && age >= (isDynasty ? 31 : 33)) {
      score += isDynasty ? 12 : 7;
      reasons.push(`${candidate.position} age curve adds downside`);
    }
    if (candidate.position === "QB" && age >= 38) {
      score += 8;
      reasons.push("late-career QB profile adds volatility");
    }
    if (isDynasty && ((candidate.position === "RB" && age <= 24) || (candidate.position === "WR" && age <= 26) || (candidate.position === "QB" && age <= 31))) {
      score -= 6;
    }
  }

  if (years === 0 && candidate.rankSort <= 80) {
    score += 6;
    reasons.push("rookie range of outcomes is wider");
  }

  const evidenceScore = scoreEvidence(evidenceItems);
  if (evidenceScore <= -8) {
    score += 12;
    reasons.push("loaded news/context is negative");
  } else if (evidenceScore >= 8) {
    score -= 5;
  }

  if (teamContext?.quarterback && hasNegativeHealthFlag(teamContext.quarterback) && (candidate.position === "WR" || candidate.position === "TE")) {
    score += 9;
    reasons.push("QB injury/status flag can hurt pass-game efficiency");
  }

  const clamped = clamp(Math.round(score), 0, 100);
  const level = clamped >= 58 ? "High" : clamped >= 34 ? "Moderate" : "Safe";
  return {
    score: clamped,
    level,
    reasons: dedupePlainReasons(reasons).slice(0, 3)
  };
}

function buildAdjustedRank(rankSort, valueMeter = {}, riskMeter = {}) {
  const rank = asNumber(rankSort) ?? 999;
  const valueLift = clamp(asNumber(valueMeter.movement) ?? 0, -7, 7) * 1.35;
  const riskDrag = riskMeter?.level === "High" ? 6 : riskMeter?.level === "Moderate" ? 2.5 : -1;
  return Math.max(1, Math.round((rank - valueLift + riskDrag) * 10) / 10);
}

function buildDraftSimulation({
  draft,
  picks = [],
  players = {},
  available = [],
  roster = {},
  slots = {},
  currentPick = 1,
  draftContext = {}
}) {
  const teams = numberSetting(draft?.settings?.teams) || numberSetting(slots.teams) || 12;
  const targetRosterId = String(roster?.rosterId ?? "");
  const nextPickNumber = estimateNextRosterPickNumber(draft, currentPick, targetRosterId);
  const currentOwner = rosterIdForPickNumber(draft, currentPick);
  const windowStart = currentOwner && targetRosterId && currentOwner === targetRosterId ? currentPick + 1 : currentPick;
  const windowEnd = Math.max(windowStart - 1, (asNumber(nextPickNumber) ?? currentPick + teams) - 1);
  const picksUntilNext = Math.max(0, windowEnd - windowStart + 1);
  const runs = 1000;

  const board = [...available]
    .filter((candidate) => candidate?.playerId && CORE_POSITIONS.has(candidate.position))
    .sort((left, right) => {
      const leftRank = roomDraftRankForCandidate(left);
      const rightRank = roomDraftRankForCandidate(right);
      return leftRank - rightRank || left.rankSort - right.rankSort;
    })
    .slice(0, 220);
  const boardById = new Map(board.map((candidate) => [candidate.playerId, candidate]));

  const records = new Map(
    board.map((candidate) => [
      candidate.playerId,
      {
        playerId: candidate.playerId,
        position: candidate.position,
        roomRank: roomDraftRankForCandidate(candidate),
        platformRank: platformRankForCandidate(candidate),
        boardRank: asNumber(candidate.rankSort) ?? null,
        gone: 0,
        taken: 0,
        takenPickTotal: 0
      }
    ])
  );
  const positionTotals = new Map();
  const positionHeavyRuns = new Map();

  if (!board.length || picksUntilNext <= 0) {
    return {
      runs,
      currentPick,
      nextPickNumber,
      picksUntilNext: 0,
      players: new Map(),
      positions: new Map()
    };
  }

  const baseRosterCounts = buildRosterCountsByRoster(picks, players, draft);
  for (let run = 0; run < runs; run += 1) {
    const rng = seededRandom(simulationSeed(draft, currentPick, run));
    const pool = board.slice();
    const rosterCounts = cloneRosterCounts(baseRosterCounts);
    const runPositionCounts = emptyCounts();

    for (let pickNo = windowStart; pickNo <= windowEnd && pool.length; pickNo += 1) {
      const rosterKey = rosterIdForPickNumber(draft, pickNo) || String(((pickNo - 1) % teams) + 1);
      const counts = rosterCounts.get(rosterKey) ?? emptyCounts();
      const selectedIndex = chooseSimulatedPick(pool, pickNo, counts, slots, draftContext, rng);
      const [selected] = pool.splice(selectedIndex, 1);
      if (!selected) {
        continue;
      }

      counts[selected.position] = (counts[selected.position] ?? 0) + 1;
      rosterCounts.set(rosterKey, counts);
      if (runPositionCounts[selected.position] !== undefined) {
        runPositionCounts[selected.position] += 1;
      }

      const record = records.get(selected.playerId);
      if (record) {
        record.gone += 1;
        record.taken += 1;
        record.takenPickTotal += pickNo;
      }
    }

    for (const position of Object.keys(runPositionCounts)) {
      const count = runPositionCounts[position] ?? 0;
      positionTotals.set(position, (positionTotals.get(position) ?? 0) + count);
      if (count >= heavyRunThreshold(position, picksUntilNext)) {
        positionHeavyRuns.set(position, (positionHeavyRuns.get(position) ?? 0) + 1);
      }
    }
  }

  const playerResults = new Map();
  for (const [playerId, record] of records) {
    const candidate = boardById.get(playerId) ?? null;
    const marketFloor = marketTakenFloor(record.platformRank ?? record.roomRank, windowStart, windowEnd);
    const takenPct = Math.max(Math.round(record.gone / runs * 100), marketFloor);
    const position = record.position;
    const tierWindow = analyzeRoomTierWindow(candidate, board, windowEnd);
    playerResults.set(playerId, {
      runs,
      nextPickNumber,
      picksUntilNext,
      position,
      roomRank: record.roomRank,
      platformRank: record.platformRank,
      boardRank: record.boardRank,
      takenBeforeNextPct: takenPct,
      availableNextPct: 100 - takenPct,
      averageTakenPick: record.taken ? round1(record.takenPickTotal / record.taken) : null,
      positionRunRiskPct: Math.round((positionHeavyRuns.get(position) ?? 0) / runs * 100),
      averagePositionTaken: round1((positionTotals.get(position) ?? 0) / runs),
      ...tierWindow
    });
  }

  const positionResults = new Map();
  for (const position of Object.keys(emptyCounts())) {
    positionResults.set(position, {
      averageTaken: round1((positionTotals.get(position) ?? 0) / runs),
      heavyRunPct: Math.round((positionHeavyRuns.get(position) ?? 0) / runs * 100)
    });
  }

  return {
    runs,
    currentPick,
    nextPickNumber,
    picksUntilNext,
    players: playerResults,
    positions: positionResults
  };
}

function chooseSimulatedPick(pool, pickNo, counts, slots, draftContext, rng) {
  const window = Math.min(pool.length, 42 + Math.floor(pickNo / 20) * 5);
  let bestIndex = 0;
  let bestScore = -Infinity;

  for (let index = 0; index < window; index += 1) {
    const candidate = pool[index];
    const roomRank = roomDraftRankForCandidate(candidate);
    const boardRank = asNumber(candidate.rankSort) ?? roomRank;
    const overdue = Math.max(0, pickNo - roomRank);
    const early = Math.max(0, roomRank - pickNo);
    const adpLane =
      roomRank <= pickNo + 1
        ? 14
        : roomRank <= pickNo + 5
          ? 7
          : roomRank <= pickNo + 10
            ? 3
            : 0;
    const priceFit = overdue * 5.2 - early * 0.48 - roomRank * 0.018 + adpLane;
    const needFit = simulationNeedScore(candidate.position, counts, slots, pickNo, draftContext);
    const tierFit = simulationTierScore(candidate, pool, index);
    const boardNudge = clamp((pickNo - boardRank) * 0.06, -2, 2);
    const riskNoise = (rng() + rng() + rng() - 1.5) * (pickNo <= 60 ? 3.5 : 7);
    const defensePenalty = candidate.position === "DEF" && pickNo < 130 ? -45 : 0;
    const youngQbMarket = superflexDynastyYoungQbAdpContext(candidate, pickNo, null, draftContext, null);
    const youngQbMarketBoost = youngQbMarket.aroundAdp ? Math.min(6, youngQbMarket.premium) : 0;
    const score = priceFit + needFit + tierFit + boardNudge + youngQbMarketBoost + riskNoise + defensePenalty;

    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }

  return bestIndex;
}

function simulationNeedScore(position, counts = {}, slots = {}, pickNo = 1, draftContext = {}) {
  const rosterPickCount = countRosterPicks(counts);
  let score = scoreNeed(position, counts, slots, pickNo, rosterPickCount, draftContext) * 0.12;
  const superflex = draftContext?.isSuperflex === true || (slots.SUPER_FLEX ?? 0) > 0;

  if (position === "QB") {
    const qbCount = counts.QB ?? 0;
    if (superflex) {
      if (qbCount === 0) score += 5;
      if (qbCount === 1) score += 2;
      if (qbCount >= 2) score -= pickNo < 100 ? 8 : 3;
    } else {
      if (qbCount >= 1 && pickNo < 105) score -= 18;
      if (qbCount === 0 && pickNo >= 70) score += 4;
    }
  }

  if (position === "TE" && (counts.TE ?? 0) >= 1 && pickNo < 115) {
    score -= 12;
  }
  if (position === "RB" && (counts.WR ?? 0) >= 4 && (counts.RB ?? 0) <= 2) {
    score += 7;
  }
  if (position === "WR" && (counts.RB ?? 0) >= 4 && (counts.WR ?? 0) <= 2) {
    score += 7;
  }
  if (position === "DEF" && rosterPickCount < 12) {
    score -= 30;
  }

  return score;
}

function simulationTierScore(candidate, pool, index) {
  const tier = asPositiveNumber(candidate.tier);
  if (!tier) {
    return 0;
  }
  const remainingSameTier = pool
    .slice(index + 1)
    .filter((item) => item.position === candidate.position && asPositiveNumber(item.tier) === tier)
    .length;
  if (remainingSameTier === 0) {
    return 5;
  }
  if (remainingSameTier === 1) {
    return 3;
  }
  return 0;
}

function scoreDraftSimulation(simulation, tierPressure = null) {
  if (!simulation) {
    return 0;
  }

  const gone = asNumber(simulation.takenBeforeNextPct) ?? 0;
  let score = 0;
  if (gone >= 85) {
    score += 8;
  } else if (gone >= 70) {
    score += 6;
  } else if (gone >= 52) {
    score += 4;
  } else if (gone >= 35) {
    score += 2;
  } else if (gone <= 14 && (tierPressure?.waitTierGap ?? 0) <= 0) {
    score -= 2;
  }

  if ((tierPressure?.waitTierGap ?? 0) >= 1 && gone >= 45) {
    score += 2;
  }
  if ((simulation.tierDropAtNext ?? 0) >= 1 && (simulation.sameTierLikelyAvailable ?? 0) === 0) {
    score += ["RB", "WR"].includes(simulation.position) ? 3 : 2;
  }
  if ((simulation.positionRunRiskPct ?? 0) >= 55 && (tierPressure?.remainingInTier ?? 0) <= 2) {
    score += 1;
  }

  return clamp(score, -3, 8);
}

function scoreSiteAdpDiscipline(candidate, currentPick, valueRank = null, draftContext = {}, draftSim = null, tierPressure = null) {
  const boardRank = asNumber(candidate.rankSort) ?? asNumber(candidate.ranking?.rank ?? candidate.ranking?.overallRank);
  const roomRank = asNumber(candidate.platformRank ?? draftSim?.platformRank);
  const marketRank = roomRank ?? asNumber(valueRank ?? candidate.ranking?.adp ?? candidate.ranking?.averageRank ?? candidate.ranking?.avgRank);
  const pickNo = asNumber(currentPick);
  if (!boardRank || !marketRank || !pickNo) {
    return 0;
  }

  const boardToMarketGap = marketRank - boardRank;
  const pickToMarketGap = marketRank - pickNo;
  const hasRoomAdp = Boolean(roomRank);
  const gone = asNumber(draftSim?.takenBeforeNextPct) ?? 0;
  const tierEnding = (draftSim?.tierDropAtNext ?? tierPressure?.tierDropAtNext ?? 0) >= 1 || (tierPressure?.roomWaitTierGap ?? tierPressure?.waitTierGap ?? 0) >= 1;
  const singleQbRedraft = candidate.position === "QB" && draftContext?.isDynasty !== true && draftContext?.isSuperflex !== true;
  const youngQbMarket = superflexDynastyYoungQbAdpContext(candidate, currentPick, valueRank, draftContext, draftSim);
  let score = 0;

  if (candidate.position === "QB") {
    if (singleQbRedraft) {
      if (pickNo <= 48) {
        score -= 24;
      } else if (pickNo <= 60) {
        score -= 16;
      } else if (pickNo <= 72) {
        score -= 9;
      }
      if (pickToMarketGap >= 10) {
        score -= hasRoomAdp ? 12 : 6;
      } else if (pickToMarketGap >= 5) {
        score -= hasRoomAdp ? 7 : 3;
      }
      if (marketRank <= pickNo + 2 && pickNo >= 55 && gone >= 65) {
        score += 5;
      }
    }

    if (pickToMarketGap >= 30 && boardToMarketGap >= 18) {
      score -= hasRoomAdp ? 26 : 13;
    } else if (pickToMarketGap >= 20 && boardToMarketGap >= 14) {
      score -= hasRoomAdp ? 20 : 10;
    } else if (pickToMarketGap >= 12 && boardToMarketGap >= 10) {
      score -= hasRoomAdp ? 14 : 7;
    } else if (pickToMarketGap >= 6 && boardToMarketGap >= 8) {
      score -= hasRoomAdp ? 8 : 4;
    }

    if (draftContext?.isSuperflex && pickToMarketGap <= 3) {
      score += 2;
    }
    if (youngQbMarket.aroundAdp) {
      score += youngQbMarket.discount ? 5 : 4;
    } else if (youngQbMarket.slightReach) {
      score += 1;
    } else if (youngQbMarket.tooEarly) {
      score -= 6;
    }
    if (gone >= 70 || tierEnding) {
      score += Math.min(5, Math.round(gone / 25));
    }
  } else {
    if (pickToMarketGap >= 28 && boardToMarketGap >= 24) {
      score -= hasRoomAdp ? 7 : 3;
    } else if (pickToMarketGap >= 16 && boardToMarketGap >= 18) {
      score -= hasRoomAdp ? 4 : 2;
    }
    if (gone >= 80 || tierEnding) {
      score += 2;
    }
  }

  const maxScore = youngQbMarket.aroundAdp ? 8 : 5;
  return clamp(score, -28, maxScore);
}

function superflexDynastyYoungQbAdpContext(candidate, currentPick, valueRank = null, draftContext = {}, draftSim = null) {
  const age = asNumber(candidate?.player?.age ?? candidate?.ranking?.age);
  const pickNo = asNumber(currentPick);
  const marketRank = asNumber(candidate?.platformRank ?? draftSim?.platformRank)
    ?? asNumber(valueRank ?? candidate?.ranking?.adp ?? candidate?.ranking?.averageRank ?? candidate?.ranking?.avgRank);
  if (draftContext?.isDynasty !== true || draftContext?.isSuperflex !== true || candidate?.position !== "QB" || !age || age > 28 || !pickNo || !marketRank) {
    return {
      applies: false,
      aroundAdp: false,
      slightReach: false,
      tooEarly: false,
      discount: false,
      pickToMarketGap: null,
      marketRank: marketRank ?? null,
      premium: 0
    };
  }

  const pickToMarketGap = marketRank - pickNo;
  const boardRank = asNumber(candidate?.valueRankSort ?? candidate?.rankSort ?? candidate?.ranking?.rank ?? candidate?.ranking?.overallRank);
  const boardToMarketGap = boardRank ? marketRank - boardRank : 0;
  const aroundAdp = pickToMarketGap >= -14 && pickToMarketGap <= 5;
  const slightReach = pickToMarketGap > 5 && pickToMarketGap <= 10;
  const tooEarly = pickToMarketGap > 10;
  const discount = pickToMarketGap <= -4;
  let premium = 0;

  if (aroundAdp) {
    premium = age <= 25 ? 8 : 6;
    if (discount) {
      premium += 2;
    } else if (pickToMarketGap <= 1) {
      premium += 1;
    }
    if (boardToMarketGap >= 6) {
      premium += 1;
    }
  } else if (slightReach) {
    premium = age <= 25 ? 2 : 1;
  }

  return {
    applies: true,
    aroundAdp,
    slightReach,
    tooEarly,
    discount,
    pickToMarketGap,
    marketRank,
    premium: clamp(Math.round(premium), 0, 10)
  };
}

function analyzeByeWeek(candidate, roster = {}, players = {}) {
  const week = getByeWeek(candidate);
  if (!week) {
    return null;
  }

  const conflicts = [];
  const samePosition = [];
  for (const pick of roster?.picks ?? []) {
    const player = players[String(pick.player_id)] ?? {};
    const pickWeek = getByeWeek({ player, ranking: null });
    if (pickWeek !== week) {
      continue;
    }
    const position = normalizePosition(pick.metadata?.position ?? player.position ?? player.fantasy_positions?.[0]);
    const name = firstNonBlank(pick.metadata?.first_name && pick.metadata?.last_name ? `${pick.metadata.first_name} ${pick.metadata.last_name}` : "", pick.metadata?.full_name, displayName(player));
    if (CORE_POSITIONS.has(position)) {
      conflicts.push({ name, position });
      if (position === candidate.position) {
        samePosition.push({ name, position });
      }
    }
  }

  return {
    week,
    conflictCount: conflicts.length,
    samePositionConflicts: samePosition.length,
    names: conflicts.map((item) => item.name).filter(Boolean).slice(0, 3),
    samePositionNames: samePosition.map((item) => item.name).filter(Boolean).slice(0, 3)
  };
}

function scoreByeWeek(byeWeek) {
  if (!byeWeek) {
    return 0;
  }
  if ((byeWeek.samePositionConflicts ?? 0) >= 2) {
    return -3;
  }
  if ((byeWeek.conflictCount ?? 0) >= 4) {
    return -2;
  }
  if ((byeWeek.conflictCount ?? 0) === 0) {
    return 1;
  }
  return 0;
}

function analyzeStacking(candidate, roster = {}, players = {}) {
  const team = normalizeTeam(candidate.team);
  if (!team || !["QB", "RB", "WR", "TE"].includes(candidate.position)) {
    return null;
  }

  const rosterPlayers = (roster?.picks ?? [])
    .map((pick) => {
      const player = players[String(pick.player_id)] ?? {};
      const position = normalizePosition(pick.metadata?.position ?? player.position ?? player.fantasy_positions?.[0]);
      return {
        name: firstNonBlank(pick.metadata?.full_name, displayName(player)),
        position,
        team: normalizeTeam(player.team ?? pick.metadata?.team)
      };
    })
    .filter((item) => item.team === team && item.name && ["QB", "RB", "WR", "TE"].includes(item.position));

  const matches =
    candidate.position === "QB"
      ? rosterPlayers.filter((item) => ["WR", "TE", "RB"].includes(item.position))
      : rosterPlayers.filter((item) => item.position === "QB");

  if (!matches.length) {
    return null;
  }

  const primary = matches.slice(0, 2);
  const passCatcherStack = candidate.position === "QB" || ["WR", "TE"].includes(candidate.position);
  return {
    names: primary.map((item) => item.name),
    positions: primary.map((item) => item.position),
    team,
    boost: passCatcherStack ? 2 : 1
  };
}

function scoreStacking(stacking) {
  return clamp(asNumber(stacking?.boost) ?? 0, 0, 3);
}

function analyzeSleeperValue(candidate, currentPick, valueRank) {
  const boardGap = currentPick - (asNumber(candidate.rankSort) ?? currentPick);
  const marketGap = valueRank ? currentPick - valueRank : null;
  const bestGap = Math.max(boardGap, marketGap ?? -999);
  const worstGap = Math.min(boardGap, marketGap ?? boardGap);
  const level =
    bestGap >= 18
      ? "strong"
      : bestGap >= 8
        ? "solid"
        : worstGap <= -14
          ? "reach"
          : "fair";
  return {
    level,
    boardGap: Math.round(boardGap),
    marketGap: marketGap === null ? null : Math.round(marketGap)
  };
}

function analyzeRosterConstruction(candidate, counts = {}, slots = {}, currentPick = 1, draftContext = {}) {
  const position = candidate.position;
  const after = { ...emptyCounts(), ...counts };
  after[position] = (after[position] ?? 0) + 1;
  const rosterPickCount = countRosterPicks(counts);
  const teams = numberSetting(slots.teams) || 12;
  const round = Math.max(1, Math.ceil(currentPick / teams));
  const phase = rosterPickCount <= 4 ? "early" : rosterPickCount <= 9 ? "middle" : "late";
  const balanceWeight = phase === "early" ? 1 : phase === "middle" ? 1.35 : 1.7;
  const flexTarget = Math.max(1, (slots.RB ?? 0) + (slots.WR ?? 0) + (slots.TE ?? 0) + (slots.FLEX ?? 0) + (slots.REC_FLEX ?? 0));
  const flexAfter = (after.RB ?? 0) + (after.WR ?? 0) + (after.TE ?? 0);
  const baseTarget = position === "QB" && draftContext?.isSuperflex
    ? Math.max(2, (slots.QB ?? 1) + (slots.SUPER_FLEX ?? 1))
    : Math.max(0, slots[position] ?? 0);
  const baseGap = Math.max(0, baseTarget - (counts[position] ?? 0));
  let score = 0;
  let message = "";

  if (position === "RB" && (counts.WR ?? 0) >= 4 && (counts.RB ?? 0) <= 2) {
    score += 5 * balanceWeight;
    message = `Construction: this balances a WR-heavy start by moving you to ${after.RB} RB and ${after.WR} WR.`;
  } else if (position === "WR" && (counts.RB ?? 0) >= 4 && (counts.WR ?? 0) <= 2) {
    score += 5 * balanceWeight;
    message = `Construction: this balances an RB-heavy start by moving you to ${after.RB} RB and ${after.WR} WR.`;
  } else if (baseGap > 0 && phase !== "early" && position !== "DEF") {
    score += 4 * balanceWeight;
    message = `Construction: this fills a real ${position} gap in the build, moving you to ${after[position]}/${baseTarget} at that spot.`;
  } else if (FLEX_POSITIONS.has(position) && flexAfter <= flexTarget) {
    score += phase === "early" ? 2 : 3 * balanceWeight;
    message = `Construction: he fills a real starter/flex lane, putting you at ${flexAfter}/${flexTarget} RB-WR-TE lineup spots.`;
  }

  if (position === "RB" && (counts.RB ?? 0) >= 4 && (counts.WR ?? 0) <= 2 && round >= 6) {
    score -= 4 * balanceWeight;
    message = "Construction: another RB makes the roster too RB-heavy unless he is a clear value over the WR tier.";
  }
  if (position === "WR" && (counts.WR ?? 0) >= 5 && (counts.RB ?? 0) <= 2 && round >= 6) {
    score -= 4 * balanceWeight;
    message = "Construction: another WR makes the roster too WR-heavy unless the RB tier is already weak.";
  }
  if (position === "TE" && (counts.TE ?? 0) >= 1 && rosterPickCount < 10) {
    score -= 5;
    message = "Construction: second TE is a luxury this early unless the player is a clear value or tier break.";
  }
  if (position === "QB" && !draftContext?.isSuperflex && (counts.QB ?? 0) >= 1 && currentPick < 120) {
    score -= 6;
    message = "Construction: second QB is usually a bench luxury before the core RB/WR/FLEX build is finished.";
  }
  if (position === "DEF" && rosterPickCount < 12) {
    score -= 6;
    message = "Construction: defense should stay late unless the board is empty of useful upside.";
  }

  return {
    score: clamp(score, -8, 10),
    message
  };
}

function analyzeTeamBalance(candidate, roster = {}, players = {}, slots = {}, currentPick = 1, draftContext = {}, valueRank = null, draftSim = null, tierPressure = null) {
  const counts = { ...emptyCounts(), ...(roster?.counts ?? {}) };
  const rosterPickCount = countRosterPicks(counts);
  const position = candidate.position;
  const isSuperflex = draftContext?.isSuperflex === true || (slots.SUPER_FLEX ?? 0) > 0;
  const isRedraft = draftContext?.isDynasty !== true;
  const teams = numberSetting(slots.teams) || 12;
  const round = Math.max(1, Math.ceil(currentPick / teams));
  const lastPosition = lastRosterPickPosition(roster?.picks ?? [], players);
  const sameRun = trailingPositionCount(roster?.picks ?? [], players, position);
  const rb = counts.RB ?? 0;
  const wr = counts.WR ?? 0;
  const qb = counts.QB ?? 0;
  const te = counts.TE ?? 0;
  const flexCovered = rb + wr + te;
  const flexTarget = Math.max(1, (slots.RB ?? 0) + (slots.WR ?? 0) + (slots.TE ?? 0) + (slots.FLEX ?? 0) + (slots.REC_FLEX ?? 0));
  const boardDiscount = currentPick - (asNumber(candidate.rankSort) ?? currentPick);
  const marketDiscount = valueRank ? currentPick - valueRank : boardDiscount;
  const valueDiscount = Math.max(boardDiscount, marketDiscount);
  const tierEnding = (draftSim?.tierDropAtNext ?? tierPressure?.tierDropAtNext ?? 0) >= 1 || (tierPressure?.roomWaitTierGap ?? tierPressure?.waitTierGap ?? 0) >= 1;
  const obviousValue = valueDiscount >= 18 || (draftSim?.takenBeforeNextPct ?? 0) >= 80 || tierEnding;
  let score = 0;
  let scoreCap = 100;
  let message = "";

  const cap = (value) => {
    scoreCap = Math.min(scoreCap, value);
  };

  if (position === "QB") {
    if (!isSuperflex) {
      if (isRedraft && qb >= 2 && round < 15) {
        score -= lastPosition === "QB" ? 52 : 46;
        cap(lastPosition === "QB" ? 36 : 42);
        message = "Balance: two QBs is enough in redraft before Round 15, so the assistant is moving this bench spot toward RB/WR upside.";
      } else if (isRedraft && qb >= 2) {
        score -= lastPosition === "QB" ? 22 : 16;
        cap(obviousValue ? 78 : 68);
        message = "Balance: a third QB is late insurance only; RB/WR lottery tickets still need to beat it unless this is a clear value.";
      } else if (qb >= 1 && currentPick < 150) {
        score -= lastPosition === "QB" ? 34 : 28;
        cap(lastPosition === "QB" ? 60 : 66);
        message = "Balance: you already have a QB, so the assistant is pushing RB/WR/TE value unless the draft is very late.";
      } else if (lastPosition === "QB" && currentPick < 125) {
        score -= 24;
        cap(68);
        message = "Balance: you just took a QB, so this turn should usually attack RB/WR value instead of repeating the position.";
      } else if (qb === 0 && round <= 5 && flexCovered < 4) {
        score -= 8;
        cap(88);
        message = "Balance: early single-QB builds still need RB/WR anchors before forcing quarterback.";
      }
    } else {
      const qbTarget = Math.max(2, (slots.QB ?? 1) + (slots.SUPER_FLEX ?? 1));
      if (lastPosition === "QB" && round <= 7) {
        score -= qb >= qbTarget ? 24 : 16;
        cap(qb >= qbTarget ? 70 : obviousValue ? 88 : 80);
        message = "Balance: you just took a QB, so RB/WR value gets priority unless this QB is a clear tier-closing value.";
      } else if (qb >= qbTarget && currentPick < 130) {
        score -= 20;
        cap(obviousValue ? 82 : 74);
        message = "Balance: your QB/superflex slots are covered, so another QB is a luxury before RB/WR depth is built.";
      } else if (qb >= 1 && flexCovered < Math.min(4, flexTarget) && round <= 6) {
        score -= 10;
        cap(obviousValue ? 90 : 84);
        message = "Balance: you have a QB start; the build needs RB/WR/FLEX points before doubling down again.";
      } else if (qb === 0 && round >= 4) {
        score += 5;
      }
    }
  }

  if (position === "RB") {
    if (rb === 0 && rosterPickCount >= 2) {
      score += 15;
      message = `Balance: RB fixes the biggest roster gap after a ${wr} WR / ${qb} QB start.`;
    } else if (wr - rb >= 2) {
      score += 12;
      message = `Balance: this pulls a WR-heavy build back toward RB/WR balance (${rb + 1} RB, ${wr} WR).`;
    } else if (rb >= 4 && wr <= 2 && round >= 6) {
      score -= 12;
      cap(84);
      message = "Balance: another RB would make the roster too RB-heavy unless he is a major value.";
    } else if (lastPosition === "RB" && sameRun >= 2 && wr <= 1 && round <= 6) {
      score -= 8;
      cap(88);
      message = "Balance: you have been hammering RB, so the assistant is checking WR value harder.";
    }
  }

  if (position === "WR") {
    if (wr === 0 && rosterPickCount >= 2) {
      score += 16;
      message = `Balance: WR fixes the biggest roster gap after a ${rb} RB / ${qb} QB start.`;
    } else if (rb - wr >= 2) {
      score += 12;
      message = `Balance: this pulls an RB-heavy build back toward RB/WR balance (${rb} RB, ${wr + 1} WR).`;
    } else if (wr >= 5 && rb <= 2 && round >= 6) {
      score -= 12;
      cap(84);
      message = "Balance: another WR makes the roster too WR-heavy unless the RB board has dried up.";
    } else if (lastPosition === "WR" && sameRun >= 3 && rb <= 1 && round <= 7) {
      score -= 8;
      cap(88);
      message = "Balance: you have been stacking WRs, so the assistant is checking RB value harder.";
    }
  }

  if (isRedraft && ["RB", "WR"].includes(position) && round < 15 && (qb >= 2 || te >= 2)) {
    score += 8;
    if (!message) {
      message = "Balance: with QB/TE depth already covered, this bench spot is better spent chasing RB/WR upside and usable flex weeks.";
    }
  }

  if (FLEX_POSITIONS.has(position) && flexCovered < flexTarget && position !== "TE") {
    score += rosterPickCount >= 4 ? 6 : 3;
    if (!message) {
      message = `Balance: this keeps filling starter/flex spots (${flexCovered + 1}/${flexTarget} RB-WR-TE lanes covered).`;
    }
  }

  if (position === "TE") {
    if (isRedraft && te >= 2 && round < 15) {
      score -= 42;
      cap(draftContext?.isTep ? 48 : 40);
      message = "Balance: two TEs is enough in redraft before Round 15; the bench value should come from RB/WR upside instead.";
    } else if (isRedraft && te >= 2) {
      score -= draftContext?.isTep ? 12 : 18;
      cap(draftContext?.isTep ? 78 : 68);
      message = "Balance: third TE is only late depth, so he needs to beat the RB/WR upside board by value.";
    } else if (te >= 1 && rosterPickCount < 10) {
      score -= draftContext?.isTep ? 8 : 14;
      cap(draftContext?.isTep ? 84 : 76);
      message = "Balance: second TE is a luxury before the RB/WR/FLEX build is secure.";
    } else if (te === 0 && flexCovered >= 4) {
      score += draftContext?.isTep ? 8 : 4;
    }
  }

  if (position === "DEF" && rosterPickCount < 12) {
    score -= 22;
    cap(62);
    message = "Balance: defense should stay late while RB/WR upside is still available.";
  }

  if (score < 0 && obviousValue && position !== "DEF") {
    score += Math.min(6, Math.max(0, valueDiscount * 0.2));
  }

  return {
    score: clamp(score, -24, 18),
    scoreCap,
    message
  };
}

function lastRosterPickPosition(picks = [], players = {}) {
  const last = [...(picks ?? [])]
    .sort((left, right) => Number(right.pick_no ?? right.round_pick_no ?? 0) - Number(left.pick_no ?? left.round_pick_no ?? 0))[0];
  return last ? pickPosition(last, players) : "";
}

function trailingPositionCount(picks = [], players = {}, position = "") {
  const sorted = [...(picks ?? [])]
    .sort((left, right) => Number(right.pick_no ?? right.round_pick_no ?? 0) - Number(left.pick_no ?? left.round_pick_no ?? 0));
  let count = 0;
  for (const pick of sorted) {
    if (pickPosition(pick, players) !== position) {
      break;
    }
    count += 1;
  }
  return count;
}

function pickPosition(pick, players = {}) {
  const player = players[String(pick?.player_id)] ?? {};
  return normalizePosition(pick?.metadata?.position ?? player.position ?? player.fantasy_positions?.[0]);
}

function publicDraftSimulation(simulation) {
  if (!simulation) {
    return null;
  }
  return {
    runs: simulation.runs,
    nextPickNumber: simulation.nextPickNumber,
    picksUntilNext: simulation.picksUntilNext,
    roomRank: simulation.roomRank,
    platformRank: simulation.platformRank,
    boardRank: simulation.boardRank,
    takenBeforeNextPct: simulation.takenBeforeNextPct,
    availableNextPct: simulation.availableNextPct,
    averageTakenPick: simulation.averageTakenPick,
    positionRunRiskPct: simulation.positionRunRiskPct,
    averagePositionTaken: simulation.averagePositionTaken,
    sameTierLikelyAvailable: simulation.sameTierLikelyAvailable,
    sameTierLikelyGone: simulation.sameTierLikelyGone,
    nextLikelyName: simulation.nextLikelyName,
    nextLikelyTier: simulation.nextLikelyTier,
    nextLikelyRoomRank: simulation.nextLikelyRoomRank,
    tierDropAtNext: simulation.tierDropAtNext
  };
}

function buildRosterCountsByRoster(picks = [], players = {}, draft = null) {
  const byRoster = new Map();
  for (const pick of picks) {
    const rosterKey = teamKeyForPick(pick, draft);
    if (!rosterKey) {
      continue;
    }
    const player = players[String(pick.player_id)] ?? {};
    const position = normalizePosition(pick.metadata?.position ?? player.position ?? player.fantasy_positions?.[0]);
    if (!CORE_POSITIONS.has(position)) {
      continue;
    }
    const counts = byRoster.get(String(rosterKey)) ?? emptyCounts();
    counts[position] = (counts[position] ?? 0) + 1;
    byRoster.set(String(rosterKey), counts);
  }
  return byRoster;
}

function cloneRosterCounts(source) {
  const clone = new Map();
  for (const [key, counts] of source) {
    clone.set(key, { ...emptyCounts(), ...counts });
  }
  return clone;
}

function countRosterPicks(counts = {}) {
  return Object.keys(emptyCounts()).reduce((total, position) => total + (counts[position] ?? 0), 0);
}

function heavyRunThreshold(position, picksUntilNext) {
  const base = Math.max(2, Math.round(picksUntilNext * 0.24));
  if (position === "WR") {
    return Math.max(3, base);
  }
  if (position === "QB" || position === "TE") {
    return Math.max(2, Math.round(picksUntilNext * 0.16));
  }
  return base;
}

function marketRankForCandidate(candidate) {
  return asNumber(candidate?.platformRank ?? candidate?.ranking?.adp ?? candidate?.ranking?.averageRank ?? candidate?.ranking?.avgRank ?? candidate?.rankSort);
}

function platformRankForCandidate(candidate) {
  return asNumber(candidate?.platformRank ?? candidate?.ranking?.platformRank ?? candidate?.ranking?.sleeperRank ?? candidate?.ranking?.adp ?? candidate?.ranking?.averageRank ?? candidate?.ranking?.avgRank);
}

function roomDraftRankForCandidate(candidate) {
  return platformRankForCandidate(candidate) ?? asNumber(candidate?.rankSort) ?? 999;
}

function marketTakenFloor(roomRank, windowStart, windowEnd) {
  const rank = asNumber(roomRank);
  if (!rank) {
    return 0;
  }

  const windowSize = Math.max(1, windowEnd - windowStart + 1);
  const overdueAtStart = windowStart - rank;
  const insideWindow = windowEnd - rank;

  if (overdueAtStart >= 2) {
    return 99;
  }
  if (overdueAtStart >= 0) {
    return 96;
  }
  if (insideWindow >= Math.max(4, Math.round(windowSize * 0.45))) {
    return 94;
  }
  if (insideWindow >= Math.max(2, Math.round(windowSize * 0.25))) {
    return 84;
  }
  if (insideWindow >= 0) {
    return 66;
  }

  const afterWindow = rank - windowEnd;
  if (afterWindow <= 3) {
    return 38;
  }
  if (afterWindow <= 8) {
    return 20;
  }
  return 6;
}

function analyzeRoomTierWindow(candidate, board = [], windowEnd = null) {
  if (!candidate || !windowEnd) {
    return {};
  }

  const currentTier = asPositiveNumber(candidate.tier);
  const position = candidate.position;
  const group = board
    .filter((item) => item.position === position && item.playerId !== candidate.playerId)
    .sort((left, right) => roomDraftRankForCandidate(left) - roomDraftRankForCandidate(right) || left.rankSort - right.rankSort);

  const nextLikely = group.find((item) => roomDraftRankForCandidate(item) > windowEnd) ?? group[group.length - 1] ?? null;
  const nextLikelyTier = asPositiveNumber(nextLikely?.tier);
  const sameTierLikelyAvailable = currentTier
    ? group.filter((item) => asPositiveNumber(item.tier) === currentTier && roomDraftRankForCandidate(item) > windowEnd).length
    : 0;
  const sameTierLikelyGone = currentTier
    ? group.filter((item) => asPositiveNumber(item.tier) === currentTier && roomDraftRankForCandidate(item) <= windowEnd).length
    : 0;

  return {
    sameTierLikelyAvailable,
    sameTierLikelyGone,
    nextLikelyName: nextLikely?.name ?? "",
    nextLikelyTier: nextLikelyTier ?? null,
    nextLikelyRoomRank: nextLikely ? roomDraftRankForCandidate(nextLikely) : null,
    tierDropAtNext: currentTier && nextLikelyTier ? Math.max(0, nextLikelyTier - currentTier) : 0
  };
}

function simulationSeed(draft, currentPick, run) {
  const text = `${draft?.draft_id ?? draft?.league_id ?? "draft"}:${currentPick}:${run}`;
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed) {
  let value = (Number(seed) || 1) % 2147483647;
  if (value <= 0) {
    value += 2147483646;
  }
  return () => {
    value = value * 16807 % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function getByeWeek(candidateOrPlayer) {
  const player = candidateOrPlayer?.player ?? candidateOrPlayer ?? {};
  return asPositiveNumber(
    candidateOrPlayer?.ranking?.bye ??
      candidateOrPlayer?.ranking?.byeWeek ??
      player.bye_week ??
      player.bye ??
      player.metadata?.bye_week ??
      player.metadata?.byeWeek
  );
}

function newsKeywordScore(items = []) {
  let score = 0;
  for (const item of items) {
    const text = `${item?.title ?? ""} ${item?.summary ?? ""} ${item?.note ?? ""} ${item?.description ?? ""}`.toLowerCase();
    if (!text) {
      continue;
    }
    if (/\b(first.?team|starter|lead back|featured|clear role|extended|contract|extension|traded for|strong camp|impressive camp|full practice)\b/i.test(text)) {
      score += 1;
    }
    if (/\b(injured|injury|out|ir|doubtful|limited|setback|surgery|holdout|suspended|demoted|cut|released)\b/i.test(text)) {
      score -= 1;
    }
  }
  return clamp(score, -3, 3);
}

function buildAvailablePlayers({ players, rankingEntries, draftedIds, draftedKeys }) {
  const seen = new Set();
  const candidates = [];
  const hasRankingBoard = rankingEntries.length > 0;

  for (const entry of rankingEntries) {
    const playerId = entry.playerId ? String(entry.playerId) : `rank:${entry.rankingKey}`;
    if (
      (entry.playerId && draftedIds.has(String(entry.playerId))) ||
      draftedKeys.has(entry.rankingKey) ||
      draftedKeys.has(nameOnlyKey(entry.name ?? entry.player ?? entry.fullName)) ||
      draftedKeys.has(initialLastKey(entry.name ?? entry.player ?? entry.fullName, entry.position)) ||
      seen.has(playerId)
    ) {
      continue;
    }
    const player = entry.playerId ? players[entry.playerId] ?? {} : rankingOnlyPlayer(entry);
    const position = normalizePosition(entry.position ?? player.position ?? player.fantasy_positions?.[0]);
    if (!CORE_POSITIONS.has(position)) {
      continue;
    }

    const candidate = toCandidate(playerId, player, entry, position, Boolean(entry.playerId));
    if (!hasDraftableTeam(candidate)) {
      continue;
    }

    candidates.push(candidate);
    seen.add(playerId);
  }

  if (hasRankingBoard) {
    candidates.sort((a, b) => a.rankSort - b.rankSort);
    return candidates;
  }

  for (const [playerId, player] of Object.entries(players)) {
    if (draftedIds.has(String(playerId)) || seen.has(String(playerId))) {
      continue;
    }

    const position = normalizePosition(player.position ?? player.fantasy_positions?.[0]);
    if (!CORE_POSITIONS.has(position) || !isDraftable(player, position)) {
      continue;
    }

    const searchRank = asNumber(player.search_rank) ?? 999;
    if (searchRank > 650 && position !== "DEF") {
      continue;
    }

    const candidate = toCandidate(String(playerId), player, null, position);
    if (!hasDraftableTeam(candidate)) {
      continue;
    }

    candidates.push(candidate);
    seen.add(String(playerId));
  }

  candidates.sort((a, b) => a.rankSort - b.rankSort);
  return candidates;
}

function toCandidate(playerId, player, ranking, position) {
  const isRankingOnly = String(playerId).startsWith("rank:");
  const platformRank = !isRankingOnly
    ? asNumber(player.search_rank ?? ranking?.platformRank ?? ranking?.sleeperRank)
    : asNumber(ranking?.platformRank ?? ranking?.sleeperRank ?? ranking?.adp);
  const rankSort =
    asNumber(ranking?.rank) ??
    asNumber(ranking?.overallRank) ??
    asNumber(player.search_rank) ??
    fallbackRank(position);
  const valueRankSort =
    asNumber(ranking?.valueRankSort ?? ranking?.valueOverallRank ?? ranking?.providerRank ?? ranking?.providerOverallRank) ??
    asNumber(ranking?.rank ?? ranking?.overallRank) ??
    asNumber(player.search_rank) ??
    fallbackRank(position);
  const name = firstNonBlank(ranking?.name, ranking?.player, ranking?.fullName, displayName(player));
  const team = firstNonBlank(ranking?.team, player.team);
  const positionTier = asPositiveNumber(ranking?.positionTier ?? ranking?.posTier ?? ranking?.positionalTier);
  const positionRank = parsePositionRank(ranking?.posRank ?? ranking?.positionRank ?? ranking?.positionalRank);
  const valuePositionRank = parsePositionRank(ranking?.valuePositionRank ?? ranking?.providerPositionRank ?? ranking?.positionRank ?? ranking?.posRank ?? ranking?.positionalRank);
  const valueTier = asPositiveNumber(ranking?.valueTier ?? ranking?.providerTier ?? ranking?.positionTier ?? ranking?.posTier ?? ranking?.positionalTier);
  const formatValue = rankingValueForFormat(ranking);
  const valueRanking = ranking ? {
    ...ranking,
    rank: valueRankSort,
    overallRank: valueRankSort,
    positionRank: valuePositionRank,
    posRank: valuePositionRank ? `${position}${valuePositionRank}` : ranking.posRank,
    positionTier: valueTier,
    tier: valueTier,
    value: formatValue,
    fantasyCalcValue: formatValue
  } : null;

  return {
    playerId: String(playerId),
    name,
    team,
    position,
    player,
    ranking,
    realPlayerId: !isRankingOnly ? String(playerId) : null,
    isRankingOnly,
    rankSort,
    redraftRank: asNumber(ranking?.redraftRank ?? ranking?.displayRank ?? rankSort) ?? rankSort,
    valueRankSort,
    valueRanking,
    platformRank,
    platformRankLabel: platformRank ? "Room ADP" : null,
    tier: positionTier,
    positionTier,
    positionRank,
    valuePositionRank,
    valueTier,
    baseValue: asNumber(ranking?.baseValue ?? formatValue) ?? null,
    calculatedValue: asNumber(ranking?.calculatedValue ?? formatValue) ?? null,
    tradeValue: asNumber(ranking?.tradeValue ?? (isDynastyRanking(ranking) ? ranking?.dynastyValue : ranking?.redraftValue) ?? formatValue) ?? null,
    positionTierSource: positionTier ? (ranking?.rankingSource === "fantasycalc" ? "market" : "custom") : "auto"
  };
}

function rankingValueForFormat(ranking = {}) {
  if (!ranking) return null;
  if (isDynastyRanking(ranking)) {
    return asNumber(ranking.calculatedValue ?? ranking.dynastyValue ?? ranking.fantasyCalcValue ?? ranking.value ?? ranking.combinedValue) ?? null;
  }
  return asNumber(ranking.calculatedValue ?? ranking.redraftValue ?? ranking.fantasyCalcValue ?? ranking.value ?? ranking.combinedValue) ?? null;
}

function isDynastyRanking(ranking = {}) {
  const scoring = String(ranking?.scoring ?? ranking?.format ?? "").toLowerCase();
  const rosterType = String(ranking?.rosterType ?? "").toLowerCase();
  return scoring.includes("dynasty") || rosterType === "dynasty";
}

function hasDraftableTeam(candidate = {}) {
  return isDraftableTeam(candidate.team ?? candidate.ranking?.team ?? candidate.player?.team);
}

function isDraftableTeam(team) {
  const normalized = normalizeTeam(team);
  if (!normalized) {
    return false;
  }
  return !INVALID_DRAFT_TEAMS.has(normalized);
}

function hydrateRankings(rankings, players) {
  const entries = Array.isArray(rankings?.players) ? rankings.players : [];
  const index = buildPlayerIndex(players);

  return entries
    .map((entry) => {
      const playerId = resolvePlayerId(entry, index);
      const position = normalizePosition(entry.position);
      const name = firstNonBlank(entry.name, entry.player, entry.fullName);
      const formatValue = rankingValueForFormat(entry);
      return {
        ...entry,
        playerId: playerId ? String(playerId) : null,
        rankingKey: rankingKey(name, position),
        position,
        rank: asNumber(entry.rank ?? entry.overallRank),
        redraftRank: asNumber(entry.redraftRank ?? entry.displayRank ?? entry.rank ?? entry.overallRank),
        redraftPositionRank: asNumber(entry.redraftPositionRank ?? entry.positionRank),
        redraftTier: asNumber(entry.redraftTier ?? entry.positionTier ?? entry.tier),
        valueRankSort: asNumber(entry.valueRankSort ?? entry.valueOverallRank ?? entry.providerRank ?? entry.rank ?? entry.overallRank),
        valuePositionRank: asNumber(entry.valuePositionRank ?? entry.providerPositionRank ?? entry.positionRank),
        valueTier: asNumber(entry.valueTier ?? entry.providerTier ?? entry.positionTier ?? entry.tier),
        providerRank: asNumber(entry.providerRank ?? entry.rank ?? entry.overallRank),
        providerPositionRank: asNumber(entry.providerPositionRank ?? entry.positionRank),
        providerTier: asNumber(entry.providerTier ?? entry.positionTier ?? entry.tier),
        positionTier: asPositiveNumber(entry.positionTier ?? entry.posTier ?? entry.positionalTier),
        posRank: entry.posRank ?? entry.positionRank ?? entry.positionalRank,
        adp: asNumber(entry.adp),
        averageRank: asNumber(entry.averageRank ?? entry.avgRank),
        high: asNumber(entry.high),
        low: asNumber(entry.low),
        projection: asNumber(entry.projection),
        fantasyCalcValue: asNumber(formatValue ?? entry.fantasyCalcValue ?? entry.value),
        value: asNumber(formatValue ?? entry.value ?? entry.fantasyCalcValue),
        baseValue: asNumber(entry.baseValue ?? formatValue),
        calculatedValue: asNumber(entry.calculatedValue ?? formatValue),
        tradeValue: asNumber(entry.tradeValue ?? (isDynastyRanking(entry) ? entry.dynastyValue : entry.redraftValue) ?? formatValue),
        redraftValue: asNumber(entry.redraftValue),
        dynastyValue: asNumber(entry.dynastyValue),
        maxFantasyCalcValue: asNumber(entry.maxFantasyCalcValue),
        trend30Day: asNumber(entry.trend30Day),
        rosterPercent: asNumber(entry.rosterPercent),
        valueRankLabel: entry.valueRankLabel,
        sleeperId: entry.sleeperId,
        platformRank: asNumber(entry.platformRank ?? entry.sleeperRank),
        sleeperRank: asNumber(entry.sleeperRank ?? entry.platformRank),
        rankingSource: entry.rankingSource,
        sourceRanks: entry.sourceRanks ?? {}
      };
    })
    .filter((entry) => entry.rankingKey);
}

function buildPlayerIndex(players) {
  const byId = new Map();
  const byNamePosition = new Map();
  const byNameTeam = new Map();
  const byName = new Map();

  for (const [playerId, player] of Object.entries(players)) {
    const name = normalizeName(displayName(player));
    const position = normalizePosition(player.position ?? player.fantasy_positions?.[0]);
    const team = normalizeTeam(player.team);
    if (!name) {
      continue;
    }

    const id = String(playerId);
    byId.set(id, id);
    setBestPlayer(byName, name, id, player);
    setBestPlayer(byNamePosition, `${name}|${position}`, id, player);
    setBestPlayer(byNameTeam, `${name}|${team}`, id, player);
  }

  return { byId, byName, byNamePosition, byNameTeam };
}

function buildDraftContext(draft, rankings, scoringSettings = {}) {
  const metadataText = [
    rankings?.scoring,
    rankings?.rosterType,
    rankings?.label,
    rankings?.name,
    rankings?.sourceFile,
    draft?.metadata?.scoring_type,
    draft?.metadata?.draft_type,
    draft?.metadata?.league_type,
    draft?.metadata?.name,
    draft?.metadata?.description
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const isDynasty =
    rankings?.rosterType === "dynasty" ||
    rankings?.scoring === "dynasty" ||
    rankings?.scoring === "superflex_dynasty" ||
    /\bdynasty\b|\bkeeper\b/.test(metadataText);
  const tightEndPremium = detectTightEndPremium(scoringSettings, draft, metadataText);
  return {
    isDynasty,
    isSuperflex:
      rankings?.scoring === "superflex_dynasty" ||
      Number(draft?.settings?.slots_super_flex ?? 0) > 0 ||
      /\bsuper[\s_-]*flex\b|\bsf\b|\b2qb\b|\b2[\s_-]*qb\b/.test(metadataText),
    isTep: tightEndPremium.isTep,
    tePremium: tightEndPremium.premium
  };
}

function detectTightEndPremium(scoringSettings = {}, draft = null, metadataText = "") {
  const scoring = {
    ...(draft?.scoring_settings ?? {}),
    ...(scoringSettings ?? {})
  };
  const rec = asNumber(scoring.rec ?? scoring.reception) ?? 0;
  const absoluteKeys = ["rec_te", "te_rec", "reception_te", "te_reception"];
  const bonusKeys = ["bonus_rec_te", "bonus_te_rec", "rec_bonus_te", "te_rec_bonus", "te_premium", "tep"];
  const absolutePremium = absoluteKeys
    .map((key) => asNumber(scoring[key]))
    .filter((value) => Number.isFinite(value))
    .reduce((max, value) => Math.max(max, value - rec), 0);
  const bonusPremium = bonusKeys
    .map((key) => asNumber(scoring[key]))
    .filter((value) => Number.isFinite(value))
    .reduce((max, value) => Math.max(max, value), 0);
  const textPremium = /\btep\b|tight end premium|te premium/.test(String(metadataText ?? "").toLowerCase()) ? 0.5 : 0;
  const premium = Math.max(absolutePremium, bonusPremium, textPremium);
  return {
    isTep: premium > 0,
    premium
  };
}

function resolvePlayerId(entry, index) {
  const explicit = entry.playerId ?? entry.player_id ?? entry.sleeperId ?? entry.sleeper_id;
  if (explicit && index.byId.has(String(explicit))) {
    return String(explicit);
  }

  const name = normalizeName(entry.name ?? entry.player ?? entry.fullName);
  const position = normalizePosition(entry.position);
  const team = normalizeTeam(entry.team);
  return (
    playerIdFromIndex(index.byNamePosition.get(`${name}|${position}`)) ??
    playerIdFromIndex(index.byNameTeam.get(`${name}|${team}`)) ??
    playerIdFromIndex(index.byName.get(name)) ??
    null
  );
}

function playerIdFromIndex(value) {
  if (!value) {
    return null;
  }
  return typeof value === "string" ? value : value.playerId ?? null;
}

function setBestPlayer(map, key, playerId, player) {
  if (!key || key.endsWith("|")) {
    return;
  }
  const current = map.get(key);
  if (!current || playerQuality(player) > playerQuality(current.player)) {
    map.set(key, { playerId, player });
  }
}

function playerQuality(player) {
  const status = String(player.status ?? "").toLowerCase();
  const searchRank = asNumber(player.search_rank) ?? 9999;
  let score = 0;
  if (player.active === true) {
    score += 1000;
  }
  if (status === "active") {
    score += 400;
  }
  if (player.team) {
    score += 250;
  }
  if (player.age && Number(player.age) < 45) {
    score += 80;
  }
  score += Math.max(0, 250 - Math.min(250, searchRank));
  return score;
}

function indexEvidence(evidence, players) {
  const index = new Map();
  const playerIndex = buildPlayerIndex(players);
  const items = Array.isArray(evidence?.items) ? evidence.items : [];

  for (const item of items) {
    const playerId = resolvePlayerId(item, playerIndex);
    if (!playerId) {
      continue;
    }
    const key = String(playerId);
    if (!index.has(key)) {
      index.set(key, []);
    }
    index.get(key).push({
      ...item,
      weight: asNumber(item.weight) ?? 0
    });
  }

  return index;
}

function indexTrends(trends) {
  const index = new Map();
  for (const item of trends.adds ?? []) {
    index.set(String(item.player_id), {
      ...(index.get(String(item.player_id)) ?? {}),
      adds: asNumber(item.count) ?? 0,
      maxAdds: trends.maxAdds ?? 0
    });
  }
  for (const item of trends.drops ?? []) {
    index.set(String(item.player_id), {
      ...(index.get(String(item.player_id)) ?? {}),
      drops: asNumber(item.count) ?? 0,
      maxDrops: trends.maxDrops ?? 0
    });
  }
  return index;
}

function buildDraftedKeys(picks, players) {
  const keys = new Set();
  for (const pick of picks) {
    const player = players[String(pick.player_id)] ?? {};
    const metadata = pick.metadata ?? {};
    const metadataName =
      metadata.player_name ??
      metadata.full_name ??
      metadata.player_full_name ??
      metadata.name ??
      metadata.player ??
      pick.player_name ??
      pick.full_name ??
      pick.name ??
      `${metadata.first_name ?? ""} ${metadata.last_name ?? ""}`.trim();
    const name = metadataName || displayName(player);
    const position = normalizePosition(metadata.position ?? player.position ?? player.fantasy_positions?.[0]);
    const key = rankingKey(name, position);
    if (key) {
      keys.add(key);
    }
    const nameKey = nameOnlyKey(name);
    if (nameKey) {
      keys.add(nameKey);
    }
    const shortKey = initialLastKey(name, position);
    if (shortKey) {
      keys.add(shortKey);
    }
  }
  return keys;
}

function rankingOnlyPlayer(entry) {
  return {
    full_name: entry.name,
    team: entry.team,
    position: entry.position,
    active: true,
    status: "Active",
    search_rank: entry.rank
  };
}

function rankingKey(name, position) {
  const normalizedName = normalizeName(name);
  const normalizedPosition = normalizePosition(position);
  if (!normalizedName || !normalizedPosition) {
    return "";
  }
  return `${normalizedName}|${normalizedPosition}`;
}

function nameOnlyKey(name) {
  const normalizedName = normalizeName(name);
  return normalizedName ? `name:${normalizedName}` : "";
}

function initialLastKey(name, position) {
  const parts = normalizedNameParts(name);
  const normalizedPosition = normalizePosition(position);
  if (parts.length < 2 || !normalizedPosition) {
    return "";
  }
  return `short:${parts[0][0]}:${parts[parts.length - 1]}:${normalizedPosition}`;
}

function groupByPosition(candidates) {
  const groups = new Map();
  for (const candidate of candidates) {
    if (!groups.has(candidate.position)) {
      groups.set(candidate.position, []);
    }
    groups.get(candidate.position).push(candidate);
  }
  for (const group of groups.values()) {
    group.sort((a, b) => a.rankSort - b.rankSort);
  }
  return groups;
}

function applyPositionTierFallbacks(candidates = [], draftContext = {}) {
  const groups = groupByPosition(candidates);
  for (const [position, group] of groups) {
    group.forEach((candidate, index) => {
      const positionRank =
        parsePositionRank(candidate.ranking?.posRank ?? candidate.ranking?.positionRank ?? candidate.ranking?.positionalRank) ??
        asPositiveNumber(candidate.positionRank) ??
        index + 1;
      const manualTier = asPositiveNumber(candidate.positionTier);
      candidate.positionRank = positionRank;
      candidate.tier = manualTier ?? autoPositionTier(position, positionRank, draftContext);
      candidate.positionTier = candidate.tier;
      candidate.positionTierSource = manualTier ? (candidate.positionTierSource === "market" ? "market" : "custom") : "auto";
    });
  }
  return candidates;
}

function autoPositionTier(position, positionRank, draftContext = {}) {
  const rank = Math.max(1, Math.round(asNumber(positionRank) ?? 999));
  const breaks = positionTierBreaks(position, draftContext);
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

function positionTierBreaks(position, draftContext = {}) {
  const isDynasty = draftContext?.isDynasty === true;
  const isSuperflex = draftContext?.isSuperflex === true;
  const isTep = draftContext?.isTep === true;
  if (position === "QB") {
    return isSuperflex
      ? [3, 8, 14, 22, 32, 44, 58]
      : [2, 5, 9, 14, 20, 28, 40];
  }
  if (position === "RB") {
    return isDynasty
      ? [4, 10, 18, 30, 44, 60, 82]
      : [4, 10, 18, 28, 40, 55, 75];
  }
  if (position === "WR") {
    return isDynasty
      ? [6, 15, 28, 44, 62, 84, 112]
      : [6, 14, 26, 42, 60, 82, 110];
  }
  if (position === "TE") {
    if (isTep) {
      return isDynasty
        ? [3, 7, 13, 22, 34, 48, 66]
        : [2, 5, 9, 15, 24, 38, 56];
    }
    return isDynasty
      ? [2, 5, 10, 18, 28, 42, 60]
      : [1, 3, 7, 12, 20, 32, 48];
  }
  if (position === "DEF") {
    return [3, 8, 14, 22, 32];
  }
  return [5, 12, 24, 40, 60, 90];
}

function buildTeamContexts(players = {}) {
  const contexts = new Map();
  for (const [playerId, player] of Object.entries(players ?? {})) {
    const team = normalizeTeam(player.team);
    const position = normalizePosition(player.position ?? player.fantasy_positions?.[0]);
    if (!team || team === "FA" || !["QB", "RB", "WR", "TE"].includes(position)) {
      continue;
    }

    if (!contexts.has(team)) {
      contexts.set(team, {
        team,
        quarterbacks: [],
        runningBacks: [],
        passCatchers: []
      });
    }

    const context = contexts.get(team);
    const item = {
      playerId: String(playerId),
      name: displayName(player),
      position,
      injuryStatus: cleanStatusText(player.injury_status),
      status: cleanStatusText(player.status),
      active: player.active === true,
      searchRank: asNumber(player.search_rank),
      depthChartOrder: asNumber(player.depth_chart_order),
      player
    };

    if (!item.name) {
      continue;
    }
    if (position === "QB") {
      context.quarterbacks.push(item);
    } else if (position === "RB") {
      context.runningBacks.push(item);
    } else {
      context.passCatchers.push(item);
    }
  }

  for (const context of contexts.values()) {
    context.quarterbacks.sort((left, right) => teamContextPlayerScore(right) - teamContextPlayerScore(left));
    context.runningBacks.sort((left, right) => teamContextPlayerScore(right) - teamContextPlayerScore(left));
    context.passCatchers.sort((left, right) => teamContextPlayerScore(right) - teamContextPlayerScore(left));
    context.quarterback = context.quarterbacks[0] ?? null;
    context.qbHealth = describeHealthSignal(context.quarterback, "QB");
  }

  return contexts;
}

function teamContextPlayerScore(item) {
  if (!item) {
    return 0;
  }

  let score = 0;
  if (item.active) {
    score += 900;
  }
  if (String(item.status).toLowerCase() === "active") {
    score += 250;
  }
  if (!isNegativeHealthFlag(item.injuryStatus)) {
    score += 150;
  }
  if (item.depthChartOrder) {
    score += Math.max(0, 90 - item.depthChartOrder * 12);
  }
  if (item.searchRank) {
    score += Math.max(0, 700 - Math.min(700, item.searchRank));
  }
  return score;
}

function summarizePlayerContext(candidate, teamContext, production = null) {
  const quarterback = teamContext?.quarterback ?? null;
  return {
    team: candidate.team || "",
    quarterbackName: quarterback?.name ?? "",
    quarterbackStatus: quarterback?.status ?? "",
    quarterbackInjuryStatus: quarterback?.injuryStatus ?? "",
    quarterbackHealth: hasNegativeHealthFlag(quarterback) ? teamContext?.qbHealth ?? "" : "",
    teammateContext: "",
    projectedPpg: production?.projectedPpg ?? null,
    ceilingPpg: production?.ceilingPpg ?? null,
    lastYearPpg: production?.lastYearPpg ?? null
  };
}

function describeTeamEnvironment(candidate, teamContext) {
  const team = candidate.team || teamContext?.team || "";
  if (!team || !teamContext) {
    return "";
  }

  const quarterback = teamContext.quarterback;
  const qbText = quarterback && hasNegativeHealthFlag(quarterback) ? `QB ${quarterback.name}: ${ensureSentence(teamContext.qbHealth)}` : "";
  const ownHealth = describeOwnHealth(candidate);

  if (candidate.position === "WR" || candidate.position === "TE") {
    const roleWord = candidate.position === "TE" ? "middle-of-field/TD usage" : "target quality and catchable volume";
    return compactSentence(
      `Team context: ${candidate.name} is tied to ${team}'s passing setup.`,
      qbText,
      `${ownHealth}`,
      `That matters because ${roleWord} can swing quickly when play volume, tempo, or offensive efficiency changes.`
    );
  }

  if (candidate.position === "RB") {
    return compactSentence(
      `Team context: ${candidate.name}'s rushing and TD ceiling is connected to ${team}'s offensive efficiency.`,
      qbText,
      `${ownHealth}`,
      "Better drive quality usually supports more red-zone chances and touchdown opportunity."
    );
  }

  if (candidate.position === "QB") {
    return compactSentence(
      `Team context: ${candidate.name} is the offense bet for ${team}.`,
      `${ownHealth}`,
      "For QB picks, the key is whether his weekly ceiling beats the RB/WR values still available at this turn."
    );
  }

  return "";
}

function describeOwnHealth(candidate) {
  const injury = cleanStatusText(candidate.player?.injury_status);
  const status = cleanStatusText(candidate.player?.status);
  if (isNegativeHealthFlag(injury) || isNegativeHealthFlag(status)) {
    const label = injury || status;
    return `${candidate.name} has a ${label} flag in the loaded player data, so the value needs a discount unless current news has cleared it.`;
  }
  if (status && status.toLowerCase() !== "active") {
    return `${candidate.name}'s loaded status is ${status}, so confirm his role before treating him as a clean pick.`;
  }
  return "";
}

function describeHealthSignal(item, label = "player") {
  if (!item) {
    return `no ${label} profile was available in the loaded Sleeper player data`;
  }

  const injury = cleanStatusText(item.injuryStatus);
  const status = cleanStatusText(item.status);
  if (isNegativeHealthFlag(injury) || isNegativeHealthFlag(status)) {
    const flag = injury || status;
    return `${flag} is showing in the loaded player data, which adds volatility`;
  }
  if (status && status.toLowerCase() !== "active") {
    return `status is ${status}, so treat the team environment as less certain`;
  }
  return "no Sleeper injury flag is loaded, which is a positive efficiency signal";
}

function describeTeammateContext(candidate, teamContext) {
  return "";
}

function teammateContextNames(candidate, teamContext) {
  if (!teamContext) {
    return [];
  }
  const pool = candidate.position === "RB" ? teamContext.runningBacks : teamContext.passCatchers;
  const candidateName = normalizeName(candidate.name);
  return (pool ?? [])
    .filter((item) => normalizeName(item.name) !== candidateName)
    .slice(0, 2)
    .map((item) => `${item.name} (${item.position})`);
}

function compactSentence(...parts) {
  return parts.map((part) => String(part ?? "").trim()).filter(Boolean).join(" ");
}

function playerExperiencePhrase(candidate) {
  const years = asNumber(candidate.player?.years_exp);
  const age = asNumber(candidate.player?.age);
  const college = firstNonBlank(candidate.player?.college, candidate.player?.metadata?.college);
  if (years === 0) {
    return college ? `Rookie profile from ${college}, so the range of outcomes is wider than a settled veteran role.` : "Rookie profile, so the range of outcomes is wider than a settled veteran role.";
  }
  if (years === 1) {
    return "Second-year profile, so the bet is role growth plus talent development rather than a fully proven workload.";
  }
  if (years && years >= 8) {
    return age ? `Veteran profile at age ${age}, so weigh proven role against durability and decline risk.` : "Veteran profile, so weigh proven role against durability and decline risk.";
  }
  if (age && age <= 24) {
    return `Young player profile at age ${age}, which keeps growth/upside in the range of outcomes.`;
  }
  return "";
}

function playerDepthChartPhrase(candidate) {
  return "";
}

function dedupeReasons(reasons) {
  const seen = new Set();
  const result = [];
  for (const reason of reasons) {
    const text = String(reason ?? "").trim();
    if (!text) {
      continue;
    }
    const key = text
      .toLowerCase()
      .replace(/^(draft call|team context|build impact|board check|value check|player profile|tier pressure|market signal|added context|score|player rating|pick grade):\s*/i, "")
      .replace(/\d+/g, "#")
      .slice(0, 120);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(text);
  }
  return result;
}

function dedupePlainReasons(reasons) {
  const seen = new Set();
  const result = [];
  for (const reason of reasons) {
    const text = String(reason ?? "").trim();
    if (!text) {
      continue;
    }
    const key = text.toLowerCase().replace(/\d+/g, "#");
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(text);
  }
  return result;
}

function ensureSentence(value) {
  const text = String(value ?? "").trim();
  if (!text) {
    return "";
  }
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function formatContextList(values) {
  if (values.length <= 1) {
    return values[0] ?? "";
  }
  return values.length === 2 ? `${values[0]} and ${values[1]}` : `${values.slice(0, -1).join(", ")}, and ${values[values.length - 1]}`;
}

function cleanStatusText(value) {
  const text = String(value ?? "").trim();
  return text && text.toLowerCase() !== "null" && text.toLowerCase() !== "undefined" ? text : "";
}

function firstNonBlank(...values) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) {
      return text;
    }
  }
  return "";
}

function isNegativeHealthFlag(value) {
  return /\bout\b|\bir\b|injured reserve|doubtful|questionable|pup|nfi|suspend|covid|limited/i.test(String(value ?? ""));
}

function hasNegativeHealthFlag(item) {
  if (!item) {
    return false;
  }
  if (typeof item === "string") {
    return isNegativeHealthFlag(item);
  }
  return [
    item.injuryStatus,
    item.injury_status,
    item.status,
    item.player?.injury_status,
    item.player?.status
  ].some((value) => isNegativeHealthFlag(value));
}

function scoreNeed(position, counts, slots, currentPick, rosterPickCount = 0, draftContext = {}) {
  const baseGap = Math.max(0, (slots[position] ?? 0) - (counts[position] ?? 0));
  const isSuperflex = draftContext?.isSuperflex === true || (slots.SUPER_FLEX ?? 0) > 0;
  const qbStarterWeight = position === "QB" && !isSuperflex ? (draftContext?.isDynasty ? 6 : 3) : 24;
  let score = baseGap * qbStarterWeight;
  const imbalance = rosterImbalance(position, counts, slots, rosterPickCount);
  score += imbalance;

  if (position === "QB" && isSuperflex) {
    const target = slots.QB + slots.SUPER_FLEX;
    const qbNeedWeight = draftContext?.isDynasty ? 7 : 8;
    score += Math.max(0, target - counts.QB) * qbNeedWeight;
  }

  if (FLEX_POSITIONS.has(position)) {
    const flexEligible = counts.RB + counts.WR + counts.TE;
    const target = slots.RB + slots.WR + slots.TE + slots.FLEX;
    score += Math.max(0, target - flexEligible) * 8;
  }

  if (REC_FLEX_POSITIONS.has(position)) {
    const recEligible = counts.WR + counts.TE;
    const target = slots.WR + slots.TE + slots.REC_FLEX;
    score += Math.max(0, target - recEligible) * 5;
  }

  if (baseGap <= 0 && ["RB", "WR"].includes(position) && currentPick > 80) {
    score += 6;
  }

  if (position === "TE" && counts.TE === 0 && currentPick <= 90) {
    score += 6;
  }
  if (position === "TE" && draftContext?.isTep) {
    const premiumBoost = clamp((asNumber(draftContext.tePremium) ?? 0.5) * 12, 4, 10);
    score += counts.TE === 0 ? premiumBoost + 6 : premiumBoost * 0.35;
  }

  return clamp(score, -36, 72);
}

function scoreFormatBuild(candidate, counts, slots, currentPick, rosterPickCount, draftContext = {}, settings = {}, valueRank = null, draftSim = null) {
  const teams = numberSetting(settings.teams) || 12;
  const round = Math.max(1, Math.ceil(currentPick / teams));
  const isSuperflex = draftContext?.isSuperflex === true || (slots.SUPER_FLEX ?? 0) > 0;
  const isDynasty = draftContext?.isDynasty === true;
  const qbCount = counts.QB ?? 0;
  const position = candidate.position;
  const youngQbMarket = superflexDynastyYoungQbAdpContext(candidate, currentPick, valueRank, draftContext, draftSim);
  let score = 0;

  if (isSuperflex) {
    if (position === "QB") {
      if (isDynasty) {
        const age = asNumber(candidate.player?.age);
        const boardRank = asNumber(candidate.valueRankSort ?? candidate.rankSort);
        const youngCoreQb = age && age <= 28 && boardRank && boardRank <= 36;
        if (youngCoreQb && round <= 4) {
          score += round <= 2 ? 6 : 4;
        }
        if (youngQbMarket.aroundAdp && qbCount <= 1) {
          score += qbCount === 0 ? Math.min(5, youngQbMarket.premium) : Math.min(3, youngQbMarket.premium);
        } else if (youngQbMarket.tooEarly) {
          score -= 3;
        }
        if (qbCount === 0) {
          score += round <= 2 ? 4 : round <= 5 ? 2 : 0;
        } else if (qbCount === 1) {
          score += youngCoreQb && round <= 6 ? 3 : round <= 6 ? 1 : 0;
        } else {
          score -= round <= 8 ? 6 : 3;
        }
      } else if (qbCount === 0) {
        score += round <= 2 ? 3 : round <= 4 ? 2 : 1;
      } else if (qbCount === 1) {
        score += round <= 4 ? 2 : round <= 7 ? 1 : 0;
      } else {
        score -= round <= 6 ? 6 : 3;
      }
    } else {
      if (qbCount === 0 && round <= 2) {
        score -= position === "TE" ? 2 : 0;
      } else if (qbCount === 0 && round <= 4) {
        score -= position === "TE" ? 1 : 0;
      } else if (qbCount === 1 && position === "TE" && round <= 4) {
        score -= 1;
      }

      if (position === "TE" && round <= 2) {
        score -= candidate.rankSort <= 6 ? 0 : 1;
      }
    }
  } else if (position === "QB") {
    if (qbCount >= 1 && round <= 9) {
      score -= 18;
    } else if (qbCount === 0 && !isDynasty) {
      if (round <= 4) {
        score -= 14;
      } else if (round <= 5) {
        score -= 9;
      } else if (round <= 6) {
        score -= 4;
      } else if (round >= 8 && round <= 11) {
        score += 4;
      }
    } else if (qbCount === 0 && round >= 9 && round <= 13) {
      score += 3;
    }
  }

  if (position === "TE" && (counts.TE ?? 0) >= 1 && rosterPickCount < 10) {
    score -= draftContext?.isTep ? 8 : 12;
  }

  if (isDynasty && position === "TE") {
    const age = asNumber(candidate.player?.age);
    if (age >= 30) {
      score -= age >= 33 ? 7 : age >= 31 ? 5 : 3;
    }
  }

  if (position === "TE" && draftContext?.isTep) {
    if ((counts.TE ?? 0) === 0) {
      score += round <= 4 ? 4 : round <= 8 ? 3 : 1;
    } else if ((counts.TE ?? 0) === 1 && round >= 8 && rosterPickCount >= 8) {
      score += 1;
    }
  }

  const highCap = youngQbMarket.aroundAdp && (qbCount ?? 0) <= 1 ? 12 : 8;
  return clamp(score, -8, highCap);
}

function rosterImbalance(position, counts, slots, rosterPickCount) {
  if (!rosterPickCount) {
    return 0;
  }

  const rb = counts.RB ?? 0;
  const wr = counts.WR ?? 0;
  const te = counts.TE ?? 0;
  const qb = counts.QB ?? 0;
  const flexNeed = Math.max(1, (slots.RB ?? 0) + (slots.WR ?? 0) + (slots.FLEX ?? 0) + (slots.REC_FLEX ?? 0));
  const rbTarget = Math.max(slots.RB ?? 0, Math.round(flexNeed * 0.45));
  const wrTarget = Math.max(slots.WR ?? 0, Math.round(flexNeed * 0.55));
  let score = 0;

  if (position === "RB") {
    score += clamp((rbTarget - rb) * 13, -18, 34);
    if (wr - rb >= 2) score += 18;
    if (wr >= 4 && rb <= 2) score += 18;
    if (rb === 0 && rosterPickCount >= 2) score += 22;
  }

  if (position === "WR") {
    score += clamp((wrTarget - wr) * 10, -20, 28);
    if (rb - wr >= 2) score += 14;
    if (wr >= 4 && rb <= 2) score -= 28;
    if (wr >= 5) score -= 34;
  }

  if (position === "TE") {
    if (te === 0) score += rosterPickCount >= 4 ? 12 : 5;
    if (te >= 1) score -= 18;
    if (te >= 2) score -= 26;
  }

  if (position === "QB") {
    const qbTarget = (slots.SUPER_FLEX ?? 0) > 0 ? 2 : 1;
    if (qb < qbTarget) score += rosterPickCount >= 5 ? 12 : 4;
    if (qb >= qbTarget) score -= (slots.SUPER_FLEX ?? 0) > 0 ? 8 : 22;
  }

  if (position === "DEF") {
    score -= rosterPickCount < 12 ? 30 : 10;
  }

  return score;
}

function scoreScarcity(candidate, byPosition, tierPressure = null, draftContext = {}, currentPick = null, valueRank = null) {
  const group = byPosition.get(candidate.position) ?? [];
  const index = group.findIndex((item) => item.playerId === candidate.playerId);
  const next = group[index + 1];
  const pressure = tierPressure ?? analyzePositionTierPressure(candidate, byPosition, null, null, null);
  let score = 3;
  if (!next) {
    score = pressure?.waitTierGap >= 1 ? 18 : 6;
  } else {
    const rankGap = pressure?.immediateRankGap ?? (next.rankSort - candidate.rankSort);
    const tierGap = pressure?.immediateTierGap ?? (candidate.tier && next.tier ? Math.max(0, next.tier - candidate.tier) : 0);
    const waitTierGap = Math.max(pressure?.waitTierGap ?? 0, pressure?.roomWaitTierGap ?? 0);
    const waitRankGap = Math.max(pressure?.waitRankGap ?? 0, pressure?.roomWaitRankGap ?? 0);
    const sameTierSurvives = ((pressure?.sameTierAfterWindow ?? 0) + (pressure?.sameTierLikelyAfterWindow ?? 0)) > 0;

    if (waitTierGap >= 2 || waitRankGap >= 40 || tierGap >= 3) {
      score = 32;
    } else if (waitTierGap >= 1 && !sameTierSurvives) {
      score = 28;
    } else if (tierGap >= 2 || rankGap >= 28 || waitRankGap >= 30) {
      score = 24;
    } else if (tierGap >= 1 || rankGap >= 16 || waitRankGap >= 20) {
      score = 18;
    } else if (rankGap >= 9) {
      score = 10;
    }
  }
  if (candidate.position === "TE" && draftContext?.isTep) {
    score += (pressure?.waitTierGap ?? 0) >= 1 || (pressure?.roomWaitTierGap ?? 0) >= 1 ? 6 : 3;
  }
  return adjustScarcityForAdp(candidate, score, currentPick, valueRank, draftContext);
}

function adjustScarcityForAdp(candidate, scarcity, currentPick = null, valueRank = null, draftContext = {}) {
  if (candidate.position !== "QB") {
    return scarcity;
  }

  const marketRank = asNumber(candidate.platformRank ?? valueRank ?? candidate.ranking?.averageRank ?? candidate.ranking?.avgRank ?? candidate.ranking?.adp);
  if (!marketRank) {
    return Math.min(scarcity, draftContext?.isSuperflex ? 14 : 10);
  }

  const pick = asNumber(currentPick) ?? marketRank;
  const priceGap = pick - marketRank;
  let cap = draftContext?.isSuperflex ? 16 : 10;
  if (priceGap < -24) {
    cap = draftContext?.isSuperflex ? 4 : 2;
  } else if (priceGap < -16) {
    cap = draftContext?.isSuperflex ? 6 : 3;
  } else if (priceGap < -10) {
    cap = draftContext?.isSuperflex ? 8 : 5;
  } else if (priceGap < -4) {
    cap = draftContext?.isSuperflex ? 11 : 7;
  } else if (priceGap < 2) {
    cap = draftContext?.isSuperflex ? 14 : 9;
  } else if (priceGap >= 8) {
    cap = draftContext?.isSuperflex ? 22 : 16;
  }

  if (marketRank <= 4 && priceGap >= -2) {
    cap = Math.max(cap, 20);
  }
  return Math.min(scarcity, cap);
}

function analyzePositionTierPressure(candidate, byPosition, currentPick = null, draft = null, roster = null) {
  const group = byPosition?.get(candidate.position) ?? [];
  const index = group.findIndex((item) => item.playerId === candidate.playerId);
  if (index < 0) {
    return null;
  }

  const next = group[index + 1] ?? null;
  const currentTier = asPositiveNumber(candidate.tier);
  const nextTier = asPositiveNumber(next?.tier);
  const immediateRankGap = next ? Math.max(0, (asNumber(next.rankSort) ?? 0) - (asNumber(candidate.rankSort) ?? 0)) : 0;
  const immediateTierGap = currentTier && nextTier ? Math.max(0, nextTier - currentTier) : 0;
  const nextPickNumber = estimateNextRosterPickNumber(draft, currentPick, roster?.rosterId);
  const windowPick = asNumber(nextPickNumber) ?? ((asNumber(currentPick) ?? asNumber(candidate.rankSort) ?? 0) + numberSetting(draft?.settings?.teams || 12));
  const projectedNext = group
    .slice(index + 1)
    .find((item) => (asNumber(item.rankSort) ?? 999) >= windowPick) ?? group[group.length - 1] ?? null;
  const projectedTier = asPositiveNumber(projectedNext?.tier);
  const waitTierGap = currentTier && projectedTier ? Math.max(0, projectedTier - currentTier) : 0;
  const waitRankGap = projectedNext
    ? Math.max(0, (asNumber(projectedNext.rankSort) ?? 0) - (asNumber(candidate.rankSort) ?? 0))
    : 0;
  const roomProjectedNext = group
    .filter((item) => item.playerId !== candidate.playerId)
    .sort((left, right) => roomDraftRankForCandidate(left) - roomDraftRankForCandidate(right) || left.rankSort - right.rankSort)
    .find((item) => roomDraftRankForCandidate(item) >= windowPick) ?? group[group.length - 1] ?? null;
  const roomProjectedTier = asPositiveNumber(roomProjectedNext?.tier);
  const roomWaitTierGap = currentTier && roomProjectedTier ? Math.max(0, roomProjectedTier - currentTier) : 0;
  const roomWaitRankGap = roomProjectedNext
    ? Math.max(0, (asNumber(roomProjectedNext.rankSort) ?? 0) - (asNumber(candidate.rankSort) ?? 0))
    : 0;
  const sameTierAfterWindow = currentTier
    ? group
      .slice(index + 1)
      .filter((item) => asPositiveNumber(item.tier) === currentTier && (asNumber(item.rankSort) ?? 999) >= windowPick).length
    : 0;
  const sameTierLikelyAfterWindow = currentTier
    ? group
      .filter((item) => item.playerId !== candidate.playerId && asPositiveNumber(item.tier) === currentTier && roomDraftRankForCandidate(item) >= windowPick).length
    : 0;
  const sameTierBeforeWindow = currentTier
    ? group
      .slice(index + 1)
      .filter((item) => asPositiveNumber(item.tier) === currentTier && (asNumber(item.rankSort) ?? 999) < windowPick).length
    : 0;
  const sameTierLikelyBeforeWindow = currentTier
    ? group
      .filter((item) => item.playerId !== candidate.playerId && asPositiveNumber(item.tier) === currentTier && roomDraftRankForCandidate(item) < windowPick).length
    : 0;
  const remainingInTier = currentTier
    ? group.slice(index).filter((item) => asPositiveNumber(item.tier) === currentTier).length
    : 0;

  return {
    currentTier,
    next,
    nextTier,
    immediateRankGap,
    immediateTierGap,
    nextPickNumber,
    projectedNext,
    projectedTier,
    waitTierGap,
    waitRankGap,
    roomProjectedNext,
    roomProjectedTier,
    roomWaitTierGap,
    roomWaitRankGap,
    sameTierAfterWindow,
    sameTierLikelyAfterWindow,
    sameTierBeforeWindow,
    sameTierLikelyBeforeWindow,
    remainingInTier
  };
}

function scoreMarket(trend) {
  const addScore = trend.maxAdds ? (trend.adds ?? 0) / trend.maxAdds * 12 : 0;
  const dropPenalty = trend.maxDrops ? (trend.drops ?? 0) / trend.maxDrops * 10 : 0;
  return clamp(addScore - dropPenalty, -10, 12);
}

function scoreEvidence(items) {
  return clamp(
    items.reduce((total, item) => {
      const direction = item.sentiment === "negative" ? -1 : 1;
      return total + direction * (item.weight ?? 0) * 4;
    }, 0),
    -16,
    18
  );
}

function scoreAgeValue(candidate, draftContext = {}) {
  const age = asNumber(candidate.player?.age);
  const position = candidate.position;
  const isDynasty = draftContext?.isDynasty === true;
  const isSuperflex = draftContext?.isSuperflex === true;
  if (!isDynasty) {
    return 0;
  }
  if (!age) {
    return position === "QB" ? (isSuperflex ? 5 : 3) : 3;
  }

  if (position === "RB") {
    if (age <= 23) return 8;
    if (age === 24) return 7;
    if (age === 25) return 6;
    if (age === 26) return 4;
    if (age === 27) return 2;
    return 0;
  }
  if (position === "WR") {
    if (age <= 24) return 8;
    if (age <= 26) return 7;
    if (age <= 28) return 6;
    if (age === 29) return 4;
    if (age <= 31) return 2;
    return 0;
  }
  if (position === "TE") {
    if (age <= 24) return 8;
    if (age <= 26) return 6;
    if (age <= 28) return 3;
    if (age === 29) return 1;
    if (age === 30) return -2;
    if (age === 31) return -4;
    if (age === 32) return -6;
    return -8;
  }
  if (position === "QB") {
    if (isSuperflex) {
      if (age <= 25) return 10;
      if (age <= 28) return 9;
      if (age <= 31) return 7;
      if (age <= 34) return 4;
      if (age <= 37) return 2;
      return -1;
    }
    if (age <= 27) return 6;
    if (age <= 31) return 4;
    if (age <= 34) return 2;
    if (age <= 37) return 1;
    return 1;
  }
  return 4;
}

function scoreRisk(player) {
  const injury = String(player.injury_status ?? "").toLowerCase();
  const status = String(player.status ?? "").toLowerCase();

  if (injury.includes("out") || injury.includes("ir") || status.includes("injured reserve")) {
    return 36;
  }
  if (injury.includes("doubtful") || status.includes("pup")) {
    return 24;
  }
  if (injury.includes("questionable") || injury.includes("limited")) {
    return 10;
  }
  if (status && !["active", ""].includes(status)) {
    return 7;
  }
  return 0;
}

function scoreSpecialTeamsTiming(position, settings, currentPick) {
  if (position !== "DEF") {
    return 0;
  }

  const teams = numberSetting(settings.teams) || 12;
  const rounds = numberSetting(settings.rounds) || 15;
  const totalPicks = teams * rounds;
  const finalTwoRounds = Math.max(1, totalPicks - teams * 2);
  return currentPick < finalTwoRounds ? 30 : 6;
}

function buildProductionSnapshot(candidate, seasonStats = {}, statsSeason = null, scoringSettings = {}) {
  const rawStats = getStatsForCandidate(candidate, seasonStats);
  const scoring = normalizeScoringSettings(scoringSettings);
  const hasStats = rawStats && Object.keys(rawStats).length > 0;
  const lastYearPoints = hasStats ? fantasyPointsFromStats(rawStats, scoring) : null;
  const games = hasStats ? statValue(rawStats, ["gp", "games", "games_played", "g"]) || inferGames(rawStats) : null;
  const projectedTotal = projectedSeasonPoints(candidate, scoring, rawStats);
  const projectedPpg = projectedTotal ? round1(projectedTotal / 17) : null;
  const ceilingPpg = projectedPpg ? round1(projectedPpg + ceilingLift(candidate, rawStats)) : null;

  return {
    season: statsSeason,
    statsAvailable: Object.keys(seasonStats ?? {}).length > 0,
    hasLastYearStats: Boolean(hasStats),
    lastYearPoints: Number.isFinite(lastYearPoints) ? round1(lastYearPoints) : null,
    lastYearPpg: Number.isFinite(lastYearPoints) && games ? round1(lastYearPoints / games) : null,
    games: games || null,
    projectedTotal: projectedTotal ? Math.round(projectedTotal) : null,
    projectedPpg,
    projectionSource: projectionSource(candidate),
    ceilingPpg,
    ceilingTotal: ceilingPpg ? Math.round(ceilingPpg * 17) : null,
    statLine: hasStats ? summarizeStatLine(candidate.position, rawStats) : "",
    rawStats: hasStats ? rawStats : null
  };
}

function getStatsForCandidate(candidate, seasonStats = {}) {
  const ids = [
    candidate.realPlayerId,
    candidate.playerId,
    candidate.ranking?.playerId,
    candidate.ranking?.player_id,
    candidate.ranking?.sleeperId,
    candidate.ranking?.sleeper_id
  ]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);

  for (const id of ids) {
    const item = seasonStats?.[id];
    if (item) {
      return item.stats ?? item;
    }
  }
  return null;
}

function normalizeScoringSettings(settings = {}) {
  const rec = asNumber(settings.rec ?? settings.reception ?? settings.rec_0p5) ?? 1;
  return {
    pass_yd: asNumber(settings.pass_yd) ?? 0.04,
    pass_td: asNumber(settings.pass_td) ?? 4,
    pass_int: asNumber(settings.pass_int) ?? -1,
    rush_yd: asNumber(settings.rush_yd) ?? 0.1,
    rush_td: asNumber(settings.rush_td) ?? 6,
    rec,
    rec_yd: asNumber(settings.rec_yd) ?? 0.1,
    rec_td: asNumber(settings.rec_td) ?? 6,
    fum_lost: asNumber(settings.fum_lost) ?? -2,
    two_pt: asNumber(settings.two_pt) ?? 2
  };
}

function fantasyPointsFromStats(stats = {}, scoring) {
  return (
    statValue(stats, ["pass_yd", "pass_yds", "passing_yd", "passing_yards"]) * scoring.pass_yd +
    statValue(stats, ["pass_td", "passing_td", "passing_tds"]) * scoring.pass_td +
    statValue(stats, ["pass_int", "int", "ints"]) * scoring.pass_int +
    statValue(stats, ["rush_yd", "rush_yds", "rushing_yd", "rushing_yards"]) * scoring.rush_yd +
    statValue(stats, ["rush_td", "rushing_td", "rushing_tds"]) * scoring.rush_td +
    statValue(stats, ["rec", "receptions"]) * scoring.rec +
    statValue(stats, ["rec_yd", "rec_yds", "receiving_yd", "receiving_yards"]) * scoring.rec_yd +
    statValue(stats, ["rec_td", "receiving_td", "receiving_tds"]) * scoring.rec_td +
    statValue(stats, ["fum_lost", "fumbles_lost"]) * scoring.fum_lost +
    statValue(stats, ["pass_2pt", "rush_2pt", "rec_2pt"]) * scoring.two_pt
  );
}

function projectedSeasonPoints(candidate, scoring, stats = null) {
  const explicit =
    asNumber(candidate.ranking?.projection) ??
    asNumber(candidate.ranking?.projectedPoints) ??
    asNumber(candidate.ranking?.projected_points) ??
    asNumber(candidate.ranking?.fantasyPoints) ??
    asNumber(candidate.ranking?.fantasy_points);
  if (explicit) {
    return explicit;
  }

  const explicitPpg =
    asNumber(candidate.ranking?.projectedPpg) ??
    asNumber(candidate.ranking?.projected_ppg) ??
    asNumber(candidate.ranking?.ppg);
  if (explicitPpg) {
    return explicitPpg * 17;
  }

  const rankProjection = projectionFromRank(candidate, scoring);
  if (stats) {
    const games = statValue(stats, ["gp", "games", "games_played", "g"]) || inferGames(stats);
    const lastYearPoints = fantasyPointsFromStats(stats, scoring);
    if (games && lastYearPoints > 0) {
      const lastYearPace = lastYearPoints / games * 17;
      return rankProjection * 0.72 + lastYearPace * 0.28;
    }
  }

  return rankProjection;
}

function projectionSource(candidate) {
  if (
    asNumber(candidate.ranking?.projection) ||
    asNumber(candidate.ranking?.projectedPoints) ||
    asNumber(candidate.ranking?.projected_points) ||
    asNumber(candidate.ranking?.fantasyPoints) ||
    asNumber(candidate.ranking?.fantasy_points) ||
    asNumber(candidate.ranking?.projectedPpg) ||
    asNumber(candidate.ranking?.projected_ppg)
  ) {
    return "board";
  }
  return "rank-estimate";
}

function projectionFromRank(candidate, scoring) {
  const posRank = parsePositionRank(candidate.ranking?.posRank) ?? positionRankEstimate(candidate);
  const recFactor = candidate.position === "WR" || candidate.position === "TE"
    ? 0.88 + Math.min(1.1, Math.max(0.75, scoring.rec)) * 0.14
    : candidate.position === "RB"
      ? 0.93 + Math.min(1.1, Math.max(0.5, scoring.rec)) * 0.07
      : 1;
  const projection = interpolateProjection(candidate.position, posRank) * recFactor;
  return Math.max(35, projection);
}

function interpolateProjection(position, posRank = 60) {
  const curves = {
    QB: [
      [1, 390], [6, 340], [12, 295], [18, 250], [28, 190], [40, 120]
    ],
    RB: [
      [1, 315], [6, 270], [12, 230], [24, 180], [36, 135], [55, 90], [80, 55]
    ],
    WR: [
      [1, 330], [6, 285], [12, 245], [24, 205], [36, 170], [55, 125], [80, 80]
    ],
    TE: [
      [1, 245], [6, 175], [12, 135], [20, 105], [32, 75], [45, 45]
    ],
    DEF: [
      [1, 155], [12, 115], [24, 90], [32, 70]
    ]
  };
  const curve = curves[position] ?? curves.WR;
  if (posRank <= curve[0][0]) {
    return curve[0][1];
  }
  for (let index = 1; index < curve.length; index += 1) {
    const [rank, points] = curve[index];
    const [previousRank, previousPoints] = curve[index - 1];
    if (posRank <= rank) {
      const percent = (posRank - previousRank) / Math.max(1, rank - previousRank);
      return previousPoints + (points - previousPoints) * percent;
    }
  }
  return curve[curve.length - 1][1];
}

function ceilingLift(candidate, stats = null) {
  const rank = candidate.rankSort;
  const years = asNumber(candidate.player?.years_exp);
  const age = asNumber(candidate.player?.age);
  let lift = 1.4;
  if (rank <= 12) lift += 4.2;
  else if (rank <= 30) lift += 3.2;
  else if (rank <= 70) lift += 2.2;
  if (years === 0 || years === 1) lift += 0.9;
  if (age && age <= 24) lift += 0.6;
  if (candidate.position === "QB") lift += 1.2;
  if (candidate.position === "TE" && rank <= 80) lift += 0.7;
  if (stats && statValue(stats, ["gp", "games", "games_played", "g"]) < 12) lift += 0.4;
  return clamp(lift, 1.3, candidate.position === "QB" ? 8.5 : 7.2);
}

function summarizeStatLine(position, stats = {}) {
  if (position === "QB") {
    return compactStatParts([
      statPair(stats, ["pass_yd", "pass_yds", "passing_yards"], "pass yds"),
      statPair(stats, ["pass_td", "passing_td", "passing_tds"], "pass TD"),
      statPair(stats, ["pass_int", "int", "ints"], "INT"),
      statPair(stats, ["rush_yd", "rush_yds", "rushing_yards"], "rush yds"),
      statPair(stats, ["rush_td", "rushing_td", "rushing_tds"], "rush TD")
    ]);
  }
  if (position === "RB") {
    return compactStatParts([
      statPair(stats, ["rush_att", "carries", "rushing_att"], "carries"),
      statPair(stats, ["rush_yd", "rush_yds", "rushing_yards"], "rush yds"),
      statPair(stats, ["rush_td", "rushing_td", "rushing_tds"], "rush TD"),
      statPair(stats, ["rec", "receptions"], "rec"),
      statPair(stats, ["rec_yd", "rec_yds", "receiving_yards"], "rec yds")
    ]);
  }
  if (position === "WR" || position === "TE") {
    return compactStatParts([
      statPair(stats, ["rec", "receptions"], "rec"),
      statPair(stats, ["rec_yd", "rec_yds", "receiving_yards"], "rec yds"),
      statPair(stats, ["rec_td", "receiving_td", "receiving_tds"], "rec TD"),
      statPair(stats, ["targets", "tgt"], "targets")
    ]);
  }
  return "";
}

function statPair(stats, keys, label) {
  const value = statValue(stats, keys);
  return value ? `${Math.round(value)} ${label}` : "";
}

function compactStatParts(parts) {
  return parts.filter(Boolean).slice(0, 5).join(", ");
}

function statValue(stats = {}, keys = []) {
  if (!Array.isArray(keys)) {
    return asNumber(stats[keys]) ?? 0;
  }
  if (keys.length > 1 && keys.every((key) => key.includes("_2pt"))) {
    return keys.reduce((total, key) => total + (asNumber(stats[key]) ?? 0), 0);
  }
  for (const key of keys) {
    const value = asNumber(stats[key]);
    if (Number.isFinite(value)) {
      return value;
    }
  }
  return 0;
}

function inferGames(stats = {}) {
  const starts = statValue(stats, ["gs", "games_started"]);
  const snaps = statValue(stats, ["off_snp", "off_snaps"]);
  if (starts) {
    return Math.min(17, Math.max(1, starts));
  }
  if (snaps) {
    return Math.min(17, Math.max(1, Math.round(snaps / 40)));
  }
  return null;
}

function parsePositionRank(value) {
  const match = String(value ?? "").match(/\d+/);
  return match ? Number(match[0]) : null;
}

function positionRankLabel(candidate) {
  if (!candidate) {
    return "";
  }
  const raw = firstNonBlank(candidate.ranking?.posRank, candidate.ranking?.positionRank, candidate.ranking?.positionalRank);
  if (raw) {
    return String(raw).toUpperCase();
  }
  const rank = asPositiveNumber(candidate.positionRank);
  return rank ? `${candidate.position}${Math.round(rank)}` : "";
}

function positionRankEstimate(candidate) {
  const rank = asNumber(candidate.rankSort) ?? 999;
  const multipliers = {
    QB: 0.42,
    RB: 0.44,
    WR: 0.56,
    TE: 0.28,
    DEF: 0.15
  };
  return Math.max(1, Math.round(rank * (multipliers[candidate.position] ?? 0.5)));
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

function buildSkipPlan(candidate, available = [], draftSimulation = null, playerRating = null) {
  const candidateRating = finiteNumber(playerRating) ?? buildPlayerRating(candidate);
  const candidateProjection = estimatedProjectedPpg(candidate, candidateRating);
  const samePosition = [...(available ?? [])]
    .filter((item) => item?.playerId !== candidate.playerId && item.position === candidate.position)
    .sort((left, right) => {
      const leftSim = draftSimulation?.players?.get(left.playerId);
      const rightSim = draftSimulation?.players?.get(right.playerId);
      const leftRank = roomDraftRankForCandidate(left);
      const rightRank = roomDraftRankForCandidate(right);
      return leftRank - rightRank || (rightSim?.availableNextPct ?? 0) - (leftSim?.availableNextPct ?? 0) || left.rankSort - right.rankSort;
    });
  const alternatives = samePosition
    .map((item, index) => {
      const sim = draftSimulation?.players?.get(item.playerId);
      const rating = buildPlayerRating(item);
      const probability = sim?.availableNextPct ?? fallbackAvailabilityPct(item, draftSimulation, index);
      return {
        name: item.name,
        position: item.position,
        team: item.team ?? "",
        probability: clamp(Math.round(probability), 1, 99),
        rating,
        projectedPpg: estimatedProjectedPpg(item, rating),
        tier: item.tier ?? null,
        rank: asNumber(item.rankSort) ?? null
      };
    })
    .filter((item) => item.name)
    .sort((left, right) => right.probability - left.probability || right.rating - left.rating)
    .slice(0, 3);
  const averageRating = averageNumber(alternatives.map((item) => item.rating));
  const averageProjectedPpg = averageNumber(alternatives.map((item) => item.projectedPpg));
  const expectedValue = alternatives.length
    ? round1(((averageProjectedPpg || 0) - (candidateProjection || 0)) * 1.25 || ((averageRating || 0) - (candidateRating || 0)) / 2)
    : -round1(Math.max(1, (candidateRating || 60) / 22));

  return {
    alternatives,
    expectedValue,
    averageRating: averageRating ? round1(averageRating) : null,
    averageProjectedPpg: averageProjectedPpg ? round1(averageProjectedPpg) : null
  };
}

function fallbackAvailabilityPct(candidate, draftSimulation = null, index = 0) {
  const nextPick = asNumber(draftSimulation?.nextPickNumber);
  const roomRank = roomDraftRankForCandidate(candidate);
  if (!nextPick || !roomRank) {
    return Math.max(8, 68 - index * 11);
  }
  const distance = roomRank - nextPick;
  if (distance <= -2) return 8;
  if (distance <= 0) return 22;
  if (distance <= 4) return 44;
  if (distance <= 10) return 63;
  return clamp(78 + Math.min(17, distance * 0.8) - index * 4, 20, 96);
}

function buildPickConfidence({
  candidate,
  totalScore = 0,
  components = {},
  draftSim = null,
  tierPressure = null,
  riskMeter = null,
  valueMeter = null,
  sleeperValue = null,
  construction = null
}) {
  const gone = asNumber(draftSim?.takenBeforeNextPct) ?? 0;
  const reachPenalty = sleeperValue?.level === "reach" ? 10 : 0;
  const riskPenalty = riskMeter?.level === "High" ? 12 : riskMeter?.level === "Moderate" ? 5 : 0;
  const tierLift = (draftSim?.tierDropAtNext ?? 0) >= 1 || (tierPressure?.waitTierGap ?? 0) >= 1 ? 6 : 0;
  const valueLift = valueMeter?.status === "Rising" ? 4 : valueMeter?.status === "Falling" ? -5 : 0;
  const constructionLift = clamp((construction?.score ?? 0) * 0.8, -6, 6);
  const modelAgreement = (
    (components.board ?? 0) / Math.max(1, components.boardMax ?? 88) +
    (components.tier ?? 0) / Math.max(1, components.tierMax ?? 6) +
    (components.fit ?? 0) / Math.max(1, components.fitMax ?? 2) +
    clamp(gone / 100, 0, 1)
  ) / 4;
  const percent = Math.round(clamp(48 + totalScore * 0.36 + gone * 0.08 + tierLift + valueLift + constructionLift - riskPenalty - reachPenalty, 41, 99));
  const reason =
    percent >= 92
      ? "Every model agrees: board value, tier pressure, roster fit, and the draft sim all point at him."
      : percent >= 80
        ? "Strong confidence because the board value and next-pick availability both support the pick."
        : percent >= 66
          ? "Good upside, but one model is asking for a price or risk check."
          : modelAgreement >= 0.58
            ? "Useful pick, but the edge is thinner than the headline score."
            : "High upside but volatile; compare him against the other positions before locking it in.";

  return {
    percent,
    reason,
    agreement: round1(modelAgreement * 100)
  };
}

function buildAiRecommendation({
  candidate,
  playerRating = null,
  production = {},
  byPosition = new Map(),
  draftSim = null,
  tierPressure = null,
  skipPlan = null,
  draftContext = {},
  components = {},
  currentPick = null,
  valueRank = null
}) {
  const position = candidate.position;
  const tier = tierPressure?.currentTier ?? candidate.tier ?? "-";
  const sameTierCount = countSameTierLeft(candidate, byPosition);
  const positionLabel = sameTierCount === 1 ? position : `${position}s`;
  const remainVerb = sameTierCount === 1 ? "remains" : "remain";
  const depth = strongestDepthPosition(byPosition, position);
  const delta = estimateReplacementDelta(candidate, playerRating, production, skipPlan);
  const ev = finiteNumber(skipPlan?.expectedValue) ?? -1.5;
  const evPct = clamp(Math.round(Math.abs(ev) * 4.5), 1, 28);
  const waitPhrase = ev < -0.2
    ? `is projected to cost ${evPct}% expected value`
    : ev > 0.2
      ? `is projected to gain ${evPct}% expected value`
      : "is close to neutral in expected value";
  const survival = draftSim?.takenBeforeNextPct !== undefined ? ` and the room sim has him ${draftSim.takenBeforeNextPct}% gone by your next pick` : "";
  const age = asNumber(candidate.player?.age ?? candidate.ranking?.age);
  const dynastyPrefix = dynastyRecommendationPrefix(candidate, draftContext, age, components, currentPick, valueRank, draftSim);
  return `${dynastyPrefix}${candidate.name} is projected ${delta} points above replacement over the next five rounds; ${sameTierCount} ${positionLabel} ${remainVerb} in Tier ${tier}, while ${depth.label} depth is ${depth.description}; waiting on ${position} ${waitPhrase}${survival}.`;
}

function dynastyRecommendationPrefix(candidate, draftContext = {}, age = null, components = {}, currentPick = null, valueRank = null, draftSim = null) {
  if (draftContext?.isDynasty !== true) {
    return "";
  }
  const isSuperflex = draftContext?.isSuperflex === true;
  if (isSuperflex && candidate.position === "QB" && age && age <= 28) {
    const youngQbMarket = superflexDynastyYoungQbAdpContext(candidate, currentPick, valueRank, draftContext, draftSim);
    if (youngQbMarket.aroundAdp) {
      const price = youngQbMarket.discount ? "at a discount to" : "near";
      return `Superflex dynasty premium: an age ${age} QB ${price} room ADP is an extremely valuable cornerstone asset. `;
    }
    if (youngQbMarket.tooEarly) {
      return `Superflex dynasty check: the young-QB premium matters, but this price is ahead of room ADP, so he still has to beat the RB/WR values. `;
    }
    return `Superflex dynasty premium: age ${age} QB with a top-board profile is a long-term cornerstone, not just a weekly starter. `;
  }
  if (candidate.position === "TE" && age && age >= 30) {
    const ageScore = components?.age ?? 0;
    return `Dynasty age warning: age ${age} TE gets a long-term value discount (${ageScore}); he needs elite near-term scoring to justify passing younger assets. `;
  }
  if (candidate.position !== "QB" && isSuperflex && age && age <= 24) {
    return `Dynasty youth bump: age ${age} keeps long-term value alive, but the pick still has to beat the QB market in superflex. `;
  }
  return "";
}

function countSameTierLeft(candidate, byPosition = new Map()) {
  const tier = asPositiveNumber(candidate.tier);
  const group = byPosition.get(candidate.position) ?? [];
  if (!tier) {
    return group.length;
  }
  return group.filter((item) => asPositiveNumber(item.tier) === tier).length;
}

function strongestDepthPosition(byPosition = new Map(), exceptPosition = "") {
  const options = ["RB", "WR", "TE", "QB"]
    .filter((position) => position !== exceptPosition)
    .map((position) => {
      const group = byPosition.get(position) ?? [];
      const topScore = group.slice(0, 8).reduce((total, item, index) => total + Math.max(0, 100 - (asNumber(item.rankSort) ?? 999) * 0.7 - index * 2), 0);
      return { position, count: group.length, topScore };
    })
    .sort((left, right) => right.topScore - left.topScore || right.count - left.count);
  const best = options[0] ?? { position: "overall", count: 0, topScore: 0 };
  return {
    label: best.position,
    description: best.topScore >= 210 ? "unusually strong" : best.topScore >= 125 ? "solid" : "thin"
  };
}

function estimateReplacementDelta(candidate, playerRating = null, production = {}, skipPlan = null) {
  const candidateRating = finiteNumber(playerRating) ?? buildPlayerRating(candidate);
  const projectedPpg = finiteNumber(production?.projectedPpg) ?? estimatedProjectedPpg(candidate, candidateRating);
  const replacementPpg = finiteNumber(skipPlan?.averageProjectedPpg);
  if (projectedPpg && replacementPpg) {
    return round1((projectedPpg - replacementPpg) * 5);
  }
  const altRating = finiteNumber(skipPlan?.averageRating) ?? Math.max(45, candidateRating - 6);
  return round1((candidateRating - altRating) * 0.75);
}

function estimatedProjectedPpg(candidate, rating = null) {
  const projectedPpg = finiteNumber(candidate?.ranking?.projectedPpg);
  if (projectedPpg) {
    return projectedPpg;
  }
  const projectedTotal = finiteNumber(candidate?.ranking?.projection ?? candidate?.ranking?.projectedPoints);
  if (projectedTotal) {
    return round1(projectedTotal / 17);
  }
  const score = finiteNumber(rating) ?? buildPlayerRating(candidate);
  const positionBase = { QB: 11.5, RB: 7.2, WR: 7.4, TE: 5.2, DEF: 4.8 }[candidate?.position] ?? 6;
  return round1(positionBase + score * (candidate?.position === "QB" ? 0.12 : 0.09));
}

function finiteNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function averageNumber(values = []) {
  const numbers = values.map(Number).filter(Number.isFinite);
  if (!numbers.length) {
    return null;
  }
  return numbers.reduce((total, value) => total + value, 0) / numbers.length;
}

function buildReasons({
  candidate,
  playerRating,
  totalScore,
  components,
  currentPick,
  valueRank,
  valueRankLabel,
  need,
  scarcity,
  tierPressure,
  market,
  evidenceItems,
  trend,
  risk,
  earlySpecialTeamsPenalty,
  slots,
  roster,
  byPosition,
  available,
  teamContext,
  production,
  draftContext,
  byeWeek,
  stacking,
  sleeperValue,
  construction,
  balance,
  draftSim,
  aiRecommendation,
  blitzValue
}) {
  const reasons = [];
  const rank = candidate.ranking?.rank ?? candidate.player.search_rank ?? candidate.rankSort;
  const ratingText = describePlayerRating(playerRating, rank);
  if (ratingText) {
    reasons.push(ratingText);
  }

  const callText = describeSelectionCall(candidate, currentPick, rank, components, roster, slots, need, scarcity, teamContext);
  if (callText) {
    reasons.push(callText);
  }

  const formatText = describeFormatBuild(candidate, components, roster.counts, slots, draftContext);
  if (formatText) {
    reasons.push(formatText);
  }

  const environmentText = describeTeamEnvironment(candidate, teamContext);
  if (environmentText) {
    reasons.push(environmentText);
  }

  const projectionText = describeProjectionLens(candidate, production);
  if (projectionText) {
    reasons.push(projectionText);
  }

  const lastYearText = describeLastYearReference(candidate, production);
  if (lastYearText) {
    reasons.push(lastYearText);
  }

  const ceilingText = describeCeilingPath(candidate, production, teamContext);
  if (ceilingText) {
    reasons.push(ceilingText);
  }

  const ageText = describeAgeValue(candidate, draftContext, components);
  if (ageText) {
    reasons.push(ageText);
  }

  const buildText = describeNeed(candidate.position, roster.counts, slots, roster.picks.length, need);
  if (buildText) {
    reasons.push(buildText);
  }

  const boardDecisionText = describeBoardDecision(candidate, currentPick, rank, valueRank, valueRankLabel, available, components, roster);
  if (boardDecisionText) {
    reasons.push(boardDecisionText);
  }

  const adpText = describeAdpDiscipline(candidate, currentPick, valueRank, valueRankLabel, draftContext);
  if (adpText) {
    reasons.push(adpText);
  }

  const profileText = describePlayerProfile(candidate, rank, roster.counts, slots, teamContext);
  if (profileText) {
    reasons.push(profileText);
  }

  const tierText = describeTierPressure(candidate, byPosition, scarcity, tierPressure);
  if (tierText) {
    reasons.push(tierText);
  }

  const marketText = describeMarketSignal(trend, market);
  if (marketText) {
    reasons.push(marketText);
  }

  const note = bestContextNote(candidate, evidenceItems);
  if (note) {
    reasons.push(note);
  }

  const scoreText = describeValueScore(totalScore, components);
  if (scoreText) {
    reasons.push(scoreText);
  }

  if (risk > 0 || earlySpecialTeamsPenalty > 0) {
    const injury = candidate.player.injury_status ? ` Injury flag: ${candidate.player.injury_status}.` : "";
    const timing =
      earlySpecialTeamsPenalty > 0
        ? " DEF is usually a late-round edge unless your board has thinned out."
        : "";
    reasons.push(`Risk check:${injury}${timing}`.trim());
  }

  return buildConciseReasons({
    candidate,
    totalScore,
    currentPick,
    valueRank,
    valueRankLabel,
    components,
    need,
    scarcity,
    tierPressure,
    roster,
    slots,
    production,
    draftContext,
    risk,
    earlySpecialTeamsPenalty,
    market,
    trend,
    byeWeek,
    stacking,
    sleeperValue,
    construction,
    balance,
    draftSim,
    aiRecommendation,
    blitzValue
  });
}

function buildConciseReasons({
  candidate,
  totalScore,
  currentPick,
  valueRank,
  valueRankLabel,
  components = {},
  need,
  scarcity,
  tierPressure,
  roster,
  slots,
  production,
  draftContext,
  risk,
  earlySpecialTeamsPenalty,
  market,
  trend,
  byeWeek,
  stacking,
  sleeperValue,
  construction,
  balance,
  draftSim,
  aiRecommendation,
  blitzValue
}) {
  const reasons = [
    aiRecommendation ? `AI Recommendation: ${aiRecommendation}` : "",
    conciseValueReason(candidate, totalScore, currentPick, valueRank, valueRankLabel, components, blitzValue),
    conciseFitReason(candidate, roster?.counts ?? emptyCounts(), slots, need, scarcity, tierPressure, draftContext, draftSim),
    conciseDraftWindowReason(candidate, draftSim, tierPressure, sleeperValue),
    conciseContextReason(candidate, production, components, risk, earlySpecialTeamsPenalty, market, trend, byeWeek, stacking, construction, balance)
  ].filter(Boolean);
  return dedupePlainReasons(reasons).slice(0, 4);
}

function conciseValueReason(candidate, totalScore, currentPick, valueRank, valueRankLabel, components = {}, blitzValue = null) {
  const boardRank = asNumber(candidate.rankSort);
  const marketRank = asNumber(valueRank);
  const gap = boardRank ? currentPick - boardRank : marketRank ? currentPick - marketRank : 0;
  const valueText =
    gap >= 6
      ? `${Math.round(gap)} picks cheaper than your board`
      : gap <= -6
        ? `${Math.abs(Math.round(gap))} picks ahead of your board`
        : "priced fairly";
  const boardText = boardRank ? `your board #${Math.round(boardRank)}` : "the loaded board";
  const marketGap = marketRank ? currentPick - marketRank : null;
  const boardToMarketGap = boardRank && marketRank ? marketRank - boardRank : 0;
  const pickToMarketGap = marketRank ? marketRank - currentPick : 0;
  const marketLabel = /^room\b/i.test(String(valueRankLabel ?? "")) ? valueRankLabel : `Room ${valueRankLabel || "market"}`;
  const marketText = marketRank
    ? candidate.position === "QB" && pickToMarketGap >= 10 && boardToMarketGap >= 10
      ? ` ${marketLabel} #${Math.round(marketRank)} is much later than the loaded board, so this is a wait spot unless the tier is about to vanish.`
      : marketGap >= 6
      ? ` ${marketLabel} #${Math.round(marketRank)} also shows a ${Math.round(marketGap)}-pick discount.`
      : marketGap <= -6
        ? ` ${marketLabel} #${Math.round(marketRank)} says this is ${Math.abs(Math.round(marketGap))} picks early, so the tier/build case has to carry it.`
        : ` ${marketLabel} #${Math.round(marketRank)} keeps him in range.`
    : "";
  const rating = asNumber(components.playerRating);
  const ratingText = rating ? ` Loaded value rating: ${Math.round(rating)}/99.` : "";
  const blitzText = blitzValue?.overall
    ? ` Blitz Value: ${formatBlitzValue(blitzValue.overall)} (${blitzValue.trend?.label ?? "Flat 0 BV"}).`
    : "";
  const grade = Number.isFinite(Number(totalScore)) ? ` Pick grade: ${Math.round(totalScore)}/100.` : "";
  return `Value: ${candidate.name} is ${valueText} at ${boardText}.${marketText}${blitzText}${ratingText}${grade}`;
}

function conciseFitReason(candidate, counts = {}, slots = {}, need = 0, scarcity = 0, tierPressure = null, draftContext = {}, draftSim = null) {
  const position = candidate.position;
  const count = counts[position] ?? 0;
  const tier = tierPressure?.currentTier ?? candidate.tier;
  const waitTierGap = Math.max(tierPressure?.waitTierGap ?? 0, tierPressure?.roomWaitTierGap ?? 0);
  const sameTierAfterWindow = (tierPressure?.sameTierLikelyAfterWindow ?? tierPressure?.sameTierAfterWindow ?? 0);
  if (waitTierGap >= 1 && sameTierAfterWindow === 0) {
    const simText = draftSim?.availableNextPct !== undefined ? ` The sim gives him only ${draftSim.availableNextPct}% odds to reach your next pick.` : "";
    const roomText = tierPressure?.roomProjectedNext?.name ? ` Room market points to ${tierPressure.roomProjectedNext.name} as the next realistic ${position}.` : "";
    return `Fit/tier: this is near the end of ${position} tier ${tier}, so waiting likely costs you a cleaner option at that position.${simText}${roomText}`;
  }
  if (position === "TE" && draftContext?.isTep) {
    const premium = asNumber(draftContext.tePremium) ?? 0.5;
    return `Fit: tight end premium adds about ${premium.toFixed(1)} point per TE catch, so this TE tier is more valuable than it would be in normal PPR.`;
  }
  if (FLEX_POSITIONS.has(position)) {
    const flexCovered = (counts.RB ?? 0) + (counts.WR ?? 0) + (counts.TE ?? 0);
    const flexTarget = (slots.RB ?? 0) + (slots.WR ?? 0) + (slots.TE ?? 0) + (slots.FLEX ?? 0) + (slots.REC_FLEX ?? 0);
    return `Fit: he gives you ${count + 1} ${position} and ${flexCovered + 1}/${Math.max(1, flexTarget)} RB/WR/TE lineup spots covered.`;
  }
  if (position === "QB" && draftContext?.isDynasty) {
    return `Fit: QB helps in superflex, but this grade is still anchored to market value instead of forcing the position.`;
  }
  if (position === "QB") {
    return `Fit: QB is useful if the weekly ceiling beats the RB/WR value left on the board.`;
  }
  return need > 0 || scarcity >= 10 ? `Fit: ${position} helps the build here without ignoring board value.` : "";
}

function conciseDraftWindowReason(candidate, draftSim = null, tierPressure = null, sleeperValue = null) {
  if (!draftSim) {
    if (sleeperValue?.level === "strong") {
      return `Draft window: he has fallen ${Math.max(sleeperValue.boardGap ?? 0, sleeperValue.marketGap ?? 0)} picks against the board/market, which is the kind of discount worth attacking.`;
    }
    return "";
  }

  const gone = draftSim.takenBeforeNextPct ?? 0;
  const available = draftSim.availableNextPct ?? 0;
  const nextPick = draftSim.nextPickNumber ? ` before pick ${Math.round(draftSim.nextPickNumber)}` : " before your next pick";
  const roomRankText = draftSim.platformRank ? ` from room market #${Math.round(draftSim.platformRank)}` : "";
  if ((draftSim.tierDropAtNext ?? 0) >= 1 && (draftSim.sameTierLikelyAvailable ?? 0) === 0) {
    const nextName = draftSim.nextLikelyName ? `; the next likely ${candidate.position} is ${draftSim.nextLikelyName} in tier ${draftSim.nextLikelyTier}` : "";
    return `Draft window: room market says this ${candidate.position} tier probably dries up${nextPick}${nextName}.`;
  }
  if (gone >= 70) {
    return `Draft window: in the 1000-run market sim, ${candidate.name} is taken ${gone}% of the time${nextPick}${roomRankText}; if you want him, this is probably the shot.`;
  }
  if (gone >= 45 || (tierPressure?.waitTierGap ?? 0) >= 1) {
    return `Draft window: the sim has him gone ${gone}% of the time and shows ${draftSim.averagePositionTaken} ${candidate.position}s coming off before you pick again.`;
  }
  if (available >= 75 && sleeperValue?.level !== "strong") {
    return `Draft window: the sim gives him ${available}% odds to make it back, so you can compare him hard against stronger values at other positions.`;
  }
  if (sleeperValue?.level === "strong" || sleeperValue?.level === "solid") {
    const gap = Math.max(sleeperValue.boardGap ?? 0, sleeperValue.marketGap ?? 0);
    return `Draft window: he is a ${sleeperValue.level} value pocket at about ${gap} picks cheaper than board/market, even without forcing the position.`;
  }
  return "";
}

function conciseContextReason(
  candidate,
  production = {},
  components = {},
  risk = 0,
  earlySpecialTeamsPenalty = 0,
  market = 0,
  trend = {},
  byeWeek = null,
  stacking = null,
  construction = null,
  balance = null
) {
  if (risk > 0 || earlySpecialTeamsPenalty > 0 || candidate.player?.injury_status) {
    const injury = candidate.player?.injury_status ? ` Injury flag: ${candidate.player.injury_status}.` : "";
    return `Risk: ${candidate.name} needs a small discount here.${injury}`.trim();
  }
  if (stacking?.names?.length) {
    return `Stack: he pairs with ${formatNameList(stacking.names)} on your roster, adding weekly ceiling without needing to overpay for the stack.`;
  }
  if (balance?.message) {
    return balance.message;
  }
  if (construction?.message) {
    return construction.message;
  }
  if (byeWeek && (byeWeek.samePositionConflicts ?? 0) >= 2) {
    return `Bye week: Week ${byeWeek.week} would stack ${byeWeek.samePositionConflicts + 1} of your ${candidate.position}s on the same bye, so only take him if the value clearly wins.`;
  }
  if (production?.projectedPpg) {
    const ceiling = production.ceilingPpg ? ` with about ${production.ceilingPpg} PPG ceiling` : "";
    return `Context: projection sits around ${production.projectedPpg} PPG${ceiling}, so the pick has a real scoring path.`;
  }
  if (candidate.valueMeter?.status === "Rising" || market > 2 || (trend?.adds ?? 0) > (trend?.drops ?? 0) * 2) {
    return `Context: market movement is positive, which supports him as more than a roster-need pick.`;
  }
  if (components.age > 0) {
    return `Context: age/format value helps the profile, especially if the board price stays fair.`;
  }
  return `Context: take him because the price, tier, and role case line up better than the alternatives.`;
}

function describeValueScore(totalScore, components = {}) {
  if (!Number.isFinite(totalScore)) {
    return "";
  }

  const formatText = components.format ? `, format/team-build adjustment (${signedNumber(components.format)}/8)` : "";
  const ageText = components.ageMax ? `, dynasty age value (${components.age ?? 0}/${components.ageMax})` : "";
  return `Pick grade: ${totalScore}/100. This is the value-and-fit score for taking him now, with market-weighted board value (${components.board ?? 0}/${components.boardMax ?? 88})${ageText}, build (${components.fit ?? 0}/${components.fitMax ?? 2}), position tier pressure (${components.tier ?? 0}/${components.tierMax ?? 6}), live signal (${components.news ?? 0}/5), safety (${components.safety ?? 0}/3)${formatText}.`;
}

function signedNumber(value) {
  const number = Math.round(Number(value) || 0);
  return number > 0 ? `+${number}` : String(number);
}

function describePlayerRating(playerRating, rank) {
  if (!Number.isFinite(playerRating)) {
    return "";
  }
  const rankText = asNumber(rank) ? ` from board rank ${Math.round(asNumber(rank))}` : "";
  return `Player rating: ${playerRating}/99${rankText}. This is expected player quality, separate from whether he is a value or fit for this exact pick.`;
}

function describeSelectionCall(candidate, currentPick, rank, components = {}, roster, slots, need, scarcity, teamContext) {
  const numericRank = asNumber(rank);
  const positionCounts = roster?.counts ?? emptyCounts();
  const team = candidate.team ? ` on ${candidate.team}` : "";
  const thesis = playerThesis(candidate, positionCounts, slots, teamContext);
  const thesisText = ensureSentence(thesis);
  const tierClause =
    scarcity >= 12
      ? "There is a real position-tier cliff behind him, so waiting changes the quality of the next option."
      : scarcity >= 7
        ? "There is some positional drop-off behind him, but the pick still needs board value to make sense."
        : "";

  if (numericRank) {
    const priceGap = currentPick - numericRank;
    if (priceGap < -10) {
      return `Draft call: ${candidate.name}${team} is a conviction pick here, not a clean board steal. He is board rank ${numericRank} at pick ${currentPick}, so the reason to take him has to be ${thesisText}`;
    }
    if ((components.board ?? 0) >= 48) {
      return compactSentence(
        `Draft call: ${candidate.name}${team} belongs in the pick window at board rank ${numericRank}.`,
        `The player-specific case is ${thesisText}`,
        tierClause
      );
    }
    if (priceGap >= 8) {
      return `Draft call: ${candidate.name}${team} has slipped ${priceGap} picks past his board slot. The attraction is not just need; it is ${thesisText}`;
    }
    return `Draft call: ${candidate.name}${team} is in range at pick ${currentPick}. You are betting on ${thesisText}`;
  }

  return `Draft call: ${candidate.name}${team} is being graded from the loaded board and live roster context. The reason to consider him is ${thesisText}`;
}

function describeFormatBuild(candidate, components = {}, counts = {}, slots = {}, draftContext = {}) {
  if (!draftContext?.isSuperflex && (slots.SUPER_FLEX ?? 0) <= 0) {
    return "";
  }

  const qbTarget = Math.max(2, (slots.QB ?? 1) + (slots.SUPER_FLEX ?? 1));
  const qbCount = counts.QB ?? 0;
  const format = Number(components.format) || 0;
  if (candidate.position === "QB" && format > 0) {
    const age = asNumber(candidate.player?.age);
    const youth = draftContext?.isDynasty && age && age <= 28 ? ` At age ${age}, he also protects long-term dynasty value.` : "";
    return `Format fit: superflex dynasty makes young difference-making QBs premium early assets because you start ${qbTarget} QB/SF slots and replacement options dry up fast.${youth}`;
  }
  if (candidate.position === "TE" && format < 0 && qbCount < qbTarget) {
    return `Format fit: TE has to clear a higher bar in superflex dynasty, especially if he is older, because QB and young RB/WR value usually holds trade value better.`;
  }
  if (candidate.position !== "QB" && format < 0 && qbCount === 0) {
    return `Format fit: this non-QB profile gets only a light superflex check because you have no QB yet. A young RB or WR with strong board value can still be the correct pick.`;
  }
  return "";
}

function playerThesis(candidate, counts = {}, slots = {}, teamContext = null) {
  if (candidate.position === "RB") {
    const workload = candidate.rankSort <= 24 ? "early-round workload and touchdown equity" : "touch volume, injury leverage, and touchdown access";
    return workload;
  }

  if (candidate.position === "WR") {
    const targetCase = candidate.rankSort <= 36 ? "bankable target share and weekly ceiling" : "a path to targets that can beat replacement FLEX options";
    return targetCase;
  }

  if (candidate.position === "TE") {
    const experience = playerExperiencePhrase(candidate);
    return `route volume, red-zone usage, or a target profile that separates him from replacement TE. ${experience || "The pick needs to win on role and ceiling, not just position."}`;
  }

  if (candidate.position === "QB") {
    const experience = playerExperiencePhrase(candidate);
    const qbTarget = (slots.SUPER_FLEX ?? 0) > 0 ? "superflex leverage" : "weekly ceiling";
    return `${qbTarget}, rushing/volume upside where available, and whether his scoring gap is bigger than the RB/WR drop-off. ${experience}`;
  }

  const experience = playerExperiencePhrase(candidate);
  return `a specific late-round job or matchup edge, not generic roster filling. ${experience}`;
}

function describeBpaComparison(candidate, available = [], components = {}) {
  const board = [...(available ?? [])]
    .filter((item) => item?.playerId !== candidate.playerId)
    .sort((left, right) => left.rankSort - right.rankSort);
  const better = board.filter((item) => item.rankSort < candidate.rankSort).slice(0, 3);
  const next = board.filter((item) => item.rankSort > candidate.rankSort).slice(0, 3);

  if (!board.length) {
    return "";
  }

  if (!better.length) {
    const nextNames = formatPlayerList(next);
    return nextNames
      ? `BPA comparison: he is the top-ranked player still available; passing likely means dropping to ${nextNames} on the board.`
      : "BPA comparison: he is the top-ranked player still available in this board pocket.";
  }

  const betterNames = formatPlayerList(better);
  if ((components.fit ?? 0) >= 2 || candidate.position === "TE" || candidate.position === "QB") {
    return `BPA comparison: pure board value still favors ${betterNames}, so this player should only jump them if the roster build, tier gap, or league format clearly supports it.`;
  }

  return `BPA comparison: pure board value favors ${betterNames}; that is why the overall grade stays BPA-first instead of forcing this position.`;
}

function describeBoardDecision(candidate, currentPick, rank, valueRank, valueRankLabel, available = [], components = {}, roster = {}) {
  const numericRank = asNumber(rank);
  const better = [...(available ?? [])]
    .filter((item) => item?.playerId !== candidate.playerId && item.rankSort < candidate.rankSort)
    .sort((left, right) => left.rankSort - right.rankSort)
    .slice(0, 3);
  const next = [...(available ?? [])]
    .filter((item) => item?.playerId !== candidate.playerId && item.rankSort > candidate.rankSort)
    .sort((left, right) => left.rankSort - right.rankSort)
    .slice(0, 2);
  const counts = roster?.counts ?? emptyCounts();
  const boardGap = numericRank ? currentPick - numericRank : 0;
  const tierText = candidate.tier ? `tier ${candidate.tier}` : "this tier";
  const posRank = candidate.ranking?.posRank ? ` as ${candidate.ranking.posRank}` : "";

  if (better.length) {
    const betterNames = formatPlayerList(better);
    if ((components.fit ?? 0) >= 2 && ["RB", "WR"].includes(candidate.position)) {
      const balance = candidate.position === "RB"
        ? `you are sitting at ${counts.RB ?? 0} RB and ${counts.WR ?? 0} WR, so this is an intentional RB build choice`
        : `you are sitting at ${counts.RB ?? 0} RB and ${counts.WR ?? 0} WR, so this is an intentional WR/FLEX ceiling choice`;
      const verb = better.length === 1 ? "is a cleaner pure-board value" : "are cleaner pure-board values";
      const pronoun = better.length === 1 ? "him" : "them";
      return `Board check: ${betterNames} ${verb}. Taking ${candidate.name}${posRank} over ${pronoun} only makes sense if ${balance}, not because the app is blindly chasing position.`;
    }
    const verb = better.length === 1 ? "sits" : "sit";
    return `Board check: ${betterNames} still ${verb} ahead on pure board rank. If you take ${candidate.name}${posRank}, it should be because his ${tierText} profile or live news beats those alternatives for your build.`;
  }

  if (numericRank && boardGap >= 8) {
    return `Value check: board rank ${numericRank}${posRank} at pick ${currentPick} is a ${boardGap}-pick discount, so you can draft him without needing a roster-need excuse.`;
  }
  if (numericRank && boardGap >= -4) {
    const nextNames = formatPlayerList(next);
    return nextNames
      ? `Value check: board rank ${numericRank}${posRank} is fair at this pick, and the next board pocket drops toward ${nextNames}.`
      : `Value check: board rank ${numericRank}${posRank} is fair at this pick, with no obvious better board value behind him.`;
  }
  if (valueRank) {
    return `Value check: his ${valueRankLabel} around ${Math.round(valueRank)} keeps him in the conversation, but the player/team context has to carry the final call.`;
  }
  return "";
}

function describeProjectionLens(candidate, production) {
  if (!production?.projectedPpg) {
    return "";
  }
  const source =
    production.projectionSource === "board"
      ? "loaded board projection"
      : "rank/tier projection estimate";
  const total = production.projectedTotal ? `${production.projectedTotal} total points` : "season-long starter points";
  return `Projection lens: ${source} puts ${candidate.name} around ${total}, about ${production.projectedPpg} fantasy PPG over 17 games. That gives the pick a concrete scoring target instead of just a rank.`;
}

function describeLastYearReference(candidate, production) {
  if (!production?.statsAvailable) {
    return "";
  }
  const season = production.season ?? "last season";
  if (!production.hasLastYearStats) {
    return `Last-year reference: no ${season} NFL season stat line was loaded for ${candidate.name}, so this is more projection/role bet than repeat-production bet.`;
  }
  const points = production.lastYearPoints ? `${production.lastYearPoints} fantasy points` : "fantasy production";
  const ppg = production.lastYearPpg ? ` (${production.lastYearPpg} PPG)` : "";
  const games = production.games ? ` across ${production.games} games` : "";
  const line = production.statLine ? `: ${production.statLine}` : "";
  return `Last-year reference: in ${season}, ${candidate.name} produced ${points}${ppg}${games}${line}. Use that as the floor/role check against this year's projection.`;
}

function describeCeilingPath(candidate, production, teamContext) {
  if (!production?.ceilingPpg) {
    return "";
  }
  const threshold = candidate.position === "QB" ? 24 : candidate.position === "TE" ? 14 : 20;
  const nuclear = production.ceilingPpg >= threshold ? "true nuclear-year range" : "spike-year range";
  const path = nuclearPathPhrase(candidate, teamContext);
  return `Ceiling case: the ${nuclear} is roughly ${production.ceilingPpg} PPG (${production.ceilingTotal} over 17). For that to hit, ${path}`;
}

function describeDepthChartValue(candidate) {
  return "";
}

function describeAgeValue(candidate, draftContext, components = {}) {
  if (!draftContext?.isDynasty) {
    return "";
  }

  const age = asNumber(candidate.player?.age);
  if (!age) {
    return "Dynasty age value: age was not loaded, so he does not get a full long-term age boost.";
  }

  if (draftContext?.isDynasty) {
    const score = `${components.age ?? 0}/${components.ageMax ?? 8}`;
    if (candidate.position === "RB") {
      return age <= 24
        ? `Dynasty age value: age ${age} is a major plus (${score}); young RB production can become multi-year points and trade value.`
        : age >= 27
          ? `Dynasty age value: age ${age} is a major warning for RB value (${score}); he needs near-term points to offset the shorter shelf life.`
          : `Dynasty age value: age ${age} is still useful, but RB age curves are short (${score}), so long-term value matters in the tiebreak.`;
    }
    if (candidate.position === "WR") {
      return age <= 26
        ? `Dynasty age value: age ${age} is a strong plus (${score}); WR prime seasons can stack value for multiple years.`
        : age >= 30
          ? `Dynasty age value: age ${age} lowers the long-term profile (${score}); he needs elite near-term scoring to beat younger assets.`
          : `Dynasty age value: age ${age} is still in the WR prime window (${score}), so he can help now without crushing future value.`;
    }
    if (candidate.position === "QB") {
      return age <= 31
        ? `Dynasty age value: age ${age} is a major superflex asset (${score}); young QBs with real scoring ceilings hold value better than almost any position.`
        : `Dynasty age value: age ${age} is less damaging at QB than RB/WR, but it still trims long-term value (${score}) and should not beat stronger market value.`;
    }
    if (candidate.position === "TE") {
      return age >= 30
        ? `Dynasty age value: age ${age} is a real TE discount (${score}); older TEs need elite near-term points to beat younger assets.`
        : `Dynasty age value: age ${age} still helps at TE (${score}), but the pick needs long-term target growth, not just a current starter label.`;
    }
  }

  return "";
}

function nuclearPathPhrase(candidate, teamContext) {
  const quarterback = teamContext?.quarterback ?? null;
  const qbInjuryText = hasNegativeHealthFlag(quarterback)
    ? ` The QB injury/status flag makes that path less clean until it clears.`
    : "";
  if (candidate.position === "RB") {
    return "he needs the lead rushing role, goal-line work, and enough passing-game usage to survive negative game scripts.";
  }
  if (candidate.position === "WR") {
    return `he needs a target-share jump, explosive-play access, and enough red-zone work to separate from the WR tier around him.${qbInjuryText}`;
  }
  if (candidate.position === "TE") {
    return `he needs route volume and red-zone looks, not just touchdown luck.${qbInjuryText}`;
  }
  if (candidate.position === "QB") {
    return "he needs rushing or elite pass volume to separate from replacement options.";
  }
  return "he needs role growth beyond normal replacement value.";
}

function formatPlayerList(players) {
  const names = (players ?? [])
    .map((player) => `${player.name} (${player.position})`)
    .filter(Boolean);
  if (!names.length) {
    return "";
  }
  if (names.length === 1) {
    return names[0];
  }
  if (names.length === 2) {
    return `${names[0]} or ${names[1]}`;
  }
  return `${names.slice(0, -1).join(", ")}, or ${names[names.length - 1]}`;
}

function formatNameList(names) {
  const clean = (names ?? []).map((name) => String(name ?? "").trim()).filter(Boolean);
  if (!clean.length) {
    return "";
  }
  if (clean.length === 1) {
    return clean[0];
  }
  if (clean.length === 2) {
    return `${clean[0]} and ${clean[1]}`;
  }
  return `${clean.slice(0, -1).join(", ")}, and ${clean[clean.length - 1]}`;
}

function describeBoardValue(candidate, currentPick, rank, valueRank, valueRankLabel) {
  const numericRank = asNumber(rank);
  const round = candidate.ranking?.round ? `, usually a round ${candidate.ranking.round} name on this board` : "";
  const tier = candidate.tier ? ` in ${candidate.position} tier ${candidate.tier}` : "";
  const posRank = candidate.ranking?.posRank ? ` (${candidate.ranking.posRank})` : "";

  if (numericRank) {
    const discount = currentPick - numericRank;
    if (discount >= 10) {
      return `Value: ${candidate.name}${posRank} is board rank ${numericRank}${tier}${round}, so getting him at pick ${currentPick} is a real ${discount}-pick discount.`;
    }
    if (discount >= 0) {
      return `Value: ${candidate.name}${posRank} is board rank ${numericRank}${tier}; pick ${currentPick} is a fair price without forcing a reach.`;
    }
    if (discount >= -8) {
      return `Price check: ${candidate.name}${posRank} is board rank ${numericRank}${tier}, so this is only a small reach if he fits your build.`;
    }
    return `Price check: ${candidate.name}${posRank} is board rank ${numericRank}${tier}; take him only if the roster fit beats the board value behind him.`;
  }

  if (valueRank) {
    return `Value: ${candidate.name} sits around ${valueRankLabel} ${Math.round(valueRank)}, which keeps him in range for pick ${currentPick}.`;
  }

  return `Value: ${candidate.name} remains in the main decision set because the board has thinned at ${candidate.position}.`;
}

function describeAdpDiscipline(candidate, currentPick, valueRank, valueRankLabel, draftContext = {}) {
  const marketRank = asNumber(valueRank);
  if (!marketRank || draftContext?.isDynasty !== true) {
    return "";
  }

  const gap = currentPick - marketRank;
  if (candidate.position === "QB" && gap < -4) {
    return `Price discipline: ${candidate.name} is priced around ${valueRankLabel} ${Math.round(marketRank)}, so taking him at pick ${currentPick} is ${Math.abs(Math.round(gap))} picks early. QB tier pressure is being treated as a tiebreaker, not a reason to skip better RB/WR value.`;
  }
  if (gap >= 6) {
    return `Price value: ${candidate.name} is sitting ${Math.round(gap)} picks past ${valueRankLabel} ${Math.round(marketRank)}, so the pick is supported by price as well as positional tier.`;
  }
  if (Math.abs(gap) <= 3) {
    return `Price check: ${candidate.name} is close to ${valueRankLabel} ${Math.round(marketRank)}, so this is a fair market price and should be decided by overall value plus roster build.`;
  }
  return "";
}

function describeNeed(position, counts, slots, rosterPickCount, need) {
  if (position === "QB" && slots.SUPER_FLEX > 0) {
    return `Build impact: you have ${counts.QB}/${slots.QB + slots.SUPER_FLEX} QB/superflex slots covered. QB carries real lineup value here, but only if the remaining RB/WR board is flat.`;
  }
  if (FLEX_POSITIONS.has(position)) {
    const rb = counts.RB ?? 0;
    const wr = counts.WR ?? 0;
    const te = counts.TE ?? 0;
    const flexEligible = counts.RB + counts.WR + counts.TE;
    const target = slots.RB + slots.WR + slots.TE + slots.FLEX + slots.REC_FLEX;
    if (position === "RB" && wr - rb >= 2) {
      return `Build impact: you are WR-heavy at ${wr} WR and ${rb} RB. This RB pick repairs the build, but your next swing should still chase WR/TE ceiling if the board offers it.`;
    }
    if (position === "WR" && rb - wr >= 2) {
      return `Build impact: you are RB-heavy at ${rb} RB and ${wr} WR. This WR pick restores target volume and keeps your flex from becoming touchdown-dependent.`;
    }
    if (position === "TE" && te === 0 && rosterPickCount >= 4) {
      return `Build impact: you still need a TE after ${rosterPickCount} picks. Take him for a tier edge, not just because the TE box is empty.`;
    }
    if (target > 0 && flexEligible < target) {
      if (position === "RB") {
        return `Build impact: this would put you at ${rb + 1} RB and ${wr} WR, with ${flexEligible + 1}/${target} RB-WR-TE/flex spots covered. That is sturdy, but it raises the urgency to find WR points soon.`;
      }
      if (position === "WR") {
        return `Build impact: this would put you at ${rb} RB and ${wr + 1} WR, with ${flexEligible + 1}/${target} RB-WR-TE/flex spots covered. That keeps weekly target volume alive without ignoring RB completely.`;
      }
      return `Build impact: this fills a real RB-WR-TE/flex slot (${flexEligible + 1}/${target}), but only matters if the player has a weekly ceiling path.`;
    }
    if (need > 8) {
      return `Build impact: another ${position} is depth now, so the bar is upside, injury leverage, or a role that can grow during the season.`;
    }
    return "";
  }
  if (position === "QB") {
    const target = (slots.SUPER_FLEX ?? 0) > 0 ? slots.QB + slots.SUPER_FLEX : Math.max(1, slots.QB ?? 1);
    return (counts.QB ?? 0) < target
      ? `Build impact: you have ${counts.QB}/${target} QB slots covered, so this fills a starter. Make sure the RB/WR drop-off is not bigger than the QB edge.`
      : "";
  }
  if (position === "DEF") {
    return rosterPickCount >= 12
      ? "Build impact: DEF is acceptable this late if your core starters and upside bench are mostly set."
      : "";
  }
  return "";
}

function describeTierPressure(candidate, byPosition, scarcity, tierPressure = null) {
  const group = byPosition?.get(candidate.position) ?? [];
  const index = group.findIndex((item) => item.playerId === candidate.playerId);
  const next = group[index + 1];
  if (!next) {
    return "";
  }

  const pressure = tierPressure ?? analyzePositionTierPressure(candidate, byPosition, null, null, null);
  const rankGap = pressure?.immediateRankGap ?? (next.rankSort - candidate.rankSort);
  const tierGap = pressure?.immediateTierGap ?? (candidate.tier && next.tier ? Math.max(0, next.tier - candidate.tier) : 0);
  const projectedNext = pressure?.projectedNext;
  const waitTierGap = pressure?.waitTierGap ?? 0;
  const waitRankGap = pressure?.waitRankGap ?? 0;
  const nextPickNumber = asNumber(pressure?.nextPickNumber);
  const sameTierAfterWindow = pressure?.sameTierAfterWindow ?? 0;
  const remainingInTier = pressure?.remainingInTier ?? 0;
  const currentTier = pressure?.currentTier ?? candidate.tier;
  const positionRank = positionRankLabel(candidate);

  if (waitTierGap >= 1 && projectedNext && sameTierAfterWindow === 0) {
    const nextRank = positionRankLabel(projectedNext);
    const nextPickText = nextPickNumber ? ` By your next projected pick around ${Math.round(nextPickNumber)},` : " If you wait,";
    return `Position tier pressure: ${candidate.name}${positionRank ? ` (${positionRank})` : ""} is at the edge of ${candidate.position} tier ${currentTier}.${nextPickText} the next realistic ${candidate.position} is ${projectedNext.name}${nextRank ? ` (${nextRank})` : ""} in tier ${projectedNext.tier}, a ${waitRankGap}-spot board drop. That is a real reason to take the end of this tier now.`;
  }

  if (tierGap >= 1 || rankGap >= 12 || scarcity >= 10) {
    const nextText = next.name ? ` before ${next.name}` : "";
    const tierText = tierGap >= 1 ? ` and a ${candidate.position} tier drop of ${tierGap}` : "";
    const endText = remainingInTier <= 2 ? ` Only ${remainingInTier} player${remainingInTier === 1 ? "" : "s"} from this ${candidate.position} tier remain in the available pool.` : "";
    return `Position tier pressure: there is a ${rankGap}-spot ${candidate.position} board gap${tierText}${nextText}, so waiting likely means a worse player profile.${endText}`;
  }
  return "";
}

function describePlayerProfile(candidate, rank, counts, slots, teamContext) {
  const tier = candidate.tier ? `${candidate.position} tier ${candidate.tier}` : "this position tier";
  const posRank = candidate.ranking?.posRank ? `${candidate.ranking.posRank}, ` : "";
  const projectionText = candidate.ranking?.projection
    ? ` The board projection (${Math.round(candidate.ranking.projection)} pts) backs up keeping him in the main decision set.`
    : "";
  const qbName = teamContext?.quarterback?.name ?? "";
  const qbPhrase = qbName && !teamContext ? ` with ${qbName} steering the offense` : "";
  const experience = playerExperiencePhrase(candidate);
  const depthText = playerDepthChartPhrase(candidate);
  if (candidate.position === "RB") {
    const rb = counts.RB ?? 0;
    const rolePhrase = rank <= 36 ? "core-volume" : rb >= 3 ? "depth/contingency" : "usable workload";
    return rank <= 36
      ? `Player profile: ${candidate.name} is ${posRank}a ${rolePhrase} RB bet${qbPhrase}. ${compactSentence(experience, depthText)} Early RB volume dries up fast, so the appeal is workload plus TD access, not a generic need click.${projectionText}`
      : `Player profile: ${candidate.name} is a ${rolePhrase} RB play${qbPhrase}. ${compactSentence(experience, depthText)} With ${rb} RB already rostered, he has to offer playable weeks, bye insulation, or contingency upside.${projectionText}`;
  }
  if (candidate.position === "WR") {
    const wr = counts.WR ?? 0;
    const rolePhrase = wr >= 4 ? "ceiling separator" : rank <= 48 ? "weekly starter/FLEX" : "upside FLEX";
    return rank <= 48
      ? `Player profile: ${candidate.name} is ${posRank}a ${rolePhrase} target bet${qbPhrase}. ${compactSentence(experience, depthText)} In PPR formats, the case is target volume plus offense quality, not just that WR is available.${projectionText}`
      : `Player profile: ${candidate.name} keeps upside in the build${qbPhrase}. ${compactSentence(experience, depthText)} With ${wr} WR already rostered, he needs a real ceiling path to beat similar ${tier} options.${projectionText}`;
  }
  if (candidate.position === "TE") {
    const teTarget = Math.max(1, slots.TE ?? 1);
    return `Player profile: ${candidate.name} is a TE bet${qbPhrase}. ${compactSentence(experience, depthText)} Draft him only if he can separate from replacement TE through route volume, red-zone role, or weekly spike potential. You have ${counts.TE ?? 0}/${teTarget} TE covered.${projectionText}`;
  }
  if (candidate.position === "QB") {
    const qbTarget = (slots.SUPER_FLEX ?? 0) > 0 ? slots.QB + slots.SUPER_FLEX : Math.max(1, slots.QB ?? 1);
    const superflexText = (slots.SUPER_FLEX ?? 0) > 0 ? " Superflex raises the replacement-cost penalty for waiting at QB." : "";
    return `Player profile: ${candidate.name} is worth it if his weekly ceiling beats the RB/WR value left. ${compactSentence(experience, depthText)} You have ${counts.QB ?? 0}/${qbTarget} QB slots covered.${superflexText}${projectionText}`;
  }
  return `Player profile: ${candidate.name} should be treated as a late tactical pick, not a core roster value. ${compactSentence(experience, depthText)}`;
}

function describeRankingConfidence(candidate) {
  const rankingValues = Object.values(candidate.ranking?.sourceRanks ?? {})
    .filter((value) => Number.isFinite(Number(value)))
    .map((value) => Number(value))
    .sort((a, b) => a - b)
    .slice(0, 4);
  if (rankingValues.length >= 2) {
    const spread = rankingValues[rankingValues.length - 1] - rankingValues[0];
    const rangeText =
      candidate.ranking?.high && candidate.ranking?.low
        ? `board range ${candidate.ranking.high}-${candidate.ranking.low}`
        : `input spread ${spread}`;
    return spread <= 18
      ? `Confidence: multiple ranking inputs cluster him tightly (${rangeText}), which makes the pick less fragile.`
      : `Confidence: the ranking inputs are split (${rangeText}), so this is more of an upside conviction pick.`;
  }
  if (candidate.tier) {
    return `Confidence: ${candidate.position} tier ${candidate.tier} keeps him grouped with players you should still be comfortable drafting here.`;
  }
  return "";
}

function describeMarketSignal(trend, market) {
  const adds = trend.adds ?? 0;
  const drops = trend.drops ?? 0;
  if (adds <= 0 && drops <= 0) {
    return "";
  }
  if (adds > drops * 2 && market >= 0) {
    return `Market signal: recent adds are outweighing drops (${adds} adds, ${drops} drops), so the room is leaning toward him rather than away from him.`;
  }
  if (drops > adds) {
    return `Market signal: drops are higher than adds (${drops} drops, ${adds} adds), so treat him as a value pick only if the roster fit is clear.`;
  }
  return `Market signal: interest is mixed (${adds} adds, ${drops} drops), so the board value matters more than hype.`;
}

function bestContextNote(candidate, evidenceItems) {
  const note = String(candidate.ranking?.notes ?? "").trim();
  if (note) {
    return `Added context: ${note}`;
  }
  const item = (evidenceItems ?? []).find((entry) => entry.summary);
  return item?.summary ? `Added context: ${item.summary}` : "";
}

function buildSources(candidate, evidenceItems, trend) {
  const sources = [];
  for (const source of candidate.ranking?.sources ?? []) {
    if (source.url) {
      sources.push({
        label: source.label ?? "Ranking",
        url: source.url
      });
    }
  }
  for (const item of evidenceItems) {
    if (item.url) {
      sources.push({
        label: item.source ?? "Evidence",
        url: item.url
      });
    }
  }
  return dedupeSources(sources).slice(0, 5);
}

function dedupeSources(sources) {
  const seen = new Set();
  return sources.filter((source) => {
    const key = source.url;
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function isDraftable(player, position) {
  if (position === "DEF") {
    return true;
  }
  if (!player.first_name && !player.last_name) {
    return false;
  }
  if (player.active === false && !player.search_rank) {
    return false;
  }
  return true;
}

function displayName(player = {}) {
  const first = player.first_name ?? "";
  const last = player.last_name ?? "";
  const full = `${first} ${last}`.trim();
  if (full) {
    return full;
  }
  if (player.full_name) {
    return player.full_name;
  }
  if (player.team && normalizePosition(player.position) === "DEF") {
    return `${player.team} D/ST`;
  }
  return "Unknown player";
}

function normalizePosition(position) {
  const value = String(position ?? "").toUpperCase().trim();
  if (["DST", "D/ST", "DEFENSE"].includes(value)) {
    return "DEF";
  }
  return value;
}

function normalizeTeam(team) {
  return String(team ?? "").toUpperCase().trim();
}

function normalizeName(name) {
  return normalizeNameText(name)
    .replace(/[^a-z0-9]/g, "");
}

function normalizedNameParts(name) {
  return normalizeNameText(name)
    .split(/\s+/)
    .filter(Boolean);
}

function normalizeNameText(name) {
  return String(name ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(jr|sr|ii|iii|iv|v)\b/g, "")
    .replace(/[.'’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function teamKeyForPick(pick, draft = null) {
  const slotToRoster = draft?.slot_to_roster_id ?? {};
  const draftOrder = draft?.draft_order ?? {};
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

function estimateNextRosterPickNumber(draft = null, currentPick = null, rosterId = null) {
  const pickNo = asNumber(currentPick);
  const teams = numberSetting(draft?.settings?.teams) || 12;
  const rounds = numberSetting(draft?.settings?.rounds) || 20;
  if (!pickNo || !rosterId || teams <= 0) {
    return pickNo ? pickNo + teams : null;
  }

  const targetRosterId = String(rosterId);
  const totalPicks = Math.max(pickNo + teams * 2, teams * rounds);
  const currentOwner = rosterIdForPickNumber(draft, pickNo);
  const startPick = currentOwner === targetRosterId ? pickNo + 1 : pickNo;
  for (let nextPick = startPick; nextPick <= totalPicks; nextPick += 1) {
    if (rosterIdForPickNumber(draft, nextPick) === targetRosterId) {
      return nextPick;
    }
  }
  return pickNo + teams;
}

function rosterIdForPickNumber(draft = null, pickNo = null) {
  const teams = numberSetting(draft?.settings?.teams) || 12;
  const numericPick = asNumber(pickNo);
  if (!numericPick || teams <= 0) {
    return "";
  }

  const round = Math.max(1, Math.ceil(numericPick / teams));
  const offset = (numericPick - 1) % teams;
  const type = String(draft?.type ?? draft?.metadata?.draft_type ?? draft?.settings?.type ?? "snake").toLowerCase();
  const isLinear = type.includes("linear");
  const slot = !isLinear && round % 2 === 0 ? teams - offset : offset + 1;
  const slotToRoster = draft?.slot_to_roster_id ?? {};
  return slotToRoster[String(slot)] ? String(slotToRoster[String(slot)]) : String(slot);
}

function numberSetting(value) {
  return asNumber(value) ?? 0;
}

function draftRound(currentPick = 1, slots = {}) {
  const teams = numberSetting(slots.teams) || 12;
  return Math.max(1, Math.ceil((asNumber(currentPick) ?? 1) / teams));
}

function asNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function asPositiveNumber(value) {
  const number = asNumber(value);
  return number && number > 0 ? number : null;
}

function fallbackRank(position) {
  return {
    RB: 700,
    WR: 720,
    QB: 760,
    TE: 780,
    DEF: 900,
  }[position] ?? 999;
}

function emptyCounts() {
  return {
    QB: 0,
    RB: 0,
    WR: 0,
    TE: 0,
    DEF: 0
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
