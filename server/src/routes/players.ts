import { Router } from 'express';
import { z } from 'zod';
import prisma from '../prisma';

const router = Router();

const playerCreateSchema = z.object({
  name: z.string().min(1),
  handle: z.string().min(1),
  teamId: z.number().optional()
});

router.get('/', async (req, res, next) => {
  try {
    const teamId = req.query.teamId ? Number(req.query.teamId) : undefined;
    const search = req.query.search ? String(req.query.search) : undefined;

    const players = await prisma.player.findMany({
      where: {
        ...(teamId ? { teamId } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { handle: { contains: search, mode: 'insensitive' } }
              ]
            }
          : {})
      },
      include: {
        team: true
      },
      orderBy: [{ rating: 'desc' }, { name: 'asc' }]
    });

    const playerIds = players.map((p) => p.id);
    const results = await prisma.result.findMany({
      where: { playerId: { in: playerIds } },
      include: {
        table: {
          include: {
            round: {
              include: {
                tournament: { include: { game: true } }
              }
            }
          }
        }
      }
    });

    const pointsByPlayer = new Map<number, number>();
    const perGame = new Map<number, Record<string, number>>();

    for (const result of results) {
      pointsByPlayer.set(result.playerId, (pointsByPlayer.get(result.playerId) ?? 0) + result.pointsAwarded);
      const gameName = result.table.round.tournament.game.name;
      const gameTotals = perGame.get(result.playerId) ?? {};
      gameTotals[gameName] = (gameTotals[gameName] ?? 0) + result.pointsAwarded;
      perGame.set(result.playerId, gameTotals);
    }

    res.json(
      players.map((player) => ({
        ...player,
        totalPoints: Number((pointsByPlayer.get(player.id) ?? 0).toFixed(2)),
        perGamePoints: perGame.get(player.id) ?? {}
      }))
    );
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const data = playerCreateSchema.parse(req.body);
    const player = await prisma.player.create({ data });
    res.status(201).json(player);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const schema = z.object({
      name: z.string().optional(),
      teamId: z.number().nullable().optional()
    });
    const data = schema.parse(req.body);
    const player = await prisma.player.update({ where: { id }, data });
    res.json(player);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/ratings', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const history = await prisma.ratingChange.findMany({
      where: { playerId: id },
      orderBy: { createdAt: 'asc' }
    });
    res.json(history);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/points-preview', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const player = await prisma.player.findUnique({ where: { id }, include: { results: true } });
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }
    const breakdown: Record<number, number> = {};
    for (const result of player.results) {
      breakdown[result.tableId] = (breakdown[result.tableId] ?? 0) + result.pointsAwarded;
    }
    res.json({ breakdown });
  } catch (err) {
    next(err);
  }
});

export default router;
