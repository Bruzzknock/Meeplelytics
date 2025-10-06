import { Router } from 'express';
import { z } from 'zod';
import prisma from '../prisma';
import { coerceRules, computePoints } from '../lib/rules';

const router = Router();

const rulesSchema = z.object({}).passthrough();

router.get('/', async (_req, res, next) => {
  try {
    const games = await prisma.game.findMany({ orderBy: { name: 'asc' } });
    res.json(games);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const schema = z.object({
      name: z.string().min(1),
      rulesetJson: rulesSchema
    });
    const data = schema.parse(req.body);
    const game = await prisma.game.create({ data });
    res.status(201).json(game);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const data = rulesSchema.parse(req.body);
    const game = await prisma.game.update({ where: { id }, data: { rulesetJson: data } });
    res.json(game);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/summary', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const game = await prisma.game.findUnique({ where: { id } });
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    const results = await prisma.result.findMany({
      where: {
        table: {
          round: {
            tournament: { gameId: id }
          }
        }
      },
      include: {
        player: true,
        table: {
          include: {
            round: true
          }
        }
      }
    });

    const leaderboard: Record<number, { playerId: number; name: string; points: number }> = {};
    const placementCounts: Record<number, number> = {};
    let totalWinningScore = 0;
    let winningCount = 0;
    const rules = coerceRules(game.rulesetJson);
    const thresholdHits: Record<string, number> = {};

    for (const result of results) {
      const entry = leaderboard[result.playerId] ?? {
        playerId: result.playerId,
        name: result.player.name,
        points: 0
      };
      entry.points += result.pointsAwarded;
      leaderboard[result.playerId] = entry;
      placementCounts[result.placement] = (placementCounts[result.placement] ?? 0) + 1;
      if (result.placement === 1 && result.rawScore != null) {
        totalWinningScore += result.rawScore;
        winningCount += 1;
      }
      const points = computePoints({ placement: result.placement, rawScore: result.rawScore, rules });
      for (const bonusName of points.appliedBonuses) {
        thresholdHits[bonusName] = (thresholdHits[bonusName] ?? 0) + 1;
      }
    }

    const sorted = Object.values(leaderboard).sort((a, b) => b.points - a.points).slice(0, 10);
    const avgWinningScore = winningCount ? Number((totalWinningScore / winningCount).toFixed(2)) : null;

    res.json({
      game,
      leaderboard: sorted,
      placementCounts,
      thresholdHits,
      avgWinningScore
    });
  } catch (err) {
    next(err);
  }
});

export default router;
