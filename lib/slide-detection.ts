import type { LectureOptions } from './lecture-options';
export const SCREEN_SAMPLE_SECONDS = 2;
export function slideCrop(region: LectureOptions['region'], width: number, height: number) {
  const start = region === 'right' ? .22 : region === 'center' ? .1 : 0;
  const fraction = region === 'full' ? 1 : region === 'center' ? .8 : .78;
  return { x: Math.round(width * start), y: 0, width: Math.round(width * fraction), height };
}
export function frameSignature(pixels: Uint8ClampedArray): Uint8Array {
  const output = new Uint8Array(pixels.length / 4);
  for (let i = 0; i < output.length; i++) output[i] = Math.round(.299 * pixels[i * 4] + .587 * pixels[i * 4 + 1] + .114 * pixels[i * 4 + 2]);
  return output;
}
export function slideChange(before: Uint8Array | undefined, after: Uint8Array, width = 96, height = 54): 'same' | 'motion' | 'slide' {
  if (!before || before.length !== after.length) return 'slide';
  let changed = 0, left = width, top = height, right = 0, bottom = 0;
  const tiles = new Set<number>();
  for (let i = 0; i < after.length; i++) if (Math.abs(after[i] - before[i]) > 28) {
    changed++; const x = i % width, y = Math.floor(i / width); left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y); tiles.add(Math.floor(y / 6) * 16 + Math.floor(x / 6));
  }
  if (changed < 5) return 'same';
  const box = (right - left + 1) * (bottom - top + 1) / (width * height);
  // Tiny cursor movement and compact corner webcam motion do not consume an OCR frame.
  const corner = (left < width * .15 || right > width * .85) && (top < height * .15 || bottom > height * .85);
  if (box < .012 || corner && box < .19 && tiles.size < 32) return 'motion';
  return changed / after.length >= .003 ? 'slide' : 'motion';
}
