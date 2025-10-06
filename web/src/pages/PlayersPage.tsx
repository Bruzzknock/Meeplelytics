import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { get } from '../api/client';
import { Player, Team } from '../api/types';
import { PageHeader } from '../components/PageHeader';
import { DataTable } from '../components/DataTable';
import { Card } from '../components/Card';

export default function PlayersPage() {
  const [search, setSearch] = useState('');
  const [teamId, setTeamId] = useState<number | 'all'>('all');

  const { data: teams } = useQuery({ queryKey: ['teams'], queryFn: () => get<Team[]>('/api/teams') });
  const { data: players, isLoading } = useQuery({
    queryKey: ['players', search, teamId],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (teamId !== 'all') params.set('teamId', String(teamId));
      const query = params.toString();
      return get<Player[]>(`/api/players${query ? `?${query}` : ''}`);
    }
  });

  const perGameHeaders = useMemo(() => {
    if (!players?.length) return [] as string[];
    const keys = new Set<string>();
    players.forEach((player) => {
      Object.keys(player.perGamePoints ?? {}).forEach((game) => keys.add(game));
    });
    return Array.from(keys);
  }, [players]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Players"
        description="Track individual performance, total points, and Elo ratings across every game."
        actions={
          <div className="flex gap-3">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search players"
              className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-200 focus:border-primary focus:outline-none"
            />
            <select
              value={teamId === 'all' ? 'all' : String(teamId)}
              onChange={(event) => setTeamId(event.target.value === 'all' ? 'all' : Number(event.target.value))}
              className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-200 focus:border-primary focus:outline-none"
            >
              <option value="all">All teams</option>
              {teams?.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>
        }
      />

      {isLoading && <div className="text-sm text-slate-400">Loading players...</div>}

      {players && (
        <Card>
          <DataTable
            data={players}
            columns={[
              { key: 'name', header: 'Name', render: (player) => <span className="font-medium text-slate-100">{player.name}</span> },
              { key: 'handle', header: 'Handle', render: (player) => <span className="text-slate-400">@{player.handle}</span> },
              {
                key: 'team',
                header: 'Team',
                render: (player) => player.team?.name ?? '—'
              },
              {
                key: 'rating',
                header: 'Elo',
                render: (player) => <span className="font-semibold text-primary-light">{player.rating}</span>
              },
              {
                key: 'totalPoints',
                header: 'Total Points',
                render: (player) => player.totalPoints?.toFixed(1) ?? '0.0'
              },
              ...perGameHeaders.map((game) => ({
                key: game,
                header: game,
                render: (player: Player) => (player.perGamePoints?.[game] ? player.perGamePoints[game].toFixed(1) : '—')
              }))
            ]}
            emptyMessage="No players match the current filters."
          />
        </Card>
      )}
    </div>
  );
}
