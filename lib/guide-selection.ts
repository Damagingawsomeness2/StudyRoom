import type {Card, Citation, Guide, Question, Topic} from './study-types';

export const GUIDE_LIMITS = {quick: {topics: 8, cards: 20, questions: 12, points: 3}, deep: {topics: 12, cards: 32, questions: 18, points: 6}};
export function minimumCards(available: number) { return Math.min(available, available <= 10 ? 5 : available <= 30 ? 10 : available <= 75 ? 15 : 20); }
export function cardBudget(available: number, depth: Guide['depth'], requested?: number) {
  const minimum = minimumCards(available);
  const target = Number.isInteger(requested) && requested! >= 5 && requested! <= 200 ? requested! : GUIDE_LIMITS[depth].cards;
  return {minimum, target: Math.min(available, Math.max(minimum, target))};
}
const stop = new Set('the and are for but has its was were can not all any one two out our who how may more most only other their then than about after also been being called class course define describe discuss each explain file from have into introduction learning lecture main material notes objective overview page part point should slide some study subject test that their them these they this through topic understand using what when which with would your important concept example'.split(' '));
const words = (s: string) => [...new Set((s.toLowerCase().match(/[\p{L}]{3,}/gu) || []).map(w => w.length > 5 && w.endsWith('s') ? w.slice(0, -1) : w).filter(w => !stop.has(w)))];
const hits = (a: string[], b: Set<string>) => a.filter(w => b.has(w)).length;
export const isLearningGoal = (s: string) => /^(?:learning (?:goals?|objectives?|outcomes?)|by the end of|after (?:this|the) (?:class|lesson|lecture)|(?:you|students) (?:will|should) be able to)\b/i.test(s.trim());
export function isAdministrative(s: string) {
  return /^(?:copyright\b|©|all rights reserved\b|https?:\/\/|www\.|(?:please )?(?:submit|upload|hand in) (?:your|the|this) (?:homework|assignment)|office hours\b|(?:the |our )?(?:next class|next lecture|assignment deadline|course schedule|grading policy|attendance policy)\b|(?:this |the |your )?(?:assignment|homework|quiz|exam) (?:is |will be )?(?:due|worth|on (?:monday|tuesday|wednesday|thursday|friday))\b|(?:please )?(?:mute your|turn on your camera|take a break|sign the attendance)|(?:contact|email) (?:me|your instructor|the instructor)\b)/i.test(s.trim());
}
export const administrativeHeading = (s: string) => /^(?:housekeeping|course logistics|announcements|office hours|grading policy|attendance policy|references|bibliography|table of contents)$/i.test(s.trim());

// Select a bounded set across topics, not the first N slides. Every answer keeps its original evidence.
function spread<T extends {topicId: string}>(items: T[], topics: Topic[], limit: number, score: (item: T) => number): T[] {
  const groups = topics.map(t => items.filter(x => x.topicId === t.id).sort((a, b) => score(b) - score(a)));
  const selected: T[] = [];
  for (let round = 0; selected.length < limit; round++) {
    let found = false;
    for (const group of groups) if (group[round] && selected.length < limit) { selected.push(group[round]); found = true; }
    if (!found) break;
  }
  return selected;
}

