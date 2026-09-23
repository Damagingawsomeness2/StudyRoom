import{imageTextReader}from'./ocr';
import{timeLabel}from'./lecture';
import type{LectureJob}from'./lecture-checkpoint';
// Sampling is explicit: brief slides and diagrams still need the original deck.
export const SCREEN_INTERVAL=5;
export async function readVideoScreen(file:File,duration:number,job:LectureJob,progress:(s:string)=>void,signal:AbortSignal){
 const video=document.createElement('video'),url=URL.createObjectURL(file),canvas=document.createElement('canvas'),tiny=document.createElement('canvas');
 video.muted=true;video.preload='auto';video.playsInline=true;tiny.width=32;tiny.height=18;
 const reader=imageTextReader(progress);let prior:Uint8ClampedArray|undefined;
 const abortable=<T>(promise:Promise<T>)=>new Promise<T>((resolve,reject)=>{const abort=()=>reject(new Error('Video processing paused.'));signal.addEventListener('abort',abort,{once:true});promise.then(resolve,reject).finally(()=>signal.removeEventListener('abort',abort));if(signal.aborted)abort();});
 const units=[...job.data.screenUnits],unreadable=[...job.data.unreadable];let attempts=job.data.screenAttempts,lastSaved=job.data.screenNext;
 const wait=(event:string,act:()=>void)=>new Promise<void>((resolve,reject)=>{
  const cleanup=()=>{clearTimeout(timer);video.removeEventListener(event,done);video.removeEventListener('error',error);signal.removeEventListener('abort',abort);};
  const done=()=>{cleanup();resolve();},error=()=>{cleanup();reject(new Error('This browser could not read video frames. Retry, or turn off on-screen text and upload the slides separately.'));},abort=()=>{cleanup();reject(new Error('Video processing paused.'));};
  const timer=setTimeout(error,30000);video.addEventListener(event,done,{once:true});video.addEventListener('error',error,{once:true});signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();else act();
 });
 const abort=()=>{void reader.close();};signal.addEventListener('abort',abort,{once:true});
 try{
  await wait('loadeddata',()=>{video.src=url;video.load();});
  const width=video.videoWidth,height=video.videoHeight;if(!width||!height)throw new Error('No video picture was found. Turn off on-screen text to use audio only.');
  canvas.width=Math.min(width,1600);canvas.height=Math.round(height*canvas.width/width);
  const context=canvas.getContext('2d')!,small=tiny.getContext('2d',{willReadFrequently:true})!;
  for(let second=job.data.screenNext;second<duration;second+=SCREEN_INTERVAL){
   if(signal.aborted)throw new Error('Video processing paused.');
   if(attempts>=480){unreadable.push({label:'On-screen text',reason:'Stopped after 480 different frames. Upload the slide deck for the remaining visual material.'});break;}
   const at=Math.min(duration-.05,second+.05);if(Math.abs(video.currentTime-at)>.01)await wait('seeked',()=>{video.currentTime=at;});
   small.drawImage(video,0,0,32,18);const pixels=small.getImageData(0,0,32,18).data;
   let changed=0;if(prior)for(let i=0;i<pixels.length;i+=4)if(Math.abs(pixels[i]-prior[i])+Math.abs(pixels[i+1]-prior[i+1])+Math.abs(pixels[i+2]-prior[i+2])>55)changed++;
   const distinct=!prior||changed/576>.025;
   if(distinct){
    prior=new Uint8ClampedArray(pixels);
    progress(`Reading on-screen text at ${timeLabel(second)} of ${timeLabel(duration)}…`);context.drawImage(video,0,0,canvas.width,canvas.height);attempts++;
    const found=await abortable(reader.read(canvas,'Video '+timeLabel(second))),text=found.text.trim(),canonical=text.toLowerCase().replace(/[^a-z0-9]+/g,'');
    if(text.length>=24&&/[a-z]{3}/i.test(text)&&!units.some(u=>u.text.toLowerCase().replace(/[^a-z0-9]+/g,'')===canonical))units.push({label:'On-screen · '+timeLabel(second),text,transcript:{start:second,end:Math.min(duration,second+SCREEN_INTERVAL),reviewed:false,kind:'screen'}});
   }
   if(distinct||second-lastSaved>=30){await job.save({screenUnits:units,screenAttempts:attempts,screenNext:Math.min(duration,second+SCREEN_INTERVAL),unreadable});lastSaved=second;}
  }
  await job.save({screenUnits:units,screenAttempts:attempts,screenNext:duration,screenDone:true,unreadable});
 }finally{signal.removeEventListener('abort',abort);await reader.close();video.removeAttribute('src');video.load();URL.revokeObjectURL(url);}
}
