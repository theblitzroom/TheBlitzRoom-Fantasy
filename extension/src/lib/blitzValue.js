export const BLITZ_VALUE_WEIGHTS = Object.freeze({
  production: 0.4,
  market: 0.2,
  news: 0.15,
  opportunity: 0.1,
  schedule: 0.05,
  aiConfidence: 0.1
});

const CORE_POSITIONS = new Set(["QB", "RB", "WR", "TE", "DEF"]);

export function buildBlitzValueProfile(input = {}) {
  const candidate = input.candidate ?? {};
  const player = input.player ?? candidate.player ?? {};
  const ranking = input.ranking ?? candidate.ranking ?? {};
  const position = normalizePosition(input.position ?? candidate.position ?? ranking.position ?? player.position ?? player.fantasy_positions?.[0]);
  const boardRank = positiveNumber(input.boardRank ?? candidate.rankSort ?? ranking.rank ?? ranking.overallRank);
  const marketRank = positiveNumber(input.marketRank ?? candidate.platformRank ?? ranking.platformRank ?? ranking.sleeperRank ?? ranking.adp ?? ranking.averageRank ?? ranking.avgRank ?? player.search_rank);
  const positionRank = positiveNumber(input.positionRank ?? candidate.positionRank ?? ranking.positionRank ?? ranking.posRank ?? ranking.positionalRank);
  const productionSnapshot = input.production ?? {};
  const draftContext = input.draftContext ?? {};
  const evidenceItems = Array.isArray(input.evidenceItems) ? input.evidenceItems : [];
  const trend = input.trend ?? {};
  const age = positiveNumber(input.age ?? player.age ?? ranking.age ?? player.metadata?.age);
  const fantasyCalcValue = positiveNumber(
    input.fantasyCalcValue ??
      ranking.fantasyCalcValue ??
      ranking.value ??
      ranking.redraftValue ??
      ranking.combinedValue
  );
  const maxFantasyCalcValue = positiveNumber(input.maxFantasyCalcValue ?? ranking.maxFantasyCalcValue);

  const valueScore = scoreFantasyCalcValue(fantasyCalcValue, maxFantasyCalcValue, boardRank);
  const boardScore = scoreRank(boardRank);
  const marketRankScore = scoreRank(marketRank);
  const positionScore = scorePositionRank(position, positionRank);
  const talent = weightedAverage([
    [valueScore, fantasyCalcValue ? 0.54 : 0],
    [boardScore, boardRank ? 0.28 : 0],
    [positionScore, positionRank ? 0.18 : 0]
  ], boardScore || valueScore || 50);
  const trendScore = scoreTrend(trend, ranking);
  const risk = scoreRisk({ player, ranking, evidenceItems, position, age, draftContext, production: productionSnapshot });
  const production = scoreProduction({ production: productionSnapshot, position, talent, boardScore, positionScore, risk });
  const market = scoreMarket({ valueScore, marketRankScore, boardScore, trendScore, fantasyCalcValue, marketRank });
  const news = scoreNews({ evidenceItems, trend, player, ranking, risk });
  const opportunity = scoreOpportunity({ position, positionRank, ranking, production, talent, draftContext });
  const schedule = scoreSchedule(ranking);
  const aiConfidence = scoreAiConfidence({
    production,
    market,
    news,
    opportunity,
    schedule,
    talent,
    risk,
    ranking,
    productionSnapshot,
    marketRank,
    boardRank
  });
  const situation = clamp(Math.round(opportunity * 0.5 + market * 0.22 + news * 0.18 + schedule * 0.1), 0, 100);
  const longevity = scoreLongevity({ position, age, isDynasty: draftContext?.isDynasty === true });
  const upside = scoreUpside({ production, talent, opportunity, risk, productionSnapshot, position });
  const consistency = clamp(Math.round(aiConfidence * 0.52 + (100 - risk) * 0.28 + production * 0.2), 0, 100);
  const playoff = schedule;

  const formulaScore =
    production * BLITZ_VALUE_WEIGHTS.production +
    market * BLITZ_VALUE_WEIGHTS.market +
    news * BLITZ_VALUE_WEIGHTS.news +
    opportunity * BLITZ_VALUE_WEIGHTS.opportunity +
    schedule * BLITZ_VALUE_WEIGHTS.schedule +
    aiConfidence * BLITZ_VALUE_WEIGHTS.aiConfidence;
  const overall = Math.round(clamp(formulaScore, 0, 100) * 100);
  const redraftScore = clamp(
    production * 0.52 + market * 0.2 + opportunity * 0.12 + news * 0.08 + schedule * 0.04 + aiConfidence * 0.04,
    0,
    100
  );
  const dynastyScore = clamp(
    production * 0.3 + market * 0.22 + longevity * 0.2 + talent * 0.12 + upside * 0.08 + news * 0.05 + aiConfidence * 0.03,
    0,
    100
  );
  const championshipImpact = clamp(
    Math.round(production * 0.45 + opportunity * 0.22 + upside * 0.18 + schedule * 0.1 - risk * 0.08),
    0,
    100
  );
  const volatilityScore = clamp(Math.round(risk * 0.56 + Math.abs(upside - production) * 0.28 + (100 - aiConfidence) * 0.16), 0, 100);
  const floor = Math.round(clamp(overall - volatilityScore * 18 - risk * 12, 0, 10000));
  const ceiling = Math.round(clamp(overall + Math.max(0, upside - 50) * 28 + Math.max(0, 100 - risk) * 4, 0, 11000));
  const reasons = buildMovementReasons({
    production,
    market,
    news,
    opportunity,
    schedule,
    aiConfidence,
    talent,
    risk,
    trendScore,
    productionSnapshot,
    evidenceItems,
    ranking,
    player
  });
  const delta = reasons.reduce((total, reason) => total + reason.delta, 0);
  const status = delta >= 140 ? "Rising" : delta <= -140 ? "Falling" : "Stable";

  return {
    overall,
    rating: blitzValueToRating(overall),
    redraftValue: Math.round(redraftScore * 100),
    dynastyValue: Math.round(dynastyScore * 100),
    championshipImpact,
    floor,
    ceiling,
    volatility: volatilityLabel(volatilityScore),
    volatilityScore,
    trend: {
      status,
      delta,
      label: formatBlitzDelta(delta)
    },
    confidence: Math.round(aiConfidence),
    formulaWeights: BLITZ_VALUE_WEIGHTS,
    components: {
      production: Math.round(production),
      market: Math.round(market),
      news: Math.round(news),
      opportunity: Math.round(opportunity),
      schedule: Math.round(schedule),
      aiConfidence: Math.round(aiConfidence),
      situation: Math.round(situation),
      talent: Math.round(talent),
      longevity: Math.round(longevity),
      upside: Math.round(upside),
      risk: Math.round(risk),
      consistency: Math.round(consistency),
      playoff: Math.round(playoff)
    },
    reasons,
    inputs: {
      position: CORE_POSITIONS.has(position) ? position : "",
      boardRank: boardRank ?? null,
      marketRank: marketRank ?? null,
      positionRank: positionRank ?? null,
      fantasyCalcValue: fantasyCalcValue ?? null,
      maxFantasyCalcValue: maxFantasyCalcValue ?? null
    }
  };
}

