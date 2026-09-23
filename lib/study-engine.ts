import {noteMistake,sourceSequences} from './study-tools.ts';
import {referenceMatcher,explicitAliases,topicName} from './source-matching.ts';
import {needsOcrReview} from './ocr-reading.ts';
import type { Citation, Evidence, Guide, Material, Parsed, PracticeRecord, ProgressData, Question, Topic } from './study-types';
export const BUILT_IN_VERSION = 5;

const STOP = new Set('a an the about above after again also among another around because been before being below between both called can could does each either even every for from further has have having here however into itself just known like many more most much must of on only other over same should some such than that their them then there these they this those through under until upon used using very well were what when where which while will with within would your example figure chapter slide page lecture copyright reserved rights professor instructor course introduction overview summary notes topic section important study and or to in at as by be is are it'.split(' '));
const canonical: Record<string, string> = { mitochondrion: 'mitochondria', mitochondrial: 'mitochondria', produces: 'produce', producing: 'produce', generates: 'produce', generating: 'produce', generate: 'produce' };
const stem = (w: string) => canonical[w] || (w.length > 5 && w.endsWith('ies') ? w.slice(0, -3) + 'y' : w.length > 4 && w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('sis') ? w.slice(0, -1) : w);
const words = (s: string) => (s.toLowerCase().match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) || []).map(stem);
export const terms = (s: string) => [...new Set(words(s).filter(w => !STOP.has(w)))].sort();
const conceptKey = (s: string) => words(s).filter(w => !['the', 'a', 'an'].includes(w)).join(' ');
const normalized = (s: string) => s.toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim();
// Ordered words, operators, polarity, and numbers are retained. Bag-of-words similarity is never proof of equivalence.
const signature = (s: string) => (s.toLowerCase().match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*|[<>=+−/%°^*-]/gu) || []).map(stem).filter(w => !['the', 'a', 'an'].includes(w)).join(' ') + '|' + (s.match(/[-+]?\d+(?:\.\d+)?\s*[°µμ]?[a-zA-Z]+/g) || []).join(' ');
const clean = (s: string) => s.replace(/^[ \t]*(?:[•●▪*]|[-–]\s|\d+[.)]\s)\s*/, '').replace(/^[ \t]*#{1,6}\s*/, '').replace(/[ \t]+/g, ' ').trim();
const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (h >>> 0).toString(36); };
function shuffle<T>(arr: T[], seed: string) { const a = [...arr]; let n = parseInt(hash(seed), 36); for (let i = a.length - 1; i > 0; i--) { n = (Math.imul(n, 1664525) + 1013904223) >>> 0; const j = n % (i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const similarity = (a: string, b: string) => { const aa = terms(a), bb = new Set(terms(b)); const n = aa.filter(x => bb.has(x)).length; return aa.length + bb.size ? n / (aa.length + bb.size - n) : 0; };
const mergeCites = (a: Citation[], b: Citation[]) => [...new Map([...a, ...b].map(c => [c.sourceId + '|' + c.label + '|' + (c.quote || ''), c])).values()];
const generic = /^(introduction|overview|summary|notes|key (ideas|points)|learning objectives|speaker notes|references|agenda|contents|section \d+|page \d+|slide \d+)$/i;
const contextDependent = /^(it|this|these|those|they|he|she|we|you|that|there|such|both|the former|the latter)\b/i;
const negated = (s: string) => /\b(no|not|never|without|cannot|isn't|aren't|doesn't|don't)\b/i.test(s);

function definition(s: string) {
  const m = s.match(/^(.{2,85}?)\s+(is defined as|are defined as|refers to|consists of|involves|describes|denotes|means|is|are)\s+(.{10,})$/i)
    || s.match(/^(.{2,85}?)(\s*[:–—]\s+)(.{10,})$/);
  if (!m) return null;
  const term = m[1].replace(/^(the|a|an)\s+/i, '').replace(/,?\s+also (?:known as|called)\s+.+$/i,'').trim(), body = m[3].trim();
  if (contextDependent.test(term) || generic.test(term) || !terms(term).length || words(term).length > 10 || /[.!?;=]/.test(term) || /^(for example|note|remember|answer|question)\b/i.test(term)) return null;
  return { term, body, relation: m[2].trim().toLowerCase() };
}
function statements(text: string) {
  const lines = text.split(/\n+/).map(clean).filter(Boolean), joined: string[] = [];
  for (const line of lines) {
    const previous = joined.at(-1);
    if (previous && previous.length > 70 && !/[.!?:;=]$/.test(previous) && /^[a-z]/.test(line) && !definition(line)) joined[joined.length - 1] += ' ' + line;
    else joined.push(line);
  }
  const segmenter = new Intl.Segmenter('en', { granularity: 'sentence' });
  return [...new Set(joined.flatMap(line => Array.from(segmenter.segment(line), x => x.segment.trim())))].filter(s =>
    s.length <= 1800 && (s.length >= 4 && /\p{L}/u.test(s) || /\S\s*=\s*\S/.test(s) && s.length >= 5)
    && !/^(copyright|all rights|table of contents|references|www\.|https?:|speaker notes)$/i.test(s));
}
function sections(text: string, fallback: string) {
  const lines = text.split('\n'), output: { title: string; text: string }[] = [];
  let title = fallback, body: string[] = [];
  const flush = () => { if (body.length) output.push({ title, text: body.join('\n') }); body = []; };
  for (let i = 0; i < lines.length; i++) {
    const line = clean(lines[i]);
    if (!line || /^speaker notes$/i.test(line)) continue;
    const next = lines.slice(i + 1).find(l => l.trim());
    const heading = line.length >= 3 && line.length <= 85 && words(line).length <= 10 && !/[.!?;=]$/.test(line) && !definition(line)
      && !/\b(is|are|was|were|has|have|can|must|should|will|because)\b/i.test(line)
      && !/^[ \t]*(?:[•●▪*]|[-–]\s|\d+[.)]\s)/.test(lines[i])
      && (i === 0 || /^\s*#/.test(lines[i]) || !lines[i - 1].trim() && !!next && (!!definition(clean(next)) || /^[ \t]*[•●▪*-]/.test(next)));
    if (heading) { flush(); title = line.replace(/:$/, ''); }
    else body.push(line);
  }
  flush();
  return output.length ? output : [{ title: fallback, text }];
}
function citationFor(material: Material, label: string, text: string, quote?: string): Citation {
  const at = quote ? text.indexOf(quote) : 0;
  const start = Math.max(0, at - 1200);
  return { sourceId: material.id, name: material.name, label, excerpt: text.slice(start, Math.max(start + 12000, at + (quote?.length || 0))), ...(quote ? { quote } : {}), ...(material.url ? { url: material.url } : {}) };
}
function evidenceFor(text: string, cite: Citation): Evidence {
  const d = definition(text);
  return { id: 'e-' + hash(signature(text)), text, citations: [cite], kind: /\S\s*=\s*\S/.test(text) ? 'formula' : d ? 'definition' : /\bbecause\b/i.test(text) ? 'cause' : 'passage', ...(d ? { term: d.term } : {}) };
}
function differenceKey(s: string) {
  const expanded = s.replace(/\b(isn't|aren't|doesn't|don't)\b/gi, x => ({ "isn't": 'is not', "aren't": 'are not', "doesn't": 'does not', "don't": 'do not' })[x.toLowerCase()]!);
  const subject = definition(expanded)?.term || (/=/.test(expanded) ? expanded.split('=')[0] : expanded.split(/\b(?:has|have|produces?|contains?|requires?|boils|freezes)\b/i)[0]);
  return conceptKey(subject) + '|' + signature(expanded.replace(/\b(?:no|not|never)\b/g, '').replace(/[-+]?\d+(?:[.,]\d+)?/g, ' NUMBER '));
}
const sourceCheck = 'These passages differ in a number or negative statement. Compare the sources with your teacher before relying on either. This idea is excluded from scored questions.';
type GuideInput = { id: string; subject: string; focus: string; depth: 'quick' | 'deep'; mode: Guide['mode'] };
type Fact = { topicId: string; evidence: Evidence; definition: NonNullable<ReturnType<typeof definition>> };

function applicationPrompt(body: string): string | null {
  const stripped = body.replace(/[.!?]+$/, '').trim();
  let match = stripped.match(/^(?:a |an |the )?(?:process|practice|method|technique|approach|procedure) (?:of|for) (.{15,})$/i);
  if (match && !/[;]|\b(?:whereas|because|although|but)\b/i.test(match[1])) return `Your task is ${match[1]}.\nWhich approach or process fits this task according to your material?`;
  match = stripped.match(/^(?:a |an |the )?(?:(?:tool|technique|method|process|system) )?(?:used|designed|intended) to (.{15,})$/i);
  if (match && !/[;]|\b(?:whereas|because|although|but)\b/i.test(match[1])) return `You need to ${match[1]}.\nWhich concept does your material identify for that purpose?`;
  return null;
}

function addRelationshipQuestions(guide: Guide) {
  const evidence = guide.topics.flatMap(t => (t.evidence || []).map(e => ({ e, topicId: t.id }))).filter(({ e }) => !e.review && !/[�]|\.{3}|…/.test(e.text));
  const add = (entry: typeof evidence[number], kind: 'cause' | 'comparison', prompt: string, answer: string, alternatives: string[]) => {
    const options = [...new Map([answer, ...alternatives].map(s => [normalized(s), s])).values()];
    if (options.length < 3 || options.some(o => o.length > 700)) return;
    const shuffled = shuffle(options.slice(0, 4), entry.e.id! + kind);
    // Replace a recognition question on the same evidence rather than repeat it in the session.
    guide.questions = guide.questions.filter(q => !q.evidenceIds?.includes(entry.e.id!));
    guide.questions.push({ id: 'q-' + kind + '-' + hash(entry.e.id!), topicId: entry.topicId, kind, evidenceIds: [entry.e.id!], prompt, options: shuffled, correct: shuffled.indexOf(answer), explanation: entry.e.text, citations: evidence.filter(x=>x.e.id===entry.e.id).reduce((cs,x)=>mergeCites(cs,x.e.citations),[] as Citation[]) });
  };
  const causes = evidence.flatMap(entry => {
    const match = entry.e.text.match(/^(.{15,320}?)\s+because\s+(.{15,320})[.!]?$/i);
    if (!match || contextDependent.test(match[1]) || contextDependent.test(match[2]) || /\b(?:whereas|unless|except|only if)\b/i.test(entry.e.text)) return [];
    return [{ ...entry, effect: match[1].trim(), cause: match[2].replace(/[.!]+$/, '').trim() }];
  });
  for (const [index, entry] of causes.entries()) {
    const alternatives = causes.slice(Math.max(0, index - 24), index + 25).filter(other => signature(other.effect) !== signature(entry.effect) && similarity(other.effect, entry.effect) < .45 && signature(other.cause) !== signature(entry.cause)).map(other => other.cause);
    add(entry, 'cause', `According to your material, what explains this result?\n“${entry.effect}”`, entry.cause, shuffle(alternatives, entry.e.id!).slice(0, 3));
  }
  const side = (s: string) => {
    const m = s.trim().replace(/[.!]+$/, '').match(/^(.{2,70}?)\s+((?:is|are|uses?|requires?|focuses? on|tests?|checks?|produces?|measures?|stores?|contains?)\s+.{8,220})$/i);
    if (!m || contextDependent.test(m[1]) || negated(m[2]) || /\b(?:if|when|unless|except)\b/i.test(m[2])) return null;
    return { name: m[1].trim(), role: m[2].trim() };
  };
  for (const entry of evidence) {
    if (!/\bwhereas\b/i.test(entry.e.text)) continue;
    const parts = entry.e.text.split(/,?\s+whereas\s+/i);
    if (parts.length !== 2) continue;
    const a = side(parts[0]), b = side(parts[1]);
    if (!a || !b || conceptKey(a.name) === conceptKey(b.name) || similarity(a.role, b.role) > .6) continue;
    const pair = (left: string, right: string) => `${a.name} ${left}; ${b.name} ${right}.`;
    add(entry, 'comparison', `How do ${a.name} and ${b.name} differ according to your material?`, pair(a.role, b.role), [pair(b.role, a.role), pair(a.role, a.role), pair(b.role, b.role)]);
    const card = guide.cards.find(c => c.back === entry.e.text);
    if (card) card.front = `Compare ${a.name} and ${b.name}. What distinction does your material make?`;
  }
}

export function createGuideBuilder(input: GuideInput) {
  const guide: Guide = { ...input, createdAt: Date.now(), topics: [], cards: [], questions: [], materials: [], warnings: [], merged: 0, builtIn: { version: BUILT_IN_VERSION, passages: 0, sourceChecks: 0, readableUnits: 0 }, sourceCoverage: [] };
  const headings = new Map<string, Topic[]>();
  const addSource = ({ material, parsed }: { material: Material; parsed: Parsed }) => {
    guide.materials.push(material);
    guide.warnings.push(...parsed.warnings.map(w => material.name + ': ' + w));
    guide.builtIn!.readableUnits += parsed.units.length;
    const coverage = { sourceId: material.id, totalUnits: parsed.reading?.totalUnits, readableLabels: parsed.units.map(u => u.label), unreadable: parsed.reading?.unreadable || [], notRepresented: [] as { label: string; reason: string }[] };
    guide.sourceCoverage!.push(coverage);
    for (const [unitIndex, unit] of parsed.units.entries()) {
      if((!unit.ocr||unit.ocr.reviewed)&&(!unit.transcript||unit.transcript.reviewed))for(const seq of sourceSequences(unit.text,citationFor(material,unit.label,unit.text))){const prior=guide.sequences?.find(s=>s.id===seq.id);if(prior)prior.citations=mergeCites(prior.citations,seq.citations);else(guide.sequences??=[]).push(seq);}
      for (const [sectionIndex, section] of sections(unit.text, unit.label).entries()) {
        let points = statements(section.text);
        const longPassage = Array.from(new Intl.Segmenter('en', { granularity: 'sentence' }).segment(section.text), x => x.segment).some(s => s.length > 1800);
        if (longPassage) coverage.notRepresented.push({ label: unit.label, reason: 'Some long passages were not turned into study items. Review the original or break them into shorter notes.' });
        if (!points.length && clean(section.text).length >= 24 && clean(section.text).length <= 1800) points = [clean(section.text)];
        if (!points.length) { if (!longPassage) coverage.notRepresented.push({ label: unit.label, reason: 'This section did not contain enough usable text for a study item.' }); continue; }
        const title = (generic.test(section.title)||!!unit.transcript) ? definition(points[0])?.term || section.title : section.title;
        const titleKey = conceptKey(title), citation = citationFor(material, unit.label, unit.text);
        // Only explicit matching headings or the same definition establish a shared topic.
        let topic = (headings.get(titleKey) || []).find(t => !generic.test(title) || t.points.some(p => points.some(q => signature(p) === signature(q))));
        if (!topic && points.length === 1 && definition(points[0])) {
          const d = definition(points[0])!;
          topic = guide.topics.find(t => t.evidence?.some(e => e.term && conceptKey(e.term) === conceptKey(d.term) && signature(e.text) === signature(points[0])));
        }
        if (topic) { guide.merged++; topic.citations = mergeCites(topic.citations, [citation]); }
        else {
          topic = { id: material.id + '-' + unitIndex + '-' + sectionIndex, title: title.charAt(0).toUpperCase() + title.slice(1), points: [], evidence: [], citations: [citation] };
          guide.topics.push(topic); const same = headings.get(titleKey) || []; same.push(topic); headings.set(titleKey, same);
        }
        for (const p of points) {
          const cite = citationFor(material, unit.label, unit.text, p);if(unit.ocr)cite.ocr={confidence:unit.ocr.confidence,reviewed:unit.ocr.reviewed};if(unit.transcript)cite.transcript=unit.transcript;const evidence = evidenceFor(p, cite);
          const existing = topic.evidence!.find(e => signature(e.text) === signature(p));
          if (existing) existing.citations = mergeCites(existing.citations, evidence.citations);
          else { topic.evidence!.push(evidence); topic.points.push(p); }
        }
      }
    }
  };
  const finish = () => {
    // Exact passages can corroborate one another even when files use different headings.
    const exactSources=new Map<string,Citation[]>();
    for(const topic of guide.topics)for(const e of topic.evidence||[])exactSources.set(signature(e.text),mergeCites(exactSources.get(signature(e.text))||[],e.citations));
    for(const topic of guide.topics)for(const e of topic.evidence||[])e.citations=exactSources.get(signature(e.text))!;
    // A second pass can see disagreements and aliases across all uploaded files.
    for (const topic of guide.topics) for (const e of topic.evidence || []) if(e.citations.length&&e.citations.every(c=>needsOcrReview(c.ocr)))e.review='The image reader was uncertain about this text. Use Review image text to compare it with the original and correct it, then rebuild the guide. It is excluded from scored questions until reviewed.';
    for(const topic of guide.topics)for(const e of topic.evidence||[])if(e.citations.length&&e.citations.every(c=>needsOcrReview(c.ocr)||c.transcript&&!c.transcript.reviewed)&&e.citations.some(c=>c.transcript&&!c.transcript.reviewed))e.review='This passage comes from an unreviewed lecture transcript. Listen at its timestamp and correct any misheard words in Review transcript, then rebuild the guide. It is excluded from scored questions until reviewed.';
    const differences = new Map<string, Evidence[]>();
    for (const topic of guide.topics) for (const e of topic.evidence || []) {
      const k = differenceKey(e.text), matches = differences.get(k) || [];
      for (const prior of matches) if (signature(prior.text) !== signature(e.text) && (negated(prior.text) !== negated(e.text) || (prior.text.match(/[-+]?\d+(?:\.\d+)?/g) || []).join('|') !== (e.text.match(/[-+]?\d+(?:\.\d+)?/g) || []).join('|'))) {
        prior.review = sourceCheck; e.review = sourceCheck;
      }
      matches.push(e); differences.set(k, matches);
    }
    const referenceRows=guide.topics.flatMap(t=>(t.evidence||[]).flatMap(e=>{const citation=e.citations.find(c=>!c.transcript&&!needsOcrReview(c.ocr));return citation?[{text:e.text,citation}]:[];}));
    const compare=referenceMatcher(referenceRows);
    for(const topic of guide.topics)for(const e of topic.evidence||[]){
      const lecture=e.citations.find(c=>c.transcript);if(!lecture)continue;
      const comparisons=compare(e.text,0,lecture.sourceId);
      if(comparisons.length){e.comparisons=comparisons.map(c=>({reasons:c.reasons,reference:c.reference}));e.review='This lecture passage may differ from your class material in '+[...new Set(comparisons.flatMap(c=>c.reasons))].join(', ')+'. Compare the passages and listen at the timestamp. It is excluded from scored questions while the difference remains.';}
    }
    const facts: Fact[] = [];
    for (const topic of guide.topics) for (const e of topic.evidence || []) {
      const d = definition(e.text);
      if (d && e.kind === 'definition') facts.push({ topicId: topic.id, evidence: e, definition: d });
    }
    const aliasMap=explicitAliases(guide.topics.flatMap(t=>(t.evidence||[]).map(e=>e.text)));
    const keyFor=(term:string)=>{const k=topicName(term);return aliasMap.get(k)||k;};
    // A shared named concept groups alternate explanations, without treating them as identical facts.
    const topicOwner=new Map<string,Topic>();
    for(const t of guide.topics){
      const key=keyFor(t.title),owner=topicOwner.get(key);
      if(owner&&!generic.test(t.title)&&/[a-z]{3}/i.test(key)){
        for(const e of t.evidence||[]){const prior=owner.evidence!.find(p=>signature(p.text)===signature(e.text));if(prior)prior.citations=mergeCites(prior.citations,e.citations);else owner.evidence!.push(e);}
        owner.points=owner.evidence!.map(e=>e.text);owner.citations=mergeCites(owner.citations,t.citations);
        for(const f of facts)if(f.topicId===t.id)f.topicId=owner.id;
        t.evidence=[];t.points=[];
      }else topicOwner.set(key,t);
    }
    const grouped = new Map<string, Fact[]>();
    for (const f of facts) { const k = keyFor(f.definition.term), entries = grouped.get(k) || []; entries.push(f); grouped.set(k, entries); }
    const questionPool: Fact[] = [];
    const covered = new Set<Evidence>();
    for (const [key, entries] of grouped) {
      const first = entries[0], citations = entries.reduce((cs, f) => mergeCites(cs, f.evidence.citations), [] as Citation[]);
      const owner = guide.topics.find(t => t.id === first.topicId)!;
      for (const f of entries) if (f.topicId !== first.topicId) {
        const previous = guide.topics.find(t => t.id === f.topicId)!;
        previous.evidence = previous.evidence!.filter(e => e !== f.evidence);
        previous.points = previous.evidence.map(e => e.text);
        const matching = owner.evidence!.find(e => signature(e.text) === signature(f.evidence.text));
        if (matching) matching.citations = mergeCites(matching.citations, f.evidence.citations);
        else { owner.evidence!.push(f.evidence); owner.points.push(f.evidence.text); }
        owner.citations = mergeCites(owner.citations, previous.citations);
        f.topicId = first.topicId;
      }
      const statements = [...new Map(entries.map(f => [signature(f.evidence.text), f.evidence.text])).values()];
      const review = entries.find(f => f.evidence.review)?.evidence.review;
      // Keep all meanings on the card, but do not automatically grade a term whose sources disagree.
      guide.cards.push({ id: 'card-' + hash(key), topicId: first.topicId, front: `Explain ${first.definition.term}.`, back: statements.join('\n\n'), citations, ...(review ? { review } : {}) });
      for (const f of entries) covered.add(f.evidence);
      const eligible = entries.find(f => !f.evidence.review && !negated(f.definition.body) && !contextDependent.test(f.definition.body) && !/[�]|\.{3}|…/.test(f.evidence.text) && f.definition.body.length >= 20 && f.definition.body.length <= 500);
      if (eligible && !review) questionPool.push(eligible);
    }
    const emptyTopics = guide.topics.filter(t => !t.evidence!.length);
    guide.merged += emptyTopics.length;
    guide.topics = guide.topics.filter(t => t.evidence!.length);
    for (const topic of guide.topics) {
      const extra = (topic.evidence || []).filter(e => !covered.has(e));
      for (const e of extra.filter(e => e.kind === 'formula' || e.kind === 'cause')) {
        const at = e.text.indexOf('=');
        const front = e.kind === 'formula' ? `Complete this relationship from “${topic.title}”: ${e.text.slice(0, at).trim()} = ________` : `Explain the reason given for: “${e.text.split(/\bbecause\b/i)[0].trim()}”.`;
        guide.cards.push({ id: 'card-' + hash(signature(e.text)), topicId: topic.id, front, back: e.text, citations: e.citations, ...(e.review ? { review: e.review } : {}) });
      }
      const rest = extra.filter(e => e.kind !== 'formula' && e.kind !== 'cause');
      // Short groups retain context for lists and fragments instead of inventing a definition.
      for (let i = 0; i < rest.length; i += 3) {
        const group = rest.slice(i, i + 3);
        guide.cards.push({ id: 'card-' + hash(topic.id + '-' + i), topicId: topic.id, front: `Recall the key points in “${topic.title}”${rest.length > 3 ? ` (part ${Math.floor(i / 3) + 1})` : ''}.`, back: group.map(e => e.text).join('\n\n'), citations: group.reduce((cs, e) => mergeCites(cs, e.citations), [] as Citation[]), ...(group.some(e => e.review) ? { review: [...new Set(group.map(e=>e.review).filter(Boolean))].join(' ') } : {}) });
      }
      if (!guide.cards.some(c => c.topicId === topic.id)) guide.cards.push({ id: 'card-' + hash(topic.id), topicId: topic.id, front: `Recall the key ideas in “${topic.title}”.`, back: topic.points.join('\n\n'), citations: topic.citations });
    }
    const byTopic = new Map<string, Fact[]>(), byDescription = new Map<string, Set<string>>();
    for (const f of questionPool) { const row = byTopic.get(f.topicId) || []; row.push(f); byTopic.set(f.topicId, row); }
    for (const f of facts) { const k = signature(f.definition.body), answers = byDescription.get(k) || new Set<string>(); answers.add(keyFor(f.definition.term)); byDescription.set(k, answers); }
    const shuffledPool = shuffle(questionPool, input.id);
    for (const [position, f] of questionPool.entries()) {
      const def = f.definition, answerKey = keyFor(def.term);
      // An identical definition attached to different concepts is ambiguous even if one is absent from the answer options.
      if ((byDescription.get(signature(def.body))?.size || 0) > 1) continue;
      const candidates = [...(byTopic.get(f.topicId) || []).slice(0, 24), ...Array.from({ length: Math.min(48, shuffledPool.length) }, (_, i) => shuffledPool[(position + i) % shuffledPool.length])];
      const distractors = shuffle(candidates.filter(d => keyFor(d.definition.term) !== answerKey
        && !normalized(f.evidence.text).includes(normalized(d.definition.term))
        && !normalized(d.evidence.text).includes(normalized(def.term))
        && !conceptKey(d.definition.term).includes(conceptKey(def.term)) && !conceptKey(def.term).includes(conceptKey(d.definition.term))
        && similarity(def.body, d.definition.body) < .55), answerKey)
        .sort((a, b) => Number(b.topicId === f.topicId) - Number(a.topicId === f.topicId));
      const options = [...new Map(distractors.map(d => [keyFor(d.definition.term), d.definition.term])).values()].slice(0, 3);
      if (options.length < 2) continue;
      const shuffled = shuffle([def.term, ...options], answerKey + f.topicId);
      // Use only citations containing the precise tested passage, never all citations for the concept.
      const matched = (grouped.get(answerKey) || []).filter(d => signature(d.evidence.text) === signature(f.evidence.text));
      const citations = matched.reduce((cs, d) => mergeCites(cs, d.evidence.citations), [] as Citation[]);
      const task = applicationPrompt(def.body);
      guide.questions.push({ id: 'q-' + hash(answerKey), topicId: f.topicId, prompt: task || `Which concept matches this description from your material?\n“${def.body}”`, options: shuffled, correct: shuffled.indexOf(def.term), explanation: f.evidence.text, citations, evidenceIds: [f.evidence.id!], kind: task ? 'application' : 'definition' });
    }
    addRelationshipQuestions(guide);
    // Exact duplicated cards (including equations) share a single review item and preserve all source links.
    const uniqueCards = new Map<string, typeof guide.cards[number]>();
    for (const card of guide.cards) { const prior = uniqueCards.get(card.id); if (prior) prior.citations = mergeCites(prior.citations, card.citations); else uniqueCards.set(card.id, card); }
    guide.cards = [...uniqueCards.values()];
    const allEvidence = guide.topics.flatMap(t => t.evidence || []);
    guide.builtIn!.passages = allEvidence.length;
    guide.builtIn!.sourceChecks = allEvidence.filter(e => e.review).length;
    if (guide.builtIn!.sourceChecks) guide.warnings.push('Some source passages need checking. Follow their review notes before using them for scored questions; Built-in cannot independently verify the source.');
    if (!guide.questions.length) guide.warnings.push('No unambiguous scored questions could be made. Use the source-backed recall cards to check your understanding, or add more complete explanations.');
    if (guide.topics.some(t => !guide.questions.some(q => q.topicId === t.id))) guide.warnings.push('Some topics have recall cards only. Formulas, incomplete passages, and unclear comparisons are not automatically graded.');
    if (input.focus.trim()) guide.topics.sort((a, b) => similarity(input.focus, b.title + ' ' + b.points.join(' ')) - similarity(input.focus, a.title + ' ' + a.points.join(' ')));
    if (input.depth === 'quick') for (const topic of guide.topics) topic.points = topic.points.slice(0, 3);
    return guide;
  };
  return { addSource, finish };
}
export function generateGuide(input: GuideInput, sources: { material: Material; parsed: Parsed }[]) { const builder = createGuideBuilder(input); for (const source of sources) builder.addSource(source); return builder.finish(); }

export function diagnostic(guide: Guide) {
  const groups = new Map<string, Question[]>();
  for (const q of guide.questions) { const entries = groups.get(q.topicId) || []; entries.push(q); groups.set(q.topicId, entries); }
  const rows = shuffle([...groups.values()], guide.id), picked: Question[] = [];
  for (let round = 0; round < 2 && picked.length < 12; round++) for (const row of rows) { if (row[round]) picked.push(row[round]); if (picked.length === 12) break; }
  return picked;
}
export function recordPractice(progress: ProgressData, q: Question, answer: number, confident: boolean, now = Date.now()): ProgressData {
  const previous = progress.practice?.[q.id], correct = answer === q.correct;
  // Repeated clicks or immediate retries do not count as a later successful recall.
  const spaced = !previous || now - previous.lastAt >= 5 * 60_000;
  const streak = correct && confident ? Math.min(5, (previous?.streak || 0) + (spaced ? 1 : 0)) : 0;
  const interval = !correct || !confident ? 5 * 60_000 : streak >= 3 ? 7 * 86400_000 : streak >= 2 ? 86400_000 : 10 * 60_000;
  const record: PracticeRecord = { attempts: (previous?.attempts || 0) + 1, streak, lastAt: now, dueAt: now + interval, correct, confident: correct && confident };
  return { ...noteMistake(progress,q,answer,confident,now), answers: { ...progress.answers, [q.id]: answer }, practice: { ...progress.practice, [q.id]: record } };
}
export function practiceQueue(questions: Question[], progress: ProgressData, now = Date.now()) {
  const priority = (q: Question) => { const p = progress.practice?.[q.id]; return p ? !p.correct || !p.confident ? 0 : p.dueAt <= now ? 1 : p.streak < 2 ? 3 : 4 : progress.assessment[q.id] !== undefined && progress.assessment[q.id] !== q.correct ? 0 : 2; };
  return [...questions].sort((a, b) => priority(a) - priority(b) || (progress.practice?.[a.id]?.lastAt || 0) - (progress.practice?.[b.id]?.lastAt || 0)).slice(0, 12);
}
export function focusTopics(guide: Guide, progress: ProgressData, now = Date.now()) {
  const weak = new Set<string>(), strong = new Set<string>(), checked = new Set<string>();
  for (const topic of guide.topics) {
    const questions = guide.questions.filter(q => q.topicId === topic.id);
    for (const q of questions) {
      const p = progress.practice?.[q.id], a = progress.assessment[q.id];
      if (p || a !== undefined) checked.add(topic.id);
      if (p ? !p.correct || !p.confident || p.dueAt <= now : a !== undefined && a !== q.correct) weak.add(topic.id);
    }
    // A diagnostic answer alone never removes an entire topic from the study plan.
    const untested = topic.evidence?.some(e => e.review || !questions.some(q => e.id && q.evidenceIds ? q.evidenceIds.includes(e.id) : q.explanation === e.text));
    if (questions.length && !untested && questions.every(q => { const p = progress.practice?.[q.id]; return p && p.correct && p.confident && p.streak >= 2 && p.dueAt > now; })) strong.add(topic.id);
  }
  const order = [...guide.topics].sort((a, b) => (weak.has(a.id) ? 0 : strong.has(a.id) ? 2 : 1) - (weak.has(b.id) ? 0 : strong.has(b.id) ? 2 : 1));
  return { weak, strong, checked, order };
}

export function demoGuide(){const id='example';const material:Material={id:'example-notes',name:'Cell biology · example notes',kind:'txt',units:5,size:1800,warnings:[]};return generateGuide({id,subject:'Cell biology',focus:'',depth:'deep',mode:'example'},[{material,parsed:{warnings:[],units:[{label:'Topic 1',text:'Cell structure\nThe cell membrane is a selectively permeable barrier that controls movement of substances into and out of the cell.\nThe cytoplasm consists of the cytosol and the structures suspended in it.\nRibosomes are the cellular structures that build proteins from amino acids.'},{label:'Topic 2',text:'Energy in cells\nMitochondria are organelles that produce much of the ATP used by eukaryotic cells during aerobic respiration.\nATP is a molecule that transfers usable energy to many cellular processes.\nCellular respiration involves breaking down fuel molecules to release energy that can be captured in ATP.'},{label:'Topic 3',text:'Genetic information\nThe nucleus is a membrane-bound organelle that contains most of the DNA in a eukaryotic cell.\nDNA is a molecule that stores hereditary information in its sequence of nucleotide bases.\nTranscription is the process of making an RNA copy from a DNA template.'},{label:'Topic 4',text:'Plant cells\nChloroplasts are organelles that carry out photosynthesis in plants and algae.\nPhotosynthesis involves converting light energy into chemical energy stored in sugars.\nThe cell wall is a rigid layer outside the cell membrane that provides structural support.'},{label:'Topic 5',text:'Transport across membranes\nDiffusion is the net movement of particles from a region of higher concentration to a region of lower concentration.\nOsmosis is the net movement of water through a selectively permeable membrane.\nActive transport is the process of moving substances against their concentration gradient using energy.'}]}}]);}
