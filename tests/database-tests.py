#!/usr/bin/env python3
from __future__ import annotations

import shutil
import sqlite3
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DB_PATH = ROOT / "database" / "kalki.db"


def one(con: sqlite3.Connection, sql: str, params=()):
    row = con.execute(sql, params).fetchone()
    if row is None:
        raise AssertionError(f"No row for query: {sql} {params}")
    return row


def model(con: sqlite3.Connection, brand: str, name: str):
    return one(con, "SELECT id,catalog_key,production_from,production_to FROM motorcycles WHERE brand=? AND model=?", (brand, name))


def series_for(con: sqlite3.Connection, motorcycle_id: int, year: int, variant: str | None = None):
    rows = con.execute(
        "SELECT id,code,variant,from_year,to_year FROM series WHERE motorcycle_id=? AND ? BETWEEN from_year AND to_year ORDER BY id",
        (motorcycle_id, year),
    ).fetchall()
    if variant:
        rows = [row for row in rows if row[2].upper() == variant.upper()]
    if len(rows) != 1:
        raise AssertionError(f"Expected one series for motorcycle={motorcycle_id}, year={year}, variant={variant}, got {rows}")
    return rows[0]


def scope(catalog_key: str, row: sqlite3.Row):
    variant = "".join(ch.lower() for ch in (row[2] or "base") if ch.isalnum()) or "base"
    return f"{catalog_key}:series:{row[0]}:{(row[1] or 'NO-CODE').upper()}:{row[3]}-{row[4]}:{variant}"


