import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getCaseById } from './src/game/cases/midnightDisappearance.ts';
import { generateScriptedInterrogationReply } from './src/game/scriptedDialogue.ts';
import type { InterrogateApiRequest } from './src/game/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production' || Boolean(process.env.RENDER);

async function createServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', mode: 'local' });
  });

  app.post('/api/interrogate', (req, res) => {
    const body = req.body as Partial<InterrogateApiRequest>;
    const caseId = typeof body.caseId === 'string' ? body.caseId : '';
    const suspectId = typeof body.suspectId === 'string' ? body.suspectId : '';
    const question = typeof body.question === 'string' ? body.question.trim() : '';

    if (!caseId || !suspectId || !question) {
      res.status(400).json({ error: 'Missing required interrogation parameters.' });
      return;
    }

    const caseFile = getCaseById(caseId);
    if (!caseFile) {
      res.status(404).json({ error: 'Unknown case file.' });
      return;
    }

    const suspect = caseFile.suspects.find((s) => s.id === suspectId);
    if (!suspect) {
      res.status(404).json({ error: 'Unknown suspect.' });
      return;
    }

    const normalizedReq: InterrogateApiRequest = {
      caseId,
      suspectId,
      question: question.slice(0, 600),
      presentedClueId: typeof body.presentedClueId === 'string' ? body.presentedClueId : null,
      discoveredClueIds: Array.isArray(body.discoveredClueIds)
        ? body.discoveredClueIds.filter((x): x is string => typeof x === 'string')
        : [],
      unlockedTestimonyIds: Array.isArray(body.unlockedTestimonyIds)
        ? body.unlockedTestimonyIds.filter((x): x is string => typeof x === 'string')
        : [],
      history: Array.isArray(body.history) ? body.history.slice(-10) : [],
    };

    const reply = generateScriptedInterrogationReply(caseFile, normalizedReq);
    res.json(reply);
  });

  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distPath, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SHADOW FILES server running on http://0.0.0.0:${PORT}`);
  });
}

createServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
