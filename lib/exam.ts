import type{ExamSession,Question,ProgressData,Topic}from'./study-types';
import{recordPractice}from'./study-engine.ts';
const shuffled=<T>(input:T[],random:()=>number)=>{const a=[...input];for(let i=a.length-1;i>0;i--){const j=Math.min(i,Math.floor(random()*(i+1)));[a[i],a[j]]=[a[j],a[i]];}return a;};
export function examQuestions(questions:Question[],count:number,random=Math.random){
 const topics=new Map<string,Question[]>(),seen=new Set<string>();
 for(const q of shuffled(questions,random)){
  const key=q.evidenceIds?.length?'e:'+[...q.evidenceIds].sort().join('|'):'p:'+q.prompt.toLowerCase().replace(/\W+/g,' ');
  if(seen.has(key))continue;seen.add(key);const a=topics.get(q.topicId)||[];a.push(q);topics.set(q.topicId,a);
 }
 const groups=shuffled([...topics.values()],random),result:Question[]=[];
 while(result.length<Math.min(50,count)&&groups.some(g=>g.length))for(const group of groups){if(result.length>=count)break;const q=group.shift();if(q)result.push(q);}
 return result;
}
export function startExam(questions:Question[],count:number,minutes:number,now=Date.now()):ExamSession{
 return{questionIds:examQuestions(questions,count).map(q=>q.id),startedAt:now,endsAt:now+Math.max(1,Math.min(120,minutes))*60000,index:0,answers:{},flagged:[]};
}
export function validatedExam(value:unknown,questions:Question[],now=Date.now()):ExamSession|undefined{
 if(!value||typeof value!=='object')return;const x=value as Partial<ExamSession>,map=new Map(questions.map(q=>[q.id,q]));
 if(typeof x.startedAt!=='number'||!Number.isFinite(x.startedAt)||x.startedAt<0||x.startedAt>now+60000||typeof x.endsAt!=='number'||!Number.isFinite(x.endsAt)||x.endsAt<=x.startedAt||x.endsAt-x.startedAt>7200000||!Array.isArray(x.questionIds))return;
 const questionIds=[...new Set(x.questionIds.filter(id=>typeof id==='string'&&map.has(id)))].slice(0,50);if(!questionIds.length)return;
 const answers:Record<string,number>={};for(const id of questionIds){const n=x.answers?.[id];if(typeof n==='number'&&Number.isInteger(n)&&n>=0&&n<map.get(id)!.options.length)answers[id]=n;}
 return{questionIds,startedAt:x.startedAt,endsAt:x.endsAt,index:typeof x.index==='number'&&Number.isInteger(x.index)?Math.max(0,Math.min(questionIds.length-1,x.index)):0,answers,flagged:Array.isArray(x.flagged)?[...new Set(x.flagged.filter(id=>questionIds.includes(id)))]:[],...(typeof x.finishedAt==='number'&&Number.isFinite(x.finishedAt)&&x.finishedAt>=x.startedAt?{finishedAt:Math.min(x.endsAt,now,x.finishedAt)}:{})};
}
export function finishExam(progress:ProgressData,questions:Question[],now=Date.now(),topics:Topic[]=[]):ProgressData{
 const exam=progress.session?.exam;if(!exam||exam.finishedAt!==undefined)return progress;
 let next=progress;for(const id of exam.questionIds){const q=questions.find(q=>q.id===id);if(q)next=recordPractice(next,q,exam.answers[id]??-1,!exam.flagged.includes(id)&&exam.answers[id]!==undefined,Math.min(now,exam.endsAt));}
 const rows=new Map<string,{title:string;correct:number;total:number;uncertain:number}>();let correct=0,unanswered=0;
 for(const id of exam.questionIds){const q=questions.find(q=>q.id===id);if(!q)continue;const title=topics.find(t=>t.id===q.topicId)?.title||q.topicId,r=rows.get(title)||{title,correct:0,total:0,uncertain:0};r.total++;if(exam.answers[id]===q.correct){correct++;r.correct++;}if(exam.answers[id]===undefined)unanswered++;if(exam.flagged.includes(id))r.uncertain++;rows.set(title,r);}
 const attempt={id:String(exam.startedAt),startedAt:exam.startedAt,finishedAt:Math.min(now,exam.endsAt),correct,total:exam.questionIds.length,unanswered,flagged:exam.flagged.length,topics:[...rows.values()]};
 return{...next,examHistory:[...(next.examHistory||[]).filter(a=>a.id!==attempt.id),attempt].slice(-100),session:{view:'guide',tab:'exam',full:false,...next.session,exam:{...exam,finishedAt:Math.min(now,exam.endsAt)}}};
}
