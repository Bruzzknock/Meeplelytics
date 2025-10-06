export type PointsByPlacement = Record<string, number>;

export interface BonusCondition {
  rawScoreAtLeast?: number;
  placementEquals?: number;
}

export interface BonusRule {
  name: string;
  if: BonusCondition;
  addPoints: number;
}

export interface GameRules {
  pointsByPlacement?: PointsByPlacement;
  bonuses?: BonusRule[];
  kFactor?: number;
}

export interface PointsComputationInput {
  placement: number;
  rawScore?: number | null;
  rules: GameRules | null | undefined;
}

export interface PointsComputationResult {
  basePoints: number;
  bonus: number;
  total: number;
  appliedBonuses: string[];
}

const DEFAULT_POINTS: PointsByPlacement = {
  '1': 5,
  '2': 3,
  '3': 2,
  '4': 1
};

export function resolvePointsByPlacement(rules?: GameRules | null): PointsByPlacement {
  if (!rules || !rules.pointsByPlacement) {
    return DEFAULT_POINTS;
  }
  return { ...DEFAULT_POINTS, ...Object.fromEntries(
    Object.entries(rules.pointsByPlacement).map(([k, v]) => [String(k), Number(v)])
  ) };
}

export function computePoints({ placement, rawScore, rules }: PointsComputationInput): PointsComputationResult {
  const placementMap = resolvePointsByPlacement(rules ?? undefined);
  const basePoints = placementMap[String(placement)] ?? 0;
  const applied: string[] = [];
  let bonusTotal = 0;

  const bonuses = rules?.bonuses ?? [];
  for (const bonusRule of bonuses) {
    const condition = bonusRule.if ?? {};
    const meetsScore = condition.rawScoreAtLeast === undefined || (rawScore ?? -Infinity) >= condition.rawScoreAtLeast;
    const meetsPlacement = condition.placementEquals === undefined || placement === condition.placementEquals;
    if (meetsScore && meetsPlacement) {
      bonusTotal += bonusRule.addPoints;
      applied.push(bonusRule.name ?? 'Bonus');
    }
  }

  return {
    basePoints,
    bonus: bonusTotal,
    total: basePoints + bonusTotal,
    appliedBonuses: applied
  };
}

export function coerceRules(raw: unknown): GameRules {
  if (!raw || typeof raw !== 'object') {
    return {};
  }
  try {
    const candidate = raw as GameRules;
    if (candidate.bonuses) {
      candidate.bonuses = candidate.bonuses.map((bonus) => ({
        name: bonus.name,
        if: bonus.if,
        addPoints: Number(bonus.addPoints)
      }));
    }
    if (candidate.pointsByPlacement) {
      const map: PointsByPlacement = {};
      for (const [key, value] of Object.entries(candidate.pointsByPlacement)) {
        map[String(key)] = Number(value);
      }
      candidate.pointsByPlacement = map;
    }
    if (candidate.kFactor !== undefined) {
      candidate.kFactor = Number(candidate.kFactor);
    }
    return candidate;
  } catch (err) {
    return {};
  }
}
