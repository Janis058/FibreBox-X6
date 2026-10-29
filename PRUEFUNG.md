# Prüfstatus der Browser-Kopie

Die Browser-Kopie enthält die automatisierten Tests der lokalen Anwendung und nur neutrale Beispieladressen und Testwerte. `npm test` prüft Authentisierung, Sitzungen, lokale API-Sicherheit, dynamische Geräte- und Dienst-IDs, Reservierungsabgleich, WLAN-Schaltung, Passwortbehandlung, Teilfehler, QR-Payload und Website-Regeln.

Die Tests verwenden nachgebildete Routermodelle und ersetzen keine Prüfung mit echter Hardware. Die Oberfläche startet standardmässig auf `127.0.0.1` und speichert keine Routerdaten dauerhaft. Vor der ersten Anmeldung ist lediglich die Routeradresse auf die eigene private IPv4-Adresse anzupassen, falls sie vom Beispiel abweicht.
