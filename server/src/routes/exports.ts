import { Router } from 'express';
import prisma from '../prisma';

const router = Router();

router.get('/:type', async (req, res, next) => {
  try {
    const type = req.params.type;
    let rows: Record<string, any>[] = [];
    switch (type) {
      case 'players':
        rows = await prisma.player.findMany({ include: { team: true } }).then((players) =>
          players.map((player) => ({
            id: player.id,
            name: player.name,
            handle: player.handle,
            team: player.team?.name ?? '',
            rating: player.rating,
            createdAt: player.createdAt.toISOString()
          }))
        );
        break;
      case 'teams':
        rows = await prisma.team.findMany().then((teams) =>
          teams.map((team) => ({ id: team.id, name: team.name, color: team.color ?? '', createdAt: team.createdAt.toISOString() }))
        );
        break;
      case 'results':
        rows = await prisma.result.findMany({
          include: {
            player: true,
            table: {
              include: {
                round: {
                  include: { tournament: { include: { game: true } } }
                }
              }
            }
          }
        }).then((results) =>
          results.map((result) => ({
            tableId: result.tableId,
            tournament: result.table.round.tournament.name,
            game: result.table.round.tournament.game.name,
            player: result.player.name,
            placement: result.placement,
            rawScore: result.rawScore ?? '',
            bonus: result.bonus,
            pointsAwarded: result.pointsAwarded,
            createdAt: result.createdAt.toISOString()
          }))
        );
        break;
      case 'ratings':
        rows = await prisma.ratingChange.findMany({ include: { player: true, table: true } }).then((changes) =>
          changes.map((change) => ({
            player: change.player.name,
            tableId: change.tableId,
            before: change.before,
            after: change.after,
            delta: change.delta,
            createdAt: change.createdAt.toISOString()
          }))
        );
        break;
      default:
        return res.status(400).json({ error: 'Unsupported export type' });
    }

    const csv = convertToCsv(rows);
    res.header('Content-Type', 'text/csv');
    res.header('Content-Disposition', `attachment; filename="${type}.csv"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

function convertToCsv(rows: Record<string, any>[]): string {
  if (!rows.length) {
    return '';
  }
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];
  for (const row of rows) {
    const values = headers.map((header) => formatCsvValue(row[header]));
    lines.push(values.join(','));
  }
  return lines.join('\n');
}

function formatCsvValue(value: any): string {
  if (value == null) return '';
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export default router;
