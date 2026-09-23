import{validatedExtras}from '@/lib/study-tools';
import{storage,fail,validId,origin,json,RequestError}from '@/lib/server';
import{validatedSession}from '@/lib/study-session';
import type{Guide,PracticeRecord}from '@/lib/study-types';
function practiceRecords(value:unknown,ids:Set<string>){
 const records:Record<string,PracticeRecord>={};if(!value||typeof value!=='object'||Array.isArray(value))return records;
 for(const [id,raw]of Object.entries(value)){if(!ids.has(id)||!raw||typeof raw!=='object')continue;const r=raw as Record<string,unknown>;
  if(!['attempts','streak','lastAt','dueAt'].every(k=>typeof r[k]==='number'&&Number.isFinite(r[k]))||typeof r.correct!=='boolean'||typeof r.confident!=='boolean')continue;
  const lastAt=Math.max(0,Math.min(Date.now(),Number(r.lastAt)));
  records[id]={attempts:Math.max(0,Math.min(100000,Math.floor(Number(r.attempts)))),streak:Math.max(0,Math.min(5,Math.floor(Number(r.streak)))),lastAt,dueAt:Math.max(lastAt,Math.min(lastAt+30*86400_000,Number(r.dueAt))),correct:r.correct,confident:r.correct&&r.confident};
 }return records;
}
export async function PUT(request:Request,{params}:{params:Promise<{id:string}>}){try{origin(request);const{db,bucket}=storage(),id=validId((await params).id),x=await json(request);const obj=await bucket.get('guides/'+id);if(!obj)throw new RequestError('Guide not found.',404);const g=await obj.json<Guide>(),cards=new Set(g.cards.map(c=>c.id)),qs=new Map(g.questions.map(q=>[q.id,q]));const strings=(v:unknown)=>Array.isArray(v)?[...new Set(v.filter(s=>typeof s==='string'&&cards.has(s)))]:[];const answers=(v:unknown)=>Object.fromEntries(Object.entries(v&&typeof v==='object'&&!Array.isArray(v)?v:{}).filter(([k,n])=>qs.has(k)&&typeof n==='number'&&Number.isInteger(n)&&n>=-1&&n<qs.get(k)!.options.length));if(x.guideVersion!==g.createdAt)throw new RequestError('This guide was updated. Reopen it before saving more progress.',409);const p={...validatedExtras(x,g),guideVersion:g.createdAt,known:strings(x.known),review:strings(x.review),answers:answers(x.answers),assessment:answers(x.assessment),assessed:x.assessed===true,practice:practiceRecords(x.practice,new Set(qs.keys())),session:validatedSession(x.session,g)};const saved=await db.prepare('UPDATE guides SET progress = ? WHERE id = ? AND created_at = ?').bind(JSON.stringify(p),id,g.createdAt).run();if(!saved.meta.changes)throw new RequestError('This guide changed. Reopen it to continue.',409);return Response.json({ok:true});}catch(e){return fail(e);}}
