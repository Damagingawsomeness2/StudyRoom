# Studyroom study improvements

Implemented September 21, 2026.

- Lecture comparison uses close passages from the documents selected for a guide. It flags possible number, negation, and spelling differences, shows both quotes, and never silently changes source text. Flagged lecture evidence remains excluded from scored questions. Comparisons are bounded and disclose partial results.
- Named concepts and explicitly introduced aliases share recall items and question pools. Ambiguous acronyms and meaningful parenthetical qualifiers remain distinct. Every retained source passage keeps its citations.
- Lecture checkpoints persist in R2 after each speech window, sampled frame, and multipart upload chunk. A bounded file fingerprint includes file metadata, first/last samples, caption content, and screen-reading choice. Reselect the same recording and options after reloading. Conditional writes reject stale concurrent checkpoints. Expired uploads restart their bytes while keeping extracted text.
- Optional on-screen OCR samples every 30 seconds and caps reading at 240 different frames. It records timestamps, skips unchanged frames and exact repeated text, and requires review. This is printed English text extraction, not diagram or formula interpretation. Silent recordings can use screen reading.
- Timed exams mix distinct questions across topics, store answers and uncertainty flags in the existing server-backed study session, and use an absolute deadline. Results include unanswered questions, exact source explanations, and a missed/unsure practice queue. Finishing is idempotent.

## Verification

- TypeScript check and production build pass.
- Existing engine and lecture regression checks pass.
- Focused checks cover comparisons, numeric words, alias ambiguity, qualifier preservation, duplicate references, screen metadata and review gating, mixed exam selection, expired timer restoration, idempotent grading, upload continuation, lost final responses, and network failures.
- Browser: uploaded synthetic notes, captions and a 65-second lecture; read three on-screen frames; found the intended fifty/100 difference; saved a correction and detected a stale comparison; paused during OCR, reloaded, and resumed from saved progress; generated a guide; restored an exam with its saved answers and decreasing timer; checked scoring and uncertainty review; opened the corresponding practice session.
- No OpenAI requests or secret changes were required. Existing private audience is preserved. No schema migration or new dependency is required.

Proof image: transcript-comparison.jpg.
