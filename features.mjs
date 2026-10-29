// Device paths and write targets are taken from fibre-box-api.md, B/C/D/E.
// Values and UIDs are always read from the current router, never from the HAR.
import {RouterError} from './router.mjs';
import {systemInfo} from './system.mjs';
export const hostRoot='Device/Hosts/Hosts';
const webRoot='Device/WebAccesses/WebRestriction';
export const truth=v=>v===true||v===1||v==='true';
const uid=v=>/^\d+$/.test(String(v))?String(v):null;
export function records(input,predicate) {
 const found=[];
 function walk(v,depth=0){if(!v||typeof v!=='object'||depth>15)return;if(!Array.isArray(v)&&predicate(v)){found.push(v);return;}for(const item of Object.values(v))walk(item,depth+1);}
 walk(input);return found;
}
function readOnly(cap) {return cap?.flags?.['read-only']===true;}
const cleanString=v=>typeof v==='string'?v:'';
export function scalar(r){return r?.ok?r.callbacks[0]?.parameters?.value:undefined;}
export function available(r){return !!r?.ok;}
export function writeable(r){return available(r)&&!readOnly(r.callbacks[0]?.parameters?.capability);}
export async function read(router,entries) {
 const result=await router.send(entries.map(([,xpath])=>({method:'getValue',xpath,options:{'capability-flags':{interface:true}}})));
 return Object.fromEntries(entries.map(([key,path],i)=>[key,{...result[i],path:result[i].callbacks[0]?.xpath||path}]));
}
function assertWrite(r){if(!writeable(r))throw new RouterError('Diese Einstellung ist auf deinem Router nicht verfügbar oder schreibgeschützt.');}
export async function apply(router,changes,{secret=false}={}) {
 for(const c of changes)assertWrite(c.current);
 const result=await router.send(changes.map(c=>({method:'setValue',xpath:c.current.path,parameters:{value:c.value}})));
 const succeeded=result.filter(r=>r.ok).length;
 if(succeeded!==changes.length)throw new RouterError(`Änderung nur teilweise oder nicht übernommen (${succeeded}/${changes.length} Aktionen bestätigt). Bitte den aktuellen Zustand neu laden; es wurde nichts automatisch zurückgesetzt.`);
 const checks=await read(router,changes.map((c,i)=>[String(i),c.current.path]));
 const verified=changes.every((c,i)=>scalar(checks[i])===c.value);
 return {verified,message:verified?'Im Router gespeichert und erneut ausgelesen.':secret?'Der Router hat die Änderung angenommen. Das Passwort wird maskiert oder lässt sich nicht erneut prüfen. Bitte eine neue WLAN-Verbindung testen.':'Der Router hat die Anfrage angenommen, aber der neue Wert ist noch nicht bestätigt. Bitte aktualisieren.'};
}
async function deviceData(router){
 const d=await read(router,[['hosts',hostRoot],['default','Device/DHCPv4/Server/Pools/Pool[Alias="DEFAULT_POOL"]/StaticAddresses'],['guest','Device/DHCPv4/Server/Pools/Pool[Alias="GUEST_POOL"]/StaticAddresses']]);
 const reservations=['default','guest'].flatMap(k=>records(d[k].callbacks?.map(c=>c.parameters?.value),v=>'Chaddr'in v&&'Yiaddr'in v));
 const list=records(d.hosts.callbacks?.map(c=>c.parameters?.value),v=>'PhysAddress'in v||'HostName'in v||'UserFriendlyName'in v);
 const mac=m=>cleanString(m).toLowerCase().replace(/-/g,':');
 return {available:available(d.hosts),reservationCoverage:['default','guest'].every(k=>available(d[k])),devices:list.map(h=>{
  const matching=reservations.filter(r=>truth(r.Enable)&&mac(r.Chaddr)&&mac(r.Chaddr)===mac(h.PhysAddress||h.MACAddress));
  return {id:uid(h.uid),name:h.UserFriendlyName||h.HostName||h.UserHostName||'Unbenanntes Gerät',hostname:h.HostName||'',ip:h.IPAddress||'',mac:h.PhysAddress||h.MACAddress||'',active:truth(h.Active),connection:h.InterfaceType||'',addressSource:h.AddressSource||'',reserved:matching.length?true:['default','guest'].every(k=>available(d[k]))?false:null,reservedIP:matching[0]?.Yiaddr||'',ipv6:records(h.IPv6Addresses,v=>'IPAddress'in v).map(v=>v.IPAddress).filter(v=>typeof v==='string')};
 })};
}
export const networks=[{id:'private24',name:'Hauptnetz, 2,4 GHz',ssid:'WL_PRIV_2G4',ap:'PRIV0',radio:'RADIO2G4'},{id:'private5',name:'Hauptnetz, 5 GHz',ssid:'WL_PRIV_5G',ap:'PRIV1',radio:'RADIO5G'},{id:'guest24',name:'Gastnetz, 2,4 GHz',ssid:'WL_GUEST_2G4',ap:'AP_GUEST_2G4',radio:'RADIO2G4'},{id:'guest5',name:'Gastnetz, 5 GHz',ssid:'WL_GUEST_5G',ap:'AP_GUEST_5G',radio:'RADIO5G'}];
function wifiPaths(n){const s=`Device/WiFi/SSIDs/SSID[Alias="${n.ssid}"]`,a=`Device/WiFi/AccessPoints/AccessPoint[Alias="${n.ap}"]`,r=`Device/WiFi/Radios/Radio[Alias="${n.radio}"]`;return [['ssid',s+'/SSID'],['ssidEnable',s+'/Enable'],['apEnable',a+'/Enable'],['radioEnable',r+'/Enable'],['mode',a+'/Security/ModeEnabled']];}
async function wifiData(router){
 const d=await read(router,networks.flatMap(n=>wifiPaths(n).map(([k,p])=>[n.id+'_'+k,p])));
 return {raw:d,networks:networks.map(n=>{const get=k=>d[n.id+'_'+k];const states=['ssidEnable','apEnable','radioEnable'].map(k=>scalar(get(k)));return {id:n.id,name:n.name,ssid:scalar(get('ssid'))??'',mode:scalar(get('mode'))??'',available:available(get('ssid')),enabled:states.every(v=>typeof v==='boolean')?states.every(truth):null,radioEnabled:scalar(get('radioEnable'))??null,canToggle:['ssidEnable','apEnable','radioEnable'].every(k=>writeable(get(k)))};})};
}
async function storageData(router){
 const discovered=await read(router,[['services','Device/Services/StorageServices']]);
 const services=records(discovered.services.callbacks?.map(c=>c.parameters?.value),v=>uid(v.uid)&&('NetworkServer'in v||'LogicalVolumes'in v));
 const entries=services.flatMap(s=>{const p=`Device/Services/StorageServices/StorageService[@uid="${uid(s.uid)}"]`;return [[`${s.uid}_smb`,p+'/NetworkServer/SMBEnable'],[`${s.uid}_volumes`,p+'/LogicalVolumes']];});
 const d=entries.length?await read(router,entries):{};
 return {raw:d,services:services.map(s=>({id:uid(s.uid),enabled:scalar(d[s.uid+'_smb'])??null,canToggle:writeable(d[s.uid+'_smb']),volumes:records(d[s.uid+'_volumes']?.callbacks?.map(c=>c.parameters?.value),v=>'Name'in v&&('Capacity'in v||'UsedSpace'in v||'Status'in v)).map(v=>({name:v.Name,status:v.Status??'Unbekannt',capacity:v.Capacity??null,used:v.UsedSpace??null}))})),available:available(discovered.services)};
}
async function webData(router){
 const d=await read(router,[['rules',webRoot],['enabled','Device/WebAccesses/WebRestrictionEnable']]);
 const rules=records(d.rules.callbacks?.map(c=>c.parameters?.value),v=>'WebPage'in v).map(v=>({id:uid(v.uid),domain:cleanString(v.WebPage),enabled:truth(v.Enable)}));
 const cap=d.rules.callbacks?.[0]?.parameters?.capability;
 const children=cap?.children||[];
 const child=children.find(c=>c.name==='WebAccess');
 const fields=new Set((child?.attributes||[]).map(a=>a.name));
 return {raw:d,available:available(d.rules),enabled:scalar(d.enabled)??null,canToggle:writeable(d.enabled),canAdd:!!child&&fields.has('WebPage')&&fields.has('Enable')&&!readOnly(child),rules};
}
async function vpnData(router){
 const data=await read(router,[['ipsec','Device/IPsec/RoadWarriorVPNs'],['l2tp','Device/VPN/RoadWarriorVPNs']]);
 const servers=[];
 for(const kind of ['ipsec','l2tp'])for(const s of records(data[kind].callbacks?.map(c=>c.parameters?.value),v=>uid(v.uid)&&'Enable'in v)){
  const path=`Device/${kind==='ipsec'?'IPsec':'VPN'}/RoadWarriorVPNs/RoadWarriorVPN[@uid="${uid(s.uid)}"]/Enable`;
  const d=await read(router,[['enabled',path]]);
  servers.push({id:`${kind}:${uid(s.uid)}`,name:kind==='ipsec'?'IPsec-Server':'L2TP/IPsec-Server',enabled:scalar(d.enabled)??null,canToggle:writeable(d.enabled),current:d.enabled});
 }
 return {servers,available:available(data.ipsec)||available(data.l2tp)};
}
export function health({wan,devices,devicesAvailable}){
 const issues=[];const unknown=[];
 if(wan===undefined||wan===null||wan==='')unknown.push('Internetstatus');else if(String(wan).toLowerCase()!=='up')issues.push({kind:'wan',label:'Internetverbindung',detail:`Router meldet „${String(wan)}“.`});
 if(!devicesAvailable)unknown.push('Geräteliste');
 const byIP=new Map();for(const d of devices.filter(d=>d.active&&d.ip&&d.ip!=='0.0.0.0')){if(!byIP.has(d.ip))byIP.set(d.ip,new Set());if(d.mac)byIP.get(d.ip).add(d.mac.toLowerCase());}
 for(const [ip,macs]of byIP)if(macs.size>1)issues.push({kind:'ip-conflict',label:'IP-Konflikt',detail:`${ip} wird von ${macs.size} aktiven Geräten gemeldet.`});
 for(const d of devices.filter(d=>d.active&&d.reserved&&d.reservedIP&&d.ip&&d.ip!==d.reservedIP))issues.push({kind:'reservation',label:d.name,detail:`Aktuell ${d.ip}, reserviert ist ${d.reservedIP}.`});
 return {issues,unknown,checked:['Internet-Schnittstellenstatus','Doppelte IPv4-Adressen','Abweichungen von IP-Reservierungen'],scope:'Kein vollständiger Hardware- oder Internettest. Es werden keine unbelegten Signal- oder Temperaturgrenzwerte verwendet.'};
}
export async function section(router,name){
 let data;
 if(name==='overview'){const devices=await deviceData(router);const d=await read(router,[['wan','Device/IP/Interfaces/Interface[Alias="IP_DATA"]/Status']]);data={deviceCount:devices.available?devices.devices.filter(d=>d.active).length:null,health:health({wan:scalar(d.wan),devices:devices.devices,devicesAvailable:devices.available})};if(!devices.reservationCoverage)data.health.unknown.push('Vollständiger Reservierungsabgleich');}
 else if(name==='devices')data=await deviceData(router);
 else if(name==='wifi'){data=await wifiData(router);delete data.raw;}
 else if(name==='nas'){data=await storageData(router);delete data.raw;}
 else if(name==='web'){data=await webData(router);delete data.raw;}
 else if(name==='vpn'){data=await vpnData(router);data.servers=data.servers.map(({current,...s})=>s);}
 else if(name==='media'){const d=await read(router,[['enabled','Device/UPnP/Device/UPnPMediaServer'],['name','Device/UPnP/Settings/UPnPMediaServer/FriendlyName']]);data={available:available(d.enabled),enabled:scalar(d.enabled)??null,canToggle:writeable(d.enabled),name:scalar(d.name)||'Medienserver'};}
 else if(name==='system')data=await systemInfo(router,{read,scalar,records});
 else throw new RouterError('Unbekannter Bereich.');
 return {...data,updatedAt:new Date().toISOString()};
}
const needBool=v=>{if(typeof v!=='boolean')throw new RouterError('Ungültiger Schaltwert.');return v;};
const safeUID=v=>{if(!uid(v))throw new RouterError('Ungültige Gerätekennung.');return uid(v);};
export function validPassword(p){return typeof p==='string'&&/^[\x20-\x7e]{8,63}$/.test(p)&&!p.includes('_XMO_');}
export function domainName(value){if(typeof value!=='string'||value.length>253)throw new RouterError('Bitte einen gültigen Domainnamen ohne Pfad eingeben.');const s=value.trim().toLowerCase();if(!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(s))throw new RouterError('Bitte eine Domain wie example.com eingeben, ohne https:// oder Pfad.');return s;}
export async function action(router,input){
 const {type}=input;
 if(type==='rename'){
  const id=safeUID(input.id);if(typeof input.name!=='string'||!input.name.trim()||input.name.trim().length>64||/[\x00-\x1f]/.test(input.name))throw new RouterError('Der Gerätename muss 1 bis 64 Zeichen lang sein.');
  const devices=await deviceData(router);if(!devices.devices.some(d=>d.id===id))throw new RouterError('Dieses Gerät ist nicht mehr im Router vorhanden.');
  const d=await read(router,[['name',`${hostRoot}/Host[@uid="${id}"]/UserFriendlyName`]]);return apply(router,[{current:d.name,value:input.name.trim()}]);
 }
 if(type==='wifi-toggle'){
  const n=networks.find(n=>n.id===input.id);if(!n)throw new RouterError('Unbekanntes WLAN.');const enabled=needBool(input.enabled);const d=await read(router,wifiPaths(n));
  // Turning off one SSID must not turn off the entire radio (including guest WLANs).
  const keys=enabled?['radioEnable','ssidEnable','apEnable']:['apEnable','ssidEnable'];
  return apply(router,keys.map(k=>({current:d[k],value:enabled})));
 }
 if(type==='wifi-password'){
  if(!validPassword(input.password))throw new RouterError('Wähle 8 bis 63 druckbare ASCII-Zeichen; Platzhalter sind nicht erlaubt.');
  const n=networks.find(n=>n.id===input.id);if(!n)throw new RouterError('Unbekanntes WLAN.');
  const base=`Device/WiFi/AccessPoints/AccessPoint[Alias="${n.ap}"]/Security`;
  const d=await read(router,[['mode',base+'/ModeEnabled'],['key',base+'/KeyPassphrase'],['sae',base+'/SAEPassphrase']]);
  const mode=String(scalar(d.mode)||'');if(!/WPA/i.test(mode)||/Enterprise|EAP/i.test(mode))throw new RouterError('Dieser Sicherheitsmodus unterstützt die Passwortänderung hier nicht.');
  const keys=/WPA3|SAE/i.test(mode)?(/WPA2/i.test(mode)?['key','sae']:['sae']):['key'];
  return apply(router,keys.map(k=>({current:d[k],value:input.password})),{secret:true});
 }
 if(type==='nas-toggle'){const d=await storageData(router);const s=d.services.find(s=>s.id===safeUID(input.id));if(!s)throw new RouterError('Speicherdienst nicht vorhanden.');return apply(router,[{current:d.raw[s.id+'_smb'],value:needBool(input.enabled)}]);}
 if(type==='media-toggle'){const d=await read(router,[['enabled','Device/UPnP/Device/UPnPMediaServer']]);return apply(router,[{current:d.enabled,value:needBool(input.enabled)}]);}
 if(type==='vpn-toggle'){const d=await vpnData(router);const s=d.servers.find(s=>s.id===input.id);if(!s)throw new RouterError('VPN-Server nicht vorhanden.');return apply(router,[{current:s.current,value:needBool(input.enabled)}]);}
 if(type==='web-toggle'){const d=await webData(router);return apply(router,[{current:d.raw.enabled,value:needBool(input.enabled)}]);}
 if(type==='web-rule-toggle'){const id=safeUID(input.id);const d=await webData(router);if(!d.rules.some(r=>r.id===id))throw new RouterError('Regel nicht mehr vorhanden.');const p=await read(router,[['enabled',`${webRoot}/WebAccess[@uid="${id}"]/Enable`]]);return apply(router,[{current:p.enabled,value:needBool(input.enabled)}]);}
 if(type==='web-add'){
  const domain=domainName(input.domain),before=await webData(router);if(!before.canAdd)throw new RouterError('Der Router bestätigt kein passendes Modell für neue Website-Sperren.');
  if(before.rules.some(r=>r.domain===domain))throw new RouterError('Diese Domain ist bereits eingetragen.');
  const [r]=await router.send([{method:'addChild',xpath:webRoot,parameters:{value:{WebAccess:{WebPage:domain,Enable:true}}}}]);
  if(!r.ok||r.callbacks.some(c=>c.parameters?.errors?.length))throw new RouterError('Die Regel konnte nicht bestätigt werden. Bitte aktualisieren.');
  const after=await webData(router);const verified=after.rules.some(r=>r.domain===domain&&r.enabled);
  return {verified,message:verified?`Regel für ${domain} gespeichert. ${after.enabled===true?'Die tatsächliche Sperrwirkung muss im Browser geprüft werden.':'Der Websitefilter ist noch ausgeschaltet.'}`:'Anlage angenommen, Regel beim erneuten Auslesen noch nicht bestätigt.'};
 }
 throw new RouterError('Unzulässige Aktion.');
}
export function wifiPayload({ssid,password,mode}){
 if(typeof ssid!=='string'||!ssid||Buffer.byteLength(ssid)>32)throw new RouterError('WLAN-Name nicht verfügbar.');
 if(!/WPA/i.test(mode)||/Enterprise|EAP/i.test(mode)||/WPA3/i.test(mode)&&!/WPA2/i.test(mode))throw new RouterError('QR-Code für diesen Sicherheitsmodus nicht unterstützt.');
 if(!validPassword(password))throw new RouterError('Passwort nicht lesbar oder maskiert. Gib das aktuelle WLAN-Passwort ein.');
 const escape=s=>s.replace(/[\\;,:\"]/g,'\\$&');return `WIFI:T:WPA;S:${escape(ssid)};P:${escape(password)};;`;
}
export async function qrCredentials(router,input){
 const n=networks.find(n=>n.id===input.id);if(!n)throw new RouterError('Unbekanntes WLAN.');
 const d=await read(router,[...wifiPaths(n),['key',`Device/WiFi/AccessPoints/AccessPoint[Alias="${n.ap}"]/Security/KeyPassphrase`]]);
 return wifiPayload({ssid:scalar(d.ssid),mode:scalar(d.mode),password:input.password||scalar(d.key)});
}
