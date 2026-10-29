# Fibre Box X6 · lokale Verwaltung

Unabhängige Oberfläche für eine Salt Fibre Box X6. Kein offizielles Salt-Produkt. Modellfelder und Schreibrechte können je nach Firmware abweichen.

## Start

`Starten.cmd` doppelklicken und http://127.0.0.1:8787 öffnen. Node.js ab Version 22 erforderlich. Beim ersten Start ohne vorhandene Pakete wird die Bibliothek für lokale QR-Codes aus npm installiert. Alternativ `npm ci --ignore-scripts` und `npm start` im Projektordner ausführen.

Genau `127.0.0.1` verwenden, nicht `localhost`. Das Programm akzeptiert nur seine eigene lokale Adresse als Host. Der Server spricht standardmässig `http://192.168.50.1` an. Für eine andere private IPv4-Adresse vor dem Start in PowerShell setzen:

```powershell
$env:ROUTER_URL = 'http://192.168.50.1'
npm start
```

Mit den Zugangsdaten der Routerverwaltung anmelden. Es ist keine Anmeldung bei Salt. „Demo ansehen“ verwendet ausschliesslich erfundene Daten; alle dortigen Änderungen sind Simulationen und gehen verloren, wenn die Seite neu geladen oder die Demo beendet wird.

## Bereiche und Aktionen

| Bereich | Inhalt und Funktionen |
| --- | --- |
| Übersicht | Zahl aktiver Geräte, kompakter Zustandscheck mit anklickbaren Befunden und kleinen Erklärdialogen, manuell gestarteter Internet-Kurztest. |
| Geräte | Kacheln mit Name, IP, MAC, Reservierungsstatus, Verbindungsart, gemeldeten IPv6-Adressen. Suche nach Name/IP/MAC, optional inaktive Geräte. Namen werden über `setValue .../UserFriendlyName` im Router gespeichert und nachgelesen. |
| WLAN | Haupt- und Gastnetze ein-/ausschalten, Passwort ändern, QR-Code anzeigen. Nur tatsächlich lesbare dokumentierte Netze werden angeboten. |
| NAS | Dynamisch ermittelte Speicherdienste, Datenträger und SMB-Freigabe ein-/ausschalten. Bestehende Berechtigungen bleiben unverändert. |
| Website-Sperren | Vorhandene Regeln und Filter ein-/ausschalten. Neue Domainregel nur bei bestätigten Capability-Feldern `WebAccess`, `WebPage`, `Enable`. |
| VPN-Server | Bereits vorhandene IPsec-/L2TP-Server ein-/ausschalten. Keine Einrichtung neuer Benutzer, Schlüssel oder VPN-Profile. |
| Medien | Vorhandenen Medienserver ein-/ausschalten. Kein Kopieren von Mediendateien auf den Computer. |
| System | Tabellen für Geräteinformationen (Modell, Seriennummer, Hardware, Software, GUI und Laufzeit), Netzwerk (IPv4, Subnetz, Heimnetz-MAC, Gateway, lokale/globale LAN-IPv6-Adressen, IP-Version, NAT), Telefonleitungen und WAN (Typ, gemeldete Maximalrate, Status, Statusdauer, Bitrate). |

Der Zustandscheck prüft den gemeldeten WAN-Schnittstellenstatus, doppelte IPv4-Adressen verschiedener aktiver MAC-Adressen sowie Abweichungen zwischen aktueller und reservierter IP. Fehlende Daten werden als nicht prüfbar angezeigt. Es ist kein vollständiger Router-/Hardwarecheck und keine externe Prüfung der Internet-Erreichbarkeit. Unbelegte Temperatur-/Signalgrenzwerte werden nicht erfunden.

Systeminformationen werden nur beim Öffnen der Systemseite oder manuellem Aktualisieren gelesen. Deine Beispielwerte werden nicht fest eingetragen. Fehlende Felder bleiben „Nicht verfügbar“. Verbindungsdauern werden nur für einen gemeldeten Up-Zustand angezeigt; `UP` und `Up` sind gleichwertig. Globale IPv6-Adressen kommen aus der lokalen LAN-Schnittstelle, nicht aus WAN-Präfixen. Telefonleitungen werden aus dem aktuellen Modell ermittelt; SIP-Passwörter und sonstige Kontodaten werden nicht an den Browser weitergegeben.

