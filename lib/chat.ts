// The text the knowledge cards are searched with: the latest user message,
// counted twice so it dominates, plus the one before it, so a follow-up like
// "e para iniciantes?" still finds the subject of the previous question.
export function chatKnowledgeQuery(messages: Array<{ role: string; content: string }>): string {
  const userTexts = messages.filter((m) => m.role === 'user').map((m) => m.content);
  const latest = userTexts.at(-1) ?? '';
  const previous = userTexts.at(-2) ?? '';
  return [latest, latest, previous].filter(Boolean).join('\n');
}

// Derives a short, human-friendly conversation title from the first message.
export function deriveConversationTitle(message: string): string {
  const cleaned = message.replace(/\s+/g, ' ').trim();
  if (cleaned === '') return 'New conversation';
  if (cleaned.length <= 60) return cleaned;
  return `${cleaned.slice(0, 57).trimEnd()}...`;
}
