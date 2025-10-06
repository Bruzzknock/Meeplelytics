import { PrismaClient } from '@prisma/client';
import { computePoints, coerceRules } from '../src/lib/rules';
import { computeEloForTable } from '../src/lib/elo';

const prisma = new PrismaClient();

async function main() {
  await prisma.ratingChange.deleteMany();
  await prisma.result.deleteMany();
  await prisma.tableSeat.deleteMany();
  await prisma.table.deleteMany();
  await prisma.round.deleteMany();
  await prisma.tournamentParticipant.deleteMany();
  await prisma.tournament.deleteMany();
  await prisma.player.deleteMany();
  await prisma.team.deleteMany();
  await prisma.game.deleteMany();

  const teamA = await prisma.team.create({ data: { name: 'Team A', color: '#2563eb' } });
  const teamB = await prisma.team.create({ data: { name: 'Team B', color: '#f97316' } });

  const players = await prisma.$transaction([
    prisma.player.create({ data: { name: 'Alice Smith', handle: 'alice', teamId: teamA.id } }),
    prisma.player.create({ data: { name: 'Cara Jones', handle: 'cara', teamId: teamA.id } }),
    prisma.player.create({ data: { name: 'Eve Turner', handle: 'eve', teamId: teamA.id } }),
    prisma.player.create({ data: { name: 'Faye Kim', handle: 'faye', teamId: teamA.id } }),
    prisma.player.create({ data: { name: 'Bob Stone', handle: 'bob', teamId: teamB.id } }),
    prisma.player.create({ data: { name: 'Dan Price', handle: 'dan', teamId: teamB.id } }),
    prisma.player.create({ data: { name: 'Gus Martin', handle: 'gus', teamId: teamB.id } }),
    prisma.player.create({ data: { name: 'Hank Li', handle: 'hank', teamId: teamB.id } })
  ]);

  const games = await prisma.$transaction([
    prisma.game.create({
      data: {
        name: 'Botanicus',
        rulesetJson: {
          bonuses: [{ name: '250+', if: { rawScoreAtLeast: 250 }, addPoints: 1 }]
        }
      }
    }),
    prisma.game.create({
      data: {
        name: 'Cities',
        rulesetJson: {
          pointsByPlacement: { '1': 5, '2': 3, '3': 2, '4': 1 },
          bonuses: [{ name: '80+', if: { rawScoreAtLeast: 80 }, addPoints: 1 }]
        }
      }
    }),
    prisma.game.create({
      data: {
        name: 'Forest Shuffle + Alpine',
        rulesetJson: {
          pointsByPlacement: { '1': 6, '2': 4, '3': 2, '4': 0 },
          kFactor: 28
        }
      }
    }),
    prisma.game.create({
      data: {
        name: '7 Empires',
        rulesetJson: {
          pointsByPlacement: { '1': 7, '2': 4, '3': 2, '4': 1 }
        }
      }
    })
  ]);

  const botanicus = games[0];
  const tournament = await prisma.tournament.create({
    data: {
      name: 'Spring Training League',
      status: 'running',
      gameId: botanicus.id,
      participants: {
        createMany: {
          data: players.map((player) => ({ playerId: player.id }))
        }
      }
    }
  });

  const rules = coerceRules(botanicus.rulesetJson);
  const ratingMap = new Map(players.map((player) => [player.id, player.rating]));

  const round1 = await prisma.round.create({ data: { tournamentId: tournament.id, index: 1 } });
  const round2 = await prisma.round.create({ data: { tournamentId: tournament.id, index: 2 } });

  const tablesRound1 = [
    {
      round: round1,
      players: [players[0], players[4], players[1], players[5]],
      rawScores: [265, 210, 248, 190]
    },
    {
      round: round1,
      players: [players[2], players[6], players[3], players[7]],
      rawScores: [255, 200, 245, 198]
    }
  ];

  const tablesRound2 = [
    {
      round: round2,
      players: [players[0], players[6], players[2], players[5]],
      rawScores: [240, 230, 220, 210]
    },
    {
      round: round2,
      players: [players[1], players[7], players[3], players[4]],
      rawScores: [260, 215, 205, 195]
    }
  ];

  const processTable = async (
    roundId: number,
    tableIndex: number,
    participants: { id: number }[],
    rawScores: number[]
  ) => {
    const table = await prisma.table.create({ data: { roundId, tableIndex } });
    const placements = rawScores
      .map((score, idx) => ({ score, idx }))
      .sort((a, b) => b.score - a.score)
      .map((entry, rankIdx) => ({ idx: entry.idx, placement: rankIdx + 1 }));

    for (let i = 0; i < participants.length; i++) {
      await prisma.tableSeat.create({ data: { tableId: table.id, playerId: participants[i].id, seatNumber: i + 1 } });
    }

    const resultsPayload = placements.map((placementInfo) => {
      const player = participants[placementInfo.idx];
      const rawScore = rawScores[placementInfo.idx];
      const points = computePoints({ placement: placementInfo.placement, rawScore, rules });
      return {
        playerId: player.id,
        placement: placementInfo.placement,
        rawScore,
        bonus: points.bonus,
        pointsAwarded: points.total
      };
    });

    for (const result of resultsPayload) {
      await prisma.result.create({ data: { ...result, tableId: table.id } });
    }

    const eloInputs = resultsPayload.map((result) => ({
      playerId: result.playerId,
      placement: result.placement,
      rating: ratingMap.get(result.playerId) ?? 1500
    }));

    const eloResults = computeEloForTable(eloInputs, { rules });
    for (const elo of eloResults) {
      ratingMap.set(elo.playerId, elo.after);
      await prisma.ratingChange.create({
        data: {
          playerId: elo.playerId,
          before: elo.before,
          after: elo.after,
          delta: elo.delta,
          tableId: table.id
        }
      });
      await prisma.player.update({ where: { id: elo.playerId }, data: { rating: elo.after } });
    }
  };

  for (let i = 0; i < tablesRound1.length; i++) {
    const table = tablesRound1[i];
    await processTable(table.round.id, i + 1, table.players, table.rawScores);
  }

  for (let i = 0; i < tablesRound2.length; i++) {
    const table = tablesRound2[i];
    await processTable(table.round.id, i + 1, table.players, table.rawScores);
  }

  await prisma.round.updateMany({ where: { id: { in: [round1.id, round2.id] } }, data: { locked: true } });
  await prisma.tournament.update({ where: { id: tournament.id }, data: { status: 'complete' } });

  console.log('Seed data generated.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
