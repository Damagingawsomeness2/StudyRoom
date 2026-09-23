import{MAX_LECTURE_SECONDS,MAX_VIDEO_BYTES,timeLabel,lectureWarnings}from'./lecture';
import{transcriptUnits,readCaptions,speechSegments,type SpeechSegment}from'./transcript';
import type{Parsed}from'./study-types';
import type{LectureJob}from'./lecture-checkpoint';
import{readVideoScreen}from'./video-screen';
type SpeechResult={text?:string;chunks?:{text:string;timestamp:[number,number|null]}[]};
function speechReader(progress:(text:string)=>void,signal:AbortSignal){
 const worker=new Worker('/transcription/worker.js',{type:'module'});
 const ask=<T>(message:unknown,expected:string,transfer:Transferable[]=[],timeout=300000)=>new Promise<T>((resolve,reject)=>{
  let timer:ReturnType<typeof setTimeout>;const cleanup=()=>{clearTimeout(timer);worker.removeEventListener('message',receive);worker.removeEventListener('error',error);signal.removeEventListener('abort',abort);};
  const fail=(e:Error)=>{cleanup();reject(e);};const abort=()=>fail(new Error('Video processing cancelled.'));
  const error=(e:ErrorEvent)=>{console.error('Speech reader load failed:',e.message);fail(new Error('The speech reader could not load. Try again, or attach an SRT/VTT caption file.'));};
  const receive=(e:MessageEvent)=>{if(e.data.type==='progress')progress(e.data.message);else if(e.data.type==='error'){console.error('Speech reader failed:',e.data.message);fail(new Error('The speech reader could not finish. Try again, or attach an SRT/VTT caption file.'));}else if(e.data.type===expected){cleanup();resolve(e.data.result);}};
  worker.addEventListener('message',receive);worker.addEventListener('error',error);signal.addEventListener('abort',abort,{once:true});timer=setTimeout(()=>fail(new Error('The speech reader took too long. Try a shorter video or attach an SRT/VTT caption file.')),timeout);
  if(signal.aborted)abort();else worker.postMessage(message,transfer);
 });
 return{init:()=>ask<void>({type:'init'},'ready'),read:(audio:Float32Array)=>ask<SpeechResult>({type:'transcribe',audio},'result',[audio.buffer]),close:()=>worker.terminate()};
}
export async function extractLecture(file:File,progress:(text:string)=>void,signal:AbortSignal,job:LectureJob,captions?:File):Promise<{parsed:Parsed;duration:number}>{
 if(!file.size||file.size>MAX_VIDEO_BYTES)throw new Error('Choose a lecture video up to 1 GB.');
 if(job.data.parsed)return{parsed:job.data.parsed,duration:job.data.duration};
 const{Input,ALL_FORMATS,BlobSource,AudioBufferSink}=await import('mediabunny');
 const input=new Input({source:new BlobSource(file),formats:ALL_FORMATS});let reader:ReturnType<typeof speechReader>|undefined;
 const abort=()=>{reader?.close();input.dispose();};signal.addEventListener('abort',abort,{once:true});
 try{
  if(signal.aborted)throw new Error('Video processing cancelled.');progress('Opening your lecture…');
  const duration=await input.computeDuration();if(!Number.isFinite(duration)||duration<=0||duration>MAX_LECTURE_SECONDS)throw new Error('Choose a lecture no longer than 3 hours.');
  if(job.data.duration&&Math.abs(job.data.duration-duration)>.5)throw new Error('This recording does not match the saved progress. Choose the original video.');
  await job.save({duration});
  let segments:SpeechSegment[]=[...job.data.segments];const unreadable=[...job.data.unreadable];
  if(!job.data.speechDone&&captions){if(captions.size>2_000_000)throw new Error('This caption file is too large.');progress('Reading your lecture captions…');segments=readCaptions(await captions.text(),duration);}
  else if(!job.data.speechDone){
   const audio=await input.getPrimaryAudioTrack();if(!audio){if(!job.data.screen)throw new Error('No audio track was found. Attach matching SRT/VTT captions or enable on-screen text.');unreadable.push({label:'Lecture audio',reason:'No audio track was found. Only sampled on-screen text was read.'});}else{
   let decoded:AudioBuffer|undefined;
   if(!await audio.canDecode()){
    if(file.size>100*1024*1024||duration>20*60)throw new Error('This browser needs a shorter video for automatic transcription. Use Chrome or Edge on the hosted Studyroom site, or attach an SRT/VTT caption file.');
    progress('Reading the lecture audio for this browser…');
    try{decoded=await new OfflineAudioContext(1,1,16000).decodeAudioData(await file.arrayBuffer());}catch{throw new Error('This browser cannot decode the video’s audio. Export as MP4 with AAC audio or WebM with Opus audio, or attach captions.');}
   }
   const rate=decoded?.sampleRate||await audio.getSampleRate();if(rate<8000||rate>192000)throw new Error('Export this lecture as MP4 with AAC audio, or attach captions.');
   progress('Preparing speech reader for this device. Keep this tab open…');reader=speechReader(progress,signal);await reader.init();
   const sink=decoded?undefined:new AudioBufferSink(audio);
   for(let start=job.data.nextSecond;start<duration;start+=60){
    if(signal.aborted)throw new Error('Video processing cancelled.');const end=Math.min(duration,start+60),from=Math.max(0,start-5),to=Math.min(duration,end+5);
    progress(`Transcribing ${timeLabel(start)}–${timeLabel(end)} of ${timeLabel(duration)}. Keep this tab open…`);
    const context=new OfflineAudioContext(1,Math.ceil((to-from)*16000),16000),buffer=context.createBuffer(1,Math.ceil((to-from)*rate),rate),mono=buffer.getChannelData(0);
    let samples=0,energy=0;
    const packets=decoded?(async function*(){yield{buffer:decoded!,timestamp:0};})():sink!.buffers(from,to);
    for await(const packet of packets){
     if(signal.aborted)throw new Error('Video processing cancelled.');const channels=Array.from({length:packet.buffer.numberOfChannels},(_,i)=>packet.buffer.getChannelData(i)),offset=Math.round((packet.timestamp-from)*rate);
     for(let n=Math.max(0,-offset);n<packet.buffer.length&&offset+n<mono.length;n++){let v=0;for(const channel of channels)v+=channel[n]/channels.length;mono[offset+n]=v;energy+=v*v;samples++;}
    }
    // Avoid feeding empty/silent windows to a speech model, which can invent speech.
    if(!samples||Math.sqrt(energy/samples)<.001){unreadable.push({label:timeLabel(start)+'–'+timeLabel(end),reason:'No clear audio was detected in this interval. Listen to check for quiet speech.'});await job.save({segments,unreadable,nextSecond:end});continue;}
    const source=context.createBufferSource();source.buffer=buffer;source.connect(context.destination);source.start();const pcm=(await context.startRendering()).getChannelData(0).slice();
    const result=await reader.read(pcm),found=speechSegments(result,from,start,end,duration);segments.push(...found);if(!found.length)unreadable.push({label:timeLabel(start)+'–'+timeLabel(end),reason:'No speech was transcribed in this interval. Listen to check for missed material.'});
    await job.save({segments,unreadable,nextSecond:end});
   }
   }
  }
  if(!job.data.speechDone)await job.save({segments,unreadable,nextSecond:duration,speechDone:true});
  reader?.close();reader=undefined;
  if(job.data.screen&&!job.data.screenDone)await readVideoScreen(file,duration,job,progress,signal);
  const units=[...transcriptUnits(segments),...job.data.screenUnits].sort((a,b)=>a.transcript!.start-b.transcript!.start);if(!units.length)throw new Error('No usable lecture text was found. Try a clearer recording or attach its SRT/VTT captions.');
  const warnings=job.data.screen?['Video screen reading: sampled every 5 seconds, up to 480 changed frames. Brief slides, diagrams, handwriting, and formulas may be missed. Upload the original slides for better coverage.']:[];
  const parsed={units,warnings:lectureWarnings(units,warnings),reading:{totalUnits:units.length+job.data.unreadable.length,unreadable:job.data.unreadable}};
  await job.save({parsed});return{duration,parsed};
 }finally{signal.removeEventListener('abort',abort);reader?.close();input.dispose();}
}
