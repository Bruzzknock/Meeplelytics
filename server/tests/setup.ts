import { PrismaClient } from '@prisma/client';

jest.setTimeout(20000);

beforeAll(() => {
  process.env.DATABASE_URL = process.env.DATABASE_URL || 'file:./dev.db';
});

afterAll(async () => {
  const prisma = new PrismaClient();
  await prisma.$disconnect();
});
