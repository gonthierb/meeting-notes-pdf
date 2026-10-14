const els = {
  status: document.getElementById('status'),
  statusText: document.getElementById('statusText'),
  title: document.getElementById('title'),
  model: document.getElementById('model'),
  dropzone: document.getElementById('dropzone'),
  file: document.getElementById('file'),
  dropError: document.getElementById('dropError'),
  notes: document.getElementById('notes'),
  charHint: document.getElementById('charHint'),
  generate: document.getElementById('generate'),
  clear: document.getElementById('clear'),
  result: document.getElementById('result'),
  overlay: document.getElementById('overlay'),
  overlayText: document.getElementById('overlayText'),
  toast: document.getElementById('toast'),
};

const numberFmt = new Intl.NumberFormat('en-US');
let dirty = false;
let toastTimer;

function setBusy(busy, text) {
  els.overlay.classList.toggle('hidden', !busy);
  if (text) els.overlayText.textContent = text;
}

function setStatus(text, state) {
  els.statusText.textContent = text;
  els.status.dataset.state = state || '';
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove('show'), 7000);
}

function setDropError(message) {
  els.dropError.textContent = message || '';
  els.dropError.classList.toggle('hidden', !message);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function updateCharHint() {
  const n = els.notes.value.trim().length;
  els.charHint.textContent = n ? `${numberFmt.format(n)} characters` : '';
  els.generate.disabled = n === 0;
}

async function loadStatus() {
  try {
    const [health, models] = await Promise.all([
      fetch('/health').then((r) => r.json()),
      fetch('/api/models').then((r) => r.json()).catch(() => ({ models: [] })),
    ]);

    els.model.innerHTML = '';
    const list = models.models?.length ? models.models : [health.defaultModel];
    for (const name of list) {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      if (name === models.defaultModel) opt.selected = true;
      els.model.appendChild(opt);
    }

    if (!health.ok) setStatus('Ollama offline', 'err');
    else if (!health.defaultModelAvailable) setStatus('Model missing', 'warn');
    else if (!health.pdfRenderer) setStatus('No PDF renderer', 'warn');
    else setStatus('Ready', 'ok');
  } catch {
    setStatus('Server error', 'err');
  }
}

async function handleFile(file) {
  if (!file) return;
  setDropError('');
  const isAudio = /\.(wav|mp3|m4a|flac|ogg|webm|aac)$/i.test(file.name);
  setBusy(true, isAudio ? 'Transcribing audio… (first run downloads a model)' : 'Extracting text…');
  try {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/extract', { method: 'POST', body: form });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Extraction failed.');
    els.notes.value = data.text || '';
    if (!els.title.value) els.title.value = file.name.replace(/\.[^.]+$/, '');
    dirty = true;
    updateCharHint();
  } catch (err) {
    setDropError(err.message);
    showToast(err.message);
  } finally {
    setBusy(false);
  }
}

function actionCard(item, index) {
  const priority = item.priority
    ? `<span class="badge ${escapeHtml(item.priority)}">${escapeHtml(item.priority)}</span>`
    : '';
  const owner = `<span class="chip"><span class="chip-k">Owner</span>${escapeHtml(item.owner || 'Unassigned')}</span>`;
  const due = item.due
    ? `<span class="chip"><span class="chip-k">Due</span>${escapeHtml(item.due)}</span>`
    : '<span class="chip"><span class="chip-k">Due</span>None</span>';

  return `<li class="action-card">
    <span class="action-index" aria-hidden="true">${index + 1}</span>
    <div class="action-body">
      <p class="action-task">${escapeHtml(item.task)}</p>
      <div class="action-meta">${priority}${owner}${due}</div>
    </div>
  </li>`;
}

function renderResult(data) {
  const items = data.actionItems || [];
  const list = items.length
    ? items.map(actionCard).join('')
    : '<li class="empty-items">No action items were identified.</li>';

  els.result.innerHTML = `
    <div class="result-head">
      <a class="btn-download" id="downloadBtn" href="${data.downloadUrl}" download>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M20 17v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2" />
        </svg>
        Download PDF
      </a>
      <span class="result-model" translate="no">${escapeHtml(data.model)}</span>
    </div>
    <h3 class="section-title">Summary</h3>
    <p class="summary">${escapeHtml(data.summary)}</p>
    <h3 class="section-title">Action Items <span class="count">${items.length}</span></h3>
    <ul class="actions-list">${list}</ul>
  `;

  document.getElementById('downloadBtn')?.focus();
}

async function generate() {
  const text = els.notes.value.trim();
  if (!text) return;
  setBusy(true, 'Generating summary with local AI…');
  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, title: els.title.value, model: els.model.value }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Generation failed.');
    renderResult(data);
    dirty = false;
  } catch (err) {
    els.result.innerHTML = `<div class="error-card">${escapeHtml(err.message)}</div>`;
    showToast(err.message);
  } finally {
    setBusy(false);
  }
}

els.dropzone.addEventListener('click', () => els.file.click());
els.file.addEventListener('change', () => {
  handleFile(els.file.files[0]);
  els.file.value = '';
});
els.notes.addEventListener('input', () => {
  dirty = true;
  updateCharHint();
});
els.generate.addEventListener('click', generate);
els.clear.addEventListener('click', () => {
  els.notes.value = '';
  els.title.value = '';
  dirty = false;
  setDropError('');
  updateCharHint();
  els.result.innerHTML = `
    <div class="empty">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" />
      </svg>
      <p>Your summary and action items will appear here.</p>
    </div>`;
});

['dragenter', 'dragover'].forEach((evt) =>
  els.dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    els.dropzone.classList.add('drag');
  })
);
['dragleave', 'drop'].forEach((evt) =>
  els.dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    els.dropzone.classList.remove('drag');
  })
);
els.dropzone.addEventListener('drop', (e) => handleFile(e.dataTransfer.files[0]));

window.addEventListener('beforeunload', (e) => {
  if (dirty && els.notes.value.trim()) {
    e.preventDefault();
    e.returnValue = '';
  }
});

loadStatus();
updateCharHint();
