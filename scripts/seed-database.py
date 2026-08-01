#!/usr/bin/env python3
import json, re, sqlite3, shutil
from pathlib import Path
from datetime import datetime

ROOT=Path(__file__).resolve().parents[1]
DB=ROOT/'database/kalki.db'
CATALOG=ROOT/'data/motorcycle-catalog.json'
BACKUP=ROOT/'database'/f'kalki.db.before-catalog-{datetime.now().strftime("%Y%m%d-%H%M%S")}'
if DB.exists(): shutil.copy2(DB,BACKUP)
con=sqlite3.connect(DB)
con.execute('PRAGMA foreign_keys=ON')
con.row_factory=sqlite3.Row

def cols(table): return {r[1] for r in con.execute(f'PRAGMA table_info({table})')}
def addcol(table, definition):
    name=definition.split()[0]
    if name not in cols(table): con.execute(f'ALTER TABLE {table} ADD COLUMN {definition}')

# Evolve current schema without deleting existing observations.
addcol('motorcycles','catalog_key TEXT')
addcol('motorcycles','source_notes TEXT')
for d in [
    'external_id TEXT','currency TEXT NOT NULL DEFAULT "EUR"','image_url TEXT','query TEXT',
    'last_seen_at TEXT','is_active INTEGER NOT NULL DEFAULT 1','raw_json TEXT','series_id INTEGER','market_scope_key TEXT NOT NULL DEFAULT ""'
]: addcol('price_observations',d)

con.executescript('''
CREATE UNIQUE INDEX IF NOT EXISTS idx_motorcycles_catalog_key ON motorcycles(catalog_key) WHERE catalog_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_aliases_motorcycle_value ON aliases(motorcycle_id,value);
CREATE UNIQUE INDEX IF NOT EXISTS idx_type_alias_unique ON type_aliases(motorcycle_type_id,alias);
CREATE INDEX IF NOT EXISTS idx_price_observations_lookup ON price_observations(motorcycle_id,part_template_id,observed_at);
DROP INDEX IF EXISTS idx_price_observations_external;
CREATE UNIQUE INDEX IF NOT EXISTS idx_price_observations_external ON price_observations(source,external_id,part_template_id,motorcycle_id,COALESCE(series_id,0),market_scope_key) WHERE external_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS market_refresh_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  motorcycle_id INTEGER NOT NULL,
  part_template_id INTEGER,
  provider TEXT NOT NULL,
  series_code TEXT NOT NULL DEFAULT '',
  series_id INTEGER,
  market_scope_key TEXT NOT NULL DEFAULT '',
  query TEXT NOT NULL,
  status TEXT NOT NULL,
  result_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  refreshed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (motorcycle_id) REFERENCES motorcycles(id) ON DELETE CASCADE,
  FOREIGN KEY (part_template_id) REFERENCES part_templates(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_market_refresh_recent ON market_refresh_log(motorcycle_id,part_template_id,provider,refreshed_at);
''')
addcol('market_refresh_log', "series_code TEXT NOT NULL DEFAULT ''")
addcol('market_refresh_log', 'series_id INTEGER')
addcol('market_refresh_log', "market_scope_key TEXT NOT NULL DEFAULT ''")
con.execute('DROP INDEX IF EXISTS idx_market_refresh_recent')
con.execute('CREATE INDEX IF NOT EXISTS idx_market_refresh_recent ON market_refresh_log(motorcycle_id,market_scope_key,part_template_id,provider,refreshed_at)')

# Unsichere Altbestände ohne exakten Markt-Scope dürfen keine aktuellen
# Modellpreise vortäuschen. Sie bleiben zur Nachvollziehbarkeit erhalten,
# werden aber aus allen aktiven Statistiken ausgeschlossen.
con.execute("""
  UPDATE price_observations
  SET is_active=0
  WHERE motorcycle_id IS NOT NULL
    AND COALESCE(TRIM(market_scope_key),'')=''
""")
# Ein alter Datensatz war als 'generic' markiert, hing aber an einem Typcode.
# Solche widersprüchlichen Zeilen könnten sonst bei späteren Abfragen leaken.
con.execute("""
  DELETE FROM part_values
  WHERE scope_type='generic' AND motorcycle_type_id IS NOT NULL
""")

