export function elapsedSeconds(base,receivedAt,now){return Number(base)+Math.max(0,Math.floor((now-receivedAt)/1000));}
export function canRefresh({authenticated,demo,hidden,loading,dialogOpen,editing,speedRunning}){return (authenticated||demo)&&!hidden&&!loading&&!dialogOpen&&!editing&&!speedRunning;}
export function issueAdvice(issue){
 if(issue.kind==='wan'||issue.label==='Internetverbindung')return {causes:'Die Box meldet keine aktive Internetverbindung. Möglich sind eine unterbrochene Glasfaserverbindung, ein laufender Verbindungsaufbau oder eine Störung beim Anbieter.',check:'Prüfe die Internetanzeige an der Box und den festen Sitz des Glasfaserkabels, ohne den Stecker unnötig zu lösen. Lade danach die Übersicht erneut. Bleibt der Zustand bestehen, prüfe eine mögliche Salt-Störung.'};
 if(issue.kind==='ip-conflict'||issue.label==='IP-Konflikt')return {causes:'Mehrere als aktiv gemeldete Geräte verwenden dieselbe IPv4-Adresse mit unterschiedlichen MAC-Adressen. Das kann durch eine manuell gesetzte IP, eine unpassende DHCP-Reservierung oder veraltete Routereinträge entstehen.',check:'Öffne die Geräteseite und suche die genannte IP-Adresse. Prüfe feste Adressen und Reservierungen. Aktualisiere die Liste, bevor du Einstellungen änderst.'};
 if(issue.kind==='reservation')return {causes:'Die aktuelle IP-Adresse eines Geräts weicht von seiner aktiven Reservierung ab. Eine alte DHCP-Zuweisung, eine manuelle Geräteadresse oder eine kürzlich geänderte Reservierung sind mögliche Ursachen.',check:'Vergleiche auf der Geräteseite aktuelle und reservierte IP. Nutzt das Gerät DHCP, kann erneutes Verbinden helfen. Prüfe vorher, ob eine laufende Verbindung dadurch unterbrochen würde.'};
 return {causes:'Der gemeldete Wert passt nicht zum erwarteten Zustand. Die Meldung allein belegt noch keine bestimmte Ursache.',check:'Aktualisiere die Daten und prüfe den betreffenden Bereich. Fehlende Angaben sind keine bestätigte Störung.'};
}
const shapes={
 overview:'<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M9 9v12m4-5 2-3 3 1"/>',
 devices:'<rect x="2" y="4" width="14" height="11" rx="2"/><path d="M6 20h8m-4-5v5"/><rect x="17" y="9" width="5" height="12" rx="1.5"/><path d="M19 18h1"/>',
 wifi:'<path d="M3 7a15 15 0 0 1 18 0M6 11a10 10 0 0 1 12 0m-9 4a5 5 0 0 1 6 0"/><circle cx="12" cy="19" r="1"/>',
 nas:'<rect x="4" y="3" width="16" height="18" rx="3"/><path d="M4 12h16M8 7h6m-6 9h6"/><circle cx="17" cy="7" r=".7"/><circle cx="17" cy="16" r=".7"/>',
 web:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c-4 4-4 14 0 18m0-18c2 2 3 5 3 8M5.5 18.5l13-13"/>',
 vpn:'<path d="M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6z"/><rect x="8" y="10" width="8" height="7" rx="1.5"/><path d="M10 10V8a2 2 0 0 1 4 0v2m-2 3v1"/>',
 media:'<rect x="2" y="4" width="20" height="14" rx="2"/><path d="m10 8 5 3-5 3zM8 22h8m-4-4v4"/>',
 system:'<path d="m10 2-.6 3-2 .9-2.7-1.2-2 3.5 2.2 2v2.6l-2.2 2 2 3.5 2.7-1.2 2 .9.6 3h4l.6-3 2-.9 2.7 1.2 2-3.5-2.2-2v-2.6l2.2-2-2-3.5-2.7 1.2-2-.9L14 2z"/><circle cx="12" cy="12" r="3"/>'
};
export function navIcon(name){return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${shapes[name]||shapes.overview}</svg>`;}
