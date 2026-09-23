import{storage,fail,origin,json,validId,RequestError,generalSource}from '@/lib/server';
import{enhanceGuide,modelId}from '@/lib/model';
import{createGuideBuilder}from '@/lib/study-engine';
import{emptyProgress,type Guide,type ProgressData,type Parsed}from '@/lib/study-types';
import{migrateProgress}from '@/lib/study-tools';
export async function GET(){try{const{db}=storage();const{results}=await db.prepare('SELECT id,subject,source_count AS sourceCount,card_count AS cardCount,mode,created_at AS createdAt FROM guides ORDER BY created_at DESC').all();return Response.json(results,{headers:{'Cache-Control':'no-store'}});}catch(e){return fail(e);}}
export async function POST(request:Request){try{
 origin(request);const{db,bucket}=storage(),x=await json(request),subject=typeof x.subject==='string'?x.subject.trim():'';
 if(subject.length<2||subject.length>180)throw new RequestError('Enter a subject between 2 and 180 characters.');
 const focus=typeof x.focus==='string'?x.focus.slice(0,500):'',depth=x.depth==='quick'?'quick':'deep';
 if(!Array.isArray(x.sourceIds))throw new RequestError('Select your materials again.');
 const replace=x.replaceGuideId?validId(x.replaceGuideId):null;
 const previousObject=replace?await bucket.get('guides/'+replace):null;
 const old=previousObject?await previousObject.json<Guide>():null;
 if(replace&&(!old||old.createdAt!==x.expectedVersion))throw new RequestError('This guide changed. Reopen it before updating its materials.',409);
 const ids=[...new Set(x.sourceIds.map(validId))] as string[],builder=createGuideBuilder({id:replace||crypto.randomUUID(),subject,focus,depth,mode:ids.length?'materials':'general'});
 for(const id of ids){const row=await db.prepare('SELECT id,name,kind,size,units,warnings,ocr,lecture FROM materials WHERE id = ?').bind(id).first<{id:string;name:string;kind:string;size:number;units:number;warnings:string;ocr:string;lecture:string}>();if(!row)throw new RequestError('A selected source was not found. Add it again.');const obj=await bucket.get('parsed/'+id);if(!obj)throw new RequestError('A selected source is unavailable. Add it again.');builder.addSource({material:{...row,warnings:JSON.parse(row.warnings),ocr:JSON.parse(row.ocr||'{}'),lecture:JSON.parse(row.lecture||'{}')},parsed:await obj.json<Parsed>()});}
 if(!ids.length)builder.addSource(await generalSource(subject));let guide=builder.finish();
 if(x.model){if(guide.materials.some(m=>m.ocr?.needsReview||m.lecture?.needsReview))throw new RequestError('Review uncertain image text and lecture transcripts before using an AI model, or choose Built-in.');guide=await enhanceGuide(guide,modelId(x.model));}
 if(!guide.topics.length)throw new RequestError('There is not enough readable text. Add more notes or text-based files.');
 let progress:ProgressData={...emptyProgress(),guideVersion:guide.createdAt};
 if(old&&previousObject){
  const row=await db.prepare('SELECT progress,created_at FROM guides WHERE id = ?').bind(old.id).first<{progress:string;created_at:number}>();if(!row||row.created_at!==old.createdAt)throw new RequestError('This guide changed. Reopen it before updating.',409);
  progress=migrateProgress(old,guide,JSON.parse(row.progress));
  await bucket.put('guide-history/'+old.id+'/'+old.createdAt,JSON.stringify({guide:old,progress:JSON.parse(row.progress)}));
  const stored=await bucket.put('guides/'+guide.id,JSON.stringify(guide),{onlyIf:{etagMatches:previousObject.etag}});if(!stored)throw new RequestError('This guide changed. Reopen it before updating.',409);
  try{const result=await db.prepare('UPDATE guides SET subject=?,source_count=?,card_count=?,mode=?,created_at=?,progress=? WHERE id=? AND created_at=? AND progress=?').bind(subject,guide.materials.length,guide.cards.length,guide.mode,guide.createdAt,JSON.stringify(progress),guide.id,old.createdAt,row.progress).run();if(!result.meta.changes)throw new RequestError('Progress was saved from another tab during this update. Reopen the guide and try again.',409);}catch(e){await bucket.put('guides/'+old.id,JSON.stringify(old),{onlyIf:{etagMatches:stored.etag}});throw e;}
 }else{
  await bucket.put('guides/'+guide.id,JSON.stringify(guide));try{await db.prepare('INSERT INTO guides (id,subject,source_count,card_count,mode,created_at,progress) VALUES (?,?,?,?,?,?,?)').bind(guide.id,subject,guide.materials.length,guide.cards.length,guide.mode,guide.createdAt,JSON.stringify(progress)).run();}catch(e){await bucket.delete('guides/'+guide.id).catch(()=>{});throw e;}
 }
 return Response.json({guide,progress});
}catch(e){return fail(e);}}
