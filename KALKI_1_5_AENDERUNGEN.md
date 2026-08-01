# KALKI 1.5.0 – Bedienung der neuen Bereiche

## Teile

1. Kategorie öffnen.
2. Bei Bedarf den Filter `OHNE PREIS` aktivieren.
3. Eine Position über `ANGEBOTE` öffnen.
4. Ein konkretes Angebot mit `ÖFFNEN` kontrollieren.
5. Passendes Angebot mit `ALS RICHTWERT ÜBERNEHMEN` verwenden oder falsches Zubehör mit `UNPASSEND` ausblenden.
6. Ohne brauchbare Treffer bleiben alle drei Preisfelder auf null. Manuelle Werte werden nur gerechnet, wenn alle drei positiv sind und `Min ≤ Real ≤ Max` gilt.

`Fehlt`, `Defekt` und `Nicht relevant` dienen unterschiedlichen Zwecken:

- `Fehlt`: Das Bauteil ist am Fahrzeug nicht vorhanden.
- `Defekt`: Es ist vorhanden, aber beschädigt. Ohne Preis ist es keine offene Preisaufgabe; mit gültigem Preis wird der Defektfaktor berücksichtigt.
- `Nicht relevant`: Das Motorrad besitzt diese Bauart nicht oder die Position soll bewusst nicht betrachtet werden.

## Besichtigung

Der Besichtigungsmodus ist eine eigenständige Seite im selben Projekt. Schalter ändern entweder den Zustand einer passenden Teileposition oder erzeugen einen transparenten festen Zu-/Abschlag, beispielsweise für fehlende Papiere oder Schlüssel. Die Auswirkungen stehen direkt unter der Checkliste; ein Zurückspringen zur Teileliste ist nicht nötig.

Mit `BESICHTIGUNG ZURÜCKSETZEN` werden die Antworten und die dadurch gesetzten Teilezustände auf den Ausgangsstand zurückgeführt.

## Fotos

Automatisch erkannte Inseratbilder werden als externe Bild-URLs gespeichert. Eigene Bilder werden lokal komprimiert und im Projekt abgelegt. Die Galerie bewertet keine Schäden und setzt keine Teilezustände automatisch.

## Mobile Ansicht

Auf dem Handy werden Teile als Karten statt als breite Tabelle angezeigt. Die untere Leiste zeigt während des Scrollens:

- vorsichtigen Erlös
- Anzahl offener Preise
- maximalen Einkaufspreis

Die Leiste springt direkt zu Kalkulation, Teilen oder Besichtigung.
