import { Router } from 'express';
import { z } from 'zod';
import prisma from '../prisma';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const teams = await prisma.team.findMany({ include: { players: true }, orderBy: { name: 'asc' } });
    const playerIds = teams.flatMap((team) => team.players.map((p) => p.id));
    const results = await prisma.result.findMany({ where: { playerId: { in: playerIds } } });
    const teamLookup = new Map<number, number>();
    for (const team of teams) {
      for (const player of team.players) {
        teamLookup.set(player.id, team.id);
      }
    }
    const totals = new Map<number, number>();
    for (const result of results) {
      const teamIdForPlayer = teamLookup.get(result.playerId);
      if (teamIdForPlayer) {
        totals.set(teamIdForPlayer, (totals.get(teamIdForPlayer) ?? 0) + result.pointsAwarded);
      }
    }
    res.json(
      teams.map((team) => ({
        ...team,
        totalPoints: Number((totals.get(team.id) ?? 0).toFixed(2))
      }))
    );
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const schema = z.object({
      name: z.string().min(1),
      color: z.string().optional()
    });
    const data = schema.parse(req.body);
    const team = await prisma.team.create({ data });
    res.status(201).json(team);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/summary', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const team = await prisma.team.findUnique({ where: { id }, include: { players: true } });
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }
    const playerIds = team.players.map((p) => p.id);
    const results = await prisma.result.findMany({
      where: { playerId: { in: playerIds } },
      include: {
        table: {
          include: {
            round: { include: { tournament: { include: { game: true } } } }
          }
        }
      }
    });
    const totalPoints = results.reduce((sum, r) => sum + r.pointsAwarded, 0);
    const perGame: Record<string, number> = {};
    for (const result of results) {
      const gameName = result.table.round.tournament.game.name;
      perGame[gameName] = (perGame[gameName] ?? 0) + result.pointsAwarded;
    }
    res.json({
      team,
      totalPoints: Number(totalPoints.toFixed(2)),
      perGame
    });
  } catch (err) {
    next(err);
  }
});

export default router;
