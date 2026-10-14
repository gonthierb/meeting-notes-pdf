import path from 'node:path';
import mammoth from 'mammoth';

export const AUDIO_EXTENSIONS = ['.wav', '.mp3', '.m4a', '.flac', '.ogg', '.webm', '.aac'];
export const DOC_EXTENSIONS = ['.txt', '.md', '.markdown', '.docx', '.vtt', '.srt'];

export function extensionOf(filename) {
  return path.extname(filename || '').toLowerCase();
}

export function isAudio(filename) {
  return AUDIO_EXTENSIONS.includes(extensionOf(filename));
}

export function isSupported(filename) {
  const ext = extensionOf(filename);
  return AUDIO_EXTENSIONS.includes(ext) || DOC_EXTENSIONS.includes(ext);
}

function cleanTranscript(text) {
  const lines = text.split(/\r?\n/);
  const out = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (/^WEBVTT/i.test(line)) continue;
    if (/^(NOTE|STYLE|REGION)\b/i.test(line)) continue;
    if (/^\d+$/.test(line)) continue; // SRT index
    if (/^\d{1,2}:\d{2}(:\d{2})?[.,]\d{1,3}\s*-->/.test(line)) continue; // cue timing
    if (/^[\d:.,\s-]+$/.test(line)) continue;
    const stripped = line
      .replace(/<[^>]+>/g, '')
      .replace(/^\s*[-–—]?\s*[A-Za-z0-9 ._'()-]{0,40}:\s{0,2}(?=\S)/, (match) =>
        /(-->|\d{2}:\d{2})/.test(match) ? match : ''
      )
      .trim();
    const cleaned = stripped || line;
    if (out.length && out[out.length - 1] === cleaned) continue;
    out.push(cleaned);
  }
  return out.join('\n');
}

export async function extractText(filename, buffer) {
  const ext = extensionOf(filename);

  if (ext === '.docx') {
    const { value } = await mammoth.extractRawText({ buffer });
    return value.trim();
  }

  const text = buffer.toString('utf8');
  if (ext === '.vtt' || ext === '.srt') {
    return cleanTranscript(text);
  }

  return text.trim();
}
