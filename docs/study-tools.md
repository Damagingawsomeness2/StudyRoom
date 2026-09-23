# Studyroom learning tools

Adds all thirteen requested improvements to the existing private site. Everything below works with Built-in and does not require OpenAI credits.

- Update a guide’s materials in place. Match exact normalized card content and question evidence/answer text; remap reordered answer options. Preserve unchanged progress, notes, and recall drafts, reset changed concepts, retain completed exam history, and keep a server backup of the prior guide. Reject stale-version saves.
- Course folders, guide/material search, display names, archive, and restore, saved in D1 with optimistic revision checks.
- Source-based short-answer checklists and sequencing exercises from explicit, consecutively numbered process steps. Combine identical sequences across sources. Exclude uncertain readings from automatic sequence exercises.
- Two levels of hints; assisted answers remain in review rather than counting toward confident recall.
- Mistake notebook with source explanations, personal notes, and resolved status.
- Diagram label masks on uploaded images or PDF pages, with keyboard position controls, answer entry, and source-image reveal. R2 stores image bytes; D1 stores asset metadata and progress.
- Teacher review-sheet/objective import, editable requirements, possible evidence matches, manual coverage confirmation, and visible gaps. Comparison objectives can match separate concept definitions.
- Concept comparison with source descriptions and two-choice distinction drills.
- Persistent exam attempt history and cumulative weak-topic summaries, including the previously completed exam when upgrading.
- Exam date and daily time budget, adaptive concept priorities, and a rolling daily plan.
- Printable review sheets and a downloadable standalone HTML sheet with escaped source text and references; use the browser’s Print / Save PDF command for PDF export.
- Focus sessions with a concept goal, saved countdown, pause/resume, and a five-minute break.
- Video frame checks every five seconds, OCR only for changed frames, up to 480 frames, with deduplicated screen text and resumable checkpoints.

## Validation

- TypeScript, existing engine/lecture/improvement tests, and new study-tools regression tests pass.
- Regression tests cover changed evidence, reordered choices, retained drafts/notes/history, source sequence guards and deduplication, saved-state validation, objective matches, assisted recall, and export HTML escaping.
- Preview browser checks: updated an existing guide from three to four files, retained 14 existing cards and nine questions, retained a recall draft and mistake note, and added a sequence exercise without duplicating the guide.
- Verified source comparison drills, objective import and gap reporting, course creation/assignment/rename/archive/restore/search, diagram upload/label editing/answer checking, and plan/focus-session reload recovery.
- Verified an existing exam appears in history; quiz hints preserve review priority even when the correct answer is selected confidently.
- A 16-second lecture fixture captured three separate on-screen passages at 0:00, 0:05, and 0:15, plus its captions.
- The review sheet renders exact source passages and the export generator is tested. The preview browser did not expose a completed download event; the downloadable sheet uses a normal server attachment endpoint.

## Limits

Source wording can contain errors. Short-answer coverage is self-assessed, checklist matches are suggestions, diagram labels are entered by the student, and spaced review does not promise exam readiness. Five-second video sampling can still miss shorter slides, handwriting, and diagrams. Existing completed video imports retain their original sampling coverage.

Structured additions use the appended 0004 migration; existing migrations and the hosted API secret are unchanged. The site keeps its current owner-only audience.
