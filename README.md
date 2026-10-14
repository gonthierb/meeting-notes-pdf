# Meeting Notes → PDF

Turn raw meeting notes (or transcripts) into a well-organized PDF using a **local AI model**.
Everything runs on your machine: notes are summarized by [Ollama](https://ollama.com) and rendered
to PDF by your local Chrome/Edge. No cloud services.

The PDF contains a short **Summary** and a clean **Action Items** table (Task · Owner · Due · Priority).

## Requirements

- **Node.js 18+**
- **[Ollama](https://ollama.com)** running locally with a model pulled, e.g.:
  ```
  ollama pull qwen3.5:9b
  ```
- **Google Chrome or Microsoft Edge** installed (used headlessly to render the PDF).

## Setup

```
npm install
```

## Run

```
npm start
```

Then open http://localhost:3000.

1. Paste notes or drop a file (`.txt`, `.md`, `.docx`, `.vtt`, `.srt`, audio `.wav`).
2. Review/edit the extracted text.
3. Click **Generate PDF** and download the result.

## Supported inputs

| Type | Extensions | Notes |
|---|---|---|
| Plain text | `.txt`, `.md`, `.markdown` | read directly |
| Word | `.docx` | text extracted via mammoth |
| Subtitles | `.vtt`, `.srt` | timestamps stripped, deduplicated |
| Audio | `.wav` | transcribed locally with Whisper (auto-downloads ~40MB model on first use) |

> **Audio other than `.wav`** (mp3/m4a/etc.) requires **ffmpeg** on your PATH to decode. If it is
> missing you'll get a clear message telling you to convert to 16 kHz `.wav` or install ffmpeg.

## Configuration

Environment variables (all optional):

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `OLLAMA_URL` | `http://localhost:11434` | Ollama endpoint |
| `OLLAMA_MODEL` | `qwen3.5:9b` | Default model (overridable in the UI) |
| `CHROME_PATH` | auto-detected | Explicit path to Chrome/Edge |

Example (PowerShell):

```powershell
$env:OLLAMA_MODEL="gemma3:27b"; npm start
```

## API

| Method | Route | Description |
|---|---|---|
| GET | `/health` | Server + Ollama + PDF renderer status |
| GET | `/api/models` | List locally available Ollama models |
| POST | `/api/extract` | multipart `file` → extracted text |
| POST | `/api/generate` | JSON `{ text, title, model }` → summary, action items, PDF id |
| GET | `/api/download/:id` | Download a generated PDF |

## Project layout

```
server/
  index.js       Express app + routes
  config.js      Config + Chrome auto-detection
  ollama.js      Ollama client (models, health, JSON generation)
  extract.js     txt/md/docx/vtt/srt text extraction
  transcribe.js  Whisper via transformers.js (audio)
  prompt.js      system prompt, JSON schema, result normalization
  pdf.js         HTML → PDF (puppeteer-core + local Chrome)
public/          Web UI (index.html, styles.css, app.js)
templates/       PDF HTML template
samples/         Example notes for testing
output/          Generated PDFs (gitignored)
```
