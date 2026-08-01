# KALKI 1.5.0

KALKI ist eine mobile Web-App zur vorsichtigen Ausschlacht-Kalkulation von Motorrädern. Diese Version basiert auf `Kalki-1.4-main.zip` und konzentriert sich auf eine verlässliche Teilebewertung, eine brauchbare Handyansicht und einen eigenen Besichtigungsmodus.

## Die wichtigsten Regeln

- Ohne echte Marktdaten oder eine bewusste manuelle Eingabe bleiben Minimum, realistisch und Maximum bei `0 €`.
- Nur vollständige und gültige Preise mit `Minimum ≤ realistisch ≤ Maximum` werden gerechnet.
- Fehlende, defekte oder nicht relevante Positionen werden eindeutig gekennzeichnet.
- Eine grüne Kaufempfehlung erscheint nicht, solange wertentscheidende Hauptteile noch ungeklärt sind.
- eBay-Angebotspreise werden mit Verkaufswahrscheinlichkeit und einem Szenario-Abschlag vorsichtig bewertet.

## Neu in 1.5.0

### Mobile Teileansicht

Auf Bildschirmen bis 720 px wird jede Teileposition als Karte dargestellt. Die Desktop-Tabelle besitzt auf dem Handy keine feste Mindestbreite mehr. Quelle, Preise, Zustand und Aktionen bleiben vollständig erreichbar; die Seite soll nicht mehr seitlich aus dem Bildschirm laufen.

### Teileliste und Preislücken

- Filter: `Alle`, `Ohne Preis`, `Marktdaten`, `Manuell`
- Suchfeld für Teile
- Offene Positionen werden innerhalb einer Kategorie zuerst angezeigt
- Kategorien zeigen die Anzahl noch offener Preise
- Ganze Kategorien können auf `Ungeprüft`, `Defekt`, `Fehlt` oder `Nicht relevant` gesetzt werden
- `Fehlt`, `Defekt` und `Nicht relevant` erzeugen keine falsche Preiswarnung
- konservative Modellrelevanz blendet bei eindeutig erkennbaren Bauarten unpassende Verkleidungs-, Kardan-, Ketten-, Vergaser- oder Einspritzpositionen als `Nicht relevant` aus

### eBay-Angebote

Eine geöffnete Teileposition zeigt die konkreten akzeptierten Angebote mit Titel, Bild, Artikelpreis, Versand, Gesamtpreis und direktem Link. Ein Angebot kann als manueller Richtwert übernommen oder als unpassend ausgeschlossen werden. Ausgeschlossene Links werden projektbezogen gespeichert und lassen sich wiederherstellen.

### Besichtigungsmodus

Der Bereich `Besichtigung` enthält große Schalter für Motor, Fahrwerk, Rahmen, Elektrik, Papiere und Schlüssel. Änderungen wirken direkt auf die betroffenen Teilezustände oder als klar ausgewiesener Zu-/Abschlag. Unten werden Ausgangswert, Änderung, neuer vorsichtiger Wert und maximaler Einkaufspreis angezeigt. Alte unsichtbare Risiko-Häkchen aus früheren Versionen erzeugen keine Doppelabzüge mehr.

### Fotos

Beim Import eines Inserats versucht KALKI dessen Bild-URLs aus strukturierten Daten und Metatags zu übernehmen. Eigene Fotos lassen sich zusätzlich nach Bereichen hochladen. Sie werden vor dem lokalen Speichern auf maximal 1200 px Kantenlänge komprimiert. Es gibt eine Galerie und eine Vollbildansicht; Schäden werden nicht automatisch markiert oder bewertet.

### Speichern und Sicherheit

- automatisches lokales Speichern nach Änderungen
- sichtbarer Speicherstatus
- ein Schritt `Rückgängig`
- Backup-Export als JSON
- mobile feste Wertleiste mit vorsichtigem Erlös, offenen Positionen und maximalem Einkaufspreis

## Bereinigte globale Teileliste

Die Teileliste enthält jetzt 108 Vorlagen. Folgende zwölf Positionen wurden aus der SQLite-Datenbank, neuen Projekten, alten gespeicherten Projekten, Marktprüfung und API-Ausgabe entfernt:

- Endschalldämpfer Zubehör
- Hitzeschutzblech
- Sammler / Kat
- ABS-Modulator
- ABS-Sensor hinten
- ABS-Sensor vorne
- Bremssattel vorne links
- Bremssattel vorne rechts
- Blinker einzeln
- Sensoren / Geber
- Zündspule einzeln
- Drosselklappengehäuse

Die zusammengefassten Positionen wie `Bremssättel vorne Satz`, `Blinker Satz`, `Zündspulen Satz` und `Endschalldämpfer original` bleiben erhalten.

## Katalog

- 638 Motorradmodelle
- 15 Hersteller
- 674 Baureihen
- 3.412 Suchaliasse
- 108 aktive Teilevorlagen

## Vercel-Variablen

Erforderlich für eBay:

```text
EBAY_CLIENT_ID
EBAY_CLIENT_SECRET
EBAY_MARKETPLACE_ID=EBAY_DE
EBAY_ENVIRONMENT=production
```

Empfohlen für den dauerhaften Marktcache:

```text
SUPABASE_URL
SUPABASE_SECRET_KEY
```

Optional für den Cronjob:

```text
CRON_SECRET
```

Geheime Schlüssel gehören ausschließlich in Vercel Environment Variables und niemals in GitHub oder eine Datei der ZIP.

## Systemprüfung nach dem Deployment

Öffne:

```text
https://DEINE-VERCEL-ADRESSE/api/system/status
```

Erwartet werden mindestens:

```json
{
  "version": "1.5.0",
  "catalog": {
    "motorcycles": 638,
    "brands": 15,
    "partTemplates": 108
  },
  "market": {
    "ebayConfigured": true
  }
}
```

Details zum Browser-Deployment stehen in `DEPLOY_ANLEITUNG_OHNE_TERMINAL.md`. Testergebnisse und nicht vollständig live prüfbare Punkte stehen in `TEST_REPORT.md` und `KNOWN_LIMITATIONS.md`.
