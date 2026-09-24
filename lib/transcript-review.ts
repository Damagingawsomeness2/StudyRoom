import type { Unit } from './study-types';
import type { TranscriptIssue } from './lecture-options';
import { timeLabel } from './lecture.ts';
export function textSpeechIssues(text: string, seconds: number): TranscriptIssue[] {
  const words = text.toLowerCase().match(/[a-z0-9']+/g) || [], triples = new Map<string, number>(), issues: TranscriptIssue[] = [];
  for (let i = 0; i + 2 < words.length; i++) { const key = words.slice(i, i + 3).join(' '); triples.set(key, (triples.get(key) || 0) + 1); }
  if ([...triples.values()].some(n => n >= 4) || words.length > 15 && new Set(words).size / words.length < .28) issues.push('repetition');
  if (words.length > 12 && seconds > 0 && words.length / seconds > 4.5) issues.push('fast-speech');
  return issues;
}
const issueLabels: Record<TranscriptIssue, string> = {
  quiet: 'Quiet audio', clipping: 'Distorted or clipped audio', 'channel-cancellation': 'Speech channel needed correction',
  repetition: 'Possible repeated words', 'fast-speech': 'Unusually dense transcript', 'screen-reading': 'Uncertain slide text',
};
export function reviewReasons(unit: Unit): { label: string; priority: number }[] {
  const issues = [...new Set([...(unit.transcript?.issues || []), ...textSpeechIssues(unit.text, (unit.transcript?.end || 0) - (unit.transcript?.start || 0))])];
  const reasons = issues.map(issue => ({ label: issueLabels[issue], priority: issue === 'repetition' ? 10 : 8 }));
  if (/\b\d+(?:[.,]\d+)?\b|\b(?:percent|hundred|thousand|million|billion|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)\b/i.test(unit.text)) reasons.push({ label: 'Check numbers and amounts', priority: 3 });
  if (/\b(?:not|never|without|except|cannot|isn't|doesn't|don't|can't|won't)\b/i.test(unit.text)) reasons.push({ label: 'Check negative statements', priority: 3 });
  if (/\b[A-Z]{2,8}\b/.test(unit.text)) reasons.push({ label: 'Check abbreviations or names', priority: 2 });
  return reasons;
}
export function priorityTranscriptSections(units: Unit[]) {
  return units.map((unit, index) => ({ index, unit, reasons: reviewReasons(unit) })).filter(x => x.unit.transcript && !x.unit.transcript.reviewed && x.reasons.length).sort((a, b) => Math.max(...b.reasons.map(r => r.priority)) - Math.max(...a.reasons.map(r => r.priority)) || a.index - b.index);
}
export function transcriptSearch(units: Unit[], query: string): number[] {
  const q = query.trim().toLowerCase(), time = /^\d{1,2}:\d{2}(?::\d{2})?$/.test(q) ? q.split(':').map(Number).reduce((a, n) => a * 60 + n, 0) : undefined;
  const needles = q.split(/\s+/).filter(Boolean);
  return units.flatMap((unit, index) => {
    if (!unit.transcript) return [];
    const matches = time !== undefined ? unit.transcript.start <= time && unit.transcript.end > time : needles.every(word => unit.text.toLowerCase().includes(word));
    return matches ? [index] : [];
  });
}
const STOP = new Set('about after again also because before being between both called could does each first from have into just know lecture like look more most much next okay only other over really right same should some something study take than that their them then there these they thing things think this those through today very want were what when where which while will with would your going gonna section chapter talk talking class well actually lets let means example examples'.split(' '));
function titleFor(units: Unit[]) {
  const screen = units.find(u => u.transcript?.kind === 'screen');
  const heading = screen?.text.split(/\n|[.!?]\s/)[0].trim();
  if (heading && heading.length >= 5 && heading.length <= 75) return heading;
  const counts = new Map<string, number>();
  for (const unit of units) for (const word of unit.text.toLowerCase().match(/[a-z][a-z-]{3,}/g) || []) if (!STOP.has(word)) counts.set(word, (counts.get(word) || 0) + 1);
  const words = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 3).map(([w]) => w[0].toUpperCase() + w.slice(1));
  return words.length ? words.join(' · ') : 'Lecture section';
}
export type LectureChapter = { start: number; end: number; title: string; indices: number[] };
export function lectureChapters(units: Unit[]): LectureChapter[] {
  const groups: number[][] = []; let group: number[] = [];
  for (let index = 0; index < units.length; index++) {
    const t = units[index].transcript; if (!t) continue;
    const first = group.length ? units[group[0]].transcript!.start : t.start;
    if (group.length && (t.start - first >= 300 || t.kind === 'screen' && t.start - first >= 150)) { groups.push(group); group = []; }
    group.push(index);
  }
  if (group.length) groups.push(group);
  return groups.map(indices => ({ indices, start: units[indices[0]].transcript!.start, end: Math.max(...indices.map(i => units[i].transcript!.end)), title: titleFor(indices.map(i => units[i])) }));
}
export function transcriptSnippet(text: string, query: string, length = 160) {
  const first = query.toLowerCase().trim().split(/\s+/)[0] || '', found = text.toLowerCase().indexOf(first), start = Math.max(0, found - 35);
  return (start ? '…' : '') + text.slice(start, start + length) + (start + length < text.length ? '…' : '');
}
export function readingGapTime(label: string): number | undefined {
  const match = label.match(/^(\d{1,2}:\d{2}(?::\d{2})?)[–-]/);
  return match ? match[1].split(':').map(Number).reduce((n, v) => n * 60 + v, 0) : undefined;
}
export const chapterLabel = (chapter: LectureChapter) => `${timeLabel(chapter.start)} · ${chapter.title}`;
