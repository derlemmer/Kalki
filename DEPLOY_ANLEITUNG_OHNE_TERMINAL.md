# KALKI 1.5.0 aktualisieren – ohne Terminal

## Vorher

Diese ZIP entpacken. Im geöffneten Ordner müssen direkt `app`, `database`, `lib`, `public`, `package.json`, `package-lock.json` und `vercel.json` liegen. Nicht den übergeordneten Ordner als zusätzlichen Unterordner in GitHub ablegen.

## Bestehendes GitHub-Repository aktualisieren

Am sichersten ist ein neues privates Repository für die erste Abnahme. Soll das bestehende Repository verwendet werden, dort alle alten Projektdateien ersetzen, nicht nur einzelne neue Dateien ergänzen.

1. GitHub-Repository öffnen.
2. `Add file` → `Upload files`.
3. Alle Inhalte des entpackten KALKI-Ordners hochladen.
4. Kontrollieren, dass `package.json` direkt im Repository-Stamm liegt.
5. Commit-Nachricht: `KALKI 1.5.0 Mobile und Besichtigung`.

Bei sehr vielen Dateien ist GitHub Desktop oft zuverlässiger als der Browser. Ein Terminal ist dafür nicht erforderlich.

## Vercel

Wenn das Repository bereits mit deinem Vercel-Projekt verbunden ist, startet der Commit normalerweise automatisch ein neues Deployment. Die vorhandenen eBay- und Supabase-Variablen bleiben im Vercel-Projekt gespeichert.

Kontrolliere unter `Settings` → `Build and Deployment`:

```text
Framework Preset: Next.js
Root Directory: ./
Node.js Version: 22.x
```

Erforderliche eBay-Variablen:

```text
EBAY_CLIENT_ID
EBAY_CLIENT_SECRET
EBAY_MARKETPLACE_ID=EBAY_DE
EBAY_ENVIRONMENT=production
```

Für den dauerhaften Cache:

```text
SUPABASE_URL
SUPABASE_SECRET_KEY
```

Nach Änderungen an Variablen immer ein neues Deployment beziehungsweise `Redeploy` ausführen. Geheimwerte niemals in GitHub oder den Chat kopieren.

## Nach dem Deployment

Öffne:

```text
https://DEINE-VERCEL-ADRESSE/api/system/status
```

Es muss unter anderem erscheinen:

```text
version: 1.5.0
motorcycles: 638
brands: 15
partTemplates: 108
ebayConfigured: true
```

Danach die Live-Abnahme aus `TEST_REPORT.md` durchführen. Zeigt Vercel einen Buildfehler, die vollständige rote Fehlermeldung aus dem Build-Log kopieren oder als Screenshot senden; nicht mehrere Einstellungen auf Verdacht gleichzeitig verändern.
