import express from 'express';
import cors from 'cors';
import playersRouter from './routes/players';
import teamsRouter from './routes/teams';
import gamesRouter from './routes/games';
import tournamentsRouter from './routes/tournaments';
import roundsRouter from './routes/rounds';
import tablesRouter from './routes/tables';
import importRouter from './routes/imports';
import exportRouter from './routes/exports';
import dashboardRouter from './routes/dashboard';

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api/players', playersRouter);
app.use('/api/teams', teamsRouter);
app.use('/api/games', gamesRouter);
app.use('/api/tournaments', tournamentsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/rounds', roundsRouter);
app.use('/api/tables', tablesRouter);
app.use('/api/import', importRouter);
app.use('/api/export', exportRouter);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  const status = err.status ?? 500;
  res.status(status).json({ error: err.message ?? 'Internal server error' });
});

export default app;
