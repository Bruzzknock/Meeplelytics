import { Router } from 'express';
import { z } from 'zod';
import prisma from '../prisma';
import { generateRound } from '../lib/roundGenerator';

const router = Router();

const createTournamentSchema = z.object({
  name: z.string().min(1),
  gameId: z.number().int(),
  playerIds: z.array(z.number().int()).min(4)
});

router.get('/', async (_req, res, next) => {
  try {
    const tournaments = await prisma.tournament.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        game: true,
        rounds: true
      }
    });
    res.json(
      tournaments.map((tournament) => ({
        id: tournament.id,
        name: tournament.name,
        status: tournament.status,
        game: tournament.game,
        rounds: tournament.rounds.length,
        createdAt: tournament.createdAt
      }))
    );
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const payload = createTournamentSchema.parse(req.body);
    if (payload.playerIds.length % 4 !== 0) {
      return res.status(400).json({ error: 'Player count must be divisible by 4' });
    }
    const tournament = await prisma.tournament.create({
      data: {
        name: payload.name,
        gameId: payload.gameId,
        status: 'running',
        participants: {
          createMany: {
            data: payload.playerIds.map((playerId) => ({ playerId }))
          }
        }
      },
      include: {
        participants: { include: { player: true } }
      }
    });
    res.status(201).json(tournament);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const tournament = await prisma.tournament.findUnique({
      where: { id },
      include: {
        game: true,
        participants: { include: { player: true } },
        rounds: {
          orderBy: { index: 'asc' },
          include: {
            tables: {
              orderBy: { tableIndex: 'asc' },
              include: {
                seats: { include: { player: true }, orderBy: { seatNumber: 'asc' } },
                results: { include: { player: true }, orderBy: { placement: 'asc' } }
              }
            }
          }
        }
      }
    });
    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    res.json(tournament);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/rounds/generate', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const tournament = await prisma.tournament.findUnique({
      where: { id },
      include: {
        game: true,
        participants: { include: { player: { include: { team: true } } } },
        rounds: {
          include: {
            tables: {
              include: {
                seats: true
              }
            }
          }
        }
      }
    });
    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    if (tournament.participants.length % 4 !== 0) {
      return res.status(400).json({ error: 'Participants must be divisible by 4' });
    }

    const openRound = tournament.rounds.find((round) => !round.locked);
    if (openRound) {
      return res.status(400).json({ error: 'Lock the current round before generating a new one' });
    }

    const history = tournament.rounds.flatMap((round) =>
      round.tables.map((table) => ({ playerIds: table.seats.map((seat) => seat.playerId) }))
    );
    const playerProfiles = tournament.participants.map((p) => ({
      id: p.playerId,
      name: p.player.name,
      teamId: p.player.teamId
    }));
    const generation = generateRound(playerProfiles, history);

    const nextIndex = (tournament.rounds.length ? Math.max(...tournament.rounds.map((r) => r.index)) : 0) + 1;

    const round = await prisma.round.create({
      data: {
        tournamentId: tournament.id,
        index: nextIndex,
        tables: {
          create: generation.tables.map((table, tableIdx) => ({
            tableIndex: tableIdx + 1,
            seats: {
              create: table.playerIds.map((playerId, seatIdx) => ({
                playerId,
                seatNumber: seatIdx + 1
              }))
            }
          }))
        }
      },
      include: {
        tables: {
          include: {
            seats: { include: { player: true }, orderBy: { seatNumber: 'asc' } }
          },
          orderBy: { tableIndex: 'asc' }
        }
      }
    });

    res.json({ round, explanation: generation.explanation });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/leaderboards', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const tournament = await prisma.tournament.findUnique({
      where: { id },
      include: {
        participants: { include: { player: { include: { team: true } } } },
        rounds: {
          include: {
            tables: true
          }
        }
      }
    });
    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    const tableIds = tournament.rounds.flatMap((round) => round.tables.map((table) => table.id));
    const results = await prisma.result.findMany({
      where: { tableId: { in: tableIds } },
      include: {
        player: { include: { team: true } }
      }
    });

    const individualTotals = new Map<number, { playerId: number; name: string; points: number; rating: number; teamName?: string | null }>();
    const teamTotals = new Map<number, { teamId: number; teamName: string; points: number }>();

    for (const result of results) {
      const player = result.player;
      const indiv = individualTotals.get(player.id) ?? {
        playerId: player.id,
        name: player.name,
        points: 0,
        rating: player.rating,
        teamName: player.team?.name
      };
      indiv.points += result.pointsAwarded;
      individualTotals.set(player.id, indiv);
      if (player.team) {
        const team = teamTotals.get(player.team.id) ?? {
          teamId: player.team.id,
          teamName: player.team.name,
          points: 0
        };
        team.points += result.pointsAwarded;
        teamTotals.set(player.team.id, team);
      }
    }

    const individuals = Array.from(individualTotals.values()).sort((a, b) => b.points - a.points);
    const teams = Array.from(teamTotals.values()).sort((a, b) => b.points - a.points);
    const elo = tournament.participants
      .map((p) => ({ playerId: p.playerId, name: p.player.name, rating: p.player.rating, teamName: p.player.team?.name ?? null }))
      .sort((a, b) => b.rating - a.rating);

    res.json({
      individuals,
      teams,
      elo
    });
  } catch (err) {
    next(err);
  }
});

export default router;
