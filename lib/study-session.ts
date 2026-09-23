import type { Guide, ProgressData, StudySession } from './study-types';
import { diagnostic } from './study-engine.ts';
import { validatedExam } from './exam.ts';

export function withSession(progress:ProgressData, patch:Partial<StudySession>):ProgressData {
 return {...progress,session:{view:'guide',tab:'overview',full:false,...progress.session,...patch}};
}

// Saved positions refer to this guide's actual cards and questions only.
export function validatedSession(value:unknown,guide:Guide):StudySession|undefined {
 if(!value||typeof value!=='object'||Array.isArray(value))return;
 const x=value as Record<string,any>;
 const s:StudySession={view:x.view==='assessment'?'assessment':'guide',tab:['overview','cards','quiz','exam','coverage','sources','tools'].includes(x.tab)?x.tab:'overview',tool:typeof x.tool==='string'?x.tool.slice(0,40):undefined,full:x.full===true};
 const exam=validatedExam(x.exam,guide.questions);if(exam)s.exam=exam;
 const cards=new Set(guide.cards.map(c=>c.id)),questions=new Map(guide.questions.map(q=>[q.id,q]));
 const list=(v:unknown,ids:Set<string>)=>Array.isArray(v)?[...new Set(v.filter((id):id is string=>typeof id==='string'&&ids.has(id)))]:[];
 const index=(v:unknown,max:number)=>typeof v==='number'&&Number.isInteger(v)?Math.max(0,Math.min(v,max)):0;
 const selected=(v:unknown,count:number)=>typeof v==='number'&&Number.isInteger(v)&&v>=-1&&v<count?v:null;
 for(const scope of ['focus','full'] as const){
  const f=x.flashcards?.[scope];
  if(f&&typeof f==='object'){const order=list(f.order,cards);(s.flashcards??={})[scope]={order,index:index(f.index,Math.max(0,order.length-1)),flip:f.flip===true,reviewOnly:f.reviewOnly===true,draft:typeof f.draft==='string'?f.draft.slice(0,4000):''};}
  const q=x.quizzes?.[scope];
  if(q&&typeof q==='object'){
   const questionIds=list(q.questionIds,new Set(questions.keys())).slice(0,12),position=index(q.index,questionIds.length),results:Record<string,{answer:number;confident:boolean}>={};
   for(const id of questionIds){const r=q.results?.[id],answer=selected(r?.answer,questions.get(id)!.options.length);if(r&&answer!==null)results[id]={answer,confident:r.confident===true&&answer!==-1};}
   // Only completed questions may be skipped when restoring a saved cursor.
   const firstUnanswered=questionIds.findIndex(id=>!results[id]);
   const safeIndex=firstUnanswered>=0?Math.min(position,firstUnanswered):position;
   (s.quizzes??={})[scope]={questionIds,index:safeIndex,selected:selected(q.selected,questions.get(questionIds[safeIndex])?.options.length||0),confidence:typeof q.confidence==='boolean'?q.confidence:null,results,hints:Object.fromEntries(questionIds.filter(id=>q.hints?.[id]).map(id=>[id,Math.min(2,Math.max(0,Number(q.hints[id])||0))]))};
  }
 }
 if(x.check&&typeof x.check==='object'){const qs=diagnostic(guide),position=index(x.check.index,qs.length);s.check={started:x.check.started===true,index:position,selected:selected(x.check.selected,qs[position]?.options.length||0)};}
 return s;
}