export function blitzValueToRating(profileOrValue) {
  const value = Number(typeof profileOrValue === "object" ? profileOrValue?.overall : profileOrValue);
  if (!Number.isFinite(value)) {
    return null;
  }
  const curve = [
    [0, 0],
    [1800, 16],
    [3000, 28],
    [4400, 46],
    [5600, 61],
    [6800, 74],
    [7800, 84],
    [8600, 91],
    [9000, 96],
    [9300, 98],
    [9700, 99],
    [10000, 99],
    [11000, 99]
  ];
  return Math.round(clamp(interpolateCurve(clamp(value, 0, 11000), curve), 0, 99));
}

export function formatBlitzValue(value, { suffix = true, compact = false } = {}) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  const number = Math.round(Number(value));
  if (!Number.isFinite(number)) {
    return "-";
  }
  const text = compact && Math.abs(number) >= 1000
    ? `${Math.round(number / 100) / 10}k`
    : formatInteger(number);
  return suffix ? `${text} BV` : text;
}

export function formatBlitzDelta(delta, { suffix = true } = {}) {
  const number = Math.round(Number(delta));
  if (!Number.isFinite(number) || number === 0) {
    return suffix ? "Flat 0 BV" : "Flat 0";
  }
  const text = `${number > 0 ? "Up +" : "Down "}${formatInteger(Math.abs(number))}`;
  return suffix ? `${text} BV` : text;
}

