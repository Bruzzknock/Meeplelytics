import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { get, patch, post } from '../api/client';
import { Game, LeaderboardResponse, Player, TournamentDetail, TournamentSummary } from '../api/types';
import { PageHeader } from '../components/PageHeader';
import { Card } from '../components/Card';
import { DataTable } from '../components/DataTable';

interface CreateTournamentPayload {
  name: string;
  gameId: number;
  playerIds: number[];
}

export default function TournamentsPage() {
  const queryClient = useQueryClient();
  const [selectedTournamentId, setSelectedTournamentId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data: tournaments } = useQuery({ queryKey: ['tournaments'], queryFn: () => get<TournamentSummary[]>('/api/tournaments') });
  const { data: games } = useQuery({ queryKey: ['games'], queryFn: () => get<Game[]>('/api/games') });
  const { data: players } = useQuery({ queryKey: ['players-all'], queryFn: () => get<Player[]>('/api/players') });
  const { data: tournamentDetail } = useQuery({
    queryKey: ['tournament', selectedTournamentId],
    queryFn: () => (selectedTournamentId ? get<TournamentDetail>(`/api/tournaments/${selectedTournamentId}`) : null),
    enabled: Boolean(selectedTournamentId)
  });
  const { data: leaderboards } = useQuery({
    queryKey: ['tournament-leaderboard', selectedTournamentId],
    queryFn: () => (selectedTournamentId ? get<LeaderboardResponse>(`/api/tournaments/${selectedTournamentId}/leaderboards`) : null),
    enabled: Boolean(selectedTournamentId)
  });

  const createTournament = useMutation({
    mutationFn: (payload: CreateTournamentPayload) => post<TournamentSummary>('/api/tournaments', payload),
    onSuccess: (tournament) => {
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      setSelectedTournamentId(tournament.id);
    },
    onError: (error: any) => setErrorMessage(error?.response?.data?.error ?? 'Failed to create tournament')
  });

  const generateRound = useMutation({
    mutationFn: (tournamentId: number) => post(`/api/tournaments/${tournamentId}/rounds/generate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournament', selectedTournamentId] });
    }
  });

  const lockRound = useMutation({
    mutationFn: (roundId: number) => post(`/api/rounds/${roundId}/lock`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournament', selectedTournamentId] });
    }
  });

  const updateSeats = useMutation({
    mutationFn: (payload: { tableId: number; seats: { playerId: number; seatNumber: number }[] }) =>
      patch(`/api/tables/${payload.tableId}/seats`, { seats: payload.seats }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournament', selectedTournamentId] });
    }
  });

  const submitResults = useMutation({
    mutationFn: (payload: { tableId: number; results: { playerId: number; placement: number; rawScore?: number | null }[] }) =>
      post(`/api/tables/${payload.tableId}/results`, payload.results),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournament', selectedTournamentId] });
      queryClient.invalidateQueries({ queryKey: ['tournament-leaderboard', selectedTournamentId] });
    }
  });

  const [seatDrafts, setSeatDrafts] = useState<Record<number, { playerId: number; seatNumber: number }[]>>({});
  const [resultDrafts, setResultDrafts] = useState<Record<number, { playerId: number; placement: number; rawScore?: number | '' }[]>>({});

  useEffect(() => {
    if (!tournamentDetail) return;
    const seatsState: Record<number, { playerId: number; seatNumber: number }[]> = {};
    const resultsState: Record<number, { playerId: number; placement: number; rawScore?: number | '' }[]> = {};
    tournamentDetail.rounds.forEach((round) => {
      round.tables.forEach((table) => {
        seatsState[table.id] = table.seats.map((seat) => ({ playerId: seat.player.id, seatNumber: seat.seatNumber }));
        if (!table.results.length) {
          resultsState[table.id] = table.seats.map((seat) => ({
            playerId: seat.player.id,
            placement: seat.seatNumber,
            rawScore: ''
          }));
        }
      });
    });
    setSeatDrafts(seatsState);
    setResultDrafts(resultsState);
  }, [tournamentDetail]);

  const availablePlayers = useMemo(() => tournamentDetail?.participants.map((participant) => participant.player) ?? [], [tournamentDetail]);

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') ?? '').trim();
    const gameId = Number(form.get('gameId'));
    const selectedPlayers = Array.from(form.getAll('playerIds')).map((value) => Number(value));
    if (!name || !gameId) return;
    if (selectedPlayers.length % 4 !== 0) {
      setErrorMessage('Player count must be divisible by 4.');
      return;
    }
    setErrorMessage(null);
    createTournament.mutate({ name, gameId, playerIds: selectedPlayers });
    event.currentTarget.reset();
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Tournaments"
        description="Host tournaments, propose new rounds, and capture table results with live leaderboards."
      />
      {errorMessage && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{errorMessage}</div>}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Create tournament">
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wide text-slate-400">Name</label>
              <input
                name="name"
                required
                className="w-full rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-200 focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wide text-slate-400">Game</label>
              <select
                name="gameId"
                required
                className="w-full rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-200 focus:border-primary focus:outline-none"
              >
                <option value="">Select game</option>
                {games?.map((game) => (
                  <option key={game.id} value={game.id}>
                    {game.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-xs uppercase tracking-wide text-slate-400">Players (select multiples)</label>
              <div className="grid max-h-48 grid-cols-2 gap-2 overflow-y-auto rounded-lg border border-slate-800 bg-slate-900/40 p-3">
                {players?.map((player) => (
                  <label key={player.id} className="flex items-center gap-2 text-sm text-slate-200">
                    <input type="checkbox" name="playerIds" value={player.id} className="rounded border-slate-700 bg-slate-900" />
                    <span>{player.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-light" disabled={createTournament.isLoading}>
              {createTournament.isLoading ? 'Creating...' : 'Create tournament'}
            </button>
          </form>
        </Card>
        <Card title="Existing tournaments">
          <DataTable
            data={(tournaments ?? []).map((t) => ({ ...t, createdAtFormatted: new Date(t.createdAt).toLocaleDateString() }))}
            columns={[
              {
                key: 'name',
                header: 'Name',
                render: (tournament) => (
                  <button onClick={() => setSelectedTournamentId(tournament.id)} className="text-left text-slate-100 hover:text-primary-light">
                    {tournament.name}
                  </button>
                )
              },
              { key: 'status', header: 'Status', render: (tournament) => tournament.status },
              { key: 'game', header: 'Game', render: (tournament) => tournament.game.name },
              { key: 'rounds', header: 'Rounds', render: (tournament) => tournament.rounds },
              { key: 'createdAtFormatted', header: 'Created', render: (tournament) => tournament.createdAtFormatted }
            ]}
            emptyMessage="No tournaments yet."
          />
        </Card>
      </div>

      {tournamentDetail && selectedTournamentId && (
        <div className="space-y-10">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-white">{tournamentDetail.name}</h2>
              <p className="text-sm text-slate-400">Game: {tournamentDetail.game.name}</p>
            </div>
            <button
              onClick={() => generateRound.mutate(selectedTournamentId)}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-light"
            >
              Suggest next round
            </button>
          </div>

          {tournamentDetail.rounds.map((round) => (
            <Card key={round.id} title={`Round ${round.index}`} subtitle={round.locked ? 'Locked' : 'Open for adjustments'}>
              <div className="space-y-6">
                {round.tables.map((table) => {
                  const seatDraft = seatDrafts[table.id] ?? [];
                  const resultDraft = resultDrafts[table.id] ?? [];
                  return (
                    <div key={table.id} className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
                      <div className="mb-4 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-slate-300">Table {table.tableIndex}</h3>
                        {!round.locked && (
                          <button
                            onClick={() => updateSeats.mutate({ tableId: table.id, seats: seatDraft })}
                            className="rounded bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-200 hover:bg-slate-700"
                          >
                            Save seating
                          </button>
                        )}
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <h4 className="mb-2 text-xs uppercase tracking-wide text-slate-500">Seats</h4>
                          <div className="space-y-2">
                            {seatDraft.map((seat, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-sm text-slate-200">
                                <span className="w-6 text-slate-500">{idx + 1}</span>
                                <select
                                  disabled={round.locked}
                                  value={seat.playerId}
                                  onChange={(event) => {
                                    const value = Number(event.target.value);
                                    setSeatDrafts((prev) => {
                                      const nextSeats = prev[table.id].map((entry, entryIdx) =>
                                        entryIdx === idx ? { ...entry, playerId: value } : entry
                                      );
                                      setResultDrafts((draftPrev) => ({
                                        ...draftPrev,
                                        [table.id]: (draftPrev[table.id] ?? nextSeats.map((seatEntry) => ({
                                          playerId: seatEntry.playerId,
                                          placement: seatEntry.seatNumber,
                                          rawScore: ''
                                        }))).map((entry, entryIdx) => ({
                                          ...entry,
                                          playerId: nextSeats[entryIdx]?.playerId ?? entry.playerId
                                        }))
                                      }));
                                      return { ...prev, [table.id]: nextSeats };
                                    });
                                  }}
                                  className="flex-1 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-200 focus:border-primary focus:outline-none"
                                >
                                  {availablePlayers.map((player) => (
                                    <option key={player.id} value={player.id}>
                                      {player.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <h4 className="mb-2 text-xs uppercase tracking-wide text-slate-500">Results</h4>
                          {table.results.length ? (
                            <ul className="space-y-2 text-sm text-slate-200">
                              {table.results.map((result) => (
                                <li key={result.id} className="flex items-center justify-between">
                                  <span>{table.seats.find((seat) => seat.player.id === result.playerId)?.player.name ?? '—'}</span>
                                  <span className="text-xs text-slate-400">Place {result.placement}</span>
                                  <span className="font-semibold text-primary-light">{result.pointsAwarded.toFixed(1)} pts</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <form
                              onSubmit={(event) => {
                                event.preventDefault();
                                const submission = resultDraft.map((entry) => ({
                                  playerId: entry.playerId,
                                  placement: Number(entry.placement),
                                  rawScore: entry.rawScore === '' ? null : Number(entry.rawScore)
                                }));
                                submitResults.mutate({ tableId: table.id, results: submission });
                              }}
                              className="space-y-2"
                            >
                              {resultDraft.map((entry, idx) => (
                                <div key={idx} className="grid grid-cols-3 items-center gap-2 text-sm text-slate-200">
                                  <span>{availablePlayers.find((p) => p.id === entry.playerId)?.name ?? '—'}</span>
                                  <select
                                    value={entry.placement}
                                    onChange={(event) =>
                                      setResultDrafts((prev) => ({
                                        ...prev,
                                        [table.id]: prev[table.id].map((item, itemIdx) =>
                                          itemIdx === idx ? { ...item, placement: Number(event.target.value) } : item
                                        )
                                      }))
                                    }
                                    className="rounded-lg border border-slate-800 bg-slate-900/60 px-2 py-1 text-sm text-slate-200"
                                  >
                                    {[1, 2, 3, 4].map((place) => (
                                      <option key={place} value={place}>
                                        Place {place}
                                      </option>
                                    ))}
                                  </select>
                                  <input
                                    value={entry.rawScore ?? ''}
                                    onChange={(event) =>
                                      setResultDrafts((prev) => ({
                                        ...prev,
                                        [table.id]: prev[table.id].map((item, itemIdx) =>
                                          itemIdx === idx ? { ...item, rawScore: event.target.value } : item
                                        )
                                      }))
                                    }
                                    placeholder="Raw score"
                                    className="rounded-lg border border-slate-800 bg-slate-900/60 px-2 py-1 text-sm text-slate-200"
                                  />
                                </div>
                              ))}
                              <button
                                type="submit"
                                className="rounded bg-primary px-3 py-1 text-sm font-semibold text-white hover:bg-primary-light"
                                disabled={submitResults.isLoading}
                              >
                                {submitResults.isLoading ? 'Submitting...' : 'Submit results'}
                              </button>
                            </form>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {!round.locked && (
                <div className="mt-4 text-right">
                  <button
                    onClick={() => lockRound.mutate(round.id)}
                    className="rounded bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-700"
                  >
                    Lock round
                  </button>
                </div>
              )}
            </Card>
          ))}

          {leaderboards && (
            <div className="grid gap-6 lg:grid-cols-2">
              <Card title="Player standings">
                <ul className="space-y-2 text-sm text-slate-200">
                  {leaderboards.individuals.map((player) => (
                    <li key={player.playerId} className="flex items-center justify-between">
                      <span>{player.name}</span>
                      <span className="text-xs text-slate-400">{player.teamName ?? 'Solo'}</span>
                      <span className="font-semibold text-primary-light">{player.points.toFixed(1)} pts</span>
                    </li>
                  ))}
                </ul>
              </Card>
              <Card title="Team totals">
                <ul className="space-y-2 text-sm text-slate-200">
                  {leaderboards.teams.map((team) => (
                    <li key={team.teamId} className="flex items-center justify-between">
                      <span>{team.teamName}</span>
                      <span className="font-semibold text-primary-light">{team.points.toFixed(1)} pts</span>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
