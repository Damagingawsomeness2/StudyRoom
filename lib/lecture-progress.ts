export const LECTURE_STAGES = ['prepare', 'speech', 'screen', 'upload', 'save'] as const;
export type LectureStage = typeof LECTURE_STAGES[number];
export type StageProgress = { status: 'waiting' | 'active' | 'done' | 'skipped'; percent?: number; etaSeconds?: number };
export type LectureProgress = { stages: Record<LectureStage, StageProgress>; detail: string; engine?: string };
export type ProgressEvent = { stage: LectureStage; completed?: number; total?: number; status?: StageProgress['status']; detail?: string; engine?: string };
export type LectureReporter = (event: ProgressEvent) => void;
export function lectureReporter(update: (progress: LectureProgress) => void, now = () => performance.now()): LectureReporter {
  const state: LectureProgress = { stages: Object.fromEntries(LECTURE_STAGES.map(s => [s, { status: 'waiting' }])) as LectureProgress['stages'], detail: '' };
  const starts = new Map<LectureStage, { time: number; completed: number }>();
  return event => {
    const current = state.stages[event.stage];
    const next: StageProgress = { ...current, status: event.status || 'active' };
    if (event.total && event.completed !== undefined) {
      const done = Math.max(0, Math.min(event.total, event.completed));
      next.percent = Math.round(100 * done / event.total);
      const baseline = starts.get(event.stage);
      if (!baseline || done < baseline.completed) starts.set(event.stage, { time: now(), completed: done });
      else if (now() - baseline.time > 1500 && done > baseline.completed) next.etaSeconds = Math.ceil((now() - baseline.time) / 1000 / (done - baseline.completed) * (event.total - done));
    }
    if (next.status === 'done' || next.status === 'skipped') { next.percent = 100; delete next.etaSeconds; }
    state.stages[event.stage] = next;
    if (event.detail) state.detail = event.detail;
    if (event.engine) state.engine = event.engine;
    update({ ...state, stages: { ...state.stages } });
  };
}