export function selectCoreGuide(guide: Guide, learningGoals: string[] = []): Guide {
  const limits = GUIDE_LIMITS[guide.depth], originalTopics = guide.topics.map(t => ({...t, citations: [...t.citations]}));
  const availableCards = Math.max(guide.selection?.availableCards || 0, guide.cards.length);
  const availableQuestions = Math.max(guide.selection?.availableQuestions || 0, guide.questions.length);
  const subject = words(guide.subject), focus = words(guide.focus), goals = new Set(words(learningGoals.join(' ')));
  const textOf = (t: Topic) => t.title + ' ' + (t.evidence?.map(e => e.text) || t.points).join(' ');
  const tokens = new Map(guide.topics.map(t => [t.id, new Set(words(textOf(t)))]));
  // A matching filename is a useful subject anchor. With no reliable anchor, rank conservatively instead of guessing a subject taxonomy.
  const subjectFiles = new Set(guide.materials.filter(m => hits(subject, new Set(words(m.name.replace(/\.[^.]+$/, '')))) > 0).map(m => m.id));
  const anchors = guide.topics.filter(t => t.citations.some(c => subjectFiles.has(c.sourceId)));
  const frequencies = new Map<string, number>();
  for (const t of anchors) for (const word of tokens.get(t.id)!) frequencies.set(word, (frequencies.get(word) || 0) + 1);
  const shared = new Set([...frequencies].sort((a, b) => b[1] - a[1]).slice(0, 120).map(([w]) => w));
  const relevant = (t: Topic) => !anchors.length || t.citations.some(c => subjectFiles.has(c.sourceId)) || hits(subject, tokens.get(t.id)!) > 0 || hits([...tokens.get(t.id)!], shared) >= 2;
  const repetition = (cs: Citation[]) => Math.min(3, new Set(cs.map(c => c.sourceId)).size - 1);
  const teaching = (s: string) => /\b(?:is|are|means|because|whereas|requires|causes|steps|process)\b|\S\s*=\s*\S/i.test(s) ? 2 : 0;
  const topicScore = (t: Topic) => hits(subject, tokens.get(t.id)!) * 3 + hits(focus, tokens.get(t.id)!) * 12 + Math.min(4, hits([...goals], tokens.get(t.id)!)) * 3 + repetition(t.citations) * 2 + teaching(textOf(t));
  const candidates = guide.topics.filter(relevant).sort((a, b) => topicScore(b) - topicScore(a));
  const candidateIds = new Set(candidates.map(t => t.id)), available = guide.cards.filter(c => candidateIds.has(c.topicId)).length;
  const budget = cardBudget(available, guide.depth, guide.cardTarget);
  // Add another relevant topic when necessary to meet the material-based floor or a requested larger set.
  let topicLimit = Math.min(limits.topics, candidates.length);
  const counts = new Map(candidates.map(t => [t.id, guide.cards.filter(c => c.topicId === t.id).length]));
  let capacity = candidates.slice(0, topicLimit).reduce((n, t) => n + (counts.get(t.id) || 0), 0);
  while (capacity < budget.target && topicLimit < candidates.length) capacity += counts.get(candidates[topicLimit++].id) || 0;
  guide.topics = candidates.slice(0, topicLimit);
  const itemScore = (item: Card | Question) => {
    const text = 'back' in item ? item.back : item.explanation, set = new Set(words(text));
    return hits(focus, set) * 12 + hits(subject, set) * 3 + Math.min(4, hits([...goals], set)) * 3 + repetition(item.citations) * 2 + teaching(text);
  };
  guide.cards = spread(guide.cards, guide.topics, budget.target, itemScore);
  const cardTopics = new Set(guide.cards.map(c => c.topicId));
  guide.topics = guide.topics.filter(t => cardTopics.has(t.id));
  const coveredQuotes = new Set(guide.cards.flatMap(c => c.citations.map(c => c.quote).filter(Boolean)));
  const questions = guide.questions.filter(q => !q.evidenceIds?.length || q.citations.some(c => coveredQuotes.has(c.quote)));
  guide.questions = spread(questions, guide.topics, limits.questions, itemScore);
  const retainedEvidence = new Set(guide.questions.flatMap(q => q.evidenceIds || []));
  for (const t of guide.topics) {
    if (t.evidence) {
      t.evidence = t.evidence.filter(e => retainedEvidence.has(e.id || '') || coveredQuotes.has(e.text));
      const checks = t.evidence.filter(e => e.review);
      t.points = [...checks, ...t.evidence.filter(e => !e.review)].map(e => e.text).slice(0, Math.max(limits.points, checks.length));
      t.citations = [...new Map(t.evidence.flatMap(e => e.citations).map(c => [c.sourceId + '|' + c.label + '|' + c.quote, c])).values()];
    } else t.points = t.points.slice(0, limits.points);
  }
  const labels = new Set(guide.topics.flatMap(t => t.citations.map(c => c.sourceId + '|' + c.label)));
  if (guide.sequences) guide.sequences = guide.sequences.filter(s => s.citations.some(c => labels.has(c.sourceId + '|' + c.label))).slice(0, guide.depth === 'quick' ? 6 : 10);
  for (const topic of originalTopics) for (const c of topic.citations) {
    if (labels.has(c.sourceId + '|' + c.label)) continue;
    const coverage = guide.sourceCoverage?.find(s => s.sourceId === c.sourceId);
    if (coverage && !coverage.notRepresented.some(x => x.label === c.label)) coverage.notRepresented.push({label: c.label, reason: relevant(topic) ? 'Outside this concise guide’s selected concepts. The original remains available in Sources.' : 'No clear link to the selected subject was found. Check the original in Sources if this belongs in your course.'});
  }
  if (guide.builtIn) {
    const evidence = guide.topics.flatMap(t => t.evidence || []);
    guide.builtIn.passages = evidence.length;
    guide.builtIn.sourceChecks = evidence.filter(e => e.review).length;
  }
  guide.selection = {availableCards, availableQuestions, minimumCards: budget.minimum, relevantCards: available, targetCards: budget.target, omittedTopics: Math.max(guide.selection?.omittedTopics || 0, originalTopics.length - guide.topics.length)};
  return guide;
}
