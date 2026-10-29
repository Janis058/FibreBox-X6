import test from 'node:test';
import assert from 'node:assert/strict';
import QRCode from 'qrcode';
import {action,apply,section,health,validPassword,wifiPayload,domainName} from './features.mjs';
const good=(value,path)=>({ok:true,callbacks:[{xpath:path,result:{code:16777238},parameters:{value}}]});
function routerModel(initial){
 const values=new Map(Object.entries(initial)),calls=[];
 return {values,calls,send:async actions=>actions.map(a=>{calls.push(a);if(a.method==='getValue')return values.has(a.xpath)?good(values.get(a.xpath),a.xpath):{ok:false,callbacks:[]};if(a.method==='setValue'){values.set(a.xpath,a.parameters.value);return good(undefined,a.xpath);}return {ok:false,callbacks:[]};})};
}
test('Gerätenamen verwenden aktuelle UID und werden am Router geschrieben und verifiziert',async()=>{
 const root='Device/Hosts/Hosts',path=root+'/Host[@uid="91"]/UserFriendlyName';
 const r=routerModel({[root]:[{uid:91,PhysAddress:'aa:bb:cc:dd:ee:ff',HostName:'alt',Active:true}],[path]:'alt'});
 const result=await action(r,{type:'rename',id:'91',name:'Büro'});assert.equal(result.verified,true);assert.equal(r.values.get(path),'Büro');assert.equal(r.calls.filter(c=>c.method==='setValue').length,1);
 await assert.rejects(action(r,{type:'rename',id:'8',name:'falsche UID'}));await assert.rejects(action(r,{type:'rename',id:'91"]',name:'Injection'}));
});
test('Gerätekacheln gleichen MAC gegen aktive Reservierungen ab; fehlende Pools sind unbekannt',async()=>{
 const r=routerModel({'Device/Hosts/Hosts':[{uid:4,PhysAddress:'AA:BB:CC:DD:EE:FF',HostName:'Laptop',IPAddress:'192.168.50.4',Active:true}], 'Device/DHCPv4/Server/Pools/Pool[Alias="DEFAULT_POOL"]/StaticAddresses':[{uid:88,Chaddr:'aa:bb:cc:dd:ee:ff',Yiaddr:'192.168.50.4',Enable:true}]});
 let d=await section(r,'devices');assert.equal(d.devices[0].reserved,true);assert.equal(d.devices[0].id,'4');assert.equal(d.reservationCoverage,false);
 r.values.set('Device/DHCPv4/Server/Pools/Pool[Alias="DEFAULT_POOL"]/StaticAddresses',[]);d=await section(r,'devices');assert.equal(d.devices[0].reserved,null);
});
test('Unbekannte Werte werden nicht als gesund eingestuft; doppelte IP und WAN-Ausfall werden benannt',()=>{
 const unknown=health({devices:[],devicesAvailable:false});assert.deepEqual(unknown.unknown,['Internetstatus','Geräteliste']);
 assert.equal(health({wan:'UP',devices:[],devicesAvailable:true}).issues.length,0);
 const h=health({wan:'Down',devicesAvailable:true,devices:[{active:true,ip:'192.168.50.5',mac:'aa'},{active:true,ip:'192.168.50.5',mac:'bb'}]});assert.deepEqual(h.issues.map(i=>i.label),['Internetverbindung','IP-Konflikt']);
});
test('WLAN ausschalten lässt gemeinsames Funkmodul und Gastnetz unangetastet',async()=>{
 const ap='Device/WiFi/AccessPoints/AccessPoint[Alias="PRIV0"]/Enable',ssid='Device/WiFi/SSIDs/SSID[Alias="WL_PRIV_2G4"]/Enable',radio='Device/WiFi/Radios/Radio[Alias="RADIO2G4"]/Enable';
 const r=routerModel({[ap]:true,[ssid]:true,[radio]:true});const result=await action(r,{type:'wifi-toggle',id:'private24',enabled:false});assert.equal(result.verified,true);assert.equal(r.values.get(radio),true);assert.equal(r.values.get(ap),false);assert.equal(r.calls.filter(c=>c.method==='setValue').length,2);
});
test('WPA2/WPA3-Mischmodus ändert PSK und SAE, ohne Modus umzuschalten',async()=>{
 const base='Device/WiFi/AccessPoints/AccessPoint[Alias="PRIV0"]/Security';const r=routerModel({[base+'/ModeEnabled']:'WPA2-WPA3-Personal',[base+'/KeyPassphrase']:'_XMO_WRITE_ONLY_',[base+'/SAEPassphrase']:'_XMO_WRITE_ONLY_'});
 const result=await action(r,{type:'wifi-password',id:'private24',password:'test-password'});assert.equal(result.verified,true);assert.equal(r.values.get(base+'/SAEPassphrase'),'test-password');assert.equal(r.values.get(base+'/KeyPassphrase'),'test-password');assert.equal(r.values.get(base+'/ModeEnabled'),'WPA2-WPA3-Personal');
 assert.equal(validPassword('_XMO_WRITE_ONLY_'),false);assert.equal(validPassword('kurz'),false);
});
test('Maskierte Rücklesewerte und Teilfehler erzeugen keine falsche Erfolgsbestätigung',async()=>{
 const current={...good('_XMO_WRITE_ONLY_','known/path'),path:'known/path'};
 const masked={send:async acts=>acts.map(a=>good(a.method==='getValue'?'_XMO_WRITE_ONLY_':undefined,a.xpath))};assert.equal((await apply(masked,[{current,value:'new-password'}],{secret:true})).verified,false);
 const partial={send:async()=>[{ok:true,callbacks:[]},{ok:false,callbacks:[]}]};await assert.rejects(apply(partial,[{current,value:true},{current,value:true}]),/teilweise/);
 const readonly={...current,callbacks:[{parameters:{capability:{flags:{'read-only':true}}}}]};await assert.rejects(apply(masked,[{current:readonly,value:true}]),/schreibgeschützt/);
});
test('WLAN-QR: Sonderzeichen werden maskiert, keine Platzhalter oder Enterprise-Zugänge',async()=>{
 const payload=wifiPayload({ssid:'Mein;WLAN',password:'abc;def:123',mode:'WPA2-Personal'});assert.equal(payload,'WIFI:T:WPA;S:Mein\\;WLAN;P:abc\\;def\\:123;;');assert.match(await QRCode.toDataURL(payload),/^data:image\/png;base64,/);
 assert.throws(()=>wifiPayload({ssid:'Test',password:'_XMO_WRITE_ONLY_',mode:'WPA2-Personal'}));assert.throws(()=>wifiPayload({ssid:'Test',password:'12345678',mode:'WPA2-Enterprise'}));
});
test('Website-Regeln erfordern bestätigtes Modell und gültige Domain; keine freie RPC-Aktion',async()=>{
 assert.equal(domainName('Example.com'),'example.com');for(const x of ['https://example.com','example.com/path','localhost','*.example.com'])assert.throws(()=>domainName(x));
 const r=routerModel({'Device/WebAccesses/WebRestriction':[]});await assert.rejects(action(r,{type:'web-add',domain:'example.com'}),/Modell/);assert.equal(r.calls.some(c=>c.method==='addChild'),false);await assert.rejects(action(r,{type:'reboot'}),/Unzulässige/);
});
test('NAS und VPN schreiben nur an tatsächlich entdeckte UIDs; keine geheimen Werte im Ergebnis',async()=>{
 const storage='Device/Services/StorageServices/StorageService[@uid="37"]';
 const vpn='Device/IPsec/RoadWarriorVPNs/RoadWarriorVPN[@uid="82"]/Enable';
 const r=routerModel({'Device/Services/StorageServices':[{uid:37,NetworkServer:{SMBEnable:false}}],[storage+'/NetworkServer/SMBEnable']:false,[storage+'/LogicalVolumes']:[], 'Device/IPsec/RoadWarriorVPNs':[{uid:82,Enable:false,PresharedKey:'not-for-browser'}],[vpn]:false});
 assert.equal((await action(r,{type:'nas-toggle',id:'37',enabled:true})).verified,true);
 assert.equal((await action(r,{type:'vpn-toggle',id:'ipsec:82',enabled:true})).verified,true);
 const view=await section(r,'vpn');assert.equal(view.servers[0].id,'ipsec:82');assert.equal(JSON.stringify(view).includes('not-for-browser'),false);assert.equal(JSON.stringify(view).includes('current'),false);
 await assert.rejects(action(r,{type:'nas-toggle',id:'1',enabled:true}));
});
test('Neue Webregel wird nur mit Capability-Feldern angelegt und nachgelesen',async()=>{
 const root='Device/WebAccesses/WebRestriction';let rules=[];const cap={children:[{name:'WebAccess',attributes:[{name:'WebPage'},{name:'Enable'}]}]};
 const r={send:async actions=>actions.map(a=>{if(a.method==='getValue'){const result=good(a.xpath===root?rules:true,a.xpath);if(a.xpath===root)result.callbacks[0].parameters.capability=cap;return result;}if(a.method==='addChild'){assert.equal(a.xpath,root);assert.deepEqual(a.parameters.value,{WebAccess:{WebPage:'example.com',Enable:true}});rules=[{uid:42,...a.parameters.value.WebAccess}];return good(undefined,root);}throw Error('unexpected');})};
 assert.equal((await action(r,{type:'web-add',domain:'example.com'})).verified,true);
});
