'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCheck, ChevronLeft, ChevronRight, Clapperboard, LoaderCircle, Play, Search, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TranscriptComparison } from './transcript-comparison';
import { timeLabel } from '@/lib/lecture';
import { lectureChapters, transcriptSearch, transcriptSnippet, priorityTranscriptSections, reviewReasons, readingGapTime } from '@/lib/transcript-review';
import { retranscribeSection } from '@/lib/retranscribe-section';
import type { Material, Parsed } from '@/lib/study-types';
type Detail = { parsed: Parsed; revision: string };
export function LectureReview({ material, start, referenceIds, onClose, onSaved }: { material: Material; start?: number; referenceIds: string[]; onClose: () => void; onSaved: (m: Material) => void }) {
  const [detail, setDetail] = useState<Detail>(), [index, setIndex] = useState(0), [draft, setDraft] = useState(''), [error, setError] = useState(''), [notice, setNotice] = useState(''), [saving, setSaving] = useState(false), [allReviewed, setAllReviewed] = useState(false);
  const [query, setQuery] = useState(''), [mode, setMode] = useState('sections'), [limit, setLimit] = useState(40), [playTime, setPlayTime] = useState(0), [recognizing, setRecognizing] = useState(false), [readerStatus, setReaderStatus] = useState(''), [proposal, setProposal] = useState<string>();
  const video = useRef<HTMLVideoElement>(null), rereadController = useRef<AbortController | null>(null), replayEnd = useRef<number | null>(null);
  const units = detail?.parsed.units || [], unit = units[index], dirty = !!unit && (draft !== unit.text || allReviewed), locked = dirty || saving || recognizing;
  const remaining = units.filter(u => u.transcript && !u.transcript.reviewed).length;
  const chapters = useMemo(() => lectureChapters(units), [detail]);
  const checks = useMemo(() => priorityTranscriptSections(units), [detail]);
  const matches = useMemo(() => transcriptSearch(units, query), [detail, query]);
  const visible = mode === 'checks' ? checks.filter(c => matches.includes(c.index)).map(c => c.index) : matches;
  const gaps = detail?.parsed.reading?.unreadable.filter(g => readingGapTime(g.label) !== undefined) || [];
  const reasons = unit ? reviewReasons(unit) : [];
  useEffect(() => { setLimit(40); }, [query, mode]);
  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/materials/' + material.id + '/text', { signal: controller.signal }).then(async response => {
      const d = await response.json() as Detail & { error?: string }; if (!response.ok) throw new Error(d.error || 'The transcript could not be loaded.');
      const selected = start !== undefined ? d.parsed.units.findIndex(u => u.transcript && u.transcript.start <= start && u.transcript.end > start) : d.parsed.units.findIndex(u => u.transcript && !u.transcript.reviewed);
      setDetail(d); setIndex(Math.max(0, selected)); setDraft(d.parsed.units[Math.max(0, selected)]?.text || '');
    }).catch(e => { if (!controller.signal.aborted) setError(e.message || 'The transcript could not be loaded.'); });
    return () => { controller.abort(); rereadController.current?.abort(); };
  }, [material.id, start]);
  const seek = (second = unit?.transcript?.start || 0, end?: number) => {
    if (!video.current) return; replayEnd.current = end ?? null; video.current.currentTime = second; setPlayTime(second);
  };
  const listen = (second: number, end?: number) => { seek(second, end); void video.current?.play().catch(() => {}); };
  useEffect(() => { if (video.current && video.current.readyState > 0 && unit?.transcript) seek(unit.transcript.start); }, [index, unit?.transcript?.start]);
  useEffect(() => {
    if (!dirty) return; const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const close = () => { if (saving || recognizing) return; if (dirty) { setError('Save your corrections or discard the edits before closing.'); return; } onClose(); };
  const select = (i: number) => { if (locked) return; setIndex(i); setDraft(units[i].text); setProposal(undefined); setError(''); setNotice(''); };
  async function reread() {
    if (!unit?.transcript || locked) return;
    const controller = new AbortController(); rereadController.current = controller; setRecognizing(true); setError(''); setProposal(undefined);
    try {
      const text = await retranscribeSection(material.id, unit.transcript.start, unit.transcript.end, setReaderStatus, controller.signal, material.size);
      if (text === unit.text) setNotice('The accuracy reader returned the same wording. Listen to check any uncertain terms.'); else setProposal(text);
    } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'This section could not be re-read.'); }
    finally { setRecognizing(false); rereadController.current = null; }
  }
  async function save() {
    if (!detail || !unit || recognizing) return; setSaving(true); setError('');
    try {
      const response = await fetch('/api/materials/' + material.id + '/text', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ index, text: draft, revision: detail.revision, allReviewed }) }), data = await response.json() as Detail & { material: Material; error?: string };
      if (!response.ok) throw new Error(data.error || 'The transcript has not saved. Try again.');
      setDetail(data); setDraft(data.parsed.units[index].text); setAllReviewed(false); setProposal(undefined); onSaved(data.material); setNotice('Transcript saved. Create or rebuild a guide to use these changes.');
    } catch (e) { setError(e instanceof Error ? e.message : 'The transcript has not saved.'); } finally { setSaving(false); }
  }
  return <Dialog open onOpenChange={open => { if (!open) close(); }}><DialogContent className="ocr-dialog lecture-review-dialog"><DialogHeader><DialogTitle><Clapperboard size={21} />Review lecture transcript</DialogTitle><DialogDescription>{material.name} · {timeLabel(material.lecture?.duration || 0)}. Search, jump to a topic, and check the words against the recording.</DialogDescription></DialogHeader>
    {error && <div className="alert" role="alert"><AlertTriangle size={17} />{error}</div>}
    {!detail ? <p className="draft-status"><LoaderCircle size={17} className="spinner" />Loading transcript…</p> : unit?.transcript && <>
      <div className="transcript-navigator">
        <div className="transcript-search"><Search size={17} /><Input aria-label="Search transcript" placeholder="Search words or a timestamp, like 12:30" value={query} onChange={e => setQuery(e.target.value)} />{query && <Button size="sm" variant="ghost" onClick={() => setQuery('')}>Clear</Button>}</div>
        <Tabs value={mode} onValueChange={setMode}><TabsList aria-label="Transcript navigation"><TabsTrigger value="sections">Sections</TabsTrigger><TabsTrigger value="chapters">Chapters</TabsTrigger><TabsTrigger value="checks">Suggested checks · {checks.length}</TabsTrigger></TabsList></Tabs>
        <p className="transcript-nav-note">{mode === 'checks' ? 'These are review cues, not confidence scores or confirmed mistakes. Other sections may still need checking.' : mode === 'chapters' && !query ? 'Suggested chapters use slide headings and repeated words from the transcript.' : `${visible.length} ${visible.length === 1 ? 'section' : 'sections'}${query ? ' matching your search' : ''}. Select one to jump to its timestamp.`}</p>
        <div className="transcript-results" aria-label="Transcript navigation results">
          {mode === 'chapters' && !query ? chapters.map((c, i) => <button type="button" key={i} disabled={locked} className={'transcript-result' + (playTime >= c.start && playTime < c.end ? ' playing' : '')} onClick={() => select(c.indices[0])}><strong>{timeLabel(c.start)} · {c.title}</strong><span>{c.indices.length} sections · through {timeLabel(c.end)}</span></button>) : visible.slice(0, limit).map(i => {
            const u = units[i], t = u.transcript!;
            return <button type="button" key={i} disabled={locked} aria-current={index === i ? 'true' : undefined} className={'transcript-result' + (playTime >= t.start && playTime < t.end ? ' playing' : '')} onClick={() => select(i)}><strong>{u.label}{t.reviewed ? ' · checked' : ''}</strong><span>{transcriptSnippet(u.text, query)}</span>{mode === 'checks' && <small>{reviewReasons(u).map(r => r.label).join(' · ')}</small>}</button>;
          })}
          {!(mode === 'chapters' && !query) && visible.length === 0 && <p className="muted">{query ? 'No matching sections. Try another word.' : 'No specific review cues remain. You can still review every section.'}</p>}
          {mode === 'checks' && !query && gaps.map((gap, i) => <button type="button" key={'gap-' + i} className="transcript-result transcript-gap" onClick={() => listen(readingGapTime(gap.label)!, readingGapTime(gap.label)! + 60)}><strong>Replay {gap.label} · possible missing speech</strong><span>{gap.reason}</span></button>)}
        </div>
        {!(mode === 'chapters' && !query) && visible.length > limit && <Button size="sm" variant="link" onClick={() => setLimit(n => n + 40)}>Show more matching sections</Button>}
      </div>
      <div className="ocr-toolbar"><Select value={String(index)} onValueChange={v => select(Number(v))} disabled={locked}><SelectTrigger aria-label="Lecture section to review"><SelectValue /></SelectTrigger><SelectContent>{units.map((u, i) => <SelectItem key={i} value={String(i)}>{u.label}{u.transcript?.reviewed ? ' · reviewed' : ''}</SelectItem>)}</SelectContent></Select><span className={'ocr-label' + (unit.transcript.reviewed ? '' : ' uncertain')}>{unit.transcript.reviewed ? <><CheckCheck size={15} />Checked by you</> : <><AlertTriangle size={15} />{remaining} sections need review</>}</span><div className="compact-buttons"><Button size="icon-sm" variant="outline" aria-label="Previous transcript section" disabled={locked || index === 0} onClick={() => select(index - 1)}><ChevronLeft size={16} /></Button><Button size="icon-sm" variant="outline" aria-label="Next transcript section" disabled={locked || index === units.length - 1} onClick={() => select(index + 1)}><ChevronRight size={16} /></Button></div></div>
      <div className="ocr-review-grid"><div><video ref={video} controls preload="metadata" playsInline src={'/api/materials/' + material.id + '?play=1'} aria-label={'Lecture video: ' + material.name} onLoadedMetadata={() => seek()} onTimeUpdate={() => { const player = video.current; if (!player) return; setPlayTime(player.currentTime); if (replayEnd.current !== null && player.currentTime >= replayEnd.current) { player.pause(); replayEnd.current = null; } }} /><Button variant="outline" size="sm" className="lecture-jump" onClick={() => listen(unit.transcript!.start, unit.transcript!.kind === 'screen' ? undefined : unit.transcript!.end)}><Play size={14} />{unit.transcript.kind === 'screen' ? 'View slide at' : 'Replay section from'} {timeLabel(unit.transcript.start)}</Button><p className="ocr-note">{unit.transcript.source === 'whisper-small.en' ? 'Accuracy transcription.' : unit.transcript.source === 'whisper-base.en' ? 'Balanced transcription.' : unit.transcript.source === 'captions' ? 'Imported captions.' : ''} Add the original slides for diagrams and complete visual coverage.</p></div><div><label htmlFor="lecture-transcript-text">{unit.transcript.kind === 'screen' ? 'On-screen text used in your guide' : 'Transcript used in your guide'}</label>{!unit.transcript.reviewed && reasons.length > 0 && <div className="transcript-cues">{reasons.map(r => <span key={r.label}>{r.label}</span>)}</div>}<Textarea id="lecture-transcript-text" maxLength={250000} value={draft} disabled={saving || recognizing} onChange={e => { setDraft(e.target.value); setNotice(''); }} /><p className="ocr-note">Keep only words that were spoken or shown. Empty sections are omitted. Unreviewed passages are excluded from scored questions unless corroborated by a trusted source.</p>
        {unit.transcript.kind !== 'screen' && unit.transcript.end - unit.transcript.start <= 120 && <div className="transcript-reread">{recognizing ? <><p role="status"><LoaderCircle size={14} className="spinner" />{readerStatus}</p><Button size="sm" variant="outline" onClick={() => rereadController.current?.abort()}>Stop re-transcribing</Button></> : <><Button size="sm" variant="outline" disabled={locked} onClick={() => void reread()}><Sparkles size={14} />Re-transcribe with Accuracy</Button><p className="ocr-note">Uses the larger speech model on your device. First use downloads about 500–600 MB. Compare its wording before accepting it.</p></>}</div>}
      </div></div>
      {proposal && <div className="transcript-proposal"><strong>Alternative transcription · not saved</strong><p>{proposal}</p><div className="compact-buttons"><Button variant="outline" size="sm" onClick={() => { setDraft(proposal); setProposal(undefined); setNotice('Alternative placed in the editor. Listen, correct it, then save.'); }}>Use this wording in editor</Button><Button variant="ghost" size="sm" onClick={() => setProposal(undefined)}>Keep original</Button></div></div>}
      <TranscriptComparison id={material.id} index={index} sourceIds={referenceIds} revision={detail.revision} disabled={locked} />
      <label className="lecture-review-all"><Checkbox checked={allReviewed} disabled={saving || recognizing} onCheckedChange={v => setAllReviewed(v === true)} /><span>I have checked the entire transcript against the lecture. Mark all sections reviewed.</span></label>{notice && <p className="ocr-saved" role="status"><CheckCheck size={16} />{notice}</p>}
      <DialogFooter className="ocr-footer">{dirty && <Button variant="ghost" disabled={saving || recognizing} onClick={() => { setDraft(unit.text); setAllReviewed(false); setError(''); }}>Discard edits</Button>}<Button variant="outline" disabled={saving || recognizing} onClick={close}>Done</Button><Button disabled={saving || recognizing} onClick={() => void save()}>{saving ? <LoaderCircle size={16} className="spinner" /> : <CheckCheck size={16} />}Save &amp; {allReviewed ? 'mark all reviewed' : 'mark reviewed'}</Button></DialogFooter>
    </>}
  </DialogContent></Dialog>;
}
