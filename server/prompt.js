export const systemPrompt = `You are an assistant that turns raw meeting notes or transcripts into a concise, well-organized summary and a clean list of action items.

Rules:
- Ignore filler, small talk, and duplicated/garbled transcript fragments.
- The summary must be a short set of 2-5 paragraphs (or a few bullet points) covering what the meeting was about and the key outcomes.
- Action items are concrete tasks someone must do. For each, identify:
  - "task": what needs to be done (imperative, specific).
  - "owner": the person responsible, or "Unassigned" if unclear.
  - "due": a due date if stated (e.g. "2026-10-20" or "next Friday"), otherwise "".
  - "priority": one of "High", "Medium", "Low", or "" when unknown.
- Only include real action items. If there are none, return an empty array.
- Never invent facts, owners, or dates that are not supported by the notes.
- Respond with JSON only, matching the provided schema.`;

export function buildUserPrompt({ text, title }) {
  const header = title ? `Meeting title: ${title}\n\n` : '';
  return `${header}Raw meeting notes / transcript:
"""
${text}
"""

Produce the JSON described in the schema: a "summary" string and an "action_items" array.`;
}

export const responseSchema = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    action_items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          task: { type: 'string' },
          owner: { type: 'string' },
          due: { type: 'string' },
          priority: { type: 'string', enum: ['High', 'Medium', 'Low', ''] },
        },
        required: ['task'],
      },
    },
  },
  required: ['summary', 'action_items'],
};

export function normalizeResult(raw) {
  const summary =
    typeof raw?.summary === 'string' && raw.summary.trim()
      ? raw.summary.trim()
      : 'No summary could be generated from the provided notes.';

  const action_items = Array.isArray(raw?.action_items)
    ? raw.action_items
        .map((item) => ({
          task: String(item?.task ?? '').trim(),
          owner: String(item?.owner ?? '').trim() || 'Unassigned',
          due: String(item?.due ?? '').trim(),
          priority: ['High', 'Medium', 'Low'].includes(item?.priority) ? item.priority : '',
        }))
        .filter((item) => item.task)
    : [];

  return { summary, action_items };
}