function scoreFantasyCalcValue(value, maxValue, rank) {
  if (value && maxValue) {
    return clamp(Math.pow(clamp(value / maxValue, 0, 1), 0.62) * 99, 1, 99);
  }
  return scoreRank(rank);
}

function scoreRank(rank) {
  const numeric = positiveNumber(rank);
  if (!numeric) {
    return 50;
  }
  return clamp(interpolateCurve(numeric, [
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
  ]), 1, 99);
}

function scorePositionRank(position, positionRank) {
  const rank = positiveNumber(positionRank);
  if (!rank) {
    return 50;
  }
  const curves = {
    QB: [[1, 99], [3, 96], [6, 91], [12, 78], [18, 63], [28, 42], [40, 18]],
    RB: [[1, 99], [3, 97], [6, 94], [12, 88], [18, 79], [24, 70], [36, 55], [55, 34], [80, 13]],
    WR: [[1, 99], [3, 97], [6, 94], [12, 88], [24, 78], [36, 66], [55, 49], [80, 27], [110, 9]],
    TE: [[1, 99], [3, 93], [6, 85], [12, 69], [20, 49], [32, 26], [45, 10]],
    DEF: [[1, 78], [5, 68], [12, 55], [24, 35], [32, 20]]
  };
  return clamp(interpolateCurve(rank, curves[position] ?? curves.WR), 1, 99);
}

function scoreProduction({ production, position, talent, boardScore, positionScore, risk }) {
  const projectedPpg = positiveNumber(production.projectedPpg);
  const projectedTotal = positiveNumber(production.projectedTotal ?? production.projection);
  const lastYearPpg = positiveNumber(production.lastYearPpg);
  const projectionScore = projectedPpg
    ? scorePpg(position, projectedPpg)
    : projectedTotal
      ? scoreSeasonPoints(position, projectedTotal)
      : talent * 0.68 + boardScore * 0.2 + positionScore * 0.12;
  const lastYearScore = lastYearPpg ? scorePpg(position, lastYearPpg) : projectionScore;
  return clamp(Math.round(projectionScore * 0.66 + lastYearScore * 0.18 + talent * 0.16 - risk * 0.08), 1, 99);
}

function scorePpg(position, ppg) {
  const curves = {
    QB: [[4, 8], [10, 38], [14, 62], [17, 78], [20, 91], [23, 98], [26, 99]],
    RB: [[2, 8], [7, 42], [10, 65], [13, 80], [16, 91], [19, 97], [22, 99]],
    WR: [[2, 8], [7, 40], [10, 62], [13, 78], [16, 90], [19, 97], [22, 99]],
    TE: [[1, 8], [5, 40], [8, 62], [11, 80], [14, 93], [17, 99]],
    DEF: [[2, 18], [5, 45], [7, 64], [9, 78], [11, 88], [13, 96]]
  };
  return clamp(interpolateCurve(ppg, curves[position] ?? curves.WR), 1, 99);
}

function scoreSeasonPoints(position, points) {
  return scorePpg(position, points / 17);
}

