import fs from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
import { config } from './config.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatParagraphs(text) {
  return escapeHtml(text)
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
      if (lines.length > 1 && lines.every((l) => /^([-*•]|\d+[.)])\s/.test(l))) {
        const items = lines
          .map((l) => `<li>${l.replace(/^([-*•]|\d+[.)])\s*/, '')}</li>`)
          .join('');
        return `<ul>${items}</ul>`;
      }
      return `<p>${lines.join('<br/>')}</p>`;
    })
    .join('\n');
}

function buildActionRows(items) {
  if (!items.length) {
    return '<tr><td colspan="4" class="empty">No action items were identified.</td></tr>';
  }
  return items
    .map((item) => {
      const priorityClass = item.priority ? `priority-${item.priority.toLowerCase()}` : '';
      const priority = item.priority
        ? `<span class="badge ${priorityClass}">${escapeHtml(item.priority)}</span>`
        : '<span class="muted">—</span>';
      return `<tr>
        <td>${escapeHtml(item.task)}</td>
        <td>${escapeHtml(item.owner || 'Unassigned')}</td>
        <td>${item.due ? escapeHtml(item.due) : '<span class="muted">—</span>'}</td>
        <td>${priority}</td>
      </tr>`;
    })
    .join('\n');
}

export async function renderPdf({ id, title, summary, actionItems }) {
  if (!config.chromePath) {
    throw new Error(
      'No Chrome/Edge browser found for PDF rendering. Set the CHROME_PATH environment variable.'
    );
  }

  const template = await fs.readFile(config.templatePath, 'utf8');
  const html = template
    .replaceAll('{{TITLE}}', escapeHtml(title || 'Meeting Notes'))
    .replaceAll('{{DATE}}', escapeHtml(new Date().toLocaleString()))
    .replaceAll('{{ACTION_COUNT}}', String(actionItems.length))
    .replaceAll('{{SUMMARY}}', formatParagraphs(summary))
    .replaceAll('{{ACTION_ROWS}}', buildActionRows(actionItems));

  await fs.mkdir(config.outputDir, { recursive: true });
  const outPath = `${config.outputDir}/${id}.pdf`;

  const browser = await puppeteer.launch({
    executablePath: config.chromePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.pdf({
      path: outPath,
      format: 'A4',
      printBackground: true,
      margin: { top: '18mm', bottom: '20mm', left: '16mm', right: '16mm' },
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate:
        '<div style="width:100%;font-size:8px;color:#94a3b8;padding:0 16mm;text-align:center;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>',
    });
  } finally {
    await browser.close();
  }

  return outPath;
}
