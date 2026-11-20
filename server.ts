import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { getCaseById } from './src/game/cases/midnightDisappearance';
import {
  buildInterrogationSystemPrompt,
  validateInterrogationOutput,
  type RawAiInterrogationOutput,
} from './src/game/interrogationGuard';
import { generateScriptedInterrogationReply } from './src/game/scriptedDialogue';
import type { InterrogateApiRequest } from './src/game/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function createServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    const aiReady = Boolean(
      process.env.GEMINI_API_KEY?.trim() &&
        process.env.GEMINI_API_KEY?.trim() !== 'MY_GEMINI_API_KEY'
    );
    res.json({ status: 'ok', aiReady });
  });

  app.post('/api/interrogate', async (req, res) => {
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

    const ai = getGeminiClient();
    if (!ai) {
      const fallback = generateScriptedInterrogationReply(
        caseFile,
        normalizedReq,
        'Gemini API key not configured in environment'
      );
      res.json(fallback);
      return;
    }

    try {
      const systemInstruction = buildInterrogationSystemPrompt(caseFile, suspect, normalizedReq);

      const historyTranscript = normalizedReq.history
        .map((turn) => {
          const speaker = turn.sender === 'detective' ? 'Detective' : suspect.name;
          const evNote = turn.presentedClueId ? ` [Presented ${turn.presentedClueId}]` : '';
          return `${speaker}${evNote}: ${turn.text}`;
        })
        .join('\n');

      const presentedClue = normalizedReq.presentedClueId
        ? caseFile.clues.find(
            (c) =>
              c.id === normalizedReq.presentedClueId &&
              normalizedReq.discoveredClueIds.includes(c.id)
          )
        : undefined;

      const userPrompt = [
        historyTranscript ? `RECENT CONVERSATION:\n${historyTranscript}\n` : '',
        `DETECTIVE'S CURRENT QUESTION: "${normalizedReq.question}"`,
        presentedClue
          ? `DETECTIVE PRESENTS EVIDENCE: ${presentedClue.code} — ${presentedClue.title} (${presentedClue.shortSummary})`
          : 'NO PHYSICAL EVIDENCE PRESENTED ON THIS TURN.',
      ]
        .filter(Boolean)
        .join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: userPrompt,
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              reply: {
                type: Type.STRING,
                description:
                  'In-character spoken response from the suspect, 2 to 4 concise noir sentences.',
              },
              emotionalState: {
                type: Type.STRING,
                description:
                  'One of: composed, guarded, defensive, rattled, cooperative.',
              },
              unlockedTestimonyId: {
                type: Type.STRING,
                nullable: true,
                description:
                  'Exact ID from qualifying unlocked disclosures, or null if none unlocked.',
              },
              contradictionReacted: {
                type: Type.BOOLEAN,
                description:
                  'True if the detective directly challenged a lie or presented contradicting evidence.',
              },
            },
            required: ['reply', 'emotionalState', 'contradictionReacted'],
          },
        },
      });

      const rawText = (response.text ?? '').trim();
      const parsed = JSON.parse(rawText) as RawAiInterrogationOutput;
      const validated = validateInterrogationOutput(caseFile, suspect, normalizedReq, parsed);
      res.json(validated);
    } catch (err) {
      let reason = 'Live AI service temporarily unavailable. Running deterministic scripted dialogue.';
      if (err instanceof Error) {
        const msg = err.message;
        if (msg.includes('503') || msg.toLowerCase().includes('high demand')) {
          reason = 'Live AI model is experiencing temporary high demand (503). Continuing in scripted dialogue mode.';
        } else if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
          reason = 'Live AI quota temporarily reached (429). Continuing in scripted dialogue mode.';
        } else if (msg.includes('403') || msg.includes('API_KEY_INVALID')) {
          reason = 'Gemini API key unavailable or invalid. Continuing in scripted dialogue mode.';
        }
      }
      const fallback = generateScriptedInterrogationReply(caseFile, normalizedReq, reason);
      res.json(fallback);
    }
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
