export function formatDuration(value){
 if(!['number','string'].includes(typeof value)||String(value).trim()===''||!Number.isSafeInteger(Number(value))||Number(value)<0)return null;
 const s=Number(value),pad=v=>String(v).padStart(2,'0');
 return `${Math.floor(s/86400)}d ${pad(Math.floor(s%86400/3600))}h${pad(Math.floor(s%3600/60))}m${pad(s%60)}s`;
}
export function formatState(value,kind='switch'){
 if(value===null||value===undefined||value==='')return null;
 const state=String(value).toLowerCase();
 if(kind==='voice')return ({registered:'Registriert',unregistered:'Nicht registriert',registering:'Registrierung läuft',up:'Bereit',down:'Nicht bereit',disabled:'Deaktiviert',error:'Fehler'})[state]??String(value);
 if(kind==='connection')return ({up:'Verbunden',down:'Nicht verbunden',lowerlayerdown:'Verbindung unterbrochen',dormant:'Inaktiv',unknown:'Unbekannt',notpresent:'Nicht vorhanden',error:'Fehler'})[state]??String(value);
 return ({true:'Aktiviert',false:'Deaktiviert',enabled:'Aktiviert',disabled:'Deaktiviert',up:'Aktiviert',down:'Deaktiviert'})[state]??String(value);
}
export function formatIPVersion(v4,v6){
 if(typeof v4!=='boolean'||typeof v6!=='boolean')return null;
 return v4&&v6?'IPv4/IPv6':v4?'IPv4':v6?'IPv6':'IPv4 und IPv6 deaktiviert';
}
export function formatMaximum(value){
 if(!['number','string'].includes(typeof value)||String(value).trim()==='')return null;
 const n=Number(value);if(!Number.isFinite(n)||n<=0)return null;
 return n>=1000?`${(n/1000).toLocaleString('de-CH')} Gbit/s`:`${n.toLocaleString('de-CH')} Mbit/s`;
}
