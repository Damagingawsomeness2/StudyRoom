import type{Unit}from'./study-types';
import type{TranscriptIssue,TranscriptSource}from'./lecture-options';
import{timeLabel}from'./lecture.ts';
export type SpeechSegment={text:string;start:number;end:number;issues?:TranscriptIssue[];source?:TranscriptSource};
export function transcriptUnits(segments:SpeechSegment[]):Unit[]{
 const units:Unit[]=[];let group:SpeechSegment[]=[];
 const flush=()=>{if(!group.length)return;const start=group[0].start,end=Math.max(...group.map(s=>s.end)),text=group.map(x=>x.text.trim()).join(' ').replace(/\s+/g,' ').trim(),issues=[...new Set(group.flatMap(s=>s.issues||[]))];if(text.length>=4)units.push({label:timeLabel(start)+'–'+timeLabel(end),text,transcript:{start,end,reviewed:false,...(issues.length?{issues}:{}),...(group[0].source?{source:group[0].source}:{})}});group=[];};
 for(const segment of segments){if(!segment.text.trim()||segment.end<=segment.start)continue;if(group.length&&(segment.end-group[0].start>75||group.reduce((n,s)=>n+s.text.length,0)+segment.text.length>3500))flush();group.push(segment);if(/[.!?][”"']?$/.test(segment.text.trim())&&segment.end-group[0].start>=45)flush();}flush();return units;
}
function captionTime(value:string){const parts=value.trim().replace(',','.').split(':').map(Number);if(parts.some(x=>!Number.isFinite(x))||parts.length<2||parts.length>3)return NaN;return parts.reduce((n,x)=>n*60+x,0);}
export function readCaptions(text:string,duration:number):SpeechSegment[]{
 const lines=text.replace(/^\uFEFF/,'').replace(/\r/g,'').split('\n'),segments:SpeechSegment[]=[];
 for(let i=0;i<lines.length;i++){
  const match=lines[i].match(/^(\d+(?::\d+){1,2}[.,]\d+)\s+-->\s+(\d+(?::\d+){1,2}[.,]\d+)/);if(!match)continue;
  const start=captionTime(match[1]),end=Math.min(duration,captionTime(match[2])),body:string[]=[];i++;while(i<lines.length&&lines[i].trim()){body.push(lines[i]);i++;}
  const content=body.join(' ').replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/\s+/g,' ').trim();
  if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||start>=duration||end<=start||start<(segments.at(-1)?.start??-1))throw new Error('These captions have timestamps that do not match this video.');
  if(content&&content!==segments.at(-1)?.text)segments.push({start,end,text:content,source:'captions'});
 }
 if(!segments.length)throw new Error('No timed captions were found. Use an SRT or VTT file, or choose automatic transcription.');return segments;
}
export function speechSegments(result:{text?:string;chunks?:{text:string;timestamp:[number,number|null]}[]},offset:number,start:number,end:number,duration:number):SpeechSegment[]{
 return(result.chunks?.length?result.chunks:[{text:result.text||'',timestamp:[0,end-offset] as[number,number]}]).flatMap(c=>{
  const a=Math.max(0,offset+Number(c.timestamp?.[0]||0)),b=Math.min(duration,offset+(c.timestamp?.[1]??end-offset)),middle=(a+b)/2;
  if(!Number.isFinite(a)||!Number.isFinite(b)||b<=a||middle<start||middle>=end||typeof c.text!=='string'||!c.text.trim())return[];
  return[{text:c.text.trim(),start:a,end:b}];
 });
}
export function appendSpeechSegments(existing:SpeechSegment[],incoming:SpeechSegment[]):SpeechSegment[]{
 const result=[...existing];
 const clean=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
 for(const original of incoming){
  let next={...original};const previous=result.at(-1);
  // Trim only matching words with overlapping times. Actual repeated speech is retained.
  if(previous&&next.start<previous.end&&next.end>previous.start){
   const left=previous.text.match(/\S+/g)||[],right=[...next.text.matchAll(/\S+/g)];let overlap=0;
   for(let n=Math.min(20,left.length,right.length);n>=4;n--)if(left.slice(-n).every((w,i)=>clean(w)===clean(right[i][0]))){overlap=n;break;}
   if(overlap===right.length&&overlap)continue;
   if(overlap){next={...next,text:next.text.slice(right[overlap].index).trim(),start:Math.min(next.end-.01,Math.max(next.start,previous.end))};}
  }
  if(next.text&&next.end>next.start)result.push(next);
 }
 return result;
}
