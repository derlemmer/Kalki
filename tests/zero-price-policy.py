#!/usr/bin/env python3
from pathlib import Path
import sqlite3

ROOT = Path(__file__).resolve().parents[1]
DB = ROOT / "database" / "kalki.db"
con = sqlite3.connect(DB)

assert con.execute("PRAGMA integrity_check").fetchone()[0] == "ok"
assert con.execute("PRAGMA foreign_key_check").fetchall() == []
assert con.execute("SELECT COUNT(*) FROM motorcycles").fetchone()[0] == 638
assert con.execute("SELECT COUNT(*) FROM part_templates").fetchone()[0] == 108
removed = {"Endschalldämpfer Zubehör", "Hitzeschutzblech", "Sammler / Kat", "ABS-Modulator", "ABS-Sensor hinten", "ABS-Sensor vorne", "Bremssattel vorne links", "Bremssattel vorne rechts", "Blinker einzeln", "Sensoren / Geber", "Zündspule einzeln", "Drosselklappengehäuse"}
names = {row[0] for row in con.execute("SELECT name FROM part_templates")}
assert removed.isdisjoint(names), removed & names

# Verbindlich für ALLE Modelle: sämtliche Nicht-Marktdaten sind 0 €.
nonzero = con.execute("""
  SELECT COUNT(*) FROM part_values
  WHERE scope_type IN ('generic','family','motorcycle')
    AND (min_price<>0 OR realistic_price<>0 OR max_price<>0)
""").fetchone()[0]
assert nonzero == 0, nonzero

# Die vollständige Teileliste bleibt trotzdem vorhanden.
generic_count = con.execute("""
  SELECT COUNT(DISTINCT part_template_id) FROM part_values
  WHERE scope_type='generic' AND scope_key IS NULL
    AND motorcycle_id IS NULL AND motorcycle_type_id IS NULL
""").fetchone()[0]
assert generic_count == 108, generic_count
coverage = con.execute("""
  SELECT COUNT(*)
  FROM motorcycles m
  CROSS JOIN (
    SELECT part_template_id FROM part_values
    WHERE scope_type='generic' AND scope_key IS NULL
      AND motorcycle_id IS NULL AND motorcycle_type_id IS NULL
  ) p
""").fetchone()[0]
assert coverage == 638 * 108, coverage
con.close()

page = (ROOT / "app/page.tsx").read_text(encoding="utf-8")
parts = (ROOT / "database/getParts.ts").read_text(encoding="utf-8")
market = (ROOT / "database/market.ts").read_text(encoding="utf-8")
assert 'min_price: 0' in parts and 'realistic_price: 0' in parts and 'max_price: 0' in parts
assert 'hasMarketPrice' in page
assert 'hasVerifiedPartPrice' in page and 'part.source === "manual"' in page and 'Boolean(part.custom)' in page
assert 'GEPRÜFT · 0' in page and 'NOCH OFFEN · 0' in page
assert '2026-08-object-v5-zero' in market
assert 'Die generische Schätzung bleibt sichtbar' not in page
print('ZERO_PRICE_POLICY_OK (638 Modelle, 108 Teile, alle Nicht-Marktdaten = 0 €)')
