export interface Team {
  id: number;
  name: string;
  color?: string | null;
  createdAt: string;
  totalPoints?: number;
}

export interface Player {
  id: number;
  name: string;
  handle: string;
  teamId?: number | null;
  team?: Team | null;
  rating: number;
  totalPoints?: number;
  perGamePoints?: Record<string, number>;
}

export interface Game {
  id: number;
  name: string;
  rulesetJson: unknown;
  createdAt: string;
}

export interface TournamentSummary {
  id: number;
  name: string;
  status: 'draft' | 'running' | 'complete';
  game: Game;
  rounds: number;
  createdAt: string;
}

export interface DashboardData {
  topTeams: { teamId: number; name: string; points: number }[];
  topPlayers: { playerId: number; name: string; points: number; teamName?: string | null }[];
  topElo: { playerId: number; name: string; rating: number; teamName?: string | null }[];
  bonusHits: { name: string; count: number }[];
  ratingSeries: { playerId: number; delta: number; createdAt: string }[];
  avgWinning: number | null;
}

export interface TournamentDetail {
  id: number;
  name: string;
  status: string;
  game: Game;
  participants: { playerId: number; player: Player }[];
  rounds: RoundDetail[];
}

export interface RoundDetail {
  id: number;
  index: number;
  locked: boolean;
  tables: TableDetail[];
}

export interface TableDetail {
  id: number;
  tableIndex: number;
  seats: { id: number; seatNumber: number; player: Player }[];
  results: { id: number; playerId: number; placement: number; rawScore: number | null; pointsAwarded: number }[];
}

export interface LeaderboardResponse {
  individuals: { playerId: number; name: string; points: number; rating: number; teamName?: string | null }[];
  teams: { teamId: number; teamName: string; points: number }[];
  elo: { playerId: number; name: string; rating: number; teamName?: string | null }[];
}
