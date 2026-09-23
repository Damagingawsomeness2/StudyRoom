import type { Citation } from './study-types';

const stop = new Set('a an the and or of to in on at for from with by as is are was were be been being this that these those it its they their has have had can could will would should may might also very more most each all into about than then'.split(' '));
const forms:Record<string,string>={testing:'test',tests:'test',tested:'test',checking:'check',checks:'check',checked:'check',methods:'method',methodology:'method',methodologies:'method',techniques:'method',technique:'method',using:'use',uses:'use',utilizes:'use',utilises:'use',components:'component',isolated:'isolation',independently:'isolation',requires:'require',required:'require',produces:'produce',producing:'produce',stores:'store',stored:'store',measures:'measure',measuring:'measure'};
export const matchingWords=(text:string)=>(text.toLowerCase().normalize('NFKC').match(/[\p{L}\p{N}]+/gu)||[]).map(w=>forms[w]||w).filter(w=>!stop.has(w));
export const topicName=(text:string)=>matchingWords(text.replace(/\s*\([A-Z][A-Z0-9-]{1,9}\)/g,'')).join(' ');
export function sentencePassages(text:string){return text.split(/\n+/).flatMap(line=>Array.from(new Intl.Segmenter('en',{granularity:'sentence'}).segment(line),s=>s.segment.trim())).filter(s=>s.length>=24&&s.length<=1800);}
const numberWords:Record<string,number>={zero:0,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,eighteen:18,nineteen:19,twenty:20,thirty:30,forty:40,fifty:50,sixty:60,seventy:70,eighty:80,ninety:90};
function quantities(text:string){
 const converted=text.toLowerCase().replace(/\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:[ -]+(?:hundred|thousand|and|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety))*\b/g,phrase=>{let n=0,total=0;for(const word of phrase.split(/[ -]+/)){if(word==='hundred')n=(n||1)*100;else if(word==='thousand'){total+=(n||1)*1000;n=0;}else n+=numberWords[word]||0;}return String(total+n);});
 return (converted.match(/[-+]?\d+(?:[.,]\d+)*/g)||[]).map(n=>n.replace(/,/g,'')).sort().join('|');
}
const negative=(text:string)=>/\b(?:not|no|never|without|cannot|can't|doesn't|don't|isn't|aren't|won't|mustn't)\b/i.test(text);
function nearWord(a:string,b:string){if(a.length<5||b.length<5||Math.abs(a.length-b.length)>2)return false;const row=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){let prior=row[0];row[0]=i;for(let j=1;j<=b.length;j++){const old=row[j];row[j]=Math.min(row[j]+1,row[j-1]+1,prior+(a[i-1]===b[j-1]?0:1));prior=old;}}return row[b.length]<=Math.min(2,Math.floor(Math.max(a.length,b.length)/4));}

export type PassageMatch={unitIndex:number;quote:string;reference:Citation;reasons:('numbers'|'negation'|'wording')[]};
export type PassageReference={text:string;citation:Citation};
export function referenceMatcher(references:PassageReference[]){
 const unique=[...new Map(references.map(r=>[r.citation.sourceId+'|'+r.citation.label+'|'+r.text,r])).values()];
 const rows=unique.slice(0,12000).map(r=>({...r,words:new Set(matchingWords(r.text).filter(w=>!/^\d+$/.test(w)&&!['not','no','never','without'].includes(w)))}));
 const index=new Map<string,number[]>();for(const [i,r]of rows.entries())for(const w of r.words){const ids=index.get(w)||[];ids.push(i);index.set(w,ids);}
 return(text:string,unitIndex=0,excludeSource?:string):PassageMatch[]=>{
  const words=new Set(matchingWords(text).filter(w=>!/^\d+$/.test(w)&&!['not','no','never','without'].includes(w))),counts=new Map<number,number>();
  for(const w of words)for(const i of index.get(w)||[])counts.set(i,(counts.get(i)||0)+1);
  return [...counts].filter(([i,n])=>n>=3&&rows[i].citation.sourceId!==excludeSource).map(([i,n])=>({r:rows[i],score:n/(words.size+rows[i].words.size-n),common:n})).sort((a,b)=>b.score-a.score).slice(0,8).flatMap(({r,score,common})=>{
   if(score<.56||common<4)return[];
   const reasons:PassageMatch['reasons']=[],a=quantities(text),b=quantities(r.text);
   if(a&&b&&a!==b)reasons.push('numbers');
   if(negative(text)!==negative(r.text))reasons.push('negation');
   const missing=[...words].filter(w=>!r.words.has(w)),extra=[...r.words].filter(w=>!words.has(w));
   if(!reasons.length&&score>=.62&&missing.some(w=>extra.some(v=>nearWord(w,v))))reasons.push('wording');
   return reasons.length?[{unitIndex,quote:text,reference:r.citation,reasons}]:[];
  }).slice(0,3);
 };
}

// Only an explicit introduction in the supplied material establishes an alias.
export function explicitAliases(texts:string[]){
 const pairs:[string,string][]=[];
 for(const text of texts){
  const acronym=text.match(/^(.{2,85}?)\s*\(([A-Z][A-Z0-9-]{1,9})\)\s+(?:is|are|means|refers to|consists of|involves)\b/);
  if(acronym)pairs.push([topicName(acronym[2]),topicName(acronym[1])]);
  const aka=text.match(/^(.{2,70}?)(?:,\s*|\s+)\(?also (?:known as|called)\s+(.{2,70}?)\)?(?:,\s*|\s+)(?:is|are|means|refers to)\b/i);
  if(aka)pairs.push([topicName(aka[2]),topicName(aka[1])]);
 }
 const candidates=new Map<string,Set<string>>();for(const[a,b]of pairs){if(!a||!b||a===b)continue;const set=candidates.get(a)||new Set<string>();set.add(b);candidates.set(a,set);}
 const result=new Map<string,string>();for(const[a,bs]of candidates)if(bs.size===1)result.set(a,[...bs][0]);return result;
}
