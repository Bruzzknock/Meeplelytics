import { computeEloForTable } from '../src/lib/elo';

const ratings = [1500, 1500, 1500, 1500];

describe('elo computation', () => {
  it('awards positive delta to top placements', () => {
    const results = computeEloForTable(
      ratings.map((rating, idx) => ({ playerId: idx + 1, rating, placement: idx + 1 }))
    );
    const deltas = results.map((r) => r.delta);
    expect(deltas[0]).toBeGreaterThan(0);
    expect(deltas[3]).toBeLessThan(0);
    const total = deltas.reduce((sum, delta) => sum + delta, 0);
    expect(Math.abs(total)).toBeLessThanOrEqual(1);
  });

  it('clamps extreme outcomes', () => {
    const unevenRatings = [2000, 1000, 1000, 1000];
    const results = computeEloForTable(
      unevenRatings.map((rating, idx) => ({ playerId: idx + 1, rating, placement: idx === 0 ? 4 : idx }))
    );
    const topLossDelta = results.find((r) => r.playerId === 1)!.delta;
    expect(topLossDelta).toBeLessThan(0);
    expect(Math.abs(topLossDelta)).toBeLessThanOrEqual(48);
  });
});
