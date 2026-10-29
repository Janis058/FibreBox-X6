import {isIP} from 'node:net';

// Documented XMO device-information paths. No sample values or HAR resource IDs.
export const systemPaths={
 model:'Device/DeviceInfo/ModelName',serial:'Device/DeviceInfo/SerialNumber',
 hardware:'Device/DeviceInfo/HardwareVersion',firmware:'Device/DeviceInfo/SoftwareVersion',
 gui:'Device/DeviceInfo/GUIFirmwareVersion',uptime:'Device/DeviceInfo/UpTime',
 lanIP:'Device/IP/Interfaces/Interface[Alias="IP_BR_LAN"]/IPv4Addresses/IPv4Address[Alias="IP_BR_LAN_ADDRESS"]/IPAddress',
 subnet:'Device/DHCPv4/Server/Pools/Pool[Alias="DEFAULT_POOL"]/SubnetMask',
 lanMAC:'Device/Ethernet/Links/Link[Alias="ETHLNK_BR_LAN"]/MACAddress',
 ipv4Duration:'Device/IP/Interfaces/Interface[Alias="IP_DATA"]/LastChange',
 gateway:'Device/IP/Interfaces/Interface[Alias="IP_DATA"]/IPv4Addresses/IPv4Address/IPGateway',
 linkLocal:'Device/IP/Interfaces/Interface[Alias="IP_BR_LAN"]/IPv6Addresses/IPv6Address[Alias="LINK_LOCAL"]/IPAddress',
 lanIPv6:'Device/IP/Interfaces/Interface[Alias="IP_BR_LAN"]/IPv6Addresses',
 ipv4:'Device/IP/IPv4Enable',ipv6:'Device/IP/IPv6Enable',
 nat:'Device/Managers/Network/NatInternetService',
 wanType:'Device/Managers/NetworkData/WanType',
 ipStatus:'Device/IP/Interfaces/Interface[Alias="IP_DATA"]/Status',
 opticalStatus:'Device/Optical/Interfaces/Interface[Alias="OPTICAL0"]/Status',
 ethernetWAN:'Device/Ethernet/Interfaces/Interface[Role="WAN"]',
 wanStatus:'Device/Ethernet/Interfaces/Interface[Role="WAN"]/Status',
 wanDuration:'Device/Ethernet/Interfaces/Interface[Role="WAN"]/LastChange',
 bitrate:'Device/Ethernet/Interfaces/Interface[Role="WAN"]/Diagnostics/CurrentBitRate',
 voice:'Device/Services/VoiceServices'
};
const simple=v=>['string','number','boolean'].includes(typeof v)?v:null;
const seconds=v=>['string','number'].includes(typeof v)&&String(v).trim()!==''&&Number.isSafeInteger(Number(v))&&Number(v)>=0?Number(v):null;
const isUp=v=>typeof v==='string'&&v.toLowerCase()==='up';
function primitives(value){if(Array.isArray(value))return value.flatMap(primitives);return [value];}
export async function systemInfo(router,{read,scalar,records}){
 const d=await read(router,Object.entries(systemPaths));
 const get=k=>simple(scalar(d[k]));
 const values=k=>d[k]?.callbacks?.flatMap(c=>primitives(c.parameters?.value))||[];
 const globalIPv6=[...new Set(records(values('lanIPv6'),v=>typeof v.IPAddress==='string').filter(v=>!v.IPAddressStatus||String(v.IPAddressStatus).toUpperCase()==='PREFERRED').map(v=>v.IPAddress).filter(ip=>isIP(ip)===6&&/^[23][0-9a-f]{3}:/i.test(ip)))];
 const lines=records(values('voice'),v=>'DirectoryNumber'in v).map(v=>({number:simple(v.DirectoryNumber),status:simple(v.Status)}));
 const wan=records(values('ethernetWAN'),v=>'MaxBitRate'in v||'CurrentBitRate'in v)[0];
 const ipStatus=get('ipStatus');
 const wanStatus=/PON/i.test(String(get('wanType')))?get('opticalStatus')??get('wanStatus'):get('wanStatus')??get('opticalStatus');
 return {
  device:{model:get('model'),serial:get('serial'),hardware:get('hardware'),firmware:get('firmware'),gui:get('gui'),uptime:seconds(get('uptime'))},
  network:{lanIP:get('lanIP'),subnet:get('subnet'),lanMAC:get('lanMAC'),ipv4Duration:isUp(ipStatus)?seconds(get('ipv4Duration')):null,ipStatus,gateway:values('gateway').map(simple).filter(v=>v!==null),linkLocal:get('linkLocal'),globalIPv6,ipv4:get('ipv4'),ipv6:get('ipv6'),nat:get('nat')},
  lines,
  wan:{type:get('wanType'),status:wanStatus,duration:isUp(get('wanStatus'))?seconds(get('wanDuration')):null,maximum:wan?simple(wan.MaxBitRate):null,bitrate:get('bitrate')}
 };
}
