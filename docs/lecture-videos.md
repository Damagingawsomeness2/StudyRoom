# Lecture video support

- MP4, MOV, M4V, and WebM, up to 1 GiB and 3 hours per upload.
- Automatic English transcription uses Whisper base.en (q8) in a browser worker. The bundled Transformers.js and ONNX WASM files are served by Studyroom; public model weights download from Hugging Face. Audio is processed locally without OpenAI API calls.
- Matching SRT or VTT captions can replace automatic transcription. Transcripts retain time ranges and can be edited beside a seekable video player.
- Mediabunny decodes audio in bounded windows through WebCodecs. Browsers without a suitable decoder fall back to Web Audio for videos up to 100 MiB and 20 minutes. Other unsupported recordings need a compatible browser, conversion, or captions.
- Original videos are uploaded in 8 MiB multipart chunks to private R2 storage. Transcript JSON is stored separately; D1 keeps material and pending-upload metadata. Migration 0003 adds lecture metadata and the pending-upload table.
- Unreviewed transcripts support reading and recall. Scored questions require reviewed text or exact corroboration from a trusted text source. Video frames are not analyzed; slides are needed for diagrams and written content.
- Keep the tab open until processing and upload finish. Upload retries in the same tab retain a completed transcript; interrupted uploads after closing the tab must be added again.

## Verification

`node tests/lecture.test.mjs` checks caption timing, transcript validation, corroboration, reviewed-question eligibility, overlap assignment, and HTTP video ranges. Existing study engine tests remain passing.

Browser checks covered automatic transcription of an 11-second public speech excerpt in MP4/AAC and WebM/Opus; a 9 MiB multipart upload with captions; playback; seeking to 0:50; saved transcript corrections after reopening; guide generation; and citation links back to the video. Maximum-size and three-hour recordings were not exercised end to end.
