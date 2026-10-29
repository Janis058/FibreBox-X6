import {randomBytes} from 'node:crypto';
export const DOWNLOAD_BYTES=12_000_000,UPLOAD_BYTES=4_000_000;
// Fixed Cloudflare measurement endpoints. No router credentials or URLs are forwarded.
export async function runSpeedtest({transport=fetch,now=()=>performance.now(),signal}={}){
 const request=async(path,options={})=>{
  const r=await transport('https://speed.cloudflare.com/'+path,{...options,headers:{'Accept-Encoding':'identity',...(options.headers||{})},redirect:'error',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(15000)]):AbortSignal.timeout(15000)});
  if(!r.ok)throw Error('Messserver antwortet nicht erfolgreich. Bitte später erneut versuchen.');return r;
 };
 const latencies=[];
 for(let i=0;i<3;i++){const start=now();const r=await request('__down?bytes=0');await r.arrayBuffer();latencies.push(now()-start);}
 const downloadStart=now(),response=await request(`__down?bytes=${DOWNLOAD_BYTES}`);let bytes=0;
 for await(const chunk of response.body){bytes+=chunk.length;if(bytes>DOWNLOAD_BYTES)throw Error('Unerwartete Datenmenge vom Messserver.');}
 if(bytes!==DOWNLOAD_BYTES)throw Error('Download unvollständig. Keine gültige Geschwindigkeitsmessung.');
 const downloadMs=now()-downloadStart;
 const payload=randomBytes(UPLOAD_BYTES),uploadStart=now();
 const uploaded=await request('__up',{method:'POST',body:payload,headers:{'Content-Type':'application/octet-stream'}});await uploaded.body?.cancel();
 const uploadMs=now()-uploadStart;
 if(downloadMs<=0||uploadMs<=0)throw Error('Messdauer zu kurz. Bitte erneut versuchen.');
 return {downloadMbps:Math.round(bytes*8/downloadMs/1000*10)/10,uploadMbps:Math.round(UPLOAD_BYTES*8/uploadMs/1000*10)/10,latencyMs:Math.round(latencies.sort((a,b)=>a-b)[1]),updatedAt:new Date().toISOString()};
}
