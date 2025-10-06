import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { get, patch, post } from '../api/client';
import { Game } from '../api/types';
import { PageHeader } from '../components/PageHeader';
import { Card } from '../components/Card';

interface GameSummary {
  game: Game;
  leaderboard: { playerId: number; name: string; points: number }[];
  placementCounts: Record<string, number>;
  thresholdHits: Record<string, number>;
  avgWinningScore: number | null;
}

export default function GamesPage() {
  const queryClient = useQueryClient();
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null);
  const [rulesDraft, setRulesDraft] = useState('');
  const { data: games } = useQuery({ queryKey: ['games'], queryFn: () => get<Game[]>('/api/games') });
  const { data: summary } = useQuery({
    queryKey: ['game-summary', selectedGameId],
    queryFn: () => (selectedGameId ? get<GameSummary>(`/api/games/${selectedGameId}/summary`) : null),
    enabled: Boolean(selectedGameId)
  });

  const createGame = useMutation({
    mutationFn: (payload: { name: string; rulesetJson: unknown }) => post<Game>('/api/games', payload),
    onSuccess: (game) => {
      queryClient.invalidateQueries({ queryKey: ['games'] });
      setSelectedGameId(game.id);
    }
  });

  const updateRules = useMutation({
    mutationFn: (payload: { id: number; ruleset: unknown }) => patch<Game>(`/api/games/${payload.id}`, payload.ruleset),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['game-summary', selectedGameId] });
      queryClient.invalidateQueries({ queryKey: ['games'] });
    }
  });

  const handleCreateGame = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get('name') ?? '').trim();
    const rulesetText = String(formData.get('ruleset') ?? '').trim();
    const rulesetJson = rulesetText ? safeParseJson(rulesetText) : {};
    if (!name) return;
    createGame.mutate({ name, rulesetJson });
    event.currentTarget.reset();
  };

  const handleUpdateRules = () => {
    if (!selectedGameId) return;
    const parsed = safeParseJson(rulesDraft);
    updateRules.mutate({ id: selectedGameId, ruleset: parsed });
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Games"
        description="Manage rulesets, points, and bonuses for each board game in rotation."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Game Library" subtitle="Select a game to view its performance">
          <ul className="space-y-2 text-sm">
            {games?.map((game) => (
              <li key={game.id}>
                <button
                  onClick={() => {
                    setSelectedGameId(game.id);
                    setRulesDraft(JSON.stringify(game.rulesetJson ?? {}, null, 2));
                  }}
                  className={`w-full rounded-lg px-3 py-2 text-left transition-colors ${
                    selectedGameId === game.id ? 'bg-primary/20 text-primary-light' : 'bg-slate-900/60 text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="font-medium">{game.name}</div>
                  <div className="text-xs text-slate-500">Created {new Date(game.createdAt).toLocaleDateString()}</div>
                </button>
              </li>
            ))}
            {!games?.length && <p className="text-slate-500">No games yet.</p>}
          </ul>
        </Card>
        <Card title="Create a new game">
          <form onSubmit={handleCreateGame} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wide text-slate-400">Name</label>
              <input
                name="name"
                required
                className="w-full rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-200 focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wide text-slate-400">Ruleset JSON</label>
              <textarea
                name="ruleset"
                rows={6}
                className="w-full rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-200 focus:border-primary focus:outline-none"
                placeholder='{"pointsByPlacement":{"1":5,"2":3,"3":2,"4":1}}'
              />
            </div>
            <button
              type="submit"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-light"
              disabled={createGame.isLoading}
            >
              {createGame.isLoading ? 'Creating...' : 'Create game'}
            </button>
          </form>
        </Card>
      </div>

      {summary && selectedGameId && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title={`Summary — ${summary.game.name}`}>
            <h3 className="text-sm font-semibold text-slate-400">Top performers</h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-200">
              {summary.leaderboard.map((entry) => (
                <li key={entry.playerId} className="flex items-center justify-between">
                  <span>{entry.name}</span>
                  <span className="font-semibold text-primary-light">{entry.points.toFixed(1)}</span>
                </li>
              ))}
              {!summary.leaderboard.length && <p className="text-slate-500">No plays recorded yet.</p>}
            </ul>
            <h3 className="mt-6 text-sm font-semibold text-slate-400">Placements</h3>
            <div className="mt-2 grid grid-cols-2 gap-3 text-sm text-slate-200">
              {Object.entries(summary.placementCounts).map(([placement, count]) => (
                <div key={placement} className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-center">
                  <div className="text-xs text-slate-500">Placement {placement}</div>
                  <div className="text-lg font-semibold text-primary-light">{count}</div>
                </div>
              ))}
            </div>
            <div className="mt-6 text-sm text-slate-400">Average winning raw score: {summary.avgWinningScore ? summary.avgWinningScore.toFixed(1) : '—'}</div>
          </Card>
          <Card title="Ruleset" subtitle="Update rules to adjust scoring and Elo">
            <textarea
              value={rulesDraft}
              onChange={(event) => setRulesDraft(event.target.value)}
              rows={14}
              className="w-full rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-200 focus:border-primary focus:outline-none"
            />
            <button
              onClick={handleUpdateRules}
              className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-light"
              disabled={updateRules.isLoading}
            >
              {updateRules.isLoading ? 'Saving...' : 'Save rules'}
            </button>
            <div className="mt-3 text-xs text-slate-500">Use JSON to configure placement points, bonuses, or a custom K factor.</div>
          </Card>
        </div>
      )}
    </div>
  );
}

function safeParseJson(text: string) {
  try {
    return text ? JSON.parse(text) : {};
  } catch (error) {
    console.error('Failed to parse JSON, falling back to empty object.', error);
    return {};
  }
}
