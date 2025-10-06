import { useQuery } from '@tanstack/react-query';
import { get } from '../api/client';
import { DashboardData } from '../api/types';
import { Card } from '../components/Card';
import { PageHeader } from '../components/PageHeader';

export default function DashboardPage() {
  const { data, isLoading } = useQuery({ queryKey: ['dashboard'], queryFn: () => get<DashboardData>('/api/dashboard') });

  return (
    <div className="space-y-8">
      <PageHeader title="Dashboard" description="Live leaders and insights across all tournaments." />
      {isLoading && <div className="text-sm text-slate-400">Loading dashboard...</div>}
      {data && (
        <>
          <div className="grid gap-6 md:grid-cols-3">
            <Card title="Top Teams" subtitle="Total points from members">
              <ul className="space-y-3 text-sm">
                {data.topTeams.map((team) => (
                  <li key={team.teamId} className="flex items-center justify-between text-slate-200">
                    <span>{team.name}</span>
                    <span className="font-semibold text-primary-light">{team.points.toFixed(1)}</span>
                  </li>
                ))}
                {!data.topTeams.length && <p className="text-slate-500">No team data yet.</p>}
              </ul>
            </Card>
            <Card title="Player Points" subtitle="Season totals">
              <ul className="space-y-3 text-sm">
                {data.topPlayers.map((player) => (
                  <li key={player.playerId} className="flex items-center justify-between text-slate-200">
                    <div>
                      <p>{player.name}</p>
                      {player.teamName && <p className="text-xs text-slate-500">{player.teamName}</p>}
                    </div>
                    <span className="font-semibold text-primary-light">{player.points.toFixed(1)}</span>
                  </li>
                ))}
                {!data.topPlayers.length && <p className="text-slate-500">No player results yet.</p>}
              </ul>
            </Card>
            <Card title="Elo Leaders" subtitle="Current ratings">
              <ul className="space-y-3 text-sm">
                {data.topElo.map((player) => (
                  <li key={player.playerId} className="flex items-center justify-between text-slate-200">
                    <div>
                      <p>{player.name}</p>
                      {player.teamName && <p className="text-xs text-slate-500">{player.teamName}</p>}
                    </div>
                    <span className="font-semibold text-primary-light">{player.rating}</span>
                  </li>
                ))}
                {!data.topElo.length && <p className="text-slate-500">No rating history yet.</p>}
              </ul>
            </Card>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <Card title="Bonus streaks" subtitle="Threshold bonuses applied">
              <ul className="space-y-3 text-sm">
                {data.bonusHits.map((bonus) => (
                  <li key={bonus.name} className="flex items-center justify-between text-slate-200">
                    <span>{bonus.name}</span>
                    <span className="font-semibold text-primary-light">{bonus.count}</span>
                  </li>
                ))}
                {!data.bonusHits.length && <p className="text-slate-500">Bonuses will appear here once games are recorded.</p>}
              </ul>
            </Card>
            <Card title="Average winning score" subtitle="Across imported games">
              <div className="text-4xl font-semibold text-primary-light">
                {data.avgWinning ? data.avgWinning.toFixed(1) : '—'}
              </div>
              <p className="mt-3 text-sm text-slate-400">Based on the raw scores of first-place finishers.</p>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
