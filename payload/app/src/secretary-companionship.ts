// Personal follow-ups are stored inside a ruler's Bond, never the empire's work notes.
export interface Followup {
  kind: 'concern' | 'advice'; quote: string; date: string;
  topic: string; baseline: string; used?: boolean;
}
type Line = { who: 'me' | 'them'; text: string };
type Fact = { key: string; text: string };
const clean = (v: unknown) => typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '';
export function rememberFollowups(old: Followup[], input: unknown, lines: Line[], facts: Fact[], date: string): Followup[] {
  const out = [...old];
  if (!Array.isArray(input)) return out;
  for (const raw of input.slice(0, 2)) {
    if (!raw || !['concern', 'advice'].includes(raw.kind)) continue;
    const quote = clean(raw.quote);
    if (quote.length < 5 || quote.length > 240) continue;
    const who = raw.kind === 'concern' ? 'me' : 'them';
    if (!lines.some(l => l.who === who && clean(l.text).includes(quote))) continue;
    if (out.some(x => x.kind === raw.kind && x.quote === quote)) continue;
    const fact = facts.find(f => f.key === raw.topic);
    out.push({ kind: raw.kind, quote, date, topic: fact?.key || '', baseline: fact?.text || '' });
  }
  return out.slice(-8);
}
export function selectFollowup(items: Followup[], facts: Fact[], message: string): Followup | undefined {
  return items.find(x => {
    if (x.used) return false;
    const now = facts.find(f => f.key === x.topic);
    // A disappearing report item does NOT prove the problem was solved.
    const changed = !!now && !!x.baseline && now.text !== x.baseline;
    const tokens = clean(x.quote).toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(t => t.length >= 3);
    const overlap = new Set(tokens.filter(t => message.toLowerCase().includes(t))).size;
    return changed || overlap >= 2;
  });
}
export function followupPrompt(item: Followup | undefined, facts: Fact[]): string {
  if (!item) return '';
  const current = facts.find(f => f.key === item.topic);
  return [
    '[Optional personal follow-up — this ruler only]',
    `${item.date}: ${item.kind === 'concern' ? 'The ruler explicitly said' : 'You previously advised'}: "${item.quote}"`,
    item.baseline ? `Recorded situation then: ${item.baseline}` : '',
    current ? `Observed situation now: ${current.text}` : 'No verified outcome is available.',
    item.kind === 'concern'
      ? 'If it fits, gently ask how they feel about this now, in one short sentence. Do not presume recovery or pressure them to answer.'
      : 'If it fits, revisit your exact earlier advice. Acknowledge uncertainty or an error only if current evidence actually supports that conclusion. Never claim the ruler followed your advice, that it caused an outcome, or that a missing report means success. If the outcome is unknown, ask rather than declaring it.',
    'This is optional, not a new topic to force into an urgent report. Do not repeat it in the next reply.',
  ].filter(Boolean).join('\n');
}
