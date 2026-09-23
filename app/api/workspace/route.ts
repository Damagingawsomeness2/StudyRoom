import {storage,origin,json,validId,fail,RequestError} from '@/lib/server';
import type {BuilderDraft} from '@/lib/study-types';
export async function GET(){try{const{db,bucket}=storage();const [row,draft]=await Promise.all([db.prepare('SELECT resume_guide_id AS resumeGuideId FROM workspace WHERE id = 1').first<{resumeGuideId:string|null}>(),bucket.get('workspace/draft.json')]);return Response.json({draft:draft?await draft.json():null,resumeGuideId:row?.resumeGuideId||null},{headers:{'Cache-Control':'no-store'}});}catch(e){return fail(e);}}
export async function PUT(request:Request){try{
 origin(request);const{db,bucket}=storage(),x=await json(request);if(!x||typeof x!=='object')throw new RequestError('Your draft could not be read.');
 const hasDraft=Object.hasOwn(x,'draft'),hasResume=Object.hasOwn(x,'resumeGuideId');
 if(!hasDraft&&!hasResume)throw new RequestError('Nothing to save.');
 let resume:string|null=null;
 if(hasResume&&x.resumeGuideId!==null){resume=validId(x.resumeGuideId);if(!await db.prepare('SELECT id FROM guides WHERE id = ?').bind(resume).first())throw new RequestError('Guide not found.',404);}
 if(hasDraft){const d=x.draft;if(!d||typeof d!=='object'||!Array.isArray(d.files))throw new RequestError('Your draft could not be read.');
  const str=(v:unknown,max:number)=>{if(typeof v!=='string'||v.length>max)throw new RequestError('Some draft text is too long.');return v;};
  const rows=await db.prepare('SELECT id FROM materials').all<{id:string}>(),ids=new Set(rows.results.map(m=>m.id));
  const draft:BuilderDraft={...(d.editing&&Number.isFinite(d.editing.version)?{editing:{id:validId(d.editing.id),version:d.editing.version}}:{}),subject:str(d.subject,180),focus:str(d.focus,500),depth:d.depth==='quick'?'quick':'deep',model:str(d.model,180),notes:str(d.notes,1_000_000),noteTitle:str(d.noteTitle,120),noteOpen:d.noteOpen===true,files:d.files.map((f:Record<string,unknown>)=>{if(!f||typeof f!=='object')throw new RequestError('A draft file could not be read.');const materialId=f.materialId?validId(f.materialId):undefined;return{key:validId(f.key),name:str(f.name,255),screen:f.screen===true,...(materialId&&ids.has(materialId)?{materialId}:{})};})};
  await bucket.put('workspace/draft.json',JSON.stringify(draft),{httpMetadata:{contentType:'application/json'}});
 }
 await db.prepare('INSERT INTO workspace (id,draft_updated_at,resume_guide_id) VALUES (1,?,?) ON CONFLICT(id) DO UPDATE SET draft_updated_at = CASE WHEN ? THEN excluded.draft_updated_at ELSE workspace.draft_updated_at END, resume_guide_id = CASE WHEN ? THEN excluded.resume_guide_id ELSE workspace.resume_guide_id END').bind(hasDraft?Date.now():null,resume,hasDraft?1:0,hasResume?1:0).run();
 return Response.json({ok:true},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return fail(e);}}