def main():
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    assert one(con, "PRAGMA integrity_check")[0] == "ok"
    assert con.execute("PRAGMA foreign_key_check").fetchall() == []
    assert one(con, "SELECT COUNT(*) FROM motorcycles")[0] == 638
    assert one(con, "SELECT COUNT(DISTINCT brand) FROM motorcycles")[0] == 15
    assert one(con, "SELECT COUNT(*) FROM part_templates")[0] == 108
    assert one(con, "SELECT COUNT(DISTINCT lower(name)) FROM part_templates")[0] == 108
    legacy_duplicates = {
        "Auspuffanlage", "Hinterrad", "Vorderrad", "Tacho",
        "Sitzbank", "Vergaseranlage",
    }
    names = {row[0] for row in con.execute("SELECT name FROM part_templates")}
    removed_parts = {
        "Endschalldämpfer Zubehör", "Hitzeschutzblech", "Sammler / Kat",
        "ABS-Modulator", "ABS-Sensor hinten", "ABS-Sensor vorne",
        "Bremssattel vorne links", "Bremssattel vorne rechts", "Blinker einzeln",
        "Sensoren / Geber", "Zündspule einzeln", "Drosselklappengehäuse",
    }
    assert removed_parts.isdisjoint(names), removed_parts & names
    assert legacy_duplicates.isdisjoint(names), legacy_duplicates & names
    for required in {
        "Kettensatz", "Kettenradträger / Ruckdämpfer",
        "Kühlerausgleichsbehälter", "Thermostat / Thermostatgehäuse",
        "Hupe", "Batteriehalter / Batteriekasten", "Kennzeichenbeleuchtung",
    }:
        assert required in names, required

    # Exactly one zero-valued placeholder row per part. Legacy estimates must not
    # leak into any motorcycle calculation.
    usable_generic = one(con, """
        SELECT COUNT(*) FROM part_values
        WHERE scope_type='generic' AND scope_key IS NULL
          AND motorcycle_id IS NULL AND motorcycle_type_id IS NULL
    """)[0]
    assert usable_generic == 108, usable_generic
    nonzero_unverified = one(con, """
        SELECT COUNT(*) FROM part_values
        WHERE scope_type IN ('generic','family','motorcycle')
          AND (min_price<>0 OR realistic_price<>0 OR max_price<>0)
    """)[0]
    assert nonzero_unverified == 0, nonzero_unverified
    contradictory_generic = one(con, """
        SELECT COUNT(*) FROM part_values
        WHERE scope_type='generic' AND motorcycle_type_id IS NOT NULL
    """)[0]
    assert contradictory_generic == 0, contradictory_generic
    unsafe_active_observations = one(con, """
        SELECT COUNT(*) FROM price_observations
        WHERE motorcycle_id IS NOT NULL
          AND COALESCE(TRIM(market_scope_key),'')=''
          AND COALESCE(is_active,1)=1
    """)[0]
    assert unsafe_active_observations == 0, unsafe_active_observations

    gsxr = model(con, "Suzuki", "GSX-R750")
    gsxr_1999 = series_for(con, gsxr[0], 1999)
    assert tuple(gsxr_1999[1:]) == ("GR7DB", "SRAD 1998-1999", 1998, 1999)

    blade = model(con, "Honda", "CBR1000RR Fireblade")
    sc57_2004 = series_for(con, blade[0], 2004)
    sc57_2006 = series_for(con, blade[0], 2006)
    sc59_2009 = series_for(con, blade[0], 2009)
    assert sc57_2004[1] == "SC57" and sc57_2004[2] == "SC57 2004-2005"
    assert sc57_2006[1] == "SC57" and "Facelift" in sc57_2006[2]
    assert sc59_2009[1] == "SC59"
    assert sc57_2004[0] != sc57_2006[0]

    sv = model(con, "Suzuki", "SV1000")
    sv_s = series_for(con, sv[0], 2004, "SV1000S")
    sv_n = series_for(con, sv[0], 2004, "SV1000N")
    assert sv_s[1] == sv_n[1] == "WVBX"
    assert sv_s[0] != sv_n[0]

    # Every target model receives the complete 108-part zero-valued list.
    for target in (gsxr, blade, sv):
        count = one(con, """
          SELECT COUNT(DISTINCT pt.id)
          FROM part_templates pt
          JOIN part_values pv ON pv.part_template_id=pt.id
          WHERE pv.scope_type='generic' AND pv.scope_key IS NULL
            AND pv.motorcycle_id IS NULL AND pv.motorcycle_type_id IS NULL
        """)[0]
        assert count == 108

    con.close()

    # Work on a temporary copy for cache/isolation tests.
    with tempfile.TemporaryDirectory() as temp:
        copy = Path(temp) / "kalki.db"
        shutil.copy2(DB_PATH, copy)
        test = sqlite3.connect(copy)
        test.row_factory = sqlite3.Row
        part_id = one(test, "SELECT id FROM part_templates WHERE name='Tank'")[0]
        scopes = {
            "sc57_04": scope(blade[1], sc57_2004),
            "sc57_06": scope(blade[1], sc57_2006),
            "sc59_09": scope(blade[1], sc59_2009),
            "sv_s": scope(sv[1], sv_s),
            "sv_n": scope(sv[1], sv_n),
        }
        test.execute("DELETE FROM price_observations WHERE external_id LIKE 'KALKI-TEST-%'")
        observations = [
            (part_id, blade[0], sc57_2004[0], scopes["sc57_04"], 111, "KALKI-TEST-A", "Honda CBR1000RR SC57 2004 Tank"),
            (part_id, blade[0], sc57_2006[0], scopes["sc57_06"], 222, "KALKI-TEST-B", "Honda CBR1000RR SC57 2006 Tank"),
            (part_id, blade[0], sc59_2009[0], scopes["sc59_09"], 333, "KALKI-TEST-C", "Honda CBR1000RR SC59 2009 Tank"),
            (part_id, sv[0], sv_s[0], scopes["sv_s"], 444, "KALKI-TEST-D", "Suzuki SV1000S WVBX Tank"),
            (part_id, sv[0], sv_n[0], scopes["sv_n"], 555, "KALKI-TEST-E", "Suzuki SV1000N WVBX Tank"),
        ]
        for template_id, bike_id, series_id, key, price, external_id, title in observations:
            test.execute("""
              INSERT INTO price_observations(
                part_template_id,motorcycle_id,series_id,market_scope_key,source,listing_type,
                price,shipping_price,title,url,external_id,currency,observed_at,last_seen_at,is_active
              ) VALUES(?,?,?,?, 'ebay','angebot',?,0,?,'https://example.invalid',?,'EUR',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,1)
            """, (template_id, bike_id, series_id, key, price, title, external_id))
        test.commit()

        for _, bike_id, series_id, key, price, _, _ in observations:
            rows = test.execute("""
              SELECT price FROM price_observations
              WHERE motorcycle_id=? AND part_template_id=?
                AND COALESCE(series_id,0)=COALESCE(?,0) AND market_scope_key=?
                AND external_id LIKE 'KALKI-TEST-%'
            """, (bike_id, part_id, series_id, key)).fetchall()
            assert [row[0] for row in rows] == [price], (key, rows)

        # Seven-day freshness is tied to the exact scope, not merely the model or
        # shared SC57/WVBX code. Re-opening the same link sees fresh data; another
        # generation/variant remains eligible.
        test.execute("DELETE FROM market_refresh_log WHERE query LIKE 'KALKI-TEST-%'")
        test.execute("""
          INSERT INTO market_refresh_log(
            motorcycle_id,series_code,series_id,market_scope_key,part_template_id,
            provider,query,status,result_count,refreshed_at
          ) VALUES(?,?,?,?,?,'ebay','KALKI-TEST-FRESH','ok',1,CURRENT_TIMESTAMP)
        """, (blade[0], "SC57", sc57_2004[0], scopes["sc57_04"], part_id))
        test.commit()
        fresh_same = one(test, """
          SELECT COUNT(*) FROM market_refresh_log
          WHERE motorcycle_id=? AND series_id=? AND market_scope_key=? AND part_template_id=?
            AND provider='ebay' AND status='ok' AND refreshed_at >= datetime('now','-7 days')
        """, (blade[0], sc57_2004[0], scopes["sc57_04"], part_id))[0]
        fresh_other = one(test, """
          SELECT COUNT(*) FROM market_refresh_log
          WHERE motorcycle_id=? AND series_id=? AND market_scope_key=? AND part_template_id=?
            AND provider='ebay' AND status='ok' AND refreshed_at >= datetime('now','-7 days')
        """, (blade[0], sc57_2006[0], scopes["sc57_06"], part_id))[0]
        assert fresh_same == 1
        assert fresh_other == 0
        test.close()

    print("DATABASE_TESTS_OK")


if __name__ == "__main__":
    main()
