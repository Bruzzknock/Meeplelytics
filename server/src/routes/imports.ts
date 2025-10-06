import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import prisma from '../prisma';
import { coerceRules, computePoints } from '../lib/rules';
import { computeEloForTable } from '../lib/elo';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

const importMetaSchema = z.object({
  gameId: z.coerce.number().optional(),
  gameName: z.string().optional(),
  mapping: z.string().optional()
});

interface ImportFilePlayer {
  name: string;
  team?: string;
  rawScore?: number;
  placement: number;
}

interface ImportFilePlay {
  date?: string;
  tableIdExternal?: string;
  players: ImportFilePlayer[];
}

interface ImportFileData {
  game: string;
  plays: ImportFilePlay[];
  rulesOverride?: unknown;
}

router.post('/', upload.single('file'), async (req, res, next) => {
  try {
    const parsed = importMetaSchema.parse(req.body ?? {});
    if (!req.file) {
      return res.status(400).json({ error: 'Missing JSON file upload' });
    }
    const content = req.file.buffer.toString('utf-8');
    const fileData = JSON.parse(content) as ImportFileData;

    const game = await resolveGame(parsed.gameId, parsed.gameName ?? fileData.game, fileData.rulesOverride);
    if (!game) {
      return res.status(400).json({ error: 'Unable to determine game for import' });
    }

    const providedMapping = parsed.mapping ? (JSON.parse(parsed.mapping) as Record<string, number>) : {};
    const finalMapping = await buildNameMapping(game.id, providedMapping);

    const unknownNames = collectUnknownPlayers(finalMapping, fileData);
    if (unknownNames.length) {
      return res.status(400).json({ error: 'Unmapped players', unknownPlayers: unknownNames });
    }

    const summary = await prisma.$transaction(async (tx) => {
      const importJob = await tx.importJob.create({
        data: {
          gameId: game.id,
          sourceFileName: req.file.originalname ?? 'upload.json',
          mappingJson: finalMapping,
          status: 'pending'
        }
      });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const tournament = await tx.tournament.create({
        data: {
          name: `Imported — ${timestamp}`,
          status: 'complete',
          gameId: game.id
        }
      });

      const allPlayerIds = Array.from(new Set(Object.values(finalMapping)));
      const players = await tx.player.findMany({ where: { id: { in: allPlayerIds } } });
      const ratingMap = new Map<number, number>();
      for (const player of players) {
        ratingMap.set(player.id, player.rating);
        await tx.tournamentParticipant.create({ data: { tournamentId: tournament.id, playerId: player.id } });
      }

      const round = await tx.round.create({ data: { tournamentId: tournament.id, index: 1, locked: true } });
      const rules = coerceRules(fileData.rulesOverride ?? game.rulesetJson);

      let tableCounter = 0;
      for (const play of fileData.plays) {
        if (play.players.length !== 4) {
          throw new Error(`Play ${play.tableIdExternal ?? tableCounter + 1} must contain exactly four players`);
        }
        tableCounter += 1;
        const table = await tx.table.create({ data: { roundId: round.id, tableIndex: tableCounter } });
        const playersInTable = play.players.map((player, idx) => ({
          id: finalMapping[player.name],
          rawScore: player.rawScore,
          placement: player.placement,
          seatNumber: idx + 1
        }));

        for (const seat of playersInTable) {
          await tx.tableSeat.create({ data: { tableId: table.id, playerId: seat.id, seatNumber: seat.seatNumber } });
        }

        const resultsPayload = playersInTable.map((entry) => {
          const points = computePoints({ placement: entry.placement, rawScore: entry.rawScore ?? null, rules });
          return {
            playerId: entry.id,
            placement: entry.placement,
            rawScore: entry.rawScore ?? null,
            bonus: points.bonus,
            pointsAwarded: points.total
          };
        });

        for (const result of resultsPayload) {
          await tx.result.create({ data: { ...result, tableId: table.id } });
        }

        const eloInputs = playersInTable.map((entry) => ({
          playerId: entry.id,
          placement: entry.placement,
          rating: ratingMap.get(entry.id) ?? 1500
        }));
        const eloResults = computeEloForTable(eloInputs, { rules });
        for (const elo of eloResults) {
          ratingMap.set(elo.playerId, elo.after);
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
      }

      const summaryText = `Imported ${fileData.plays.length} tables into ${tournament.name}`;
      await tx.importJob.update({ where: { id: importJob.id }, data: { status: 'done', summaryText } });
      return { tournamentId: tournament.id, summary: summaryText };
    });

    res.json(summary);
  } catch (err) {
    next(err);
  }
});

async function resolveGame(gameId?: number, fallbackName?: string, rulesOverride?: unknown) {
  if (gameId) {
    const game = await prisma.game.findUnique({ where: { id: gameId } });
    if (game) return game;
  }
  if (!fallbackName) return null;
  let game = await prisma.game.findUnique({ where: { name: fallbackName } });
  if (!game) {
    game = await prisma.game.create({ data: { name: fallbackName, rulesetJson: rulesOverride ?? {} } });
  }
  return game;
}

async function buildNameMapping(gameId: number, incoming: Record<string, number>) {
  const previous = await prisma.importJob.findFirst({
    where: { gameId, status: 'done' },
    orderBy: { createdAt: 'desc' }
  });
  const mapping: Record<string, number> = previous?.mappingJson ? { ...(previous.mappingJson as Record<string, number>) } : {};
  for (const [name, playerId] of Object.entries(incoming)) {
    const numeric = Number(playerId);
    if (!Number.isNaN(numeric)) {
      mapping[name] = numeric;
    }
  }
  return mapping;
}

function collectUnknownPlayers(mapping: Record<string, number>, fileData: ImportFileData): string[] {
  const unknown: string[] = [];
  for (const play of fileData.plays) {
    for (const player of play.players) {
      if (mapping[player.name] == null) {
        if (!unknown.includes(player.name)) {
          unknown.push(player.name);
        }
      }
    }
  }
  return unknown;
}

export default router;