Die aktuell geöffnete Unterseite wird nach zwei Minuten automatisch neu gelesen. Verdeckte Tabs, offene Dialoge, aktive Eingabefelder und ein laufender Speedtest pausieren diese Abfragen. Nach Rückkehr wird eine fällige Aktualisierung nachgeholt. Gerätefilter bleiben bei Hintergrundaktualisierungen erhalten. Laufzeiten zählen mit einer lokalen, monotonen Uhr sekündlich weiter und werden bei der nächsten erfolgreichen Routerabfrage neu abgeglichen; das Weiterzählen verursacht keine zusätzlichen Routeranfragen. Ohne aktuelle Messung sind es hochgerechnete Werte.

Der Internet-Kurztest läuft ausschliesslich auf manuellen Start. Er verwendet die festen Cloudflare-Endpunkte [`__down` und `__up`](https://github.com/cloudflare/speedtest) mit 12 MB Download und 4 MB zufälligen Uploaddaten sowie drei HTTP-Zeitmessungen. Der Server überträgt dabei keine Routerpasswörter oder Routerdaten. Cloudflare sieht die öffentliche IP-Adresse und die normalen Verbindungsdaten. Es wird keine Messhistorie gespeichert; das letzte Ergebnis liegt nur im Speicher der geöffneten Seite. Der Kurztest misst diesen Computer einschliesslich seiner Verbindung zum Router, ist kein Routerdiagnosetest und keine verlässliche Ausmessung eines 10-Gbit-Anschlusses. Die ausgewiesene HTTP-Antwortzeit ist kein ICMP-Ping. Im Demomodus wird nur ein ausdrücklich simuliertes Beispiel angezeigt.

Die maximale Rate bezeichnet die Ethernet-WAN-Schnittstelle, keine gemessene Internetgeschwindigkeit oder Vertragsleistung. `MaxBitRate` wird entsprechend dem [Broadband-Forum-Datenmodell](https://cwmp-data-models.broadband-forum.org/tr-181-2-20-0-cwmp.html) in Mbit/s interpretiert und bei Bedarf als Gbit/s angezeigt. Die herstellerspezifische Diagnose-Bitrate bleibt unverändert, da ihre Einheit nicht abgesichert ist. `LastChange` bezeichnet laut [Schnittstellenmodell](https://device-data-model.broadband-forum.org/) die Sekunden seit dem letzten Betriebszustandswechsel. Die tatsächliche Übernahme dieser Semantik durch die Firmware ist vor Ort zu prüfen.

Reservierungen werden aus den dokumentierten Standard- und Gastpools anhand aktiver MAC-Zuordnungen abgeglichen. Sind diese Pools nicht vollständig lesbar, bedeutet ein fehlender Treffer „nicht prüfbar“. Weitere herstellerspezifische Pools sind nicht abgedeckt.

## Speichern und Bestätigen

Alle Änderungen werden erst nach einer konkreten Aktion in der Oberfläche gesendet. Der Server bietet eine feste Liste zulässiger Aktionen und nimmt keine freien Methoden oder XPaths vom Browser an. IDs werden mit dem aktuellen Routermodell abgeglichen; keine UID aus der HAR wird als Geräte-ID übernommen.

Nach einer Schreibaktion werden die betroffenen Werte erneut gelesen. Bei Teilfehlern gibt es keine pauschale Erfolgsmeldung und kein automatisches Zurückschreiben. Falls ein Passwort nur maskiert zurückkommt, bestätigt die Oberfläche lediglich die Annahme durch den Router. Eine neue WLAN-Verbindung muss dann getestet werden.

WLAN ausschalten deaktiviert das ausgewählte AccessPoint-/SSID-Paar und lässt das gemeinsam verwendete Funkmodul und die anderen Netze unangetastet. Einschalten aktiviert bei Bedarf auch das Funkmodul; weitere aktivierte Netze können dadurch wieder senden. WLAN-Änderungen am besten über ein Netzwerkkabel ausführen.

Passwörter: 8–63 druckbare ASCII-Zeichen, keine XMO-Platzhalter. Für einen WPA2/WPA3-Mischmodus werden PSK und SAE gesetzt, ohne den Sicherheitsmodus zu ändern. Reines WPA3 verwendet SAE. Der QR-Code unterstützt WPA/WPA2-Personal und den kompatiblen Mischmodus, keine Enterprise- oder reinen WPA3-Netze. Wenn der Router keinen lesbaren Schlüssel liefert, kann das aktuelle Passwort nur für die Codeerzeugung eingegeben werden. Die tatsächliche Verbindung und Passwortgültigkeit kann ein QR-Code allein nicht prüfen.

Die Website-Sperrwirkung muss an einem verbundenen Gerät geprüft werden. Eine gespeicherte Domainregel ist keine Zusicherung für die Sperre von HTTPS, Unterdomains, Apps oder alternativen DNS-Zugängen. VPN-Verwaltung setzt eine vorhandene Konfiguration voraus; schalte einen VPN-Server nur mit den gewünschten Zugriffsrechten ein.

## Lokale Daten und Sicherheit

- Keine Netzwerkdaten, Namen, Regelkopien, WLAN-Passwörter oder QR-Codes in LocalStorage, SessionStorage, IndexedDB oder Dateien. Kein Service Worker, keine Telemetrie.
- Daten der geöffneten Seite bleiben vorübergehend im Arbeitsspeicher und werden beim Verlassen aus der Oberfläche verworfen. Ein QR-Code wird zusätzlich beim Schliessen seines Dialogs entfernt. Änderungen selbst bleiben ausschliesslich im Router bestehen.
- Die Anmeldung verwendet ein zufälliges HttpOnly-/SameSite-Sitzungscookie ohne festes Ablaufdatum. Browser können Sitzungscookies im Rahmen ihrer eigenen Sitzungswiederherstellung erhalten. Die Anwendung speichert keine Passwörter in Dateien; Browser-Passwortmanager stehen unter deiner Kontrolle.
- Hash, Nonce und Routersitzung verbleiben im Server-Arbeitsspeicher und werden nach neun Minuten lokaler Inaktivität entfernt. Diese Bereinigung kann nach dem Schliessen der Seite noch bis zum Ablauf ausstehen. Ein Prozessneustart löscht alle Sitzungen. Bei nicht erreichbarem Router kann dessen eigene Sitzung bis zu ihrem serverseitigen Ablauf bestehen bleiben.
- Nur Loopback-Bindung `127.0.0.1`, Host-/Origin-Prüfung, eigener Anfrageheader, JSON-Pflicht, feste Dateiliste, CSP und `Cache-Control: no-store`. Routerziel auf konfigurierte private IPv4-Adresse begrenzt; HTTP-Weiterleitungen abgelehnt.
- Standardmässig dokumentiertes HTTP im Heimnetz, keine Transportverschlüsselung zum Router. HTTPS wird mit regulärer Zertifikatsprüfung unterstützt. Keine abgeschaltete Zertifikatsprüfung.
- QR-Codes werden mit der lokal installierten Bibliothek [node-qrcode](https://github.com/soldair/node-qrcode) erzeugt; WLAN-Zugangsdaten werden an keinen externen QR-Dienst übertragen.

## Prüfung

`npm test` führt Tests mit nachgebildeten Routermodellen aus. Sie prüfen Authentisierung, Sitzung, lokale API-Sicherheit, tatsächliche Schreibpfade mit dynamischen UIDs, Reservierungsabgleich, WLAN-Schaltung, Passwortbehandlung, Teilfehler, QR-Payload und Website-Regeln. Sie ersetzen keine Prüfung mit echter Hardware. Details und konkret geprüfte Browserwege: `PRUEFUNG.md`.

Offen: Live-Anmeldung und Verhalten auf deiner konkreten X6-Firmware, tatsächliche WLAN-Verbindung nach Passwortwechsel, Sperrwirkung von Domainregeln, externe VPN-Verbindung sowie NAS-/Medienzugriff von einem anderen Gerät. Es wurden während der Entwicklung keine Einstellungen am echten Router verändert.
