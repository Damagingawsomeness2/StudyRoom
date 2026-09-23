export function byteRange(header:string|null,size:number):{offset:number;length:number}|false|undefined{
 if(!header)return;const match=header.match(/^bytes=(\d*)-(\d*)$/);if(!match||!match[1]&&!match[2])return false;
 if(!match[1]){const count=Number(match[2]);return Number.isSafeInteger(count)&&count>0?{offset:Math.max(0,size-count),length:Math.min(count,size)}:false;}
 const start=Number(match[1]),end=match[2]?Math.min(size-1,Number(match[2])):size-1;
 if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>=size||end<start)return false;return{offset:start,length:end-start+1};
}
