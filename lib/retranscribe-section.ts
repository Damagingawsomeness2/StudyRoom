import { speechReader } from './speech-reader';
import { readAudioWindow } from './lecture-audio';
import { speechSegments } from './transcript';
export async function retranscribeSection(id: string, start: number, end: number, progress: (text: string) => void, signal: AbortSignal, fileSize = Infinity) {
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || end - start > 120) throw new Error('Choose a speech section no longer than two minutes.');
  const { Input, UrlSource, ALL_FORMATS } = await import('mediabunny');
  const url = new URL('/api/materials/' + encodeURIComponent(id) + '?play=1', window.location.href);
  const input = new Input({ source: new UrlSource(url, { maxCacheSize: 16 * 1024 * 1024, parallelism: 1, getRetryDelay: attempts => attempts < 3 ? 2 ** attempts : null }), formats: ALL_FORMATS });
  const reader = speechReader('accurate', progress, signal), abort = () => { input.dispose(); reader.close(); };
  signal.addEventListener('abort', abort, { once: true });
  try {
    if (signal.aborted) throw new Error('Transcription stopped.');
    progress('Reading this section’s audio…');
    const duration = await input.computeDuration(), audio = await input.getPrimaryAudioTrack();
    if (!audio) throw new Error('This video has no audio track. Correct the on-screen words while watching.');
    let decoded: AudioBuffer | undefined;
    if (!await audio.canDecode()) {
      if (fileSize > 100 * 1024 * 1024 || duration > 20 * 60) throw new Error('This browser cannot re-read this recording’s audio. Try Chrome or Edge, or correct the words while listening.');
      progress('Preparing this short recording for your browser…');
      const response = await fetch(url, {signal});
      if (!response.ok) throw new Error('The saved recording could not be opened. Try again.');
      try { decoded = await new OfflineAudioContext(1, 1, 16000).decodeAudioData(await response.arrayBuffer()); }
      catch { throw new Error('This browser cannot decode this recording’s audio. Try Chrome or Edge, or correct the words while listening.'); }
    }
    const from = Math.max(0, start - 4), to = Math.min(duration, end + 4);
    const prepared = await readAudioWindow(audio, from, to, signal, decoded);
    if (prepared.silent) throw new Error('No clear audio was found in this section. Listen before adding any words.');
    await reader.init(); progress('Re-transcribing with the accuracy model…');
    const result = await reader.read(prepared.audio);
    const text = speechSegments(result, from, start, end, duration).map(s => s.text).join(' ').trim();
    if (!text) throw new Error('The accuracy reader did not find words in this section. Your existing text is unchanged.');
    return text;
  } finally { signal.removeEventListener('abort', abort); input.dispose(); reader.close(); }
}
