#!/usr/bin/env python3
import json,re,sqlite3,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
cat=json.loads((ROOT/'data/motorcycle-catalog.json').read_text(encoding='utf-8'))
errors=[]
keys=set()
for m in cat:
    k=(m['brand'].casefold(),m['model'].casefold())
    if k in keys: errors.append(f'duplicate model {k}')
    keys.add(k)
    if not (1970<=m['production']['from']<=m['production']['to']<=2010): errors.append(f'years {k}')
    if not m['aliases']: errors.append(f'aliases {k}')
    if not any(re.sub(r'\W','',a).casefold()==re.sub(r'\W','',m['model']).casefold() for a in m['aliases']): errors.append(f'model alias {k}')
con=sqlite3.connect(ROOT/'database/kalki.db')
con.row_factory=sqlite3.Row
if con.execute('pragma integrity_check').fetchone()[0] != 'ok': errors.append('sqlite integrity')
if con.execute('pragma foreign_key_check').fetchall(): errors.append('foreign keys')
counts={t:con.execute(f'select count(*) from {t}').fetchone()[0] for t in ['motorcycles','aliases','series','motorcycle_types','part_templates','part_values','price_observations']}
for table in ['projects','inventory_items','sales','project_expenses','market_refresh_log']:
    if not con.execute("select 1 from sqlite_master where type='table' and name=?",(table,)).fetchone(): errors.append(f'missing prepared table {table}')
if counts['motorcycles'] != len(cat): errors.append(f"DB motorcycles {counts['motorcycles']} != catalog {len(cat)}")
if con.execute("select count(*) from part_values where scope_type in ('generic','family','motorcycle') and (min_price<>0 or realistic_price<>0 or max_price<>0)").fetchone()[0]: errors.append('unverified prices must be zero')
# Common recognition anchors and type codes that matter for KALKI.
expect=[
 ('Yamaha','XS400','2A2'),('Yamaha','YZF-R1','RN01'),('Yamaha','YZF-R6','RJ15'),
 ('Honda','CBR600F','PC31'),('Honda','XL600V Transalp','PD06'),('Honda','XRV750 Africa Twin','RD07'),
 ('Suzuki','GSF1200 Bandit','WVA9'),('Suzuki','SV650','AV'),('Suzuki','GSX-R750','GR7AB'),
]
for brand,model,code in expect:
    row=con.execute('''select m.id from motorcycles m join series s on s.motorcycle_id=m.id where m.brand=? and m.model=? and s.code=?''',(brand,model,code)).fetchone()
    if not row: errors.append(f'missing {brand} {model} {code}')
# Every non-empty series code must have an isolated motorcycle_type scope.
missing_type_scopes=con.execute("""
select m.brand,m.model,s.code
from series s
join motorcycles m on m.id=s.motorcycle_id
left join motorcycle_types mt
  on mt.motorcycle_id=s.motorcycle_id and upper(mt.type_code)=upper(s.code)
where s.code is not null and trim(s.code)<>'' and mt.id is null
""").fetchall()
if missing_type_scopes:
    errors.append(f'missing type scopes: {len(missing_type_scopes)}')

# Model-level observations must be possible without a type code.
try:
    con.execute('begin')
    mid=con.execute("select id from motorcycles where brand='Honda' and model='CB500'").fetchone()[0]
    pid=con.execute('select id from part_templates limit 1').fetchone()[0]
    con.execute("insert into price_observations(part_template_id,motorcycle_id,source,listing_type,price,url,external_id) values(?,?,'ebay','angebot',99,'https://example.invalid/test','validation-test')",(pid,mid))
    con.execute('rollback')
except Exception as e:
    errors.append(f'model-level observation insert failed: {e}')
finally:
    if con.in_transaction: con.execute('rollback')
con.close()
print(json.dumps({'catalog_models':len(cat),'brands':len(set(m['brand'] for m in cat)),'database':counts,'errors':errors},ensure_ascii=False,indent=2))
sys.exit(1 if errors else 0)
