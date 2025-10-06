import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { get } from '../api/client';
import { Team } from '../api/types';
import { PageHeader } from '../components/PageHeader';
import { Card } from '../components/Card';
import { DataTable } from '../components/DataTable';

interface TeamSummary {
  team: Team & { players: { id: number; name: string }[] };
  totalPoints: number;
  perGame: Record<string, number>;
}

export default function TeamsPage() {
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const { data: teams, isLoading } = useQuery({ queryKey: ['teams'], queryFn: () => get<Team[]>('/api/teams') });
  const { data: summary } = useQuery({
    queryKey: ['team-summary', selectedTeamId],
    queryFn: () => (selectedTeamId ? get<TeamSummary>(`/api/teams/${selectedTeamId}/summary`) : null),
    enabled: Boolean(selectedTeamId)
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Teams"
        description="Compare squads by total points and dive into roster performance by game."
      />
      {isLoading && <div className="text-sm text-slate-400">Loading teams...</div>}
      {teams && (
        <Card title="Leaderboard" subtitle="Select a team to view details">
          <DataTable
            data={teams.sort((a, b) => (b.totalPoints ?? 0) - (a.totalPoints ?? 0))}
            columns={[
              {
                key: 'name',
                header: 'Team',
                render: (team) => (
                  <button
                    onClick={() => setSelectedTeamId(team.id)}
                    className="text-left text-slate-100 hover:text-primary-light"
                  >
                    {team.name}
                  </button>
                )
              },
              {
                key: 'totalPoints',
                header: 'Total Points',
                render: (team) => (team.totalPoints ? team.totalPoints.toFixed(1) : '0.0')
              }
            ]}
            emptyMessage="No teams have been created yet."
          />
        </Card>
      )}

      {summary && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card title={summary.team.name} subtitle={`Total points: ${summary.totalPoints.toFixed(1)}`}>
            <h3 className="mb-3 text-sm font-semibold text-slate-400">Roster</h3>
            <ul className="space-y-2 text-sm text-slate-200">
              {summary.team.players.map((player) => (
                <li key={player.id}>{player.name}</li>
              ))}
            </ul>
          </Card>
          <Card title="Per-game contribution">
            <ul className="space-y-2 text-sm text-slate-200">
              {Object.entries(summary.perGame).map(([game, value]) => (
                <li key={game} className="flex items-center justify-between">
                  <span>{game}</span>
                  <span className="font-semibold text-primary-light">{value.toFixed(1)}</span>
                </li>
              ))}
              {!Object.keys(summary.perGame).length && <p className="text-slate-500">No results yet.</p>}
            </ul>
          </Card>
        </div>
      )}
    </div>
  );
}
