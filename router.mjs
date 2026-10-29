import {createHash, randomInt} from 'node:crypto';
const hash = value => createHash('sha512').update(value).digest('hex');
export const paths = {
 model:'Device/DeviceInfo/ModelName', firmware:'Device/DeviceInfo/SoftwareVersion', hardware:'Device/DeviceInfo/HardwareVersion', uptime:'Device/DeviceInfo/UpTime',
 optical:'Device/Optical/Interfaces/Interface[Alias="OPTICAL0"]/OpticalSignalLevel',
 hosts:'Device/Hosts/Hosts',
 ...Object.fromEntries(['RADIO2G4','RADIO5G'].flatMap((alias,i)=>['Status','Channel','OperatingChannelBandwidth','OperatingStandards'].map(field=>[`radio${i}_${field}`,`Device/WiFi/Radios/Radio[Alias="${alias}"]/${field}`])))
};
export class RouterError extends Error { constructor(message, expired=false) { super(message); this.name='RouterError'; this.expired=expired; } }
export function parseReply(data, actions) {
 const r=data?.reply;
 if (!r || !Array.isArray(r.actions)) throw new RouterError('Ungültige Routerantwort.');
 const expired = /XMO_(INVALID_SESSION|SESSION_LOGOUT|SESSION_TIMEOUT)_ERR/;
 if(expired.test(r.error?.description)) throw new RouterError('Sitzung abgelaufen. Bitte erneut anmelden.',true);
 if(![16777216,16777236].includes(r.error?.code)) throw new RouterError('Der Router hat die Anfrage abgelehnt.');
 return actions.map(a=>{
  const result=r.actions.find(x=>x.id===a.id);
  if(expired.test(result?.error?.description) || result?.callbacks?.some(c=>expired.test(c.result?.description))) throw new RouterError('Sitzung abgelaufen. Bitte erneut anmelden.',true);
  const callbacks=result?.callbacks;
  const ok=result?.error?.code===16777238 && Array.isArray(callbacks) && callbacks.length>0 && callbacks.every(c=>c.result?.code===16777238);
  return {ok, callbacks:ok?callbacks:[], error:ok?null:(result?.error?.description || 'Keine vollständige Antwort')};
 });
}
export class Router {
 constructor(url, transport=fetch) { this.url=url; this.transport=transport; this.index=0; this.session='0'; this.nonce=''; this.tail=Promise.resolve(); }
 async login(user,password) {
  this.user=user; this.secret=hash(password);
  const [r]=await this.send([{method:'logIn',parameters:{user,persistent:'true','session-options':{nss:[{name:'gtw',uri:'http://sagemcom.com/gateway-data'}],'context-flags':{'get-content-name':true,'local-time':true},'capability-depth':2,'capability-flags':{name:true,'default-value':true,restriction:true,description:true},'time-format':'ISO_8601','jwt-auth':'true','write-only-string':'_XMO_WRITE_ONLY_','undefined-write-only-string':'_XMO_UNDEFINED_WRITE_ONLY_'}}}]);
  const p=r.callbacks[0]?.parameters;
  if(!r.ok || !p || !['number','string'].includes(typeof p.id) || !p.id || p.id==='0' || typeof p.nonce!=='string') throw new RouterError('Anmeldung fehlgeschlagen. Benutzer und Passwort prüfen.');
  this.session=p.id; this.nonce=p.nonce;
 }
 send(actions) {
  const run=async()=>{
   const id=this.index++, cnonce=randomInt(0,4294967295);
   const ha1=hash(`${this.user}:${this.nonce}:${this.secret}`);
   const request={id,'session-id':this.session,priority:false,actions:actions.map((a,id)=>({...a,id})),cnonce,'auth-key':hash(`${ha1}:${id}:${cnonce}:JSON:/cgi/json-req`)};
   let response;
   try { response=await this.transport(`${this.url}/cgi/json-req`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8','Accept':'application/json'},body:new URLSearchParams({req:JSON.stringify({request})}),redirect:'error',signal:AbortSignal.timeout(15000)}); }
   catch { throw new RouterError('Router nicht erreichbar oder Zeitüberschreitung. Prüfe die Verbindung zum Heimnetz.'); }
   if(!response.ok) throw new RouterError(`Router antwortet mit HTTP ${response.status}.`);
   let data; try { data=await response.json(); } catch { throw new RouterError('Der Router hat kein gültiges JSON geliefert.'); }
   return parseReply(data,request.actions);
  };
  const pending=this.tail.then(run); this.tail=pending.then(()=>undefined,()=>undefined); return pending;
 }
 async snapshot() {
  const entries=Object.entries(paths);
  const results=await this.send(entries.map(([,xpath])=>({method:'getValue',xpath,options:{'capability-flags':{interface:true}}})));
  return {updatedAt:new Date().toISOString(),values:Object.fromEntries(entries.map(([key],i)=>[key,{available:results[i].ok,value:results[i].callbacks.map(c=>c.parameters?.value),error:results[i].error}]))};
 }
 async logout() { try { await this.send([{method:'logOut'}]); } finally { this.secret=''; this.nonce=''; this.session='0'; } }
}
