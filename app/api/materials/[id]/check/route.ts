import{storage,fail,origin,json,validId,RequestError}from'@/lib/server';
import{sentencePassages,referenceMatcher,type PassageReference}from'@/lib/source-matching';
import{needsOcrReview}from'@/lib/ocr-reading';
import type{Parsed}from'@/lib/study-types';
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){try{
 origin(request);const id=validId((await params).id),x=await json(request),{db,bucket}=storage();
 if(!Array.isArray(x.sourceIds)||x.sourceIds.length>500)throw new RequestError('Choose up to 500 class files for one comparison.');
 const target=await bucket.get('parsed/'+id);if(!target)throw new RequestError('The lecture transcript is unavailable.',404);
 const parsed=await target.json<Parsed>(),references:PassageReference[]=[];let files=0,skipped=0,limited=false;
 for(const refId of [...new Set<string>(x.sourceIds.map(validId))]){
  if(refId===id)continue;
  const row=await db.prepare('SELECT name,kind FROM materials WHERE id = ?').bind(refId).first<{name:string;kind:string}>();
  if(!row||['mp4','m4v','mov','webm'].includes(row.kind)){skipped++;continue;}
  const object=await bucket.get('parsed/'+refId);if(!object){skipped++;continue;}
  const source=await object.json<Parsed>();files++;
  for(const unit of source.units){if(needsOcrReview(unit.ocr))continue;for(const text of sentencePassages(unit.text)){
   if(references.length>=12000){limited=true;break;}
   references.push({text,citation:{sourceId:refId,name:row.name,label:unit.label,quote:text,excerpt:unit.text.slice(Math.max(0,unit.text.indexOf(text)-400),unit.text.indexOf(text)+text.length+800),...(unit.ocr?{ocr:{confidence:unit.ocr.confidence,reviewed:unit.ocr.reviewed}}:{})}});
  }}
  if(limited)break;
 }
 const compare=referenceMatcher(references),items=[];let checked=0;
 scan: for(const[index,unit]of parsed.units.entries())if(unit.transcript)for(const text of sentencePassages(unit.text)){checked++;items.push(...compare(text,index,id));if(items.length>=200||checked>=12000){limited=true;break scan;}}
 return Response.json({items:items.slice(0,200),files,passages:references.length,checked,skipped,limited,revision:target.etag},{headers:{'Cache-Control':'no-store'}});
}catch(e){return fail(e);}}
