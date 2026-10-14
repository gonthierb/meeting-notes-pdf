import path from 'node:path';
import fs from 'node:fs';

function detectChrome() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }
  const candidates = [
    process.env['PROGRAMFILES'] && path.join(process.env['PROGRAMFILES'], 'Google/Chrome/Application/chrome.exe'),
    process.env['PROGRAMFILES(X86)'] && path.join(process.env['PROGRAMFILES(X86)'], 'Google/Chrome/Application/chrome.exe'),
    process.env['LOCALAPPDATA'] && path.join(process.env['LOCALAPPDATA'], 'Google/Chrome/Application/chrome.exe'),
    process.env['PROGRAMFILES(X86)'] && path.join(process.env['PROGRAMFILES(X86)'], 'Microsoft/Edge/Application/msedge.exe'),
    process.env['PROGRAMFILES'] && path.join(process.env['PROGRAMFILES'], 'Microsoft/Edge/Application/msedge.exe'),
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

export const config = {
  port: Number(process.env.PORT) || 3000,
  ollamaUrl: (process.env.OLLAMA_URL || 'http://localhost:11434').replace(/\/$/, ''),
  defaultModel: process.env.OLLAMA_MODEL || 'qwen3.5:9b',
  chromePath: detectChrome(),
  outputDir: path.join(process.cwd(), 'output'),
  templatePath: path.join(process.cwd(), 'templates', 'meeting-pdf.html'),
  cacheDir: path.join(process.cwd(), '.cache'),
  maxUploadBytes: 50 * 1024 * 1024,
  requestTimeoutMs: Number(process.env.OLLAMA_TIMEOUT_MS) || 600000,
  think: process.env.OLLAMA_THINK === 'true',
};
