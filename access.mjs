import {BlockList,isIP} from 'node:net';
export const isLoopback=ip=>ip==='127.0.0.1'||ip==='::1'||ip==='::ffff:127.0.0.1';
const privateIP=ip=>{const n=ip.split('.').map(Number);return isIP(ip)===4&&(n[0]===10||n[0]===192&&n[1]===168||n[0]===172&&n[1]>=16&&n[1]<=31);};
export function accessPolicy({publicOrigin,allowedCIDRs='127.0.0.0/8'}={}){
 let configuredOrigin;
 if(publicOrigin){const u=new URL(publicOrigin);if(!['http:','https:'].includes(u.protocol)||!privateIP(u.hostname)||u.username||u.password||u.pathname!=='/'||u.search||u.hash)throw Error('PUBLIC_ORIGIN muss eine private IPv4-Adresse mit optionalem Port sein.');configuredOrigin=u.origin;}
 const ranges=new BlockList();
 for(const cidr of allowedCIDRs.split(',')){const [ip,prefix]=cidr.trim().split('/');const bits=Number(prefix);const minimum=ip?.startsWith('192.168.')?16:ip?.startsWith('172.')?12:8;if(!ip||!prefix||!Number.isInteger(bits)||bits<minimum||bits>32||(!privateIP(ip)&&!ip.startsWith('127.')))throw Error('ALLOWED_CIDRS darf nur private IPv4-Netze oder Loopback enthalten.');ranges.addSubnet(ip,bits,'ipv4');}
 return {configuredOrigin,allowed(ip){if(isLoopback(ip))return true;const v4=ip?.startsWith('::ffff:')?ip.slice(7):ip;return isIP(v4)===4&&ranges.check(v4,'ipv4');}};
}
