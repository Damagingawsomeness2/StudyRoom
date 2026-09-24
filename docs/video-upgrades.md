# Video and focused-guide update

- Accuracy mode uses Whisper small.en with a full-precision encoder; Balanced uses base.en. WebGPU is attempted, with CPU fallback on load or inference failure. First Accuracy download is approximately 500–600 MB. Automatic speech recognition remains English-only and fallible.
- Audio windows preserve quiet speech, avoid opposite-phase stereo cancellation, and remove matching text at overlapping chunk boundaries. No transcript is silently rewritten from slide text.
- Separate preparation, speech, slide, upload, and save stages report actual completed work. ETA starts only after measured advancement and resets on resume. It is an estimate for that stage, not a promise of completion time.
- Screen sampling runs every 2 seconds. Cropping can exclude presenter panels. Small cursor and compact corner motion are ignored, with a periodic 45-second read to catch local additions; OCR is bounded at 480 reads.
- Transcript navigation provides word/timestamp search, suggested chapters, replay, and prioritized review cues. Re-transcription proposes a replacement; it cannot save or approve it automatically.
- Source review gates, conflicting-passage warnings, saved corrections, and unchanged-concept progress migration remain active.

## Guide size

Class administration is removed before generating items. Learning objectives, subject/focus matches and repeated sources prioritize source-backed concepts. Filename anchors help identify clearly unrelated material; without a reliable anchor selection remains conservative. This is heuristic source selection, not a claim of semantic understanding or complete exam coverage.

Automatic targets are 20 cards for Quick review and 32 for In depth. The material-based minimum uses the count of distinct relevant candidate cards after merging:

| Available distinct cards | Minimum |
| --- | --- |
| 1–10 | 5, or all available if fewer |
| 11–30 | 10 |
| 31–75 | 15 |
| 76+ | 20 |

Users can request 5–200 cards. Targets below the minimum are raised; insufficient source content produces fewer cards instead of filler. Additional relevant topics are included when needed to reach the requested count. Question limits remain 12/18, and the diagnostic samples no more than 12 questions. Requests persist in drafts and guide updates. Originals remain available in Sources; omitted sections are reported in Coverage.

## Verification

`pnpm exec tsc --noEmit` and all five Node regression files pass. Tests cover real repeated speech versus boundary duplicates, silence/quiet/clipping/channel cancellation, cursor/webcam versus slide motion, resumed ETA, search/chapter cues, transcript review gates, source conflicts, relevance/coverage, automatic limits, custom counts, insufficient material, and progress migration.

Browser verification uses only the local preview. A synthetic spoken WebM completed automatic Accuracy transcription, detected its slide change, uploaded, saved, and opened with searchable timed text. Technical words were misrecognized in the synthetic voice, confirming that larger-model output still requires review; this is not an accuracy benchmark or a universal speedup claim. Re-reading a silent fixture correctly produced no invented transcript. GPU speed and recognition quality depend on the recording and hardware.

The saved-section Accuracy re-read completed with unchanged wording. A manual correction saved successfully. Browser generation of a requested 45-card fixture returned exactly 45 cards, with the calculated minimum displayed; Update materials retained the requested count.

