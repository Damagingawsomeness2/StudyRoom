import type { Input } from 'mediabunny';
import { chooseAudioChannel, prepareSpeechAudio } from './audio-quality';
type AudioTrack = NonNullable<Awaited<ReturnType<Input['getPrimaryAudioTrack']>>>;
export async function readAudioWindow(track: AudioTrack, from: number, to: number, signal: AbortSignal, decoded?: AudioBuffer) {
  const { AudioBufferSink } = await import('mediabunny');
  const rate = decoded?.sampleRate || await track.getSampleRate();
  if (rate < 8000 || rate > 192000) throw new Error('Export this lecture as MP4 with AAC audio, or attach captions.');
  const context = new OfflineAudioContext(1, Math.max(1, Math.ceil((to - from) * 16000)), 16000);
  const buffer = context.createBuffer(1, Math.max(1, Math.ceil((to - from) * rate)), rate), mono = buffer.getChannelData(0);
  let cancellation = false;
  const packets = decoded ? (async function* () { yield { buffer: decoded, timestamp: 0 }; })() : new AudioBufferSink(track).buffers(from, to);
  for await (const packet of packets) {
    if (signal.aborted) throw new Error('Video processing cancelled.');
    const channels = Array.from({ length: packet.buffer.numberOfChannels }, (_, i) => packet.buffer.getChannelData(i));
    const selected = chooseAudioChannel(channels), offset = Math.round((packet.timestamp - from) * rate);
    cancellation ||= selected.cancellation;
    for (let n = Math.max(0, -offset); n < selected.samples.length && offset + n < mono.length; n++) mono[offset + n] = selected.samples[n];
  }
  if (signal.aborted) throw new Error('Video processing cancelled.');
  const source = context.createBufferSource(); source.buffer = buffer; source.connect(context.destination); source.start();
  const processed = prepareSpeechAudio((await context.startRendering()).getChannelData(0));
  if (cancellation) processed.issues.push('channel-cancellation');
  return processed;
}