function scoreMarket({ valueScore, marketRankScore, boardScore, trendScore, fantasyCalcValue, marketRank }) {
  const pairs = [
    [valueScore, fantasyCalcValue ? 0.64 : 0.24],
    [marketRankScore, marketRank ? 0.2 : 0],
    [boardScore, 0.16],
    [trendScore, 0.1]
  ];
  return clamp(Math.round(weightedAverage(pairs, boardScore || valueScore || 50)), 1, 99);
}

function scoreTrend(trend = {}, ranking = {}) {
  const adds = positiveNumber(trend.adds);
  const drops = positiveNumber(trend.drops);
  const maxAdds = positiveNumber(trend.maxAdds);
  const maxDrops = positiveNumber(trend.maxDrops);
  const trend30Day = numberValue(ranking.trend30Day ?? trend.trend30Day);
  let score = 75;
  if (adds && maxAdds) {
    score += clamp(adds / Math.max(1, maxAdds) * 18, 0, 18);
  }
  if (drops && maxDrops) {
    score -= clamp(drops / Math.max(1, maxDrops) * 20, 0, 20);
  }
  if (Number.isFinite(trend30Day)) {
    score += clamp(trend30Day / 25, -12, 12);
  }
  return clamp(Math.round(score), 25, 99);
}

function scoreNews({ evidenceItems, trend, player, ranking, risk }) {
  let score = 88;
  for (const item of evidenceItems) {
    const direction = item?.sentiment === "negative" ? -1 : 1;
    const weight = positiveNumber(item?.weight) ?? 1;
    score += direction * clamp(weight * 9, 1, 18);
    score += keywordNewsDelta(item);
  }
  const trendScore = scoreTrend(trend, ranking);
  score += clamp((trendScore - 75) * 0.35, -8, 8);
  if (hasInjuryFlag(player)) {
    score -= 22;
  }
  score -= risk * (hasInjuryFlag(player) ? 0.1 : 0.04);
  return clamp(Math.round(score), 1, 99);
}

function keywordNewsDelta(item = {}) {
  const text = `${item.title ?? ""} ${item.summary ?? ""} ${item.note ?? ""} ${item.description ?? ""}`.toLowerCase();
  let delta = 0;
  if (/\b(starting role|starter named|lead back|featured|workload|target share|first team|healthy|full practice|extension|camp buzz|strong camp|impressive camp|qb upgrade|trade to a better offense)\b/.test(text)) {
    delta += 11;
  }
  if (/\b(injury|injured|out|ir|acl|hamstring|surgery|setback|limited|holdout|suspended|demoted|backup role|trade to a backup role)\b/.test(text)) {
    delta -= 16;
  }
  return delta;
}

function scoreOpportunity({ position, positionRank, ranking, production, talent, draftContext }) {
  const roleScore = scorePositionRank(position, positionRank);
  const rosterPercent = positiveNumber(ranking.rosterPercent);
  const rosterScore = rosterPercent ? clamp(38 + rosterPercent * 0.62, 35, 99) : roleScore;
  const premium = position === "TE" && draftContext?.isTep ? 5 : 0;
  const superflex = position === "QB" && draftContext?.isSuperflex ? 4 : 0;
  return clamp(Math.round(roleScore * 0.46 + production * 0.24 + rosterScore * 0.16 + talent * 0.14 + premium + superflex), 1, 99);
}

function scoreSchedule(ranking = {}) {
  const numeric = positiveNumber(ranking.scheduleScore ?? ranking.playoffScore ?? ranking.playoffScheduleScore ?? ranking.sosScore);
  if (numeric) {
    return clamp(numeric <= 10 ? 48 + numeric * 5 : numeric, 20, 99);
  }
  const text = String(ranking.playoffSchedule ?? ranking.schedule ?? ranking.sos ?? ranking.strengthOfSchedule ?? "").toLowerCase();
  if (/\b(great|easy|soft|favorable|plus|green)\b/.test(text)) return 90;
  if (/\b(good|above average)\b/.test(text)) return 82;
  if (/\b(hard|difficult|bad|brutal|red)\b/.test(text)) return 55;
  if (/\b(average|neutral|medium)\b/.test(text)) return 76;
  return 78;
}

