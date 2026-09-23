import type { Evidence, Guide, ProgressData, Question } from './study-types';

export type CoverageState = 'unchecked' | 'review' | 'building' | 'ready' | 'recall' | 'source-check';
export type CoveragePassage = { evidence: Evidence; state: CoverageState; questions: Question[] };
export function studyCoverage(guide: Guide, progress: ProgressData, now = Date.now()) {
  const questionState = (q: Question): CoverageState => {
    const p = progress.practice?.[q.id];
    if (p) return !p.correct || !p.confident || p.dueAt <= now ? 'review' : p.streak >= 2 ? 'ready' : 'building';
    const answer = progress.answers[q.id] ?? progress.assessment[q.id];
    return answer === undefined ? 'unchecked' : answer === q.correct ? 'building' : 'review';
  };
  const byEvidence = new Map<string, Question[]>();
  for (const q of guide.questions) for (const id of q.evidenceIds || []) { const existing = byEvidence.get(id) || []; existing.push(q); byEvidence.set(id, existing); }
  const topics = guide.topics.map(topic => {
    const passages: CoveragePassage[] = (topic.evidence || []).map(evidence => {
      const questions = evidence.id ? byEvidence.get(evidence.id) || [] : [];
      const states = questions.map(questionState);
      const state: CoverageState = evidence.review ? 'source-check' : !questions.length ? 'recall' : states.includes('review') ? 'review' : states.includes('unchecked') ? 'unchecked' : states.every(s => s === 'ready') ? 'ready' : 'building';
      return { evidence, state, questions };
    });
    return { topic, passages, checked: passages.filter(p => ['review', 'building', 'ready'].includes(p.state)).length };
  });
  const passages = topics.flatMap(t => t.passages);
  // A shared passage counts once overall even when an older guide keeps it under multiple topics.
  const unique = [...new Map(passages.map(p => [p.evidence.id || p.evidence.text, p])).values()];
  const count = (states: CoverageState[]) => unique.filter(p => states.includes(p.state)).length;
  const sources = guide.materials.map(material => {
    const reading = guide.sourceCoverage?.find(s => s.sourceId === material.id);
    const linked = unique.filter(p => p.evidence.citations.some(c => c.sourceId === material.id));
    const labels = (rows: CoveragePassage[]) => new Set(rows.flatMap(p => p.evidence.citations.filter(c => c.sourceId === material.id).map(c => c.label)));
    return { material, reading, passages: linked.length, representedUnits: labels(linked).size, quizUnits: labels(linked.filter(p => p.questions.length)).size, checked: linked.filter(p => ['review', 'building', 'ready'].includes(p.state)).length };
  });
  return { topics, sources, total: unique.length, checked: count(['review', 'building', 'ready']), unchecked: count(['unchecked']), review: count(['review']), ready: count(['ready']), recall: count(['recall']), sourceChecks: count(['source-check']) };
}
