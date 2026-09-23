import type {OcrReading,Unit,OcrSummary} from './study-types';
export const OCR_REVIEW_THRESHOLD=85;
// OCR line breaks often reflect page width, not the end of a thought. Preserve
// paragraph boundaries and explicit lists while joining wrapped printed lines.
type TextBox={x0:number;y0:number;x1:number;y1:number};
export function ocrParagraphText(paragraphs:string[][],boxes?:TextBox[]){
 const result:string[]=[];
 for(const [i,lines]of paragraphs.entries()){
  const text=lines.map(line=>line.trim()).filter(Boolean).reduce((value,line)=>value+(value?(/^(?:[•●▪*]|[-–]\s|\d+[.)]\s)/.test(line)?'\n':' '):'')+line,''),previous=result.at(-1),box=boxes?.[i],prior=boxes?.[i-1];
  if(!text)continue;
  const lineHeight=box&&prior?Math.max((box.y1-box.y0)/Math.max(1,lines.length),(prior.y1-prior.y0)/Math.max(1,paragraphs[i-1].length)):0;
  // Double-spaced scans can split one sentence into adjacent OCR paragraphs.
  // Join only a lowercase continuation in the same column at normal line spacing.
  const adjacent=box&&prior&&box.y0>=prior.y1&&box.y0-prior.y1<lineHeight*1.8&&Math.abs(box.x0-prior.x0)<lineHeight*2;
  if(adjacent&&previous&&previous.length>=25&&!/[.!?:;=]$/.test(previous)&&/\b(is|are|was|were|means|has|have|can|must|should|will|because)\b/i.test(previous)&&/^[a-z]/.test(text)&&!/^.{2,85}\s+(is|are|means|refers to)\s/i.test(text))result[result.length-1]+=' '+text;
  else result.push(text);
 }
 return result.join('\n\n');
}
export function needsOcrReview(ocr?:Pick<OcrReading,'confidence'|'reviewed'>){return !!ocr&&!ocr.reviewed&&ocr.confidence<OCR_REVIEW_THRESHOLD;}
export function ocrSummary(units:Unit[]):OcrSummary{return{units:units.filter(u=>u.ocr).length,needsReview:units.filter(u=>needsOcrReview(u.ocr)).length};}
export function ocrWarnings(units:Unit[],warnings:string[]){const summary=ocrSummary(units);return [...warnings.filter(w=>!w.startsWith('Image text:')), ...(summary.units?[`Image text: OCR was used in ${summary.units} section(s). ${summary.needsReview?summary.needsReview+' need a reading check before scored questions.':'Compare important terms and numbers with the original.'} Printed English is supported; diagrams, handwriting, and equations still need your review.`]:[])];}
export function validatedOcr(value:unknown):OcrReading|undefined{
 if(!value||typeof value!=='object')return;const x=value as Partial<OcrReading>;
 if(typeof x.confidence!=='number'||!Number.isFinite(x.confidence)||!Array.isArray(x.images)||x.images.length>500)return;
 const images=x.images.filter(r=>r&&typeof r==='object'&&(!r.page||Number.isInteger(r.page)&&r.page>0&&r.page<=100000)&&(!r.path||typeof r.path==='string'&&/^(ppt|word)\/media\/[\w. -]+$/.test(r.path))).map(r=>({...(r.page?{page:r.page}:{}),...(r.path?{path:r.path}:{}),...(r.crop&&Object.values(r.crop).length===4&&Object.values(r.crop).every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<1)?{crop:r.crop}:{})}));
 return{confidence:Math.max(0,Math.min(100,x.confidence)),reviewed:x.reviewed===true,images};
}
export function additionalImageText(native:string,recognized:string){const norm=(s:string)=>s.normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim();const original=norm(native);return recognized.split('\n').map(s=>s.trim()).filter(s=>s&&!original.includes(norm(s))).join('\n').trim();}