function scoreAiConfidence({ production, market, news, opportunity, schedule, talent, risk, ranking, productionSnapshot, marketRank, boardRank }) {
  const values = [production, market, news, opportunity, schedule, talent].filter((value) => Number.isFinite(value));
  const agreement = 100 - standardDeviation(values) * 1.25;
  const completeness = [
    positiveNumber(ranking?.fantasyCalcValue ?? ranking?.value),
    boardRank,
    marketRank,
    positiveNumber(ranking?.positionRank ?? ranking?.posRank),
    positiveNumber(productionSnapshot?.projectedPpg ?? productionSnapshot?.projectedTotal)
  ].filter(Boolean).length / 5;
  return clamp(Math.round(agreement * 0.45 + completeness * 32 + (100 - risk) * 0.18 + 8), 35, 99);
}

function scoreLongevity({ position, age, isDynasty }) {
  if (!isDynasty) {
    return 72;
  }
  if (!age) {
    return position === "QB" ? 84 : 74;
  }
  const curves = {
    QB: [[21, 92], [27, 97], [31, 95], [34, 88], [37, 76], [40, 58], [44, 34]],
    RB: [[20, 96], [23, 98], [24, 94], [25, 88], [26, 78], [27, 64], [28, 48], [30, 24]],
    WR: [[20, 94], [24, 98], [26, 96], [28, 86], [29, 74], [31, 48], [34, 24]],
    TE: [[21, 88], [25, 93], [29, 90], [31, 75], [33, 56], [35, 32]],
    DEF: [[1, 60], [40, 60]]
  };
  return clamp(interpolateCurve(age, curves[position] ?? curves.WR), 1, 99);
}

function scoreUpside({ production, talent, opportunity, risk, productionSnapshot }) {
  const ceilingPpg = positiveNumber(productionSnapshot?.ceilingPpg);
  const projectedPpg = positiveNumber(productionSnapshot?.projectedPpg);
  const ceilingLift = ceilingPpg && projectedPpg ? clamp((ceilingPpg - projectedPpg) * 2.8, 0, 10) : 4;
  return clamp(Math.round(production * 0.38 + talent * 0.3 + opportunity * 0.22 + ceilingLift - risk * 0.05), 1, 99);
}

function scoreRisk({ player, ranking, evidenceItems, position, age, draftContext, production }) {
  let score = 16;
  if (hasInjuryFlag(player)) {
    score += 28;
  }
  for (const item of evidenceItems) {
    const delta = keywordNewsDelta(item);
    if (delta < 0) {
      score += 12;
    } else if (delta > 0) {
      score -= 2;
    }
  }
  const projectedPpg = positiveNumber(production?.projectedPpg);
  const lastYearPpg = positiveNumber(production?.lastYearPpg);
  if (projectedPpg && lastYearPpg && projectedPpg - lastYearPpg >= 3.5) {
    score += 7;
  }
  if (draftContext?.isDynasty && age) {
    if (position === "RB" && age >= 28) score += 18;
    if (position === "WR" && age >= 31) score += 13;
    if (position === "TE" && age >= 33) score += 12;
    if (position === "QB" && age >= 38) score += 9;
  }
  if (ranking?.riskScore) {
    score = Math.max(score, positiveNumber(ranking.riskScore));
  }
  return clamp(Math.round(score), 0, 100);
}

