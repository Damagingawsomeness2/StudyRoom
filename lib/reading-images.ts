import type {PDFPageProxy} from 'pdfjs-dist';
import type {ImageReference} from './study-types';
const MAX_PIXELS=6_000_000;
export async function pdfPageCanvas(page:PDFPageProxy){const base=page.getViewport({scale:1}),scale=Math.min(2.8,2600/Math.max(base.width,base.height),Math.sqrt(MAX_PIXELS/(base.width*base.height)));const viewport=page.getViewport({scale}),canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);await page.render({canvas,viewport}).promise;return canvas;}
export async function imageCanvas(blob:Blob,crop?:ImageReference['crop']){
 const bitmap=await createImageBitmap(blob);try{
  const left=crop?.left||0,top=crop?.top||0,width=bitmap.width*(1-left-(crop?.right||0)),height=bitmap.height*(1-top-(crop?.bottom||0));
  if(width<1||height<1||bitmap.width*bitmap.height>50_000_000)throw new Error('This image is too large or its crop cannot be read.');
  const scale=Math.min(2,2600/Math.max(width,height),Math.sqrt(MAX_PIXELS/(width*height))),canvas=document.createElement('canvas');canvas.width=Math.ceil(width*scale);canvas.height=Math.ceil(height*scale);const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Your browser could not open this image.');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,bitmap.width*left,bitmap.height*top,width,height,0,0,canvas.width,canvas.height);return canvas;
 }finally{bitmap.close();}
}
export function releaseCanvas(canvas:HTMLCanvasElement){canvas.width=0;canvas.height=0;}
export async function officeZip(file:Blob,kind:'pptx'|'docx'){
 const {unzipSync,strFromU8}=await import('fflate');let total=0;
 const zip=unzipSync(new Uint8Array(await file.arrayBuffer()),{filter:f=>{const wanted=kind==='pptx'?/^ppt\/(?:slides\/(?:slide\d+\.xml|_rels\/slide\d+\.xml.rels)|notesSlides\/notesSlide\d+\.xml|presentation.xml|_rels\/presentation.xml.rels|media\/[\w. -]+)$/.test(f.name):/^word\/(?:document.xml|_rels\/document.xml.rels|media\/[\w. -]+)$/.test(f.name);if(wanted){total+=f.originalSize;if(total>120*1024*1024)throw new Error('This document expands into too many images. Split it into smaller files.');}return wanted;}});
 return{zip,xml:(key:string)=>new DOMParser().parseFromString(strFromU8(zip[key]),'application/xml')};
}
export function embeddedImages(document:Document,relationships:Document|undefined,base:string):ImageReference[]{
 if(!relationships)return[];const rels=Array.from(relationships.getElementsByTagNameNS('*','Relationship'));
 return Array.from(document.getElementsByTagNameNS('*','blip')).flatMap(blip=>{
  const id=blip.getAttribute('r:embed')||blip.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','embed');
  const rel=rels.find(r=>r.getAttribute('Id')===id&&r.getAttribute('TargetMode')!=='External'&&(r.getAttribute('Type')||'').endsWith('/image')),target=rel?.getAttribute('Target');if(!target)return[];
  const parts=(target.startsWith('/')?target.slice(1):base+'/'+target).split('/'),out:string[]=[];for(const part of parts){if(part==='..')out.pop();else if(part&&part!=='.')out.push(part);}const path=out.join('/');if(!/^(ppt|word)\/media\/[\w. -]+$/.test(path))return[];
  const rect=blip.parentElement?.getElementsByTagNameNS('*','srcRect')[0];const crop=rect?{left:Number(rect.getAttribute('l')||0)/100000,top:Number(rect.getAttribute('t')||0)/100000,right:Number(rect.getAttribute('r')||0)/100000,bottom:Number(rect.getAttribute('b')||0)/100000}:undefined;
  return[{path,...(crop&&Object.values(crop).every(n=>n>=0&&n<1)?{crop}:{})}];
 });
}
export async function readingPreview(file:Blob,kind:string,ref:ImageReference):Promise<Blob>{
 let canvas:HTMLCanvasElement;
 if(kind==='pdf'&&ref.page){const pdfjs=await import('pdfjs-dist');pdfjs.GlobalWorkerOptions.workerSrc='/pdf.worker.min.mjs';const doc=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false,useSystemFonts:true}).promise;try{canvas=await pdfPageCanvas(await doc.getPage(ref.page));}finally{await doc.destroy();}}
 else if((kind==='pptx'||kind==='docx')&&ref.path){const{zip}=await officeZip(file,kind);if(!zip[ref.path])throw new Error('This image is unavailable in the original file.');canvas=await imageCanvas(new Blob([new Uint8Array(zip[ref.path])]),ref.crop);}
 else canvas=await imageCanvas(file);
 try{return await new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('The preview could not be made.')),'image/png'));}finally{releaseCanvas(canvas);}
}
