# Meeplelytics

Meeplelytics is a full-stack training suite for four-player board-game tournaments. It combines a TypeScript/Express API, Prisma with SQLite, and a Vite + React dashboard styled with Tailwind CSS. Features include Elo updates tuned for four-player tables, round generation that minimises repeat pairings, JSON imports with cached name mappings, CSV exports, and live leaderboards for teams and players.

## Project structure

```
/workspace/Meeplelytics
├── server/   # Express + Prisma API
└── web/      # Vite + React dashboard
```

## Prerequisites

- Node.js 18+
- npm 9+

## Getting started

```bash
npm install
cp server/.env.example server/.env
npm run migrate
npm run seed
npm run dev
```

- The API runs on http://localhost:4000
- The web dashboard runs on http://localhost:5173 (proxied to the API during dev)

## Available scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Run API and web dev servers in parallel |
| `npm run migrate` | Apply Prisma migrations to `tournament.db` |
| `npm run seed` | Seed teams, players, games, and a sample tournament |
| `npm run test` | Execute Jest (server) and Vitest (web) test suites |

### Server package scripts
- `npm run migrate:dev` – create new migrations during development.
- `npm run seed` – reseed after resetting the database.

### Web package scripts
- `npm run build` – build the web UI for production.
- `npm run preview` – preview the production build.

## API overview

All endpoints are prefixed with `/api`.

### Players
- `GET /api/players` – list players with optional `teamId` and `search`
- `POST /api/players` – create `{ name, handle, teamId? }`
- `PATCH /api/players/:id` – update name or team
- `GET /api/players/:id/ratings` – Elo history

### Teams
- `GET /api/teams` – leaderboard and members
- `POST /api/teams` – create team
- `GET /api/teams/:id/summary` – totals and per-game breakdown

### Games
- `GET /api/games`
- `POST /api/games` – create with rules JSON
- `PATCH /api/games/:id` – update ruleset
- `GET /api/games/:id/summary` – leaderboards and placement stats

### Tournaments & Rounds
- `GET /api/tournaments` – list tournaments
- `POST /api/tournaments` – `{ name, gameId, playerIds[] }`
- `GET /api/tournaments/:id` – full detail
- `POST /api/tournaments/:id/rounds/generate` – create proposed round
- `POST /api/rounds/:id/lock` – lock round seating
- `PATCH /api/tables/:id/seats` – update seating before locking
- `POST /api/tables/:id/results` – submit placements and raw scores (points & Elo computed server-side)
- `GET /api/tournaments/:id/leaderboards` – team and player standings

### Dashboard & Reporting
- `GET /api/dashboard` – high-level metrics for UI cards
- `POST /api/import` – multipart JSON import (`file`, optional `gameId`, optional `mapping` JSON string)
- `GET /api/export/:type` – CSV export for `players`, `teams`, `results`, or `ratings`

## JSON import schema

The importer expects the following structure (bonuses and K factor optional):

```json
{
  "game": "Cities",
  "plays": [
    {
      "date": "2025-09-21",
      "tableIdExternal": "C-R1-T1",
      "players": [
        { "name": "Alice", "team": "Team A", "rawScore": 87, "placement": 1 },
        { "name": "Bob",   "team": "Team B", "rawScore": 74, "placement": 2 },
        { "name": "Cara",  "team": "Team A", "rawScore": 60, "placement": 3 },
        { "name": "Dan",   "team": "Team B", "rawScore": 45, "placement": 4 }
      ]
    }
  ],
  "rulesOverride": {
    "pointsByPlacement": { "1": 5, "2": 3, "3": 2, "4": 1 },
    "bonuses": [
      { "name": "Cities 80+", "if": { "rawScoreAtLeast": 80 }, "addPoints": 1 }
    ],
    "kFactor": 24
  }
}
```

Mapping external names to existing players is done via the `mapping` field (JSON string) or by reusing the mapping stored from previous successful imports.

## Scoring & Elo

- Default placement points: 1st=5, 2nd=3, 3rd=2, 4th=1 (per-game overrides allowed).
- Bonuses apply when ruleset conditions are met (e.g., raw-score thresholds).
- Elo updates treat the table as three pairwise matchups per player using a default K=24 (per-game override) and clamp deltas to ±48.
- Every result writes `Result` rows and `RatingChange` history in a single transaction.

## Round generator

The “rotating group mixer” minimises repeat pairings and encourages 2v2 team splits. It considers previous rounds and uses a greedy heuristic with pair-count penalties and team balance rewards.

## Seed data

`npm run seed` creates:
- Teams: Team A (blue) and Team B (orange)
- Eight players evenly split between the teams
- Games: Botanicus, Cities, Forest Shuffle + Alpine, 7 Empires
- Tournament “Spring Training League” with two rounds of results for Botanicus

## Testing

- Server: Jest covers scoring, bonus handling, Elo clamping, and round generation heuristics.
- Web: Vitest with Testing Library verifies layout bootstraps correctly.

Run the complete suite:

```bash
npm run test
```

## CSV exports

Download aggregated data via `/api/export/:type` for quick spreadsheet reporting (players, teams, table results, and Elo history).

## Environment variables

The API reads `DATABASE_URL` from `server/.env` (default `file:./tournament.db`). Copy the example file before running migrations.

## License

MIT
