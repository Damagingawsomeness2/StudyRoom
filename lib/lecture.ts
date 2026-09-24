import{validatedReadingReport}from './reading-report.ts';
import{TRANSCRIPT_ISSUES,TRANSCRIPT_SOURCES}from './lecture-options.ts';
import type{LectureSummary,Parsed,TranscriptReading,Unit}from './study-types';
export const VIDEO_EXTENSIONS=['mp4','m4v','mov','webm'];
export const VIDEO_ACCEPT=VIDEO_EXTENSIONS.map(e=>'.'+e).join(',');
export const MAX_VIDEO_BYTES=1024*1024*1024;
export const MAX_LECTURE_SECONDS=3*60*60;
export const VIDEO_PART_BYTES=8*1024*1024;
export const isLecture=(name:string)=>VIDEO_EXTENSIONS.includes(name.split('.').pop()?.toLowerCase()||'');
export const videoMime=(kind:string)=>kind==='webm'?'video/webm':kind==='mov'?'video/quicktime':'video/mp4';
export function timeLabel(seconds:number){const n=Math.max(0,Math.floor(seconds)),h=Math.floor(n/3600),m=Math.floor(n%3600/60),s=n%60;return(h?h+':'+String(m).padStart(2,'0'):String(m))+':'+String(s).padStart(2,'0');}
export function validatedTranscript(value:unknown,duration=MAX_LECTURE_SECONDS):TranscriptReading|undefined{
 if(!value||typeof value!=='object')return;const x=value as Partial<TranscriptReading>;
 if(typeof x.start!=='number'||typeof x.end!=='number'||!Number.isFinite(x.start)||!Number.isFinite(x.end)||x.start<0||x.end<=x.start||x.end>duration+.1)return;
 const issues=Array.isArray(x.issues)?[...new Set(x.issues.filter(v=>TRANSCRIPT_ISSUES.includes(v)))]:[];
 return{start:x.start,end:Math.min(duration,x.end),reviewed:x.reviewed===true,...(x.kind==='screen'?{kind:'screen' as const}:{}),...(issues.length?{issues}:{}),...(x.source&&TRANSCRIPT_SOURCES.includes(x.source)?{source:x.source}:{})};
}
export function lectureSummary(units:Unit[],duration:number):LectureSummary{return{duration,units:units.filter(u=>u.transcript).length,needsReview:units.filter(u=>u.transcript&&!u.transcript.reviewed).length};}
export function lectureWarnings(units:Unit[],warnings:string[]=[]){const count=units.filter(u=>u.transcript&&!u.transcript.reviewed).length;return[...warnings.filter(w=>!w.startsWith('Lecture transcript:')),...(units.some(u=>u.transcript)?[`Lecture transcript: ${count?count+(count===1?' section needs':' sections need')+' checking before scored questions.':'Checked by you.'} Speech and screen-text recognition can miss terms, numbers, or negation. Check the video before relying on the extracted text.`]:[])];}
export function validatedLecture(value:unknown,duration:number):Parsed{
 if(!Number.isFinite(duration)||duration<=0||duration>MAX_LECTURE_SECONDS)throw new Error('Lectures must be no longer than 3 hours.');
 const x=value as Partial<Parsed>;
 if(!x||!Array.isArray(x.units)||!x.units.length||x.units.length>5000)throw new Error('No readable speech was found in this lecture.');
 let total=0,prior=-1;
 const units=x.units.map(u=>{const transcript=validatedTranscript(u?.transcript,duration);if(!transcript||typeof u.text!=='string'||u.text.trim().length<4||u.text.length>250000||transcript.start<prior)throw new Error('The lecture transcript could not be read. Try transcribing the video again.');prior=transcript.start;total+=u.text.length;return{label:transcript.kind==='screen'?'On-screen · '+timeLabel(transcript.start):timeLabel(transcript.start)+'–'+timeLabel(transcript.end),text:u.text.trim(),transcript:{...transcript,reviewed:false}};});
 if(total>5_000_000)throw new Error('Split this lecture into smaller videos.');
 const warnings=Array.isArray(x.warnings)?x.warnings.filter(w=>typeof w==='string'&&w.startsWith('Video screen reading:')).slice(0,1).map(w=>w.slice(0,500)):[];
 return{units,warnings:lectureWarnings(units,warnings),reading:validatedReadingReport(x.reading,units.map(u=>u.label))||{totalUnits:units.length,unreadable:[]}};
}
