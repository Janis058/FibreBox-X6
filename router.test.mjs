import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import http from 'node:http';
import {Router,RouterError,parseReply} from './router.mjs';
import {createApp,routerAddress} from './server.mjs';
const success=parameters=>({reply:{error:{code:16777216},actions:[{id:0,error:{code:16777238},callbacks:[{result:{code:16777238},parameters}]}]}});
test('Formulartransport, SHA-512 und neue Nonce nach Login',async()=>{
 const calls=[];const r=new Router('http://192.168.50.1',async(url,init)=>{const request=JSON.parse(init.body.get('req')).request;calls.push(request);assert.equal(url,'http://192.168.50.1/cgi/json-req');assert.equal(init.redirect,'error');return {ok:true,json:async()=>success(calls.length===1?{id:72,nonce:'server-nonce'}:{value:123})};});
 await r.login('admin','test-only');await r.send([{method:'getValue',xpath:'Device/DeviceInfo/UpTime'}]);
 const h=s=>createHash('sha512').update(s).digest('hex');
 for(let i=0;i<2;i++){const c=calls[i];assert.equal(c.id,i);assert.equal(c['session-id'],i?72:'0');const ha1=h(`admin:${i?'server-nonce':''}:${h('test-only')}`);assert.equal(c['auth-key'],h(`${ha1}:${i}:${c.cnonce}:JSON:/cgi/json-req`));assert.ok(!JSON.stringify(c).includes('test-only'));}
});
test('HTTP-Erfolg verdeckt keine Callbackfehler; fehlende Aktionen bleiben unverfügbar',()=>{
 const data=success({value:1});data.reply.error.code=16777236;data.reply.actions[0].callbacks[0].result.code=16777262;
 assert.equal(parseReply(data,[{id:0}])[0].ok,false);assert.equal(parseReply(success({}),[{id:7}])[0].ok,false);
});
test('Sitzungsfehler werden erkannt',()=>{const d=success({});d.reply.actions[0].callbacks[0].result.description='XMO_SESSION_TIMEOUT_ERR';assert.throws(()=>parseReply(d,[{id:0}]),e=>e.expired);});
test('Verständliche Routerfehler behalten ihren Typ für die Benutzeroberfläche',()=>{assert.equal(new RouterError('Prüfmeldung').name,'RouterError');});
test('Routerziel ist auf private IPv4-Adressen beschränkt',()=>{assert.equal(routerAddress(),'http://192.168.50.1');for(const u of ['http://example.com','http://127.0.0.1','http://8.8.8.8','http://192.168.50.1/other','http://user:pass@192.168.50.1'])assert.throws(()=>routerAddress(u));});
test('Lokaler Server: Ursprung, Sitzung, Daten, Abmeldung und keine beliebigen Dateien',async()=>{
 class Mock {async login(){} async snapshot(){return {values:{},updatedAt:'test'};} async logout(){}}
 const app=createApp({RouterClass:Mock});await new Promise(r=>app.listen(0,'127.0.0.1',r));
 const url=`http://127.0.0.1:${app.address().port}`;
 try{
  assert.equal((await fetch(`${url}/api/snapshot`)).status,401);
  assert.equal((await fetch(`${url}/router.mjs`)).status,404);
  const hostileHost=await new Promise((resolve,reject)=>{http.get(url,{headers:{Host:'attacker.invalid'}},r=>{r.resume();resolve(r.statusCode);}).on('error',reject);});assert.equal(hostileHost,403);
  assert.equal((await fetch(`${url}/api/login`,{method:'POST',headers:{Origin:'http://attacker.invalid','Content-Type':'application/json'},body:'{}'})).status,403);
  const headers={Origin:url,'Content-Type':'application/json','X-Fibre-Console':'1'};
  const login=await fetch(`${url}/api/login`,{method:'POST',headers,body:JSON.stringify({user:'admin',password:'test'})});assert.equal(login.status,200);
  const cookie=login.headers.get('set-cookie');assert.match(cookie,/HttpOnly/);assert.match(cookie,/SameSite=Strict/);
  const authed={...headers,Cookie:cookie.split(';')[0]};
  assert.equal((await fetch(`${url}/api/snapshot`,{headers:authed})).status,200);
  assert.equal((await fetch(`${url}/api/logout`,{method:'POST',headers:authed,body:'{}'})).status,200);
  assert.equal((await fetch(`${url}/api/snapshot`,{headers:authed})).status,401);
 }finally{await new Promise(r=>app.close(r));}
});
