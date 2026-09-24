import { imageTextReader } from './ocr';
import { timeLabel } from './lecture';
import type { LectureJob } from './lecture-checkpoint';
import type { LectureReporter } from './lecture-progress';
import { slideCrop, frameSignature, slideChange, SCREEN_SAMPLE_SECONDS } from './slide-detection';
export const SCREEN_INTERVAL = SCREEN_SAMPLE_SECONDS;
export async function readVideoScreen(file: File, duration: number, job: LectureJob, progress: (s: string) => void, signal: AbortSignal, report?: LectureReporter) {
  const video = document.createElement('video'), url = URL.createObjectURL(file), canvas = document.createElement('canvas'), tiny = document.createElement('canvas');
  video.muted = true; video.preload = 'auto'; video.playsInline = true; tiny.width = 96; tiny.height = 54;
  const reader = imageTextReader(progress); let prior: Uint8Array | undefined;
  const abortable = <T>(promise: Promise<T>) => new Promise<T>((resolve, reject) => {
    const abort = () => reject(new Error('Video processing paused.')); signal.addEventListener('abort', abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort)); if (signal.aborted) abort();
  });
  const units = [...job.data.screenUnits], unreadable = [...job.data.unreadable]; let attempts = job.data.screenAttempts, lastSaved = job.data.screenNext, lastRead = -60;
  const wait = (event: string, act: () => void) => new Promise<void>((resolve, reject) => {
    const cleanup = () => { clearTimeout(timer); video.removeEventListener(event, done); video.removeEventListener('error', error); signal.removeEventListener('abort', abort); };
    const done = () => { cleanup(); resolve(); }, error = () => { cleanup(); reject(new Error('This browser could not read video frames. Retry, or upload the slides separately.')); }, abort = () => { cleanup(); reject(new Error('Video processing paused.')); };
    const timer = setTimeout(error, 30000); video.addEventListener(event, done, { once: true }); video.addEventListener('error', error, { once: true }); signal.addEventListener('abort', abort, { once: true }); if (signal.aborted) abort(); else act();
  });
  const abort = () => { void reader.close(); }; signal.addEventListener('abort', abort, { once: true });
  try {
    report?.({ stage: 'screen', completed: job.data.screenNext, total: duration });
    await wait('loadeddata', () => { video.src = url; video.load(); });
    const width = video.videoWidth, height = video.videoHeight;
    if (!width || !height) throw new Error('No video picture was found. Turn off on-screen text to use audio only.');
    const crop = slideCrop(job.data.options?.region || 'full', width, height);
    canvas.width = Math.min(crop.width, 1600); canvas.height = Math.round(crop.height * canvas.width / crop.width);
    const context = canvas.getContext('2d')!, small = tiny.getContext('2d', { willReadFrequently: true })!;
    const signature = () => { small.drawImage(video, crop.x, crop.y, crop.width, crop.height, 0, 0, 96, 54); return frameSignature(small.getImageData(0, 0, 96, 54).data); };
    const seek = async (at: number) => { if (Math.abs(video.currentTime - at) > .01) await wait('seeked', () => { video.currentTime = at; }); };
    for (let second = job.data.screenNext; second < duration; second += SCREEN_INTERVAL) {
      if (signal.aborted) throw new Error('Video processing paused.');
      if (attempts >= 480) { unreadable.push({ label: 'On-screen text', reason: 'Stopped after 480 screen readings. Upload the slide deck for any remaining visual material.' }); break; }
      const at = Math.min(duration - .05, second + .05); await seek(at);
      let pixels = signature(); const change = slideChange(prior, pixels);
      const distinct = change === 'slide', periodic = second - lastRead >= 45;
      if (distinct || periodic) {
        // Read after a short settling interval so slide-transition frames are less likely to enter the guide.
        await seek(Math.min(duration - .05, at + .35)); pixels = signature();
        prior = pixels; lastRead = second; attempts++;
        progress(`Reading slide text at ${timeLabel(second)} of ${timeLabel(duration)}…`);
        context.drawImage(video, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height);
        const found = await abortable(reader.read(canvas, 'Video ' + timeLabel(second))), text = found.text.trim(), canonical = text.toLowerCase().replace(/[^a-z0-9]+/g, '');
        if (text.length >= 24 && /[a-z]{3}/i.test(text) && !units.some(u => u.text.toLowerCase().replace(/[^a-z0-9]+/g, '') === canonical)) units.push({ label: 'On-screen · ' + timeLabel(second), text, transcript: { start: second, end: Math.min(duration, second + SCREEN_INTERVAL), reviewed: false, kind: 'screen', ...(found.confidence < 75 ? { issues: ['screen-reading'] } : {}) } });
      }
      const next = Math.min(duration, second + SCREEN_INTERVAL);
      if (distinct || periodic || second - lastSaved >= 30) { await job.save({ screenUnits: units, screenAttempts: attempts, screenNext: next, unreadable }); lastSaved = second; }
      report?.({ stage: 'screen', completed: next, total: duration });
    }
    await job.save({ screenUnits: units, screenAttempts: attempts, screenNext: duration, screenDone: true, unreadable });
    report?.({ stage: 'screen', status: 'done' });
  } finally { signal.removeEventListener('abort', abort); await reader.close(); video.removeAttribute('src'); video.load(); URL.revokeObjectURL(url); }
}
