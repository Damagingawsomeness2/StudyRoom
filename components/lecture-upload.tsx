'use client';
import { useEffect, useRef, useState } from 'react';
import { Clapperboard, Upload, FileText, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { VIDEO_ACCEPT, MAX_VIDEO_BYTES } from '@/lib/lecture';
import { DEFAULT_LECTURE_OPTIONS, type LectureOptions } from '@/lib/lecture-options';
export function LectureUpload({ onClose, onAdd, initialScreen = false, initialOptions }: { onClose: () => void; onAdd: (file: File, captions?: File, screen?: boolean, options?: LectureOptions) => void; initialScreen?: boolean; initialOptions?: LectureOptions }) {
  const [screen, setScreen] = useState(initialScreen), [options, setOptions] = useState<LectureOptions>(initialOptions || DEFAULT_LECTURE_OPTIONS);
  const [file, setFile] = useState<File>(), [captions, setCaptions] = useState<File>(), [error, setError] = useState(''), [preview, setPreview] = useState('');
  const videoInput = useRef<HTMLInputElement>(null), captionInput = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!file) return; const url = URL.createObjectURL(file); setPreview(url); return () => URL.revokeObjectURL(url); }, [file]);
  function add() {
    if (!file) { setError('Choose a lecture video first.'); return; }
    if (file.size > MAX_VIDEO_BYTES) { setError('Choose a video up to 1 GB. Split longer recordings into parts.'); return; }
    if (captions && captions.size > 2_000_000) { setError('Choose a caption file under 2 MB.'); return; }
    onAdd(file, captions, screen, options); onClose();
  }
  const regionLeft = options.region === 'right' ? 22 : options.region === 'center' ? 10 : 0;
  const regionWidth = options.region === 'full' ? 100 : options.region === 'center' ? 80 : 78;
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}><DialogContent className="lecture-upload-dialog">
    <DialogHeader><DialogTitle><Clapperboard size={21} />Add a lecture video</DialogTitle><DialogDescription>Turn your teacher’s spoken explanations and slide text into study material.</DialogDescription></DialogHeader>
    <div className="lecture-upload-choice"><strong>1. Choose your recording</strong><Button variant="outline" onClick={() => videoInput.current?.click()}><Upload size={16} />{file ? file.name : 'Choose lecture video'}</Button><input ref={videoInput} aria-label="Lecture video" type="file" accept={VIDEO_ACCEPT} className="sr-only" onChange={e => { setFile(e.target.files?.[0]); setError(''); }} /><p>MP4, MOV, M4V, or WebM · up to 1 GB and 3 hours</p></div>
    <div className="lecture-upload-choice"><strong>2. Add captions if you have them <span>(optional)</span></strong><Button variant="outline" onClick={() => captionInput.current?.click()}><FileText size={16} />{captions ? captions.name : 'Choose SRT or VTT captions'}</Button><input ref={captionInput} aria-label="Lecture captions" type="file" accept=".srt,.vtt" className="sr-only" onChange={e => setCaptions(e.target.files?.[0])} />{captions && <Button variant="link" onClick={() => { setCaptions(undefined); if (captionInput.current) captionInput.current.value = ''; }}>Use automatic transcription instead</Button>}<p>Checked captions from your teacher can preserve technical terms better than automatic speech recognition.</p></div>
    {!captions && <div className="lecture-upload-choice"><label className="field-label" htmlFor="speech-quality">3. Transcription quality</label><Select value={options.quality} onValueChange={v => setOptions(o => ({ ...o, quality: v as LectureOptions['quality'] }))}><SelectTrigger id="speech-quality"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="accurate">Accuracy · larger speech model</SelectItem><SelectItem value="balanced">Balanced · smaller download</SelectItem></SelectContent></Select><p>{options.quality === 'accurate' ? 'Recommended for lectures. About 500–600 MB on first use; needs more memory and processing time.' : 'About 140 MB on first use. Better for limited memory or a quicker start.'} Uses your GPU when available, with a CPU fallback. No API credits.</p></div>}
    <label className="lecture-screen-option"><Checkbox checked={screen} onCheckedChange={v => setScreen(v === true)} /><span><strong>Read text shown in the video</strong><small>Checks every 2 seconds and filters small cursor or corner motion. Up to 480 screen readings.</small></span></label>
    {screen && <div className="lecture-upload-choice"><label className="field-label" htmlFor="lecture-slide-area">Slide area</label><Select value={options.region} onValueChange={v => setOptions(o => ({ ...o, region: v as LectureOptions['region'] }))}><SelectTrigger id="lecture-slide-area"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="full">Full picture</SelectItem><SelectItem value="left">Left side · exclude right camera panel</SelectItem><SelectItem value="right">Right side · exclude left camera panel</SelectItem><SelectItem value="center">Center · exclude side panels</SelectItem></SelectContent></Select>{preview && <div className="lecture-crop-preview"><video src={preview} controls preload="metadata" aria-label="Preview lecture slide area" /><div className="lecture-crop-outline" style={{ left: regionLeft + '%', width: regionWidth + '%' }} /></div>}<p>The outlined area is read for slide text. Include the whole slide; text outside it is skipped. Original slides work best for diagrams, handwriting, and brief transitions.</p></div>}
    <div className="lecture-info"><strong>{captions ? 'Your captions keep their timestamps.' : 'Automatic English transcription on your device'}</strong><p>Keep this tab open until processing and upload finish. Separate progress bars show each stage and its estimated time. Review the transcript before using it for scored questions.</p><p>To resume after closing the tab, choose the same video, captions, quality, and slide area. Upload parts expire after 24 hours; extracted text remains saved.</p></div>
    {error && <div className="alert" role="alert"><AlertCircle size={17} />{error}</div>}
    <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={add} disabled={!file}>{captions ? 'Add lecture with captions' : 'Transcribe & add lecture'}</Button></DialogFooter>
  </DialogContent></Dialog>;
}