function buildMovementReasons(input) {
  const reasons = [];
  const productionDelta = clamp(Math.round((input.production - input.talent) * 7), -450, 450);
  if (Math.abs(productionDelta) >= 45) {
    reasons.push({
      category: "Projection Model",
      delta: productionDelta,
      label: productionDelta > 0 ? "Projected workload/production is beating baseline" : "Projection model is below talent baseline"
    });
  }

  const marketDelta = clamp(Math.round((input.market - 75) * 7 + (input.trendScore - 75) * 3), -520, 520);
  if (Math.abs(marketDelta) >= 45) {
    reasons.push({
      category: "Market Value",
      delta: marketDelta,
      label: marketDelta > 0 ? "Market and draft-room value are moving up" : "Market and draft-room value are cooling"
    });
  }

  const newsDelta = clamp(Math.round((input.news - 82) * 8), -700, 700);
  if (Math.abs(newsDelta) >= 35) {
    reasons.push({
      category: "News Engine",
      delta: newsDelta,
      label: newsDelta > 0 ? "News/context supports the role" : "News/context adds a discount"
    });
  }

  const opportunityDelta = clamp(Math.round((input.opportunity - 75) * 5), -360, 360);
  if (Math.abs(opportunityDelta) >= 40) {
    reasons.push({
      category: "Opportunity Model",
      delta: opportunityDelta,
      label: opportunityDelta > 0 ? "Role and opportunity profile are stronger than neutral" : "Role and opportunity profile are thinner than neutral"
    });
  }

  const scheduleDelta = clamp(Math.round((input.schedule - 78) * 4), -180, 180);
  if (Math.abs(scheduleDelta) >= 35) {
    reasons.push({
      category: "Schedule",
      delta: scheduleDelta,
      label: scheduleDelta > 0 ? "Schedule adds a small playoff-season lift" : "Schedule creates a small late-season drag"
    });
  }

  const confidenceDelta = clamp(Math.round((input.aiConfidence - 75) * 4), -240, 240);
  if (Math.abs(confidenceDelta) >= 35) {
    reasons.push({
      category: "AI Confidence",
      delta: confidenceDelta,
      label: confidenceDelta > 0 ? "Models agree with the player profile" : "Model agreement is thinner than preferred"
    });
  }

  if (input.risk >= 45) {
    reasons.push({
      category: "Risk",
      delta: -Math.round(input.risk * 5),
      label: "Risk profile requires a BV discount"
    });
  }

  if (!reasons.length) {
    reasons.push({
      category: "Baseline",
      delta: 0,
      label: "Baseline value from loaded rankings and neutral live signals"
    });
  }

  return reasons
    .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta))
    .slice(0, 5);
}

function volatilityLabel(score) {
  if (score >= 58) return "High";
  if (score >= 34) return "Medium";
  return "Low";
}

function hasInjuryFlag(player = {}) {
  const text = `${player.injury_status ?? ""} ${player.status ?? ""}`.toLowerCase();
  return /\b(out|ir|injured|pup|doubtful|questionable|limited|suspended)\b/.test(text);
}

function weightedAverage(pairs, fallback = 50) {
  let total = 0;
  let weightTotal = 0;
  for (const [value, weight] of pairs) {
    if (!Number.isFinite(value) || !Number.isFinite(weight) || weight <= 0) {
      continue;
    }
    total += value * weight;
    weightTotal += weight;
  }
  return weightTotal ? total / weightTotal : fallback;
}

function standardDeviation(values) {
  if (!values.length) {
    return 18;
  }
  const average = values.reduce((total, value) => total + value, 0) / values.length;
  const variance = values.reduce((total, value) => total + (value - average) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function interpolateCurve(value, curve) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return curve[0][1];
  }
  if (numeric <= curve[0][0]) {
    return curve[0][1];
  }
  for (let index = 1; index < curve.length; index += 1) {
    const [rightX, rightY] = curve[index];
    const [leftX, leftY] = curve[index - 1];
    if (numeric <= rightX) {
      const percent = (numeric - leftX) / Math.max(1, rightX - leftX);
      return leftY + (rightY - leftY) * percent;
    }
  }
  return curve[curve.length - 1][1];
}

function positiveNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const match = typeof value === "string" ? value.match(/-?\d+(\.\d+)?/) : null;
  const number = Number(match ? match[0] : value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function numberValue(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizePosition(position) {
  const value = String(position ?? "").trim().toUpperCase();
  if (["DST", "D/ST", "DEFENSE"].includes(value)) {
    return "DEF";
  }
  return value;
}

function formatInteger(value) {
  return String(Math.round(Number(value) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
