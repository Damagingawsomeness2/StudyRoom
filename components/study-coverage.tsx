'use client';
import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, FileText, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Progress } from '@/components/ui/progress';
import { studyCoverage, type CoverageState } from '@/lib/study-coverage';
import { BUILT_IN_VERSION } from '@/lib/study-engine';
import type { Citation, Guide, ProgressData } from '@/lib/study-types';
import { timeLabel } from '@/lib/lecture';
import { Sources } from './practice';

const stateLabels: Record<CoverageState, string> = { unchecked: 'Not checked yet', review: 'Needs practice', building: 'Checked · revisit later', ready: 'Ready for later review', recall: 'Recall practice only', 'source-check': 'Check the source' };
export function StudyCoverage({ guide, progress, onCite, onReview, onRebuild, rebuilding }: { guide: Guide; progress: ProgressData; onCite: (c: Citation) => void; onReview: (id: string) => void; onRebuild: () => void; rebuilding: boolean }) {
  const coverage = useMemo(() => studyCoverage(guide, progress), [guide, progress]);
  const [filter, setFilter] = useState<'all' | 'unchecked' | 'review'>('all');
  if (!guide.builtIn || guide.builtIn.version < BUILT_IN_VERSION) return <div className="empty-state"><FileText size={30}/><h2>Add detailed study coverage.</h2><p>Rebuild this guide with the latest Built-in generator to link each question to the passages it tests. Your original guide stays saved.</p><Button disabled={rebuilding} onClick={onRebuild}><RefreshCw size={16}/>{rebuilding ? 'Rebuilding…' : 'Rebuild with Built-in'}</Button></div>;
  const topics = coverage.topics.filter(t => filter === 'all' || t.passages.some(p => filter === 'unchecked' ? ['unchecked', 'recall'].includes(p.state) : ['review', 'source-check'].includes(p.state)));
  return <div className="coverage-panel">
    <div className="coverage-heading"><div><h2>What has your session covered?</h2><p>This tracks extracted passages, not exam readiness. A checked passage can still need practice.</p></div><span className="coverage-fraction">{coverage.checked} / {coverage.total}<small>passages checked</small></span></div>
    <Progress value={coverage.total ? 100 * coverage.checked / coverage.total : 0} aria-label="Extracted passages checked"/>
    <div className="coverage-metrics">
      <div><strong>{coverage.unchecked}</strong><span>Not checked yet</span></div>
      <div><strong>{coverage.review}</strong><span>Need more practice</span></div>
      <div><strong>{coverage.recall}</strong><span>Recall practice only</span></div>
      <div><strong>{coverage.sourceChecks}</strong><span>Need a source check</span></div>
    </div>
    <p className="coverage-note">Recall cards are self-checked and don’t count as a scored knowledge check. Unreadable pages, diagrams, and text left out of the guide are not included in the passage count.</p>
    <div className="coverage-section-heading"><h3>By topic</h3><div className="depth-options" role="group" aria-label="Coverage filter">{([{value:'all',label:'All topics'},{value:'unchecked',label:'Not fully checked'},{value:'review',label:'Needs attention'}] as const).map(f=><button key={f.value} aria-pressed={filter===f.value} onClick={()=>setFilter(f.value)}>{f.label}</button>)}</div></div>
    {!topics.length ? <p className="coverage-note">No topics match this view. Choose All topics to see the complete guide.</p> : <Accordion type="multiple" className="coverage-topics">{topics.map(({ topic, passages, checked })=><AccordionItem key={topic.id} value={topic.id} className="section-card"><AccordionTrigger className="section-title"><span>{topic.title}<small className="coverage-topic-count">{checked} of {passages.length} passages checked</small></span></AccordionTrigger><AccordionContent><ul className="coverage-passages">{passages.map((p,i)=><li key={p.evidence.id || i}><span className={'coverage-state '+p.state}>{stateLabels[p.state]}</span><p>{p.evidence.text}</p>{p.state==='recall'&&<p className="coverage-reason">No scored question is linked to this passage. Use its recall card and compare your answer with the source.</p>}{p.evidence.review&&<p className="coverage-reason">{p.evidence.review}</p>}<Sources citations={p.evidence.citations} onClick={onCite}/></li>)}</ul><Button variant="outline" size="sm" onClick={()=>onReview(topic.id)}>Open this topic<ArrowRight size={14}/></Button></AccordionContent></AccordionItem>)}</Accordion>}
    <div className="coverage-section-heading"><h3>By file</h3></div>
    <p className="coverage-note">Reading text from a page does not mean every image, formula, or idea on that page has been tested.</p>
    <div className="coverage-files">{coverage.sources.map(({material,reading,representedUnits,quizUnits,checked,passages})=>{
      const noun=material.kind==='pdf'?'pages':material.kind==='pptx'?'slides':'sections';
      const issues=[...(reading?.unreadable||[]),...(reading?.notRepresented||[])];
      return <article className="coverage-file" key={material.id}><div className="coverage-file-heading"><FileText size={19}/><h4>{material.name}</h4></div><div className="coverage-file-stats"><span><strong>{reading?.readableLabels.length ?? material.units}{reading?.totalUnits!==undefined ? ' / '+reading.totalUnits : ''}</strong> readable {noun}</span><span><strong>{representedUnits}</strong> {noun} used in guide</span><span><strong>{quizUnits}</strong> {noun} used in questions</span><span><strong>{checked} / {passages}</strong> passages checked</span></div>{reading?.totalUnits===undefined&&<p className="coverage-note">The original {noun} count wasn’t recorded for this upload. The readable count alone cannot show whether anything was missed.</p>}{!!material.lecture?.units&&<p className="coverage-note">{timeLabel(material.lecture.duration)} lecture · {material.lecture.needsReview} transcript sections need checking. Review the transcript in Sources. On-screen sections are included when screen reading was enabled. Screen reading samples frames and may miss brief slides or visual explanations.</p>}{!!material.ocr?.units?<p className="coverage-note">Image text was read in {material.ocr.units} {material.ocr.units===1?'section':'sections'}{material.ocr.needsReview?' · '+material.ocr.needsReview+' need checking':''}. Review image text in Sources. Diagrams, handwriting, and equations still need your own review.</p>:['pdf','pptx','docx'].includes(material.kind)&&<p className="coverage-note">No image text was recorded for this upload. Re-upload older scans to use the image reader. Diagrams still need your own review.</p>}{issues.length>0&&<details className="coverage-issues"><summary><AlertTriangle size={15}/>{issues.length} reading {issues.length===1?'issue':'issues'}</summary><ul>{issues.map((issue,i)=><li key={i}><strong>{issue.label}:</strong> {issue.reason}</li>)}</ul></details>}{material.warnings.length>0&&<ul className="coverage-file-notes">{material.warnings.map((warning,i)=><li key={i}>{warning}</li>)}</ul>}</article>;
    })}</div>
  </div>;
}
