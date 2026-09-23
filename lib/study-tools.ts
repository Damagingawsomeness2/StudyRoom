import type {Guide,ProgressData,Card,Question,Citation,Topic} from './study-types.ts';
export type Mistake={firstAt:number;lastAt:number;misses:number;note:string;resolved:boolean};
export type RecallCheck={draft:string;revealed:boolean;checked:number[]};
export type ExamAttempt={id:string;startedAt:number;finishedAt:number;correct:number;total:number;unanswered:number;flagged:number;topics:{title:string;correct:number;total:number;uncertain:number}[]};
export type Objective={id:string;text:string;status:'unchecked'|'covered'|'practice';evidenceIds:string[]};
export type DiagramLabel={id:string;text:string;x:number;y:number;w:number;h:number};
export type Diagram={id:string;title:string;assetId:string;labels:DiagramLabel[];answers:Record<string,string>;revealed:boolean};
export type FocusSession={phase:'study'|'break'|'done';cardIds:string[];completed:string[];index:number;revealed:boolean;endsAt:number;remainingMs?:number;minutes:number};
export type StudyExtras={mistakes?:Record<string,Mistake>;recall?:Record<string,RecallCheck>;sequences?:Record<string,{order:number[];checked:boolean}>;examHistory?:ExamAttempt[];objectives?:Objective[];objectiveSource?:string;diagrams?:Diagram[];studyPlan?:{examDate:string;dailyMinutes:number;completedDays:string[]};focusSession?:FocusSession;comparison?:{a:string;b:string;draft:string;revealed:boolean;answer?:string;round?:number};updateSummary?:{cards:number;questions:number;reset:number}};
export type Sequence={id:string;title:string;steps:string[];citations:Citation[]};
const text=(x:unknown,max=4000)=>typeof x==='string'?x.slice(0,max):'';
const obj=(x:unknown):Record<string,any>=>x&&typeof x==='object'&&!Array.isArray(x)?x as Record<string,any>:{};
const arr=(x:unknown):any[]=>Array.isArray(x)?x:[];
const num=(x:unknown,min=0,max=1e15)=>typeof x==='number'&&Number.isFinite(x)?Math.max(min,Math.min(max,x)):min;
const integer=(x:unknown,min=0,max=100000)=>Math.floor(num(x,min,max));
const ids=(x:unknown,set:Set<string>,max=5000)=>[...new Set(arr(x).filter((s):s is string=>typeof s==='string'&&set.has(s)))].slice(0,max);
export function validatedExtras(raw:unknown,guide:Guide):StudyExtras{
 const x=obj(raw),cards=new Set(guide.cards.map(c=>c.id)),qs=new Set(guide.questions.map(q=>q.id)),evidence=new Set(guide.topics.flatMap(t=>t.evidence||[]).map(e=>e.id||''));
 const p:StudyExtras={mistakes:{},recall:{},sequences:{},examHistory:[],objectives:[],diagrams:[]};
 for(const [id,v] of Object.entries(obj(x.mistakes)).slice(0,3000)){if(!qs.has(id))continue;const m=obj(v);p.mistakes![id]={firstAt:num(m.firstAt),lastAt:num(m.lastAt),misses:integer(m.misses),note:text(m.note,1500),resolved:m.resolved===true};}
 for(const [id,v] of Object.entries(obj(x.recall)).slice(0,3000)){if(!cards.has(id))continue;const r=obj(v);p.recall![id]={draft:text(r.draft,4000),revealed:r.revealed===true,checked:[...new Set(arr(r.checked).filter(n=>Number.isInteger(n)&&n>=0&&n<30))]};}
 for(const seq of guide.sequences||[]){const r=obj(obj(x.sequences)[seq.id]),order=arr(r.order);if(order.length===seq.steps.length&&new Set(order).size===order.length&&order.every(n=>Number.isInteger(n)&&n>=0&&n<order.length))p.sequences![seq.id]={order,checked:r.checked===true};}
 const seen=new Set<string>();for(const v of arr(x.examHistory).slice(-100)){const h=obj(v),id=text(h.id,100);if(!id||seen.has(id))continue;seen.add(id);const total=integer(h.total,1,50);p.examHistory!.push({id,startedAt:num(h.startedAt),finishedAt:num(h.finishedAt),correct:integer(h.correct,0,total),total,unanswered:integer(h.unanswered,0,total),flagged:integer(h.flagged,0,total),topics:arr(h.topics).slice(0,50).map(v=>{const t=obj(v),total=integer(t.total,1,50);return{title:text(t.title,180),total,correct:integer(t.correct,0,total),uncertain:integer(t.uncertain,0,total)};})});}
 p.objectiveSource=text(x.objectiveSource,255);
 p.objectives=arr(x.objectives).slice(0,150).map((v,i)=>{const o=obj(v);return{id:text(o.id,100)||String(i),text:text(o.text,1000),status:['covered','practice'].includes(o.status)?o.status:'unchecked',evidenceIds:ids(o.evidenceIds,evidence,10)};}).filter(o=>o.text.trim());
 p.diagrams=arr(x.diagrams).slice(0,20).flatMap(v=>{const d=obj(v);if(!/^[a-zA-Z0-9_-]{1,100}$/.test(d.assetId))return[];const labels=arr(d.labels).slice(0,50).map((v,i)=>{const l=obj(v),x=num(l.x,0,.98),y=num(l.y,0,.98);return{id:text(l.id,100)||String(i),text:text(l.text,150),x,y,w:num(l.w,.02,1-x),h:num(l.h,.02,1-y)};});return[{id:text(d.id,100),title:text(d.title,180),assetId:d.assetId,labels,answers:Object.fromEntries(labels.map(l=>[l.id,text(obj(d.answers)[l.id],150)])),revealed:d.revealed===true}];});
 if(x.studyPlan){const s=obj(x.studyPlan);p.studyPlan={examDate:/^\d{4}-\d{2}-\d{2}$/.test(s.examDate)?s.examDate:'',dailyMinutes:integer(s.dailyMinutes,5,180),completedDays:arr(s.completedDays).filter(d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)).slice(-400)};}
 if(x.focusSession){const f=obj(x.focusSession),cardIds=ids(f.cardIds,cards,50);if(cardIds.length)p.focusSession={phase:['break','done'].includes(f.phase)?f.phase:'study',cardIds,completed:ids(f.completed,new Set(cardIds)),index:integer(f.index,0,cardIds.length-1),revealed:f.revealed===true,endsAt:num(f.endsAt),minutes:integer(f.minutes,1,180),...(typeof f.remainingMs==='number'?{remainingMs:num(f.remainingMs,0,10800000)}:{})};}
 if(x.comparison){const c=obj(x.comparison);if(cards.has(c.a)&&cards.has(c.b)&&c.a!==c.b)p.comparison={a:c.a,b:c.b,draft:text(c.draft),revealed:c.revealed===true,answer:text(c.answer,100),round:integer(c.round)};}
 if(x.updateSummary){const s=obj(x.updateSummary);p.updateSummary={cards:integer(s.cards),questions:integer(s.questions),reset:integer(s.reset)};}
 return p;
}
export function noteMistake(p:ProgressData,q:Question,answer:number,sure:boolean,now=Date.now()):ProgressData{
 if(answer===q.correct&&sure)return p;
 const old=p.mistakes?.[q.id];return{...p,mistakes:{...p.mistakes,[q.id]:{firstAt:old?.firstAt||now,lastAt:now,misses:(old?.misses||0)+1,note:old?.note||'',resolved:false}}};
}
const canonical=(s:string)=>s.normalize('NFKC').replace(/\s+/g,' ').trim();
const cardKey=(c:Card)=>canonical(c.front)+'\n'+canonical(c.back)+(c.review?'\nreview:'+c.review:'');
const qKey=(q:Question)=>canonical(q.prompt)+'\n'+canonical(q.explanation)+'\n'+canonical(q.options[q.correct]);
export function archiveExistingExam(p:ProgressData,questions:Question[],topics:Topic[]):ProgressData{
 const e=p.session?.exam;if(!e||e.finishedAt===undefined||(p.examHistory||[]).some(a=>a.id===String(e.startedAt)))return p;
 const rows=new Map<string,ExamAttempt['topics'][number]>();let correct=0,total=0,unanswered=0;
 for(const id of e.questionIds){const q=questions.find(q=>q.id===id);if(!q)continue;total++;const title=topics.find(t=>t.id===q.topicId)?.title||q.topicId,r=rows.get(title)||{title,correct:0,total:0,uncertain:0};r.total++;if(e.answers[id]===q.correct){correct++;r.correct++;}if(e.answers[id]===undefined)unanswered++;if(e.flagged.includes(id))r.uncertain++;rows.set(title,r);}
 if(!total)return p;return{...p,examHistory:[...(p.examHistory||[]),{id:String(e.startedAt),startedAt:e.startedAt,finishedAt:e.finishedAt,correct,total,unanswered,flagged:e.flagged.length,topics:[...rows.values()]}].slice(-100)};
}
export function migrateProgress(old:Guide,next:Guide,p:ProgressData):ProgressData{
 p=archiveExistingExam(p,old.questions,old.topics);
 const cardMap=new Map<string,string>(),qMap=new Map<string,string>();
 const oldCards=new Map(old.cards.map(c=>[cardKey(c),c])),oldQs=new Map(old.questions.map(q=>[qKey(q),q]));
 for(const c of next.cards){const before=oldCards.get(cardKey(c));if(before)cardMap.set(before.id,c.id);}
 for(const q of next.questions){const before=oldQs.get(qKey(q));if(before)qMap.set(before.id,q.id);}
 const mapAnswers=(a:Record<string,number>)=>Object.fromEntries(Object.entries(a).flatMap(([id,n])=>{const newId=qMap.get(id),before=old.questions.find(q=>q.id===id),after=next.questions.find(q=>q.id===newId);if(!before||!after)return[];const answer=n===-1?-1:after.options.findIndex(o=>canonical(o)===canonical(before.options[n]||''));return answer===-1&&n!==-1?[]:[[after.id,answer]];}));
 const rekey=<T>(values:Record<string,T>|undefined,map:Map<string,string>)=>Object.fromEntries(Object.entries(values||{}).flatMap(([id,v])=>map.has(id)?[[map.get(id)!,v]]:[]));
 const objectives=p.objectives?.map(o=>{const evidence=next.topics.flatMap(t=>t.evidence||[]);const unchanged=o.evidenceIds.length>0&&o.evidenceIds.every(id=>{const a=old.topics.flatMap(t=>t.evidence||[]).find(e=>e.id===id),b=evidence.find(e=>e.id===id);return a&&b&&canonical(a.text)===canonical(b.text)&&!b.review;});return{...o,status:unchanged?o.status:'unchecked' as const,evidenceIds:unchanged?o.evidenceIds:[]};});
 const out:ProgressData={...p,guideVersion:next.createdAt,known:p.known.flatMap(id=>cardMap.has(id)?[cardMap.get(id)!]:[]),review:p.review.flatMap(id=>cardMap.has(id)?[cardMap.get(id)!]:[]),answers:mapAnswers(p.answers),assessment:mapAnswers(p.assessment),practice:rekey(p.practice,qMap),mistakes:rekey(p.mistakes,qMap),recall:rekey(p.recall,cardMap),comparison:undefined,focusSession:undefined,objectives,session:{view:'guide',tab:'overview',full:false},updateSummary:{cards:cardMap.size,questions:qMap.size,reset:next.cards.length-cardMap.size}};
 return{...out,...validatedExtras(out,next)};
}
export function recallPoints(c:Card){return c.back.split(/\n\s*\n/).map(s=>s.trim()).filter(Boolean);}
export function questionHint(q:Question,level:number){if(level===1)return q.kind==='cause'?'Look for the cause in the passage, then distinguish it from the result.':q.kind==='comparison'?'Identify what each concept does, then compare their roles.':'Identify the defining action or property in the question before choosing a term.';let clue=q.explanation;for(const option of [...q.options].sort((a,b)=>b.length-a.length)){const escaped=option.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');if(escaped)clue=clue.replace(new RegExp(escaped,'gi'),'[concept]');}return 'Source clue: “'+clue.slice(0,500)+(clue.length>500?'…':'')+'” — '+(q.citations[0]?.name||'your material')+' · '+(q.citations[0]?.label||'the source section');}
export function objectiveMatches(text:string,g:Guide){const stop=new Set('the and for with from this that what which explain describe define understand compare discuss know how are was can you your about their'.split(' '));const words=(s:string)=>new Set((s.toLowerCase().match(/[a-z0-9]{3,}/g)||[]).filter(w=>!stop.has(w)));const query=words(text);if(!query.size)return[];return g.topics.flatMap(t=>(t.evidence||[]).filter(e=>!e.review).map(e=>{const content=words(t.title+' '+e.text),hits=[...query].filter(w=>content.has(w)).length;return{e,score:hits/query.size,hits,termMatch:!!e.term&&[...words(e.term)].length>0&&[...words(e.term)].every(w=>query.has(w))};})).filter(x=>x.termMatch||x.score>=.4&&x.hits>=Math.min(2,query.size)).sort((a,b)=>b.score-a.score).slice(0,3).map(x=>x.e);}
export function priorityCards(g:Guide,p:ProgressData,now=Date.now()){const weak=new Set(g.questions.filter(q=>{const r=p.practice?.[q.id];return r?!r.correct||!r.confident||r.dueAt<=now:p.assessment[q.id]!==undefined&&p.assessment[q.id]!==q.correct;}).map(q=>q.topicId));const score=(c:Card)=>p.review.includes(c.id)||weak.has(c.topicId)?0:!p.known.includes(c.id)?1:2;return [...g.cards].filter(c=>!c.review).sort((a,b)=>score(a)-score(b));}
export function sourceSequences(text:string,citation:Citation):Sequence[]{
 const lines=text.split(/\r?\n/),result:Sequence[]=[];let steps:string[]=[],title='Source order';
 const flush=()=>{if(steps.length>=2&&steps.length<=10&&/\b(step|process|procedure|sequence|stages?|cycle|order|method|protocol)\b/i.test(title)){let hash=2166136261;for(const ch of steps.join('\n'))hash=Math.imul(hash^ch.charCodeAt(0),16777619);result.push({id:'seq-'+(hash>>>0).toString(36),title:title.slice(0,180),steps:[...steps],citations:[citation]});}steps=[];};
 for(const line of lines){const m=line.trim().match(/^(?:step\s+)?(\d{1,2})[.)\s:-]+(.{5,500})$/i);if(m){const n=Number(m[1]);if(n===1){flush();steps=[m[2]];}else if(n===steps.length+1)steps.push(m[2]);else flush();}else if(line.trim()){flush();title=line.trim();}}
 flush();return result;
}
