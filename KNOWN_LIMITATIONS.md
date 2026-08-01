# Bekannte Grenzen von KALKI 1.5.0

- Automatisch geladene Inseratbilder bleiben externe URLs. Wird das Inserat oder das Bild beim Anbieter gelöscht, kann das Foto später fehlen.
- Eigene Fotos, Projekte, ausgeschlossene Treffer und Besichtigungsdaten werden derzeit im Browser gespeichert. Sie synchronisieren sich nicht automatisch zwischen mehreren Geräten. Der JSON-Backup-Export sollte regelmäßig verwendet werden.
- Browser-Speicher ist begrenzt. Eigene Fotos werden deshalb komprimiert und auf zwölf Bilder pro Projekt begrenzt; sehr viele große Projekte können dennoch das Speicherlimit erreichen.
- KALKI erkennt keine Schäden automatisch aus Bildern. Die Fotos dienen ausschließlich zur Ansicht und Dokumentation.
- eBay liefert Angebotspreise, keine garantierten Verkaufspreise. Szenario-Abschlag und Verkaufswahrscheinlichkeit bleiben deshalb Teil der vorsichtigen Kalkulation.
- Eine einzelne eBay-Suche kann trotz strenger Filter relevante Angebote übersehen oder unpassende Angebote enthalten. Jeder konkrete Link muss vor einer Kaufentscheidung kontrolliert werden.
- Automatisches Massen-Scraping von Kleinanzeigen-Teilepreisen ist nicht eingebaut. KALKI stellt für fehlende Positionen eine manuelle, modellgenaue Suche bereit.
- Die automatische Inseraterkennung hängt von den öffentlich ausgelieferten HTML-Daten ab. Blockiert oder verändert ein Portal diese Daten, müssen Fahrzeugdaten oder Fotos manuell ergänzt werden.
- Der dauerhafte Sieben-Tage-Marktcache benötigt Supabase. Ohne Supabase kann Vercels temporäre SQLite-Kopie neue Beobachtungen nicht zuverlässig über mehrere Serverinstanzen hinweg behalten.
- In der Entwicklungsumgebung dieser Erstellung konnte `npm ci` nicht abgeschlossen werden, weil der interne Paketspiegel `undici-types@7.18.2` mit 404 beantwortete. Deshalb war hier kein vollständiger `next build` möglich. Der erste Vercel-Build bleibt der abschließende echte Build-Test.
