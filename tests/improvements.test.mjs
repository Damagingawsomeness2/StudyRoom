import assert from 'node:assert/strict';
import{referenceMatcher,explicitAliases,topicName}from'../lib/source-matching.ts';
import{generateGuide}from'../lib/study-engine.ts';
import{examQuestions,startExam,validatedExam,finishExam}from'../lib/exam.ts';
import{uploadLecture}from'../lib/upload-lecture.ts';
import{validatedLecture}from'../lib/lecture.ts';
const reference=text=>({text,citation:{sourceId:'notes',name:'Class notes',label:'Page 1',excerpt:text,quote:text}});
const compare=referenceMatcher([
 reference('A buffer stores 100 records before sending data to the server.'),
 reference('A semaphore does not allow unlimited access to the shared resource.'),
 reference('Chlorophyll is the green pigment that absorbs light energy in plants.')
]);
assert.deepEqual(compare('A buffer stores fifty records before sending data to the server.')[0].reasons,['numbers']);
assert.equal(compare('A buffer stores one hundred records before sending data to the server.').length,0);
assert(compare('A semaphore does allow unlimited access to the shared resource.')[0].reasons.includes('negation'));
assert(compare('Chlorophyl is the green pigment that absorbs light energy in plants.')[0].reasons.includes('wording'));
assert.equal(compare('A cloud is a visible mass of water droplets in the sky.').length,0);
assert.equal(compare('A buffer stores 50 records before sending data to the server.',0,'notes').length,0);
const duplicate=reference('A buffer stores 100 records before sending data to the server.');
assert.equal(referenceMatcher([duplicate,duplicate,duplicate])('A buffer stores fifty records before sending data to the server.').length,1,'Repeated citations produce one comparison');
assert.notEqual(topicName('Memory (volatile)'),topicName('Memory (nonvolatile)'),'Meaningful qualifiers must not disappear');
let aliases=explicitAliases(['Random access memory (RAM) is temporary working storage for a computer.','RAM is volatile working memory.']);
assert.equal(aliases.get('ram'),'random access memory');
aliases=explicitAliases(['Alpha beta (AB) is a fictional first concept.','Another branch (AB) is a different fictional concept.']);assert.equal(aliases.has('ab'),false,'Ambiguous acronyms stay separate');
aliases=explicitAliases(['Unit testing, also called component testing, is the practice of testing components in isolation.']);assert.equal(aliases.get('component test'),'unit test');
const source=(id,text,transcript)=>({material:{id,name:id+'.txt',kind:'txt',size:500,units:1,warnings:[]},parsed:{units:[{label:'Notes',text,...(transcript?{transcript}:{})}],warnings:[]}});
const build=sources=>generateGuide({id:'improvements',subject:'Software testing',focus:'',depth:'deep',mode:'materials'},sources);
const guide=build([
 source('notes','Testing methods\nUnit testing, also called component testing, is the practice of testing individual components in isolation.\nIntegration testing is the process of testing interactions between components.\nAcceptance testing is the process of checking software against user needs.'),
 source('lecture','Unit tests\nComponent testing is a method for checking a single component independently.')
]);
assert.equal(guide.cards.filter(c=>/Explain (?:Unit|Component) testing/i.test(c.front)).length,1,'Explicit aliases make one recall item');
assert(guide.cards.find(c=>/Explain Unit testing/i.test(c.front)).citations.length>=2,'Merged concept retains both source references');
const disagreement=build([source('typed','Buffers\nA buffer stores 100 records before sending data to the server.'),source('spoken','Buffers\nA buffer stores fifty records before sending data to the server.',{start:0,end:15,reviewed:true})]);
assert(disagreement.topics.flatMap(t=>t.evidence).some(e=>e.comparisons?.length),'Cross-source differences remain visible even after user review');
assert.equal(disagreement.questions.length,0);
const screen=validatedLecture({units:[{label:'ignored',text:'Integration testing checks interactions between components.',transcript:{start:30,end:60,reviewed:true,kind:'screen'}}],warnings:['Video screen reading: sampled every 30 seconds.']},90);
assert.equal(screen.units[0].label,'On-screen · 0:30');assert.equal(screen.units[0].transcript.kind,'screen');assert.equal(screen.units[0].transcript.reviewed,false);assert(screen.warnings[0].includes('30 seconds'));
const questions=Array.from({length:12},(_,i)=>({id:'q'+i,topicId:'t'+Math.floor(i/4),prompt:'Concept '+i,options:['A','B','C'],correct:i%3,explanation:'Source '+i,citations:[],evidenceIds:['e'+i]}));
const mixed=examQuestions(questions,6,()=>.5);assert.equal(new Set(mixed.slice(0,3).map(q=>q.topicId)).size,3);assert.equal(new Set(mixed.map(q=>q.id)).size,6);
assert.equal(examQuestions([...questions,{...questions[0],id:'alternate'}],50).length,12,'Two questions using the same evidence are not repeated');
const now=1000000,exam=startExam(questions,3,5,now);exam.answers[exam.questionIds[0]]=questions.find(q=>q.id===exam.questionIds[0]).correct;exam.flagged=[exam.questionIds[0]];
const restored=validatedExam({...exam,index:999,questionIds:[...exam.questionIds,'unknown'],answers:{...exam.answers,unknown:1,[exam.questionIds[1]]:900}},questions,now+400000);
assert.equal(restored.endsAt,exam.endsAt,'Reloading an expired exam cannot reset its timer');assert.equal(restored.index,2);assert.equal(Object.keys(restored.answers).length,1);
const progress={known:[],review:[],answers:{},assessment:{},assessed:false,session:{view:'guide',tab:'exam',full:false,exam:restored}};
const finished=finishExam(progress,questions,now+400000);assert.equal(finished.session.exam.finishedAt,exam.endsAt);assert.equal(Object.keys(finished.practice).length,3);assert.equal(finished.practice[exam.questionIds[0]].confident,false);assert.equal(finishExam(finished,questions),finished,'Resuming results cannot count the exam twice');
assert.equal(validatedExam({...exam,endsAt:Infinity},questions,now),undefined);
// Resume a multi-part upload without retransmitting acknowledged chunks.
const originalFetch=globalThis.fetch,calls=[];
const file=new File(['abcdefghij'],'resume.mp4'),job={data:{upload:{id:'saved-upload',parts:[{partNumber:1,etag:'one'}]}},async save(patch){this.data={...this.data,...patch};}};
globalThis.fetch=async(url,options)=>{calls.push([url,options?.method]);if(url==='/api/lectures/saved-upload'&&!options?.method)return Response.json({id:'saved-upload',partBytes:5});if(url.endsWith('/parts/2'))return Response.json({partNumber:2,etag:'two'});if(options?.method==='POST')return Response.json({id:'material'});throw new Error('Unexpected request '+url);};
assert.equal((await uploadLecture(file,{parsed:{units:[],warnings:[]},duration:5},()=>{},new AbortController().signal,job)).id,'material');assert.equal(calls.filter(([url])=>url.includes('/parts/')).length,1);assert.equal(job.data.upload.parts.length,2);
calls.length=0;globalThis.fetch=async(url,options)=>{calls.push([url,options?.method]);return Response.json({material:{id:'already-finished'}});};
assert.equal((await uploadLecture(file,{parsed:{units:[],warnings:[]},duration:5},()=>{},new AbortController().signal,job)).id,'already-finished');assert.equal(calls.length,1);
calls.length=0;job.data.upload.parts=[];globalThis.fetch=async(url,options)=>{calls.push([url,options?.method]);if(!options?.method)return Response.json({id:'saved-upload',partBytes:5});throw new Error('Network lost');};
await assert.rejects(()=>uploadLecture(file,{parsed:{units:[],warnings:[]},duration:5},()=>{},new AbortController().signal,job),/Network lost/);assert(!calls.some(([,method])=>method==='DELETE'),'Network failures preserve upload progress');
globalThis.fetch=originalFetch;
console.log('Source comparisons, conservative aliases, screen review, exam coverage/timer/results, and interrupted upload recovery passed.');
