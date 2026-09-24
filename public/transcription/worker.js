let transcriber, activeDevice, quality = 'accurate', library;
const files = new Map();
const modelName = () => quality === 'accurate' ? 'whisper-small.en' : 'whisper-base.en';
const engineName = () => `${quality === 'accurate' ? 'Accuracy' : 'Balanced'} · ${activeDevice === 'webgpu' ? 'GPU accelerated' : 'CPU'}`;
function reportDownload(p) {
  if (p.file && p.status === 'progress') files.set(p.file, { loaded: p.loaded || 0, total: p.total || 0 });
  if (p.file && p.status === 'done' && files.has(p.file)) files.get(p.file).loaded = files.get(p.file).total;
  const values = [...files.values()], total = values.reduce((n, x) => n + x.total, 0), loaded = values.reduce((n, x) => n + x.loaded, 0);
  self.postMessage({ type: 'progress', message: `Preparing ${quality === 'accurate' ? 'accuracy' : 'balanced'} speech reader…`, percent: total ? Math.min(98, Math.round(100 * loaded / total)) : undefined, engine: engineName() });
}
async function load(device) {
  await transcriber?.dispose(); transcriber = undefined; activeDevice = device; files.clear();
  if (!library) library = await import(new URL('./vendor/transformers.min.js', self.location.href).href);
  library.env.allowLocalModels = false;
  library.env.backends.onnx.wasm.wasmPaths = new URL('./vendor/', self.location.href).href;
  library.env.backends.onnx.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 1) : 1;
  // Whisper's encoder is sensitive to quantization. Preserve its full precision in both modes.
  transcriber = await library.pipeline('automatic-speech-recognition', `onnx-community/${modelName()}`, {
    device,
    dtype: { encoder_model: 'fp32', decoder_model_merged: device === 'webgpu' ? 'q4' : 'q8' },
    progress_callback: reportDownload,
  });
}
self.onmessage = async ({ data }) => {
  try {
    if (data.type === 'init') {
      quality = data.quality === 'balanced' ? 'balanced' : 'accurate';
      let gpu = false;
      try { gpu = !!(await navigator.gpu?.requestAdapter()); } catch { /* Use the CPU fallback. */ }
      if (gpu) {
        try { await load('webgpu'); }
        catch { self.postMessage({ type: 'progress', message: 'GPU is unavailable for this model. Preparing the CPU fallback…' }); await load('wasm'); }
      } else await load('wasm');
      self.postMessage({ type: 'ready', result: { engine: engineName(), source: modelName() } });
    } else if (data.type === 'transcribe') {
      if (!transcriber) throw new Error('The speech reader has not loaded.');
      const options = { return_timestamps: true, chunk_length_s: 30, stride_length_s: 5, do_sample: false };
      let result;
      try { result = await transcriber(data.audio, options); }
      catch (error) {
        if (activeDevice !== 'webgpu') throw error;
        self.postMessage({ type: 'progress', message: 'GPU processing stopped. Retrying this section on the CPU…' });
        await load('wasm'); result = await transcriber(data.audio, options);
      }
      self.postMessage({ type: 'result', result: { ...result, engine: engineName(), source: modelName() } });
    }
  } catch (error) {
    self.postMessage({ type: 'error', message: error instanceof Error ? error.message : 'The speech reader could not finish this recording.' });
  }
};
