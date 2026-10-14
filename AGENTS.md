# AGENTS.md

Local web app: raw meeting notes/transcripts -> Summary + Action Items PDF, using a local Ollama model and the system Chrome/Edge for rendering. No cloud services.

## Commands

- Install: `npm install`
- Run: `npm start` -> http://localhost:3000
- Dev (auto-restart): `npm run dev` (uses `node --watch`)
- Syntax check (the only automated check): `node --check <file>`

There is **no** test, lint, typecheck, or build script. Verify changes by running the server and exercising endpoints (`GET /health`, `POST /api/generate`) or the UI at localhost:3000. `/health` reports Ollama connectivity, default-model availability, and the detected browser — use it first when something fails.

## Runtime prerequisites (not installed by npm install)

- Ollama running at `http://localhost:11434` with a model pulled (default `qwen3.5:9b`).
- Chrome or Edge installed; `server/config.js` auto-detects it, or set `CHROME_PATH`.
- Audio transcription only works for `.wav` out of the box. mp3/m4a/etc. need `ffmpeg` on PATH.
- First audio run downloads the Whisper model (~40 MB) into `.cache/`.
- `package.json` `allowScripts` opts in `protobufjs` and `sharp` install scripts; these are required by `@xenova/transformers`.

## Architecture (wiring not obvious from filenames)

- Entrypoint `server/index.js` (Express, ESM). All routes live here; there is no router split.
- `POST /api/generate` -> `server/ollama.js` `generateJSON` (Ollama JSON mode, schema-constrained, `temperature 0.2`, `think` flag) -> `server/prompt.js` `normalizeResult` -> `server/pdf.js` `renderPdf`.
- `server/pdf.js` fills `templates/meeting-pdf.html` by replacing `{{TITLE}} {{DATE}} {{ACTION_COUNT}} {{SUMMARY}} {{ACTION_ROWS}}`. If you add/rename a placeholder, update **both** files.
- `server/prompt.js` owns the model system prompt, the JSON response schema, and output normalization. The schema shape (summary + action_items[task,owner,due,priority]) is the contract between model output, PDF, and UI.
- PDF ids are UUIDs; `GET /api/download/:id` validates the id with a regex before touching the filesystem. Keep that guard.
- `server/transcribe.js` lazily loads Whisper and caches the pipeline promise; `server/extract.js` owns extension allowlists and subtitle cleanup.

## Configuration (all optional; see `server/config.js`)

- `PORT` (3000), `OLLAMA_URL` (http://localhost:11434), `OLLAMA_MODEL` (qwen3.5:9b), `CHROME_PATH` (auto), `OLLAMA_TIMEOUT_MS` (600000), `OLLAMA_THINK` (false).
- `OLLAMA_THINK=true` enables model reasoning but is much slower; leave false for normal use.

## Conventions

- ESM only (`"type": "module"`); Node >= 18. Use `import`/`export`, `node:`-prefixed core imports.
- Every value interpolated into HTML (both `server/pdf.js` and `public/app.js`) must go through the local `escapeHtml`. Follow this when adding fields.
- Frontend is framework-free vanilla HTML/CSS/JS (`public/`), served by Express static. `app.js` calls the API directly.
- Do not commit generated artifacts: `output/`, `generated_documents/`, `.cache/`, `uploads/` are gitignored.

## opencode config

- `opencode.json` registers the `document-generator` MCP server (`npx --yes document-generator-mcp@latest`), exposing `gerar_documento_word` / `gerar_documento_pdf`.
- opencode loads config only at startup — **restart opencode** after editing `opencode.json`; the current session won't pick it up.
- Skill `web-design-guidelines` lives in `.agents/skills/` and is pinned in `skills-lock.json`.

## Environment gotchas (Windows / PowerShell 5.1)

- No `-Form` on `Invoke-RestMethod`/`Invoke-WebRequest`; use `curl.exe -F` for multipart tests.
- `Start-Process` for the server can surface a cosmetic tool error even though the server starts fine.
- Free port 3000 with: `Get-NetTCPConnection -LocalPort 3000 | Stop-Process`.
- Stop server processes via their PID rather than `npm start` in the foreground when scripted.

## Not present (don't look for it)

- No CI workflows, no Dockerfile, no migrations, no bundler/transpiler, no `.env` (all config is env vars).
