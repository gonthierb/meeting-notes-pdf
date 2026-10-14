import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import express from 'express';
import multer from 'multer';

import { config } from './config.js';
import { listModels, generateJSON, health, OllamaError } from './ollama.js';
import { extractText, isAudio, isSupported, extensionOf } from './extract.js';
import { transcribe } from './transcribe.js';
import { renderPdf } from './pdf.js';
import { systemPrompt, buildUserPrompt, responseSchema, normalizeResult } from './prompt.js';

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(process.cwd(), 'public')));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxUploadBytes },
});

app.get('/health', async (_req, res) => {
  const ollama = await health();
  res.status(ollama.ok ? 200 : 503).json({
    ok: ollama.ok,
    ollamaUrl: config.ollamaUrl,
    defaultModel: config.defaultModel,
    defaultModelAvailable: ollama.hasDefault ?? false,
    pdfRenderer: config.chromePath || null,
    error: ollama.error,
  });
});

app.get('/api/models', async (_req, res) => {
  try {
    const models = await listModels();
    res.json({ models, defaultModel: config.defaultModel });
  } catch (err) {
    res.status(502).json({ error: err.message, models: [] });
  }
});

app.post('/api/extract', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }
    const { originalname, buffer } = req.file;
    if (!isSupported(originalname)) {
      return res.status(415).json({
        error: `Unsupported file type "${extensionOf(originalname) || originalname}".`,
      });
    }

    if (isAudio(originalname)) {
      const text = await transcribe(originalname, buffer);
      return res.json({ text, kind: 'audio', filename: originalname });
    }

    const text = await extractText(originalname, buffer);
    if (!text) {
      return res.status(422).json({ error: 'No text could be extracted from that file.' });
    }
    res.json({ text, kind: 'document', filename: originalname });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/generate', async (req, res) => {
  try {
    const { text, title, model } = req.body || {};
    const notes = typeof text === 'string' ? text.trim() : '';
    if (!notes) {
      return res.status(400).json({ error: 'Meeting notes are empty.' });
    }

    const raw = await generateJSON({
      model,
      schema: responseSchema,
      system: systemPrompt,
      prompt: buildUserPrompt({ text: notes, title }),
    });

    const { summary, action_items } = normalizeResult(raw);
    const id = crypto.randomUUID();
    const resolvedTitle = (typeof title === 'string' && title.trim()) || 'Meeting Notes';

    await renderPdf({ id, title: resolvedTitle, summary, actionItems: action_items });

    res.json({
      id,
      title: resolvedTitle,
      model: model || config.defaultModel,
      summary,
      actionItems: action_items,
      downloadUrl: `/api/download/${id}`,
    });
  } catch (err) {
    const status = err instanceof OllamaError ? 502 : 500;
    res.status(status).json({ error: err.message });
  }
});

app.get('/api/download/:id', (req, res) => {
  const { id } = req.params;
  if (!/^[a-f0-9-]{16,64}$/i.test(id)) {
    return res.status(400).json({ error: 'Invalid file id.' });
  }
  const file = path.join(config.outputDir, `${id}.pdf`);
  if (!fs.existsSync(file)) {
    return res.status(404).json({ error: 'PDF not found. Generate it first.' });
  }
  res.download(file, `meeting-notes-${id.slice(0, 8)}.pdf`);
});

app.use((err, _req, res, _next) => {
  if (err?.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large (limit 50 MB).' });
  }
  res.status(500).json({ error: err?.message || 'Unexpected server error.' });
});

app.listen(config.port, async () => {
  const ollama = await health();
  console.log(`\nMeeting Notes → PDF running at http://localhost:${config.port}`);
  console.log(`  Ollama:  ${config.ollamaUrl} (${ollama.ok ? 'connected' : 'NOT reachable'})`);
  console.log(`  Model:   ${config.defaultModel}${ollama.hasDefault ? '' : ' (not found locally)'}`);
  console.log(`  PDF:     ${config.chromePath || 'no browser found'}\n`);
});
