'use client';
import { Check } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { LECTURE_STAGES, type LectureProgress } from '@/lib/lecture-progress';
const labels = { prepare: 'Speech reader', speech: 'Transcription', screen: 'Slide text', upload: 'Video upload', save: 'Save lecture' };
function estimate(seconds: number) { return seconds < 60 ? 'less than a minute' : seconds < 3600 ? `about ${Math.ceil(seconds / 60)} min` : `about ${Math.ceil(seconds / 3600)} hr`; }
export function LectureProgressPanel({ progress, paused }: { progress: LectureProgress; paused: boolean }) {
  const active = LECTURE_STAGES.find(s => progress.stages[s].status === 'active');
  const remaining = active ? progress.stages[active].etaSeconds : undefined;
  return <div className={'lecture-progress-panel' + (paused ? ' is-paused' : '')} aria-label="Lecture processing progress">
    <div className="lecture-progress-stages">{LECTURE_STAGES.map(stage => {
      const p = progress.stages[stage];
      return <div key={stage} className={'lecture-stage stage-' + p.status}>
        <div className="lecture-stage-label"><span>{labels[stage]}</span><span>{p.status === 'skipped' ? 'Not needed' : p.status === 'done' ? <Check size={14} aria-label="Complete" /> : p.status === 'waiting' ? 'Waiting' : p.percent === undefined ? 'Preparing…' : `${p.percent}%`}</span></div>
        <Progress value={p.percent ?? 0} aria-label={labels[stage]} aria-valuetext={p.status === 'skipped' ? 'Not needed' : p.status === 'waiting' ? 'Waiting' : p.percent === undefined ? 'Preparing' : `${p.percent} percent`} />
      </div>;
    })}</div>
    <div className="lecture-progress-note">{paused ? 'Stopped at your last saved checkpoint.' : remaining !== undefined && remaining > 0 ? `${estimate(remaining)} remaining in this stage · estimate adjusts as it runs` : active ? 'Estimating time from completed work…' : 'Lecture saved.'}{progress.engine && <span>{progress.engine}</span>}</div>
  </div>;
}
