import{storage,fail,validId,RequestError,origin,json}from '@/lib/server';
import{ocrSummary,ocrWarnings}from '@/lib/ocr-reading';
import{lectureSummary,lectureWarnings}from '@/lib/lecture';
import type{Parsed,LectureSummary}from '@/lib/study-types';
type Params={params:Promise<{id:string}>};
async function source(id:string){const{db,bucket}=storage();const row=await db.prepare('SELECT id,name,kind,size,units,warnings,ocr,lecture FROM materials WHERE id = ?').bind(id).first<{id:string;name:string;kind:string;size:number;units:number;warnings:string;ocr:string;lecture:string}>();if(!row)throw new RequestError('This source was not found.',404);const object=await bucket.get('parsed/'+id);if(!object)throw new RequestError('The extracted text is unavailable.',404);return{db,bucket,row,object,parsed:await object.json<Parsed>()};}
export async function GET(request:Request,{params}:Params){try{const{parsed,object}=await source(validId((await params).id));return Response.json({parsed,revision:object.etag},{headers:{'Cache-Control':'no-store'}});}catch(e){return fail(e);}}
export async function PUT(request:Request,{params}:Params){try{
 origin(request);const id=validId((await params).id),x=await json(request),{db,bucket,row,object,parsed}=await source(id);
 if(!x||!Number.isInteger(x.index)||x.index<0||x.index>=parsed.units.length)throw new RequestError('Choose a section to review.');
 const unit=parsed.units[x.index];if(!unit.ocr&&!unit.transcript)throw new RequestError('Choose image text or a lecture transcript.');
 if(typeof x.text!=='string'||!unit.transcript&&x.text.trim().length<25||x.text.length>250000)throw new RequestError(unit.transcript?'Keep this section under 250,000 characters.':'Keep between 25 and 250,000 characters of readable text.');
 if(x.revision!==object.etag)throw new RequestError('This text changed in another window. Close and reopen the review before saving.',409);
 parsed.units[x.index]={...unit,text:x.text.trim(),...(unit.ocr?{ocr:{...unit.ocr,reviewed:true}}:{}),...(unit.transcript?{transcript:{...unit.transcript,reviewed:true}}:{})};
 if(unit.transcript&&x.allReviewed===true)for(const u of parsed.units)if(u.transcript)u.transcript.reviewed=true;
 if(parsed.units.reduce((sum,u)=>sum+u.text.length,0)>5_000_000)throw new RequestError('This document has too much text.',413);
 parsed.warnings=lectureWarnings(parsed.units,ocrWarnings(parsed.units,parsed.warnings));
 const ocr=unit.ocr?{...ocrSummary(parsed.units),reviewedAt:Date.now()}:JSON.parse(row.ocr||'{}'),oldLecture=JSON.parse(row.lecture||'{}')as LectureSummary;
 const lecture=unit.transcript?{...lectureSummary(parsed.units,oldLecture.duration),reviewedAt:Date.now()}:oldLecture;
 const result=await bucket.put('parsed/'+id,JSON.stringify(parsed),{onlyIf:{etagMatches:object.etag}});
 if(!result)throw new RequestError('This text changed in another window. Close and reopen the review before saving.',409);
 await db.prepare('UPDATE materials SET warnings = ?, ocr = ?, lecture = ? WHERE id = ?').bind(JSON.stringify(parsed.warnings),JSON.stringify(ocr),JSON.stringify(lecture),id).run();
 return Response.json({parsed,revision:result.etag,material:{...row,warnings:parsed.warnings,ocr,lecture}},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return fail(e);}}
