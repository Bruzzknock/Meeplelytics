export interface PlayerProfile {
  id: number;
  name: string;
  teamId?: number | null;
}

export interface HistoricalTable {
  playerIds: number[];
}

export interface GeneratedTable {
  tableIndex: number;
  playerIds: number[];
  teamSummary: Record<string, number>;
  pairScore: number;
}

export interface RoundGenerationResult {
  tables: GeneratedTable[];
  explanation: string[];
}

function combination<T>(arr: T[], k: number): T[][] {
  const results: T[][] = [];
  const choose = (start: number, depth: number, path: T[]) => {
    if (depth === 0) {
      results.push([...path]);
      return;
    }
    for (let i = start; i <= arr.length - depth; i++) {
      path.push(arr[i]);
      choose(i + 1, depth - 1, path);
      path.pop();
    }
  };
  choose(0, k, []);
  return results;
}

function buildPairKey(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

export function generateRound(players: PlayerProfile[], history: HistoricalTable[]): RoundGenerationResult {
  if (players.length % 4 !== 0) {
    throw new Error('Player count must be divisible by 4');
  }

  const pairCount = new Map<string, number>();
  for (const table of history) {
    const ids = table.playerIds;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const key = buildPairKey(ids[i], ids[j]);
        pairCount.set(key, (pairCount.get(key) ?? 0) + 1);
      }
    }
  }

  const remaining = [...players];
  const tables: GeneratedTable[] = [];

  const pairLoad = (candidate: PlayerProfile) => {
    return remaining.reduce((sum, other) => {
      if (other.id === candidate.id) return sum;
      const key = buildPairKey(candidate.id, other.id);
      return sum + (pairCount.get(key) ?? 0);
    }, 0);
  };

  let tableIndex = 1;
  while (remaining.length) {
    remaining.sort((a, b) => pairLoad(b) - pairLoad(a));
    const anchor = remaining.shift()!;
    const combos = combination(remaining, 3);
    let bestCombo: PlayerProfile[] | null = null;
    let bestScore = Number.POSITIVE_INFINITY;

    for (const combo of combos) {
      const group = [anchor, ...combo];
      let score = 0;
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          score += pairCount.get(buildPairKey(group[i].id, group[j].id)) ?? 0;
        }
      }
      const teamCounts = new Map<number | string, number>();
      for (const p of group) {
        const key = p.teamId ?? `solo-${p.id}`;
        teamCounts.set(key, (teamCounts.get(key) ?? 0) + 1);
      }
      const counts = Array.from(teamCounts.values());
      counts.sort((a, b) => b - a);
      if (counts.length === 2 && counts[0] === 2 && counts[1] === 2) {
        score -= 0.5; // reward perfect 2v2 mix
      } else {
        score += counts[0] > 2 ? counts[0] * 0.5 : counts[0] * 0.2;
      }
      if (score < bestScore) {
        bestScore = score;
        bestCombo = combo;
      }
    }

    if (!bestCombo) {
      throw new Error('Unable to build a table with remaining players');
    }

    const selectedIds = [anchor, ...bestCombo].map((p) => p.id);
    const teamSummary: Record<string, number> = {};
    for (const p of [anchor, ...bestCombo]) {
      const key = p.teamId ? `team-${p.teamId}` : `player-${p.id}`;
      teamSummary[key] = (teamSummary[key] ?? 0) + 1;
    }

    tables.push({
      tableIndex,
      playerIds: selectedIds,
      teamSummary,
      pairScore: bestScore
    });

    for (const comboPlayer of bestCombo) {
      const idx = remaining.findIndex((p) => p.id === comboPlayer.id);
      if (idx >= 0) {
        remaining.splice(idx, 1);
      }
    }

    tableIndex += 1;
  }

  const explanation: string[] = tables.map((table) => {
    const repeats = table.pairScore >= 0 ? table.pairScore.toFixed(2) : '0';
    return `Table ${table.tableIndex} minimised repeat pair score ${repeats}`;
  });

  return { tables, explanation };
}
