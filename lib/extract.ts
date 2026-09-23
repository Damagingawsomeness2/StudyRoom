import type{Parsed,Unit,ReadingReport,ImageReference}from './study-types';
import {imageTextReader} from './ocr';
import {pdfPageCanvas,imageCanvas,releaseCanvas,officeZip,embeddedImages} from './reading-images';
import {additionalImageText,ocrWarnings} from './ocr-reading';
export const ACCEPT='.pdf,.pptx,.docx,.txt,.md,.csv,.png,.jpg,.jpeg,.webp';
export function textUnits(text:string):Unit[]{const ps=text.replace(/\r/g,'').split(/\n\s*\n/).filter(p=>p.trim());const units:Unit[]=[];let s='';const flush=()=>{if(s.trim())units.push({label:`Section ${units.length+1}`,text:s.trim()});s='';};for(const p of ps){if(s.length+p.length>3000)flush();if(p.length>6000){const sentences=p.split(/(?<=[.!?])\s+/);for(const sentence of sentences){if(s.length+sentence.length>4000)flush();s+=sentence+' ';}}else s+=(s?'\n':'')+p;}flush();return units;}
export async function extract(file:File,progress:(text:string)=>void):Promise<Parsed>{
 if(file.size>30*1024*1024)throw new Error('This file is over 30 MB. Split or compress it, then try again.');
 if(!file.size)throw new Error('This file is empty.');const ext=file.name.split('.').pop()?.toLowerCase();
 if(!['pdf','pptx','docx','txt','md','csv','png','jpg','jpeg','webp'].includes(ext||''))throw new Error(ext==='ppt'||ext==='doc'?'Save this older Office file as PPTX, DOCX, or PDF first.':'Use PDF, PPTX, DOCX, PNG, JPG, WebP, TXT, Markdown, or CSV.');
 let units:Unit[]=[];const warnings:string[]=[],reader=imageTextReader(progress);let reading:ReadingReport|undefined;
 const problem=(label:string)=>warnings.push(`${label}: image text could not be read. Review the original or add clearer text.`);
 try{
  if(ext==='pdf'){
   progress('Opening PDF…');const pdfjs=await import('pdfjs-dist');pdfjs.GlobalWorkerOptions.workerSrc='/pdf.worker.min.mjs';
   const doc=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false,useSystemFonts:true}).promise;
   reading={totalUnits:doc.numPages,unreadable:[]};
   try{for(let i=1;i<=doc.numPages;i++){
    const label=`Page ${i}`;progress(`Reading ${label.toLowerCase()} of ${doc.numPages}…`);const page=await doc.getPage(i),content=await page.getTextContent();let native='',lastY:number|undefined;
    for(const item of content.items)if('str'in item){const y=item.transform[5];if(lastY!==undefined&&Math.abs(lastY-y)>4)native+='\n';native+=item.str+' ';if(item.hasEOL)native+='\n';lastY=y;}
    native=native.replace(/ +\n/g,'\n').trim();const unit:Unit={label,text:native};
    try{const ops=await page.getOperatorList();const hasImages=ops.fnArray.some(op=>[pdfjs.OPS.paintImageXObject,pdfjs.OPS.paintInlineImageXObject,pdfjs.OPS.paintImageXObjectRepeat].includes(op));
     if(native.length<80||hasImages){const canvas=await pdfPageCanvas(page);try{const result=await reader.read(canvas,label);const extra=native.length<25?result.text:additionalImageText(native,result.text);if(extra.length>=25){unit.text=native.length<25?result.text:native+'\n\n'+extra;unit.ocr={confidence:result.confidence,reviewed:false,images:[{page:i}]};}}finally{releaseCanvas(canvas);}}
    }catch{problem(label);}finally{page.cleanup();}
    if(unit.text.length>=25)units.push(unit);else reading.unreadable.push({label,reason:'No usable text was recovered, including image reading. Add a clearer scan or paste the text.'});
   }}finally{await doc.destroy();}
  }else if(ext==='pptx'||ext==='docx'){
   const {zip,xml}=await officeZip(file,ext),paragraphs=(d:Document)=>Array.from(d.getElementsByTagNameNS('*','p')).map(p=>Array.from(p.getElementsByTagNameNS('*','t')).map(t=>t.textContent||'').join(' ')).filter(Boolean);
   const cache=new Map<string,{text:string;confidence:number}>();
   const readImage=async(ref:ImageReference,label:string)=>{const key=ref.path+JSON.stringify(ref.crop);if(cache.has(key))return cache.get(key)!;if(!ref.path||!zip[ref.path]||! /\.(png|jpe?g|webp|gif|bmp)$/i.test(ref.path))throw new Error('Unsupported embedded image');const canvas=await imageCanvas(new Blob([new Uint8Array(zip[ref.path])]),ref.crop);try{const result=await reader.read(canvas,label);cache.set(key,result);return result;}finally{releaseCanvas(canvas);}};
   if(ext==='docx'){
    if(!zip['word/document.xml'])throw new Error('This Word document could not be read.');const document=xml('word/document.xml');units=textUnits(paragraphs(document).join('\n\n'));
    const refs=embeddedImages(document,zip['word/_rels/document.xml.rels']?xml('word/_rels/document.xml.rels'):undefined,'word');reading={totalUnits:units.length+refs.length,unreadable:[]};
    for(const [index,ref]of refs.entries()){const label=`Image ${index+1}`;try{const result=await readImage(ref,label);if(result.text.length>=25){units.push({label,text:result.text,ocr:{confidence:result.confidence,reviewed:false,images:[ref]}});continue;}}catch{problem(label);}reading.unreadable.push({label,reason:'No usable image text was recovered. Check the original image or diagram.'});}
   }else{
    const order:string[]=[];
    if(zip['ppt/presentation.xml']&&zip['ppt/_rels/presentation.xml.rels']){const rels=Array.from(xml('ppt/_rels/presentation.xml.rels').getElementsByTagNameNS('*','Relationship'));for(const slide of Array.from(xml('ppt/presentation.xml').getElementsByTagNameNS('*','sldId'))){const target=rels.find(r=>r.getAttribute('Id')===slide.getAttribute('r:id'))?.getAttribute('Target');if(target){const path=target.startsWith('/')?target.slice(1):'ppt/'+target;if(zip[path])order.push(path);}}}
    const keys=order.length?order:Object.keys(zip).filter(k=>/^ppt\/slides\/slide\d+\.xml$/.test(k)).sort((a,b)=>Number(a.match(/slide(\d+)/)?.[1])-Number(b.match(/slide(\d+)/)?.[1]));reading={totalUnits:keys.length,unreadable:[]};
    for(const [i,key]of keys.entries()){
     const label=`Slide ${i+1}`;progress(`Reading ${label.toLowerCase()} of ${keys.length}…`);const slide=xml(key),parts=paragraphs(slide),relKey=key.replace('/slides/','/slides/_rels/')+'.rels',rels=zip[relKey]?xml(relKey):undefined;
     if(rels){const target=Array.from(rels.getElementsByTagNameNS('*','Relationship')).find(r=>(r.getAttribute('Type')||'').endsWith('/notesSlide'))?.getAttribute('Target');if(target){const nk=target.startsWith('/')?target.slice(1):'ppt/'+target.replace(/^\.\.\//,'');if(zip[nk]){const notes=paragraphs(xml(nk)).filter(s=>!/^\d+$/.test(s.trim()));if(notes.length)parts.push('Speaker notes',...notes);}}}
     const unit:Unit={label,text:parts.join('\n')};
     for(const [n,ref]of embeddedImages(slide,rels,'ppt/slides').entries()){
      try{const result=await readImage(ref,`${label}, image ${n+1}`),extra=additionalImageText(unit.text,result.text);if(extra.length>=25){unit.text+=(unit.text?'\n\n':'')+extra;unit.ocr={confidence:Math.min(unit.ocr?.confidence??100,result.confidence),reviewed:false,images:[...(unit.ocr?.images||[]),ref]};}}
      catch{problem(`${label}, image ${n+1}`);}
     }
     if(unit.text.length>=25)units.push(unit);else reading.unreadable.push({label,reason:'No usable text was recovered. Check the original slide or add a description.'});
    }
   }
  }else if(['png','jpg','jpeg','webp'].includes(ext||'')){
   const canvas=await imageCanvas(file);try{const result=await reader.read(canvas,'Image 1');if(result.text.length>=25)units.push({label:'Image 1',text:result.text,ocr:{confidence:result.confidence,reviewed:false,images:[{}]}});}finally{releaseCanvas(canvas);}reading={totalUnits:1,unreadable:units.length?[]:[{label:'Image 1',reason:'No usable printed text was recovered.'}]};
  }else units=textUnits(await file.text());
 }finally{await reader.close();}
 if(!units.length)throw new Error('No usable text was recovered. Try a clearer scan with printed English, or paste the text into notes.');
 if(units.reduce((n,u)=>n+u.text.length,0)>5_000_000)throw new Error('This document has too much text. Split it into smaller files and add each one.');
 if(reading?.unreadable.length)warnings.push(`${reading.unreadable.length} page(s), slide(s), or image(s) had no usable text. See Coverage for the exact labels.`);
 return{units,warnings:ocrWarnings(units,warnings),reading:reading||{totalUnits:units.length,unreadable:[]}};
}
