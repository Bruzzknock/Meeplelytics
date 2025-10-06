import app from './app';
import prisma from './prisma';

const port = process.env.PORT ? Number(process.env.PORT) : 4000;

async function main() {
  await prisma.$connect();
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server', err);
  process.exit(1);
});
