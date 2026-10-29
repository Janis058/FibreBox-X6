import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {Router} from './router.mjs';
import {section,action,qrCredentials} from './features.mjs';
import QRCode from 'qrcode';
import {runSpeedtest} from './speedtest.mjs';
import {accessPolicy,isLoopback} from './access.mjs';

export function routerAddress(value='http://192.168.50.1') {
 const u=new URL(value); const octets=u.hostname.split('.').map(Number);
 const privateIP=octets.length===4 && octets.every(n=>Number.isInteger(n)&&n>=0&&n<=255) && (octets[0]===10 || octets[0]===192&&octets[1]===168 || octets[0]===172&&octets[1]>=16&&octets[1]<=31);
 if(!privateIP || !['http:','https:'].includes(u.protocol) || u.username || u.password || u.pathname!=='/' || u.search || u.hash) throw new Error('ROUTER_URL muss eine private IPv4-Adresse ohne Pfad sein.');
 return u.origin;
}
export function createApp({target=routerAddress(process.env.ROUTER_URL),RouterClass=Router,publicOrigin=process.env.PUBLIC_ORIGIN,allowedCIDRs=process.env.ALLOWED_CIDRS}={}) {
 const access=accessPolicy({publicOrigin,allowedCIDRs});
 const sessions=new Map(), attempts=[]; const ttl=9*60*1000;
 let speedRunning=false,lastSpeedStart=0;
 const demoQR=QRCode.toDataURL('WIFI:T:WPA;S:X6-Demo;P:beispielpasswort;;',{width:320,margin:4,errorCorrectionLevel:'M'});
 const server=http.createServer(async(req,res)=>{
  const origin=access.configuredOrigin||`http://127.0.0.1:${server.address().port}`;
  const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"};
  const json=(status,data,extra={})=>{res.writeHead(status,{...headers,'Content-Type':'application/json; charset=utf-8',...extra});res.end(JSON.stringify(data));};
  if(req.method==='GET'&&req.url==='/healthz'&&isLoopback(req.socket.remoteAddress)){res.writeHead(204,headers);return res.end();}
  if(!access.allowed(req.socket.remoteAddress))return json(403,{error:'Zugriff ist nur aus dem konfigurierten lokalen Netzwerk erlaubt.'});
  if(req.headers.host!==new URL(origin).host) return json(403,{error:'Unzulässiger Host. Öffne die angezeigte lokale Adresse.'});
  if(req.method==='POST' && (req.headers.origin!==origin || req.headers['content-type']!=='application/json' || req.headers['x-fibre-console']!=='1')) return json(403,{error:'Anfrageursprung abgelehnt.'});
  const cookie=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('fibre_session='))?.slice(14);
  const entry=sessions.get(cookie);
  try {
   if(req.method==='GET' && req.url==='/api/status') return json(200,{authenticated:!!entry&&Date.now()-entry.last<ttl,router:target,measurementLocation:access.configuredOrigin?'server':'local'});
   if(req.method==='GET' && req.url==='/api/demo-qr') return json(200,{image:await demoQR});
   if(req.method==='POST' && req.url==='/api/login') {
    while(attempts.length && Date.now()-attempts[0]>60000) attempts.shift();
    if(attempts.length>=5) return json(429,{error:'Zu viele Anmeldeversuche. Bitte eine Minute warten.'});
    attempts.push(Date.now()); let body=''; for await(const chunk of req) {body+=chunk; if(body.length>4096) return json(413,{error:'Anfrage zu gross.'});}
    let input; try {input=JSON.parse(body);} catch {return json(400,{error:'Ungültige Eingabe.'});}
    if(typeof input.user!=='string'|| !input.user.trim() || input.user.length>100 || typeof input.password!=='string'||input.password.length>512) return json(400,{error:'Benutzer und Passwort prüfen.'});
    const router=new RouterClass(target); await router.login(input.user.trim(),input.password);
    if(entry) {sessions.delete(cookie); void entry.router.logout().catch(()=>{});}
    const token=randomBytes(32).toString('hex'); sessions.set(token,{router,last:Date.now(),operations:Promise.resolve()});
    return json(200,{authenticated:true},{'Set-Cookie':`fibre_session=${token}; HttpOnly; SameSite=Strict; Path=/`});
   }
   if(req.url?.startsWith('/api/')) {
    if(!entry || Date.now()-entry.last>=ttl) {sessions.delete(cookie);return json(401,{error:'Bitte am Router anmelden.'});}
    entry.last=Date.now();
    if(req.method==='POST'&&req.url==='/api/speedtest'){
     if(speedRunning||Date.now()-lastSpeedStart<30000)return json(429,{error:'Bitte warte kurz, bevor du einen weiteren Speedtest startest.'});
     speedRunning=true;lastSpeedStart=Date.now();const abort=new AbortController();res.on('close',()=>{if(!res.writableEnded)abort.abort();});
     try{return json(200,await runSpeedtest({signal:abort.signal}));}catch{return json(502,{error:'Speedtest nicht abgeschlossen. Prüfe deine Internetverbindung oder versuche es später erneut.'});}finally{speedRunning=false;}
    }
    if(req.method==='GET' && req.url==='/api/snapshot') return json(200,await entry.router.snapshot());
    // Keep complete read/write/read operations in order, including concurrent tabs.
    const serial=fn=>{const p=entry.operations.then(fn);entry.operations=p.then(()=>undefined,()=>undefined);return p;};
    if(req.method==='GET' && /^\/api\/section\/(overview|devices|wifi|nas|web|vpn|media|system)$/.test(req.url)) return json(200,await serial(()=>section(entry.router,req.url.split('/').at(-1))));
    if(req.method==='POST' && ['/api/action','/api/qr'].includes(req.url)){
     let body='';for await(const chunk of req){body+=chunk;if(body.length>4096)return json(413,{error:'Anfrage zu gross.'});}
     let input;try{input=JSON.parse(body);}catch{return json(400,{error:'Ungültige Eingabe.'});}
     if(!input||typeof input!=='object'||Array.isArray(input))return json(400,{error:'Ungültige Eingabe.'});
     if(req.url==='/api/action')return json(200,await serial(()=>action(entry.router,input)));
     const payload=await serial(()=>qrCredentials(entry.router,input));
     return json(200,{image:await QRCode.toDataURL(payload,{width:320,margin:4,errorCorrectionLevel:'M'})});
    }
    if(req.method==='POST' && req.url==='/api/logout') {sessions.delete(cookie); await entry.router.logout(); return json(200,{authenticated:false},{'Set-Cookie':'fibre_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'});}
    return json(404,{error:'Funktion nicht vorhanden.'});
   }
   const files={'/':['index.html','text/html'],'/app.js':['app.js','text/javascript'],'/system-format.js':['system-format.js','text/javascript'],'/ui-helpers.js':['ui-helpers.js','text/javascript'],'/style.css':['style.css','text/css']};
   if(req.method!=='GET'||!files[req.url]) return json(404,{error:'Seite nicht gefunden.'});
   const [file,type]=files[req.url];res.writeHead(200,{...headers,'Content-Type':`${type}; charset=utf-8`});res.end(await readFile(new URL(`public/${file}`,import.meta.url)));
  } catch(e) {if(e.expired) sessions.delete(cookie); json(e.expired?401:502,{error:e.name==='RouterError'?e.message:'Die Anfrage konnte nicht abgeschlossen werden.'});}
 });
 const timer=setInterval(()=>{for(const [key,s]of sessions)if(Date.now()-s.last>=ttl){sessions.delete(key);void s.router.logout().catch(()=>{});}},30000); timer.unref();server.on('close',()=>clearInterval(timer));
 return server;
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
 const port=Number(process.env.PORT||8787),host=process.env.BIND_HOST||'127.0.0.1';
 if(host!=='127.0.0.1'&&(!process.env.PUBLIC_ORIGIN||!process.env.ALLOWED_CIDRS))throw Error('Netzwerkbetrieb benötigt PUBLIC_ORIGIN und ALLOWED_CIDRS.');
 createApp().listen(port,host,()=>console.log(`Fibre Box X6: ${process.env.PUBLIC_ORIGIN||`http://127.0.0.1:${port}`}`));
}
