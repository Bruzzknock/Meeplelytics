import { GameRules } from './rules';

export interface TableEloInput {
  playerId: number;
  placement: number;
  rating: number;
}

export interface EloComputationResult {
  playerId: number;
  before: number;
  after: number;
  delta: number;
}

export interface EloComputationOptions {
  rules?: GameRules | null;
  clamp?: number;
}

const DEFAULT_K = 24;
const DEFAULT_CLAMP = 48;

function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

function placementBeats(placementA: number, placementB: number): number {
  return placementA < placementB ? 1 : 0;
}

export function computeEloForTable(players: TableEloInput[], options: EloComputationOptions = {}): EloComputationResult[] {
  if (players.length !== 4) {
    throw new Error('Elo tables must contain exactly 4 players');
  }
  const kFactor = options.rules?.kFactor ?? DEFAULT_K;
  const clamp = options.clamp ?? DEFAULT_CLAMP;

  return players.map((player, idx) => {
    let sumDiff = 0;
    for (let j = 0; j < players.length; j++) {
      if (j === idx) continue;
      const opponent = players[j];
      const expected = expectedScore(player.rating, opponent.rating);
      const actual = placementBeats(player.placement, opponent.placement);
      sumDiff += actual - expected;
    }
    let delta = Math.round(kFactor * sumDiff);
    if (delta > clamp) delta = clamp;
    if (delta < -clamp) delta = -clamp;
    const after = player.rating + delta;
    return {
      playerId: player.playerId,
      before: player.rating,
      after,
      delta
    };
  });
}
