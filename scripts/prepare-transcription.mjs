import{mkdir,copyFile}from'node:fs/promises';
import{createRequire}from'node:module';
import{dirname,resolve,join}from'node:path';
const require=createRequire(import.meta.url),dist=resolve(dirname(require.resolve('@huggingface/transformers')),'../dist'),target=new URL('../public/transcription/vendor/',import.meta.url);
await mkdir(target,{recursive:true});
for(const name of ['transformers.min.js','ort-wasm-simd-threaded.jsep.mjs','ort-wasm-simd-threaded.jsep.wasm'])await copyFile(join(dist,name),new URL(name,target));
await copyFile(resolve(dist,'../LICENSE'),new URL('LICENSE-transformers.txt',target));
