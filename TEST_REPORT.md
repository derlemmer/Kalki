# Testbericht KALKI 1.5.0

## Erfolgreich geprüft

### SQLite und Katalog

- `PRAGMA integrity_check`: `ok`
- keine Fremdschlüsselverletzungen
- 638 Motorradmodelle
- 15 Hersteller
- 674 Baureihen
- 3.412 Alias-Einträge
- 108 aktive Teilevorlagen
- 108 generische Nullpreis-Grundpositionen
- 68.904 Modell-/Teile-Kombinationen unter der globalen Nullpreis-Regel
- alle zwölf gestrichenen Positionen fehlen in der aktiven Datenbank
- Katalogvalidierung: keine gemeldeten Fehler

### Markt- und Erkennungslogik

- reine Parser-/Routen-/Modellisolationstests: bestanden
- Teile-Titeltests: 23 Fälle bestanden
- Marktsuchtests: 17 Trefferfälle und sieben Suchvarianten bestanden
- alle 108 aktiven Teileprofile mit einer passenden Referenzbezeichnung getestet
- Markentrennung: 11 Handfälle und 1.960 Katalogfälle bestanden
- Inseratfoto-Erkennung aus JSON-LD, `og:image` und bildtypischen CDN-URLs ohne Dateiendung getestet
- Modellrelevanz für Naked Bike, Sportmotorrad, Kardan, Riemenantrieb, Klassiker und modernes Einspritzmodell getestet

### Oberfläche und Quellcode

- 22 statische UI-Prüfungen für mobile Karten, Angebotslinks, Filter, Preisvalidierung, Besichtigung, Fotos, Autospeichern und Rückgängig bestanden
- TypeScript-Syntaxprüfung: 36 TS-/TSX-Dateien, keine Syntaxfehler
- zusätzliche semantische TypeScript-Prüfung aller 36 Dateien mit lokalen Modul-Stubs: bestanden
- Version und Systemstatus auf 1.5.0 / 108 Teile aktualisiert
- alte versteckte Risiko-Häkchen erzeugen keinen Doppelabzug mehr

## Nicht vollständig in dieser Umgebung prüfbar

`npm ci` scheiterte am internen Paketspiegel mit einem 404 für `undici-types@7.18.2`. Dadurch konnten der offizielle `npm run typecheck`, ein vollständiger Next.js-Produktionsbuild und ein Browser-E2E-Test hier nicht ausgeführt werden. Das ist keine bestätigte Fehlfunktion des Projekts, aber eine offene Prüfung. Nach dem GitHub-Upload muss Vercel den Build abschließen; danach sind Handyansicht, echte eBay-API, externe Inseratbilder und Supabase in der Live-Umgebung zu testen.

## Empfohlener Live-Abnahmetest

1. `/api/system/status` zeigt Version `1.5.0` und `partTemplates: 108`.
2. GSX-R-Inserat importieren und prüfen, ob Fahrzeugdaten sowie verfügbare Fotos erscheinen.
3. Teileliste auf dem Handy öffnen: kein seitliches Überlaufen, Quelle und Aktion bleiben erreichbar.
4. Filter `OHNE PREIS` aktivieren.
5. Eine Position mit eBay-Treffern öffnen, konkreten Link kontrollieren, einen Treffer ablehnen und wiederherstellen.
6. Ein Angebot als Richtwert übernehmen und ungültige Preisreihenfolge testen.
7. Besichtigungswerte setzen und kontrollieren, ob die Live-Änderung nachvollziehbar erscheint.
8. Seite neu laden und Autospeicherung kontrollieren.
