import { Router } from 'express';
import prisma from '../prisma';

const router = Router();

router.post('/:id/lock', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const round = await prisma.round.update({ where: { id }, data: { locked: true } });
    res.json(round);
  } catch (err) {
    next(err);
  }
});

export default router;
