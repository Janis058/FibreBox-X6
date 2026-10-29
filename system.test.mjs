import test from 'node:test';
import assert from 'node:assert/strict';
import {section} from './features.mjs';
import {systemPaths} from './system.mjs';
import {formatDuration,formatMaximum,formatIPVersion,formatState} from './public/system-format.js';

test('Systeminformationen lesen reale Werte, mehrere Leitungen und ausschliesslich globale LAN-IPv6-Adressen',async()=>{
 const values={serial:'SERIAL-FROM-ROUTER',uptime:587827,ipv4:true,ipv6:true,lanIP:'192.168.50.1',lanIPv6:[{IPAddress:'fe80::1'},{IPAddress:'2001:db8::1',IPAddressStatus:'PREFERRED'},{IPAddress:'2001:db8::2',IPAddressStatus:'DEPRECATED'},{IPAddress:'fd00::1'}],ipStatus:'Up',ipv4Duration:225955,wanType:'XGSPON',opticalStatus:'Up',wanStatus:'Up',wanDuration:90,ethernetWAN:[{MaxBitRate:10000}],bitrate:0,voice:{VoiceService:[{uid:44,VoiceProfiles:{VoiceProfile:[{uid:71,Lines:[{DirectoryNumber:'test-line-1',Status:'Registered',AuthPassword:'test-placeholder'},{DirectoryNumber:'test-line-2',Status:'Down'}]}]}}]}};
 const map=new Map(Object.entries(values).map(([k,v])=>[systemPaths[k],v]));const calls=[];
 const router={send:async actions=>actions.map(a=>{calls.push(a);return map.has(a.xpath)?{ok:true,callbacks:[{parameters:{value:map.get(a.xpath)}}]}:{ok:false,callbacks:[]};})};
 const info=await section(router,'system');assert.equal(info.device.serial,'SERIAL-FROM-ROUTER');assert.equal(info.device.gui,null);assert.equal(info.device.uptime,587827);assert.equal(info.wan.bitrate,0);assert.equal(info.wan.maximum,10000);assert.deepEqual(info.network.globalIPv6,['2001:db8::1']);assert.equal(info.lines.length,2);assert.equal(JSON.stringify(info).includes('test-placeholder'),false);assert.ok(calls.every(c=>c.method==='getValue'));assert.ok(calls.length<90);
 map.set(systemPaths.ipStatus,'Down');map.set(systemPaths.wanStatus,'Down');const disconnected=await section(router,'system');assert.equal(disconnected.network.ipv4Duration,null);assert.equal(disconnected.wan.duration,null);
});
test('Fehlende Systemdaten bleiben unbekannt; Nullwerte und Laufzeiten werden korrekt formatiert',async()=>{
 const router={send:async actions=>actions.map(()=>({ok:false,callbacks:[]}))};const info=await section(router,'system');assert.equal(info.device.serial,null);assert.deepEqual(info.lines,[]);assert.deepEqual(info.network.globalIPv6,[]);assert.equal(info.wan.maximum,null);
 assert.equal(formatDuration(587827),'6d 19h17m07s');assert.equal(formatDuration(0),'0d 00h00m00s');for(const value of [null,undefined,-1,'',NaN,false,' '])assert.equal(formatDuration(value),null);
 assert.equal(formatMaximum(10000),'10 Gbit/s');assert.equal(formatMaximum(-1),null);assert.equal(formatIPVersion(true,true),'IPv4/IPv6');assert.equal(formatIPVersion(true,null),null);assert.equal(formatState('Registered','voice'),'Registriert');assert.equal(formatState(false),'Deaktiviert');
});
