import { config } from './config.js';

export class OllamaError extends Error {}

async function request(path, init = {}, timeoutMs = config.requestTimeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${config.ollamaUrl}${path}`, {
      ...init,
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new OllamaError(`Ollama responded ${res.status}: ${body.slice(0, 300)}`);
    }
    return res;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new OllamaError('Ollama request timed out.');
    }
    if (err instanceof OllamaError) throw err;
    throw new OllamaError(
      `Could not reach Ollama at ${config.ollamaUrl}. Is it running? (${err.message})`
    );
  } finally {
    clearTimeout(timer);
  }
}

export async function listModels() {
  const res = await request('/api/tags', {}, 10000);
  const data = await res.json();
  return (data.models || []).map((m) => m.name);
}

export async function health() {
  try {
    const models = await listModels();
    return { ok: true, models, hasDefault: models.includes(config.defaultModel) };
  } catch (err) {
    return { ok: false, error: err.message, models: [] };
  }
}

export async function generateJSON({ model, system, prompt, schema }) {
  const body = {
    model: model || config.defaultModel,
    stream: false,
    format: schema || 'json',
    think: config.think,
    options: { temperature: 0.2 },
    messages: [
      ...(system ? [{ role: 'system', content: system }] : []),
      { role: 'user', content: prompt },
    ],
  };

  const res = await request('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  const content = data?.message?.content ?? data?.response ?? '';
  if (!content) {
    throw new OllamaError('Ollama returned an empty response.');
  }

  try {
    return JSON.parse(content);
  } catch {
    const start = content.indexOf('{');
    const end = content.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      try {
        return JSON.parse(content.slice(start, end + 1));
      } catch {
        /* fall through */
      }
    }
    throw new OllamaError('Could not parse the model response as JSON.');
  }
}
