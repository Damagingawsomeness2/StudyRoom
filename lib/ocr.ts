import type {Worker} from 'tesseract.js';
import {ocrParagraphText} from './ocr-reading';

export function imageTextReader(progress:(s:string)=>void){
 let worker:Worker|undefined,failed=false,label='Image';
 const deadline=async<T>(promise:Promise<T>,ms=90000):Promise<T>=>{let timer:ReturnType<typeof setTimeout>|undefined;try{return await Promise.race([promise,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('Image reading took too long. Try a clearer or smaller image.')),ms);})]);}finally{if(timer)clearTimeout(timer);}};
 return{
  async read(canvas:HTMLCanvasElement,sourceLabel:string){
   if(failed)throw new Error('The image reader is unavailable. Retry this file.');label=sourceLabel;
   try{
    if(!worker){progress('Preparing the image text reader…');const url=new URL('/ocr/v7/tesseract.esm.min.js',window.location.origin).href;const {default:{createWorker,PSM}}=await import(/* @vite-ignore */ url) as {default:typeof import('tesseract.js')};
     const starting=createWorker('eng',1,{workerPath:'/ocr/v7/worker.min.js',corePath:'/ocr/v7',langPath:'/ocr/v7',workerBlobURL:false,cacheMethod:'none',logger:m=>progress(m.status==='recognizing text'?`${label}: reading image text… ${Math.round(m.progress*100)}%`:'Preparing the image text reader…')});
     void starting.then(w=>{if(failed)void w.terminate().catch(()=>{});},()=>{});
     worker=await deadline(starting);
     await worker.setParameters({tessedit_pageseg_mode:PSM.AUTO,user_defined_dpi:'200'});
    }
    const {data}=await deadline(worker.recognize(canvas,{rotateAuto:true},{text:true,blocks:true}));
    const words=(data.blocks||[]).flatMap(b=>b.paragraphs.flatMap(p=>p.lines.flatMap(l=>l.words))).filter(w=>/[a-z0-9]/i.test(w.text));
    const uncertain=words.length>0&&words.filter(w=>w.confidence<60).length/words.length>.12;
    const paragraphs=(data.blocks||[]).flatMap(b=>b.paragraphs);
    return{text:(ocrParagraphText(paragraphs.map(p=>p.lines.map(l=>l.text)),paragraphs.map(p=>p.bbox))||data.text).replace(/\u0000/g,'').trim(),confidence:Math.max(0,Math.min(uncertain?84:100,Number.isFinite(data.confidence)?data.confidence:0))};
   }catch(e){failed=true;await worker?.terminate().catch(()=>{});worker=undefined;throw e;}
  },
  async close(){failed=true;await worker?.terminate().catch(()=>{});worker=undefined;}
 };
}
