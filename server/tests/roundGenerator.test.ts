import { generateRound, HistoricalTable, PlayerProfile } from '../src/lib/roundGenerator';

describe('round generator', () => {
  it('avoids repeating pairings across consecutive rounds for eight players', () => {
    const players: PlayerProfile[] = Array.from({ length: 8 }).map((_, idx) => ({
      id: idx + 1,
      name: `Player ${idx + 1}`,
      teamId: idx < 4 ? 1 : 2
    }));

    const firstRound = generateRound(players, []);
    const history: HistoricalTable[] = firstRound.tables.map((table) => ({ playerIds: table.playerIds }));
    const secondRound = generateRound(players, history);

    const seenPairs = new Set<string>();
    for (const table of history) {
      for (let i = 0; i < table.playerIds.length; i++) {
        for (let j = i + 1; j < table.playerIds.length; j++) {
          const pair = [table.playerIds[i], table.playerIds[j]].sort().join('-');
          seenPairs.add(pair);
        }
      }
    }

    for (const table of secondRound.tables) {
      for (let i = 0; i < table.playerIds.length; i++) {
        for (let j = i + 1; j < table.playerIds.length; j++) {
          const pair = [table.playerIds[i], table.playerIds[j]].sort().join('-');
          expect(seenPairs.has(pair)).toBe(false);
        }
      }
    }
  });
});
