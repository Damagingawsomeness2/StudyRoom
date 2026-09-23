let transcriber;
self.onmessage=async({data})=>{try{
 if(data.type==='init'){
  const{pipeline,env}=await import(new URL('./vendor/transformers.min.js',self.location.href).href);
  env.allowLocalModels=false;
  env.backends.onnx.wasm.wasmPaths=new URL('./vendor/',self.location.href).href;
  env.backends.onnx.wasm.numThreads=1;
  transcriber=await pipeline('automatic-speech-recognition','onnx-community/whisper-base.en',{device:'wasm',dtype:'q8',progress_callback:p=>{if(p.status==='progress')self.postMessage({type:'progress',message:`Preparing speech reader… ${Math.round(p.progress||0)}%`});}});
  self.postMessage({type:'ready'});
 }else if(data.type==='transcribe'){
  if(!transcriber)throw new Error('The speech reader has not loaded.');
  const result=await transcriber(data.audio,{return_timestamps:true,chunk_length_s:30,stride_length_s:5});
  self.postMessage({type:'result',result});
 }
 }catch(error){self.postMessage({type:'error',message:error instanceof Error?error.message:'The speech reader could not finish this recording.'});}};
