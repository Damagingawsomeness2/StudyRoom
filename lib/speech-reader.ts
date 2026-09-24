import type { LectureOptions, TranscriptSource } from './lecture-options';
import type { LectureReporter } from './lecture-progress';
export type SpeechResult = { text?: string; chunks?: { text: string; timestamp: [number, number | null] }[]; engine: string; source: TranscriptSource };
export function speechReader(quality: LectureOptions['quality'], progress: (text: string) => void, signal: AbortSignal, report?: LectureReporter) {
  const worker = new Worker('/transcription/worker.js?v=2', { type: 'module' });
  let preparing = true;
  const ask = <T>(message: unknown, expected: string, transfer: Transferable[] = [], timeout = 1200000) => new Promise<T>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout>;
    const cleanup = () => { clearTimeout(timer); worker.removeEventListener('message', receive); worker.removeEventListener('error', error); signal.removeEventListener('abort', abort); };
    const fail = (e: Error) => { cleanup(); reject(e); };
    const abort = () => fail(new Error('Video processing cancelled.'));
    const error = () => fail(new Error('The speech reader could not load. Retry, use Balanced for a smaller download, or attach SRT/VTT captions.'));
    const receive = (event: MessageEvent) => {
      const d = event.data;
      if (d.type === 'progress') { progress(d.message); report?.({ stage: preparing ? 'prepare' : 'speech', ...(preparing && Number.isFinite(d.percent) ? { completed: d.percent, total: 100 } : {}), detail: d.message, engine: d.engine }); }
      else if (d.type === 'error') { console.error('Speech reader:', d.message); error(); }
      else if (d.type === expected) { cleanup(); resolve(d.result); }
    };
    worker.addEventListener('message', receive); worker.addEventListener('error', error); signal.addEventListener('abort', abort, { once: true });
    timer = setTimeout(() => fail(new Error('This speech reader took too long. Retry, choose Balanced, or attach captions. Your completed sections are saved.')), timeout);
    if (signal.aborted) abort(); else worker.postMessage(message, transfer);
  });
  return {
    async init() { report?.({ stage: 'prepare' }); const result = await ask<{ engine: string; source: TranscriptSource }>({ type: 'init', quality }, 'ready'); preparing = false; report?.({ stage: 'prepare', status: 'done', engine: result.engine }); return result; },
    read: (audio: Float32Array<ArrayBuffer>) => ask<SpeechResult>({ type: 'transcribe', audio }, 'result', [audio.buffer]),
    close: () => worker.terminate(),
  };
}
