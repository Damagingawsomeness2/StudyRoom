import type { TranscriptIssue } from './lecture-options';
export function chooseAudioChannel(channels: Float32Array[]): { samples: Float32Array; cancellation: boolean } {
  if (channels.length === 1) return { samples: channels[0], cancellation: false };
  const length = channels[0]?.length || 0, mixed = new Float32Array(length), energies = channels.map(() => 0);
  let mixEnergy = 0;
  for (let i = 0; i < length; i++) {
    let value = 0;
    for (let c = 0; c < channels.length; c++) { const n = channels[c][i] || 0; value += n; energies[c] += n * n; }
    mixed[i] = value / channels.length; mixEnergy += mixed[i] * mixed[i];
  }
  const strongest = energies.indexOf(Math.max(...energies));
  const cancellation = energies[strongest] > 0 && mixEnergy < energies[strongest] * .08;
  return { samples: cancellation ? channels[strongest] : mixed, cancellation };
}
export function prepareSpeechAudio(input: Float32Array): { audio: Float32Array<ArrayBuffer>; silent: boolean; issues: TranscriptIssue[] } {
  let sum = 0, energy = 0, peak = 0, clipped = 0;
  for (const raw of input) { const v = Number.isFinite(raw) ? raw : 0; sum += v; }
  const mean = sum / Math.max(1, input.length), audio = new Float32Array(input.length);
  for (let i = 0; i < input.length; i++) { const v = Number.isFinite(input[i]) ? input[i] - mean : 0; audio[i] = v; energy += v * v; peak = Math.max(peak, Math.abs(v)); if (Math.abs(input[i]) >= .995) clipped++; }
  const rms = Math.sqrt(energy / Math.max(1, input.length)), issues: TranscriptIssue[] = [];
  // Only discard near-digital silence. Quiet voices remain available for transcription and review.
  const silent = peak < .0001 && rms < .00002;
  if (!silent && rms < .006) issues.push('quiet');
  if (clipped / Math.max(1, input.length) > .01) issues.push('clipping');
  const gain = !silent && rms < .03 ? Math.min(4, .03 / Math.max(.000001, rms), .95 / Math.max(.000001, peak)) : 1;
  if (gain > 1) for (let i = 0; i < audio.length; i++) audio[i] *= gain;
  return { audio, silent, issues };
}