catalog=json.loads(CATALOG.read_text(encoding='utf-8'))

def key(s):
    return re.sub(r'[^a-z0-9]+','-',s.lower().replace('ä','ae').replace('ö','oe').replace('ü','ue').replace('ß','ss')).strip('-')

find_existing=con.execute
inserted=updated=0
for m in catalog:
    ckey=f"{key(m['brand'])}:{key(m['model'])}"
    row=con.execute('SELECT id FROM motorcycles WHERE catalog_key=? OR (lower(brand)=lower(?) AND lower(model)=lower(?)) ORDER BY id LIMIT 1',(ckey,m['brand'],m['model'])).fetchone()
    values=(m['brand'],m.get('family'),m['model'],None,m.get('displayName') or m['model'],m['production']['from'],m['production']['to'],m.get('engine'),m.get('cylinders'),m.get('hp'),m.get('cooling'),m.get('fuel'),1 if m.get('abs') else 0,m.get('dataStatus','partial'),ckey,json.dumps(m.get('notes',[]),ensure_ascii=False))
    if row:
        mid=row['id'];updated+=1
        con.execute('''UPDATE motorcycles SET brand=?,family=?,model=?,variant=?,display_name=?,production_from=?,production_to=?,engine_cc=?,cylinders=?,hp=?,cooling=?,fuel=?,abs=?,data_status=?,catalog_key=?,source_notes=?,updated_at=CURRENT_TIMESTAMP WHERE id=?''',values+(mid,))
    else:
        cur=con.execute('''INSERT INTO motorcycles(brand,family,model,variant,display_name,production_from,production_to,engine_cc,cylinders,hp,cooling,fuel,abs,data_status,catalog_key,source_notes) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)''',values)
        mid=cur.lastrowid;inserted+=1
    # aliases
    aliases=set(m.get('aliases',[]))|{m['model'],f"{m['brand']} {m['model']}"}
    for a in aliases:
        if a.strip(): con.execute('INSERT OR IGNORE INTO aliases(motorcycle_id,value) VALUES(?,?)',(mid,a.strip()))
    # series and type-code records. Obsolete broad ranges are removed,
    # while unchanged rows keep their IDs so cached market scopes stay stable.
    desired_series={(str(s.get('code') or ''),str(s.get('variant') or ''),int(s['from']),int(s['to'])) for s in m.get('series',[])}
    for old_series in con.execute('SELECT id,code,variant,from_year,to_year FROM series WHERE motorcycle_id=?',(mid,)).fetchall():
        signature=(str(old_series['code'] or ''),str(old_series['variant'] or ''),int(old_series['from_year']),int(old_series['to_year']))
        if signature not in desired_series:
            # Alte Marktbeobachtungen dürfen nach einer Katalogkorrektur nicht
            # in eine neue Generation hineinragen.
            con.execute('UPDATE price_observations SET is_active=0 WHERE series_id=?',(old_series['id'],))
            con.execute('DELETE FROM market_refresh_log WHERE series_id=?',(old_series['id'],))
            con.execute('DELETE FROM series WHERE id=?',(old_series['id'],))
    for s in m.get('series',[]):
        market=','.join(s.get('market',[])) if isinstance(s.get('market'),list) else s.get('market')
        exists=con.execute('''SELECT id FROM series WHERE motorcycle_id=? AND COALESCE(code,'')=COALESCE(?,'') AND COALESCE(variant,'')=COALESCE(?,'') AND from_year=? AND to_year=? LIMIT 1''',(mid,s.get('code'),s.get('variant'),s['from'],s['to'])).fetchone()
        if exists: sid=exists['id']
        else:
            sid=con.execute('INSERT INTO series(motorcycle_id,code,variant,from_year,to_year,market) VALUES(?,?,?,?,?,?)',(mid,s.get('code'),s.get('variant'),s['from'],s['to'],market)).lastrowid
        code=s.get('code')
        if code:
            display=f"{m['brand']} {m['model']} {code}"
            type_status='verified' if m.get('dataStatus')=='verified' else 'unverified'
            typ=con.execute('SELECT id FROM motorcycle_types WHERE motorcycle_id=? AND type_code=? LIMIT 1',(mid,code)).fetchone()
            if typ: tid=typ['id'];con.execute('UPDATE motorcycle_types SET display_name=?,production_from=?,production_to=?,data_status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?',(display,s['from'],s['to'],type_status,tid))
            else: tid=con.execute('INSERT INTO motorcycle_types(motorcycle_id,type_code,display_name,production_from,production_to,aliases,data_status) VALUES(?,?,?,?,?,?,?)',(mid,code,display,s['from'],s['to'],code,type_status)).lastrowid
            con.execute('INSERT OR IGNORE INTO type_aliases(motorcycle_type_id,alias,confidence) VALUES(?,?,?)',(tid,code,1.0))

