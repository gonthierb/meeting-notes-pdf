import { config } from './config.js';
import { extensionOf } from './extract.js';

const MODEL_ID = 'Xenova/whisper-base';
let transcriberPromise = null;

async function getTranscriber() {
  if (!transcriberPromise) {
    transcriberPromise = (async () => {
      const { pipeline, env } = await import('@xenova/transformers');
      env.cacheDir = config.cacheDir;
      env.allowLocalModels = false;
      env.useBrowserCache = false;
      return pipeline('automatic-speech-recognition', MODEL_ID);
    })().catch((err) => {
      transcriberPromise = null;
      throw err;
    });
  }
  return transcriberPromise;
}

async function decodeWav(buffer) {
  const mod = await import('wavefile');
  const WaveFile = mod.WaveFile || mod.default?.WaveFile || mod.default;
  const wav = new WaveFile(buffer);
  wav.toBitDepth('32f');
  wav.toSampleRate(16000);

  let samples = wav.getSamples();
  if (Array.isArray(samples)) {
    const length = samples[0].length;
    const merged = new Float32Array(length);
    for (const channel of samples) {
      for (let i = 0; i < length; i += 1) {
        merged[i] += channel[i] / samples.length;
      }
    }
    samples = merged;
  } else {
    samples = Float32Array.from(samples);
  }
  return samples;
}

export async function transcribe(filename, buffer) {
  const ext = extensionOf(filename);
  if (ext !== '.wav') {
    throw new Error(
      `Transcribing "${ext || 'this format'}" requires ffmpeg on your PATH. ` +
        'Convert the audio to .wav (16 kHz) or install ffmpeg, then try again.'
    );
  }

  const samples = await decodeWav(buffer);
  const transcriber = await getTranscriber();
  const output = await transcriber(samples, {
    chunk_length_s: 30,
    stride_length_s: 5,
    task: 'transcribe',
  });
  const text = (Array.isArray(output) ? output.map((o) => o.text).join(' ') : output.text) || '';
  return text.trim();
}
