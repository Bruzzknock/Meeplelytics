import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, get } from '../api/client';
import { Game } from '../api/types';
import { PageHeader } from '../components/PageHeader';
import { Card } from '../components/Card';

interface ImportResponse {
  tournamentId: number;
  summary: string;
}

export default function ImportPage() {
  const queryClient = useQueryClient();
  const { data: games } = useQuery({ queryKey: ['games'], queryFn: () => get<Game[]>('/api/games') });
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const importMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await api.post<ImportResponse>('/api/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return response.data;
    },
    onSuccess: (data) => {
      setSummary(`Imported successfully: ${data.summary}`);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      queryClient.invalidateQueries({ queryKey: ['players'] });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
    },
    onError: (err: any) => {
      setSummary(null);
      setError(err?.response?.data?.error ?? 'Import failed');
    }
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const file = formData.get('file');
    if (!file) {
      setError('Please choose a JSON file.');
      return;
    }
    importMutation.mutate(formData);
    event.currentTarget.reset();
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="JSON Import"
        description="Import historical results with consistent mappings and automatic Elo updates."
      />
      {summary && <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{summary}</div>}
      {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}
      <Card title="Upload matches" subtitle="Provide mappings to connect external player names to local records">
        <form onSubmit={handleSubmit} className="space-y-4" encType="multipart/form-data">
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-slate-400">Game</label>
            <select
              name="gameId"
              className="w-full rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-200 focus:border-primary focus:outline-none"
            >
              <option value="">Select existing game</option>
              {games?.map((game) => (
                <option key={game.id} value={game.id}>
                  {game.name}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-slate-500">Leave empty to create a new game using the name in the JSON payload.</p>
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-slate-400">Player mapping (JSON)</label>
            <textarea
              name="mapping"
              rows={4}
              placeholder='{"Alice":1,"Bob":2}'
              className="w-full rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-200 focus:border-primary focus:outline-none"
            />
            <p className="mt-2 text-xs text-slate-500">Map external player names to their local player IDs. Leave blank to reuse the last mapping.</p>
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-slate-400">JSON file</label>
            <input
              type="file"
              name="file"
              accept="application/json"
              required
              className="w-full rounded-lg border border-dashed border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-200"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-light"
            disabled={importMutation.isLoading}
          >
            {importMutation.isLoading ? 'Importing...' : 'Import file'}
          </button>
        </form>
      </Card>
      <Card title="Schema" subtitle="Expected JSON structure">
        <pre className="overflow-auto rounded-lg bg-slate-950/70 p-4 text-xs text-slate-300">
{`{
  "game": "Cities",
  "plays": [
    {
      "date": "2025-09-21",
      "tableIdExternal": "C-R1-T1",
      "players": [
        { "name": "Alice", "team": "Team A", "rawScore": 87, "placement": 1 },
        { "name": "Bob", "team": "Team B", "rawScore": 74, "placement": 2 },
        { "name": "Cara", "team": "Team A", "rawScore": 60, "placement": 3 },
        { "name": "Dan", "team": "Team B", "rawScore": 45, "placement": 4 }
      ]
    }
  ],
  "rulesOverride": {
    "pointsByPlacement": { "1":5, "2":3, "3":2, "4":1 },
    "bonuses": [
      { "name":"Cities 80+","if":{ "rawScoreAtLeast":80 }, "addPoints":1 }
    ],
    "kFactor": 24
  }
}`}
        </pre>
      </Card>
    </div>
  );
}
