import { computePoints, coerceRules } from '../src/lib/rules';

describe('points and bonuses', () => {
  it('applies default placement points', () => {
    const result = computePoints({ placement: 1, rawScore: null, rules: {} });
    expect(result.basePoints).toBe(5);
    expect(result.bonus).toBe(0);
    expect(result.total).toBe(5);
  });

  it('applies custom points and bonuses', () => {
    const rules = coerceRules({
      pointsByPlacement: { '1': 6, '2': 4, '3': 2, '4': 0 },
      bonuses: [{ name: 'High score', if: { rawScoreAtLeast: 80 }, addPoints: 2 }]
    });
    const result = computePoints({ placement: 2, rawScore: 85, rules });
    expect(result.basePoints).toBe(4);
    expect(result.bonus).toBe(2);
    expect(result.appliedBonuses).toContain('High score');
    expect(result.total).toBe(6);
  });
});