# KALKI 1.5: Diese Positionen sind bewusst aus der globalen Teileliste entfernt.
REMOVED_PART_TEMPLATES = ['Endschalldämpfer Zubehör', 'Hitzeschutzblech', 'Sammler / Kat', 'ABS-Modulator', 'ABS-Sensor hinten', 'ABS-Sensor vorne', 'Bremssattel vorne links', 'Bremssattel vorne rechts', 'Blinker einzeln', 'Sensoren / Geber', 'Zündspule einzeln', 'Drosselklappengehäuse']
con.execute(
    "DELETE FROM part_templates WHERE name IN (%s)" % ",".join("?" * len(REMOVED_PART_TEMPLATES)),
    REMOVED_PART_TEMPLATES,
)

# KALKI 1.2.3: Unverifizierte Preise sind immer 0 €.
# Die 108 bereinigten Teilevorlagen bleiben vollständig vorhanden; erst echte, streng
# gefilterte Marktbeobachtungen oder eine bewusste manuelle Eingabe erzeugen
# einen Wert. So können Schätzwerte niemals als vermeintlicher Schlachtwert
# aufsummiert werden.
for pt in con.execute('SELECT id,default_probability FROM part_templates').fetchall():
    pv=con.execute("SELECT id FROM part_values WHERE part_template_id=? AND scope_type='generic' AND scope_key IS NULL AND motorcycle_id IS NULL LIMIT 1",(pt['id'],)).fetchone()
    if pv:
        con.execute('UPDATE part_values SET min_price=0,realistic_price=0,max_price=0,probability=?,confidence=0,valuation_source="generic",observation_count=0,updated_at=CURRENT_TIMESTAMP WHERE id=?',(pt['default_probability'],pv['id']))
    else:
        con.execute("""INSERT INTO part_values(part_template_id,scope_type,scope_key,motorcycle_id,min_price,realistic_price,max_price,probability,confidence,valuation_source,observation_count) VALUES(?,'generic',NULL,NULL,0,0,0,?,0,'generic',0)""",(pt['id'],pt['default_probability']))

# Auch alte Familien-/Modellschätzungen werden neutralisiert. Echte Marktwerte
# stammen ausschließlich aus price_observations und werden zur Laufzeit berechnet.
con.execute("UPDATE part_values SET min_price=0,realistic_price=0,max_price=0,confidence=0,observation_count=0 WHERE scope_type IN ('generic','family','motorcycle')")

con.commit()
counts={t:con.execute(f'SELECT COUNT(*) FROM {t}').fetchone()[0] for t in ['motorcycles','aliases','series','motorcycle_types','part_templates','part_values','price_observations']}
print(json.dumps({'inserted':inserted,'updated':updated,'backup':str(BACKUP),'counts':counts},ensure_ascii=False,indent=2))
con.close()
