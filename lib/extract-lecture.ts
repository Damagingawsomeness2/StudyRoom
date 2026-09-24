import { MAX_LECTURE_SECONDS, MAX_VIDEO_BYTES, timeLabel, lectureWarnings } from './lecture';
import { transcriptUnits, readCaptions, speechSegments, appendSpeechSegments, type SpeechSegment } from './transcript';
import type { Parsed } from './study-types';
import type { LectureJob } from './lecture-checkpoint';
import type { LectureReporter } from './lecture-progress';
import { readVideoScreen } from './video-screen';
import { speechReader } from './speech-reader';
import { readAudioWindow } from './lecture-audio';
import { textSpeechIssues } from './transcript-review';
export async function extractLecture(file: File, progress: (text: string) => void, signal: AbortSignal, job: LectureJob, captions?: File, report?: LectureReporter): Promise<{ parsed: Parsed; duration: number }> {
  if (!file.size || file.size > MAX_VIDEO_BYTES) throw new Error('Choose a lecture video up to 1 GB.');
  if (!job.data.screen) report?.({ stage: 'screen', status: 'skipped' });
  if (job.data.parsed) {
    report?.({ stage: 'prepare', status: 'skipped' }); report?.({ stage: 'speech', status: 'done' });
    report?.({ stage: 'screen', status: job.data.screen ? 'done' : 'skipped' });
    return { parsed: job.data.parsed, duration: job.data.duration };
  }
  const { Input, ALL_FORMATS, BlobSource } = await import('mediabunny');
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  let reader: ReturnType<typeof speechReader> | undefined;
  const abort = () => { reader?.close(); input.dispose(); }; signal.addEventListener('abort', abort, { once: true });
  try {
    if (signal.aborted) throw new Error('Video processing cancelled.'); progress('Opening your lecture…');
    const duration = await input.computeDuration();
    if (!Number.isFinite(duration) || duration <= 0 || duration > MAX_LECTURE_SECONDS) throw new Error('Choose a lecture no longer than 3 hours.');
    if (job.data.duration && Math.abs(job.data.duration - duration) > .5) throw new Error('This recording does not match the saved progress. Choose the original video.');
    await job.save({ duration });
    let speechSkipped = false;
    let segments: SpeechSegment[] = [...job.data.segments]; const unreadable = [...job.data.unreadable];
    if (job.data.speechDone) { report?.({ stage: 'prepare', status: 'skipped' }); report?.({ stage: 'speech', status: 'done' }); }
    else if (captions) {
      if (captions.size > 2_000_000) throw new Error('This caption file is too large.');
      progress('Reading your lecture captions…'); report?.({ stage: 'prepare', status: 'skipped', engine: 'Supplied captions' });
      segments = readCaptions(await captions.text(), duration);
    } else {
      const audio = await input.getPrimaryAudioTrack();
      if (!audio) {
        if (!job.data.screen) throw new Error('No audio track was found. Attach matching SRT/VTT captions or enable on-screen text.');
        speechSkipped = true; unreadable.push({ label: 'Lecture audio', reason: 'No audio track was found. Only sampled on-screen text was read.' });
        report?.({ stage: 'prepare', status: 'skipped' }); report?.({ stage: 'speech', status: 'skipped' });
      } else {
        let decoded: AudioBuffer | undefined;
        if (!await audio.canDecode()) {
          if (file.size > 100 * 1024 * 1024 || duration > 20 * 60) throw new Error('This browser needs a shorter video for automatic transcription. Use Chrome or Edge, or attach captions.');
          progress('Reading the lecture audio for this browser…');
          try { decoded = await new OfflineAudioContext(1, 1, 16000).decodeAudioData(await file.arrayBuffer()); }
          catch { throw new Error('This browser cannot decode the audio. Export as MP4 with AAC audio or WebM with Opus audio, or attach captions.'); }
        }
        reader = speechReader(job.data.options?.quality || 'balanced', progress, signal, report);
        await reader.init(); report?.({ stage: 'speech', completed: job.data.nextSecond, total: duration });
        for (let start = job.data.nextSecond; start < duration; start += 60) {
          if (signal.aborted) throw new Error('Video processing cancelled.');
          const end = Math.min(duration, start + 60), from = Math.max(0, start - 5), to = Math.min(duration, end + 5);
          progress(`Transcribing ${timeLabel(start)}–${timeLabel(end)} of ${timeLabel(duration)}…`);
          const audioWindow = await readAudioWindow(audio, from, to, signal, decoded);
          if (audioWindow.silent) unreadable.push({ label: timeLabel(start) + '–' + timeLabel(end), reason: 'No usable audio was detected. Replay this interval to check for missing speech.' });
          else {
            const result = await reader.read(audioWindow.audio);
            const found = speechSegments(result, from, start, end, duration).map(s => ({ ...s, source: result.source, issues: [...new Set([...audioWindow.issues, ...textSpeechIssues(s.text, s.end - s.start)])] }));
            segments = appendSpeechSegments(segments, found);
            report?.({ stage: 'speech', engine: result.engine });
            if (!found.length) unreadable.push({ label: timeLabel(start) + '–' + timeLabel(end), reason: 'No speech was transcribed. Replay this interval to check for missed material.' });
          }
          await job.save({ segments, unreadable, nextSecond: end });
          report?.({ stage: 'speech', completed: end, total: duration, ...(end >= duration ? { status: 'done' as const } : {}) });
        }
      }
    }
    if (!job.data.speechDone) { await job.save({ segments, unreadable, nextSecond: duration, speechDone: true }); report?.({ stage: 'speech', status: speechSkipped ? 'skipped' : 'done' }); }
    reader?.close(); reader = undefined;
    if (job.data.screen && !job.data.screenDone) await readVideoScreen(file, duration, job, progress, signal, report);
    else if (job.data.screen) report?.({ stage: 'screen', status: 'done' });
    const units = [...transcriptUnits(segments), ...job.data.screenUnits].sort((a, b) => a.transcript!.start - b.transcript!.start);
    if (!units.length) throw new Error('No usable lecture text was found. Try a clearer recording or attach captions.');
    const warnings = job.data.screen ? ['Video screen reading: checks every 2 seconds, ignores small cursor/corner motion, and reads up to 480 changed frames. Very brief slides, handwriting, and diagrams may be missed.'] : [];
    const parsed = { units, warnings: lectureWarnings(units, warnings), reading: { totalUnits: units.length + job.data.unreadable.length, unreadable: job.data.unreadable } };
    await job.save({ parsed }); return { duration, parsed };
  } finally { signal.removeEventListener('abort', abort); reader?.close(); input.dispose(); }
}
