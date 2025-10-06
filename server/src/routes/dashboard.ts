import { Router } from 'express';
import prisma from '../prisma';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const [players, results, ratingChanges] = await Promise.all([
      prisma.player.findMany({ include: { team: true } }),
      prisma.result.findMany({ include: { player: { include: { team: true } }, table: { include: { round: { include: { tournament: { include: { game: true } } } } } } } }),
      prisma.ratingChange.findMany({ orderBy: { createdAt: 'asc' } })
    ]);

    const teamTotals = new Map<number, { teamId: number; name: string; points: number }>();
    const playerTotals = new Map<number, { playerId: number; name: string; points: number; teamName?: string | null }>();
    const bonusHits = new Map<string, number>();
    const winningScores: number[] = [];

    for (const result of results) {
      if (result.player.team) {
        const team = result.player.team;
        const entry = teamTotals.get(team.id) ?? { teamId: team.id, name: team.name, points: 0 };
        entry.points += result.pointsAwarded;
        teamTotals.set(team.id, entry);
      }
      const playerEntry = playerTotals.get(result.playerId) ?? {
        playerId: result.playerId,
        name: result.player.name,
        points: 0,
        teamName: result.player.team?.name
      };
      playerEntry.points += result.pointsAwarded;
      playerTotals.set(result.playerId, playerEntry);
      if (result.bonus > 0) {
        const gameName = result.table.round.tournament.game.name;
        const key = `${gameName}: bonus`;
        bonusHits.set(key, (bonusHits.get(key) ?? 0) + 1);
      }
      if (result.placement === 1 && result.rawScore != null) {
        winningScores.push(result.rawScore);
      }
    }

    const topTeams = Array.from(teamTotals.values()).sort((a, b) => b.points - a.points).slice(0, 5);
    const topPlayers = Array.from(playerTotals.values()).sort((a, b) => b.points - a.points).slice(0, 5);
    const topElo = players
      .map((player) => ({ playerId: player.id, name: player.name, teamName: player.team?.name ?? null, rating: player.rating }))
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 5);

    const ratingSeries = ratingChanges.map((change) => ({
      playerId: change.playerId,
      delta: change.delta,
      createdAt: change.createdAt
    }));

    const avgWinning = winningScores.length
      ? Number((winningScores.reduce((sum, val) => sum + val, 0) / winningScores.length).toFixed(2))
      : null;

    res.json({
      topTeams,
      topPlayers,
      topElo,
      bonusHits: Array.from(bonusHits.entries()).map(([name, count]) => ({ name, count })),
      ratingSeries,
      avgWinning
    });
  } catch (err) {
    next(err);
  }
});

export default router;
