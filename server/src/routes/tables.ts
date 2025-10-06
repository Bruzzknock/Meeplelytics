import { Router } from 'express';
import { z } from 'zod';
import prisma from '../prisma';
import { coerceRules, computePoints } from '../lib/rules';
import { computeEloForTable } from '../lib/elo';

const router = Router();

const resultSchema = z.array(
  z.object({
    playerId: z.number().int(),
    placement: z.number().int().min(1).max(4),
    rawScore: z.number().optional().nullable()
  })
);

router.post('/:id/results', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const input = resultSchema.parse(req.body);
    if (input.length !== 4) {
      return res.status(400).json({ error: 'Results must include exactly 4 players' });
    }
    const placements = new Set(input.map((r) => r.placement));
    if (placements.size !== 4) {
      return res.status(400).json({ error: 'Placements must be unique values 1-4' });
    }

    const payload = await prisma.$transaction(async (tx) => {
      const table = await tx.table.findUnique({
        where: { id },
        include: {
          round: {
            include: {
              tournament: { include: { game: true } }
            }
          },
          seats: { include: { player: true } },
          results: true
        }
      });
      if (!table) {
        throw Object.assign(new Error('Table not found'), { status: 404 });
      }
      if (table.results.length > 0) {
        throw Object.assign(new Error('Results already submitted for this table'), { status: 400 });
      }

      const seatPlayerIds = new Set(table.seats.map((seat) => seat.playerId));
      for (const row of input) {
        if (!seatPlayerIds.has(row.playerId)) {
          throw Object.assign(new Error(`Player ${row.playerId} is not seated at this table`), { status: 400 });
        }
      }

      const rules = coerceRules(table.round.tournament.game.rulesetJson);

      const resultCreates = input.map((row) => {
        const points = computePoints({ placement: row.placement, rawScore: row.rawScore ?? null, rules });
        return {
          playerId: row.playerId,
          placement: row.placement,
          rawScore: row.rawScore ?? null,
          bonus: points.bonus,
          pointsAwarded: points.total
        };
      });

      for (const result of resultCreates) {
        await tx.result.create({ data: { ...result, tableId: table.id } });
      }

      const eloInputs = input.map((row) => {
        const seat = table.seats.find((s) => s.playerId === row.playerId);
        return {
          playerId: row.playerId,
          placement: row.placement,
          rating: seat?.player.rating ?? 1500
        };
      });

      const eloResults = computeEloForTable(eloInputs, { rules });

      for (const elo of eloResults) {
        await tx.ratingChange.create({
          data: {
            playerId: elo.playerId,
            before: elo.before,
            after: elo.after,
            delta: elo.delta,
            tableId: table.id
          }
        });
        await tx.player.update({ where: { id: elo.playerId }, data: { rating: elo.after } });
      }

      return {
        tableId: table.id,
        results: resultCreates,
        elo: eloResults
      };
    });

    res.json(payload);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/seats', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const schema = z.object({
      seats: z.array(
        z.object({
          playerId: z.number().int(),
          seatNumber: z.number().int().min(1).max(4)
        })
      )
    });
    const { seats } = schema.parse(req.body);
    const table = await prisma.table.findUnique({ where: { id }, include: { round: true } });
    if (!table) {
      return res.status(404).json({ error: 'Table not found' });
    }
    if (table.round.locked) {
      return res.status(400).json({ error: 'Cannot change seats on a locked round' });
    }
    await prisma.$transaction(async (tx) => {
      await tx.tableSeat.deleteMany({ where: { tableId: id } });
      for (const seat of seats) {
        await tx.tableSeat.create({ data: { tableId: id, playerId: seat.playerId, seatNumber: seat.seatNumber } });
      }
    });
    const updated = await prisma.table.findUnique({
      where: { id },
      include: {
        seats: { include: { player: true }, orderBy: { seatNumber: 'asc' } }
      }
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

export default router;
