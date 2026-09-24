export type LectureOptions = { quality: 'balanced' | 'accurate'; region: 'full' | 'left' | 'right' | 'center' };
export const DEFAULT_LECTURE_OPTIONS: LectureOptions = { quality: 'accurate', region: 'full' };
export function lectureOptions(value: unknown): LectureOptions {
  const x = value as Partial<LectureOptions> | undefined;
  return { quality: x?.quality === 'balanced' ? 'balanced' : 'accurate', region: ['left', 'right', 'center'].includes(x?.region || '') ? x!.region! : 'full' };
}
export const TRANSCRIPT_ISSUES = ['quiet', 'clipping', 'channel-cancellation', 'repetition', 'fast-speech', 'screen-reading'] as const;
export type TranscriptIssue = typeof TRANSCRIPT_ISSUES[number];
export const TRANSCRIPT_SOURCES = ['captions', 'whisper-base.en', 'whisper-small.en'] as const;
export type TranscriptSource = typeof TRANSCRIPT_SOURCES[number];
