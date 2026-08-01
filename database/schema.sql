PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS motorcycles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  brand TEXT NOT NULL,
  family TEXT,
  model TEXT NOT NULL,
  variant TEXT,
  display_name TEXT,
  production_from INTEGER NOT NULL,
  production_to INTEGER NOT NULL,
  engine_cc INTEGER,
  cylinders INTEGER,
  hp INTEGER,
  cooling TEXT,
  fuel TEXT,
  abs INTEGER NOT NULL DEFAULT 0,
  data_status TEXT NOT NULL DEFAULT 'unverified',
  type_code TEXT,
  catalog_key TEXT,
  source_notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS aliases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  motorcycle_id INTEGER NOT NULL,
  value TEXT NOT NULL,
  FOREIGN KEY (motorcycle_id) REFERENCES motorcycles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS series (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  motorcycle_id INTEGER NOT NULL,
  code TEXT,
  variant TEXT,
  from_year INTEGER NOT NULL,
  to_year INTEGER NOT NULL,
  market TEXT,
  FOREIGN KEY (motorcycle_id) REFERENCES motorcycles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS motorcycle_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  motorcycle_id INTEGER NOT NULL,
  type_code TEXT NOT NULL,
  display_name TEXT,
  production_from INTEGER,
  production_to INTEGER,
  aliases TEXT,
  data_status TEXT NOT NULL DEFAULT 'unverified' CHECK (data_status IN ('unverified','verified')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (motorcycle_id) REFERENCES motorcycles(id) ON DELETE CASCADE,
  UNIQUE (motorcycle_id,type_code)
);

CREATE TABLE IF NOT EXISTS type_aliases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  motorcycle_type_id INTEGER NOT NULL,
  alias TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 1.0,
  FOREIGN KEY (motorcycle_type_id) REFERENCES motorcycle_types(id) ON DELETE CASCADE,
  UNIQUE (motorcycle_type_id,alias)
);

CREATE TABLE IF NOT EXISTS parts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  motorcycle_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  min_price INTEGER NOT NULL DEFAULT 0,
  realistic_price INTEGER NOT NULL DEFAULT 0,
  max_price INTEGER NOT NULL DEFAULT 0,
  probability INTEGER NOT NULL DEFAULT 70,
  FOREIGN KEY (motorcycle_id) REFERENCES motorcycles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS part_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  default_probability INTEGER NOT NULL DEFAULT 70,
  UNIQUE(name,category)
);

CREATE TABLE IF NOT EXISTS part_values (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  part_template_id INTEGER NOT NULL,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('generic','family','motorcycle')),
  scope_key TEXT,
  motorcycle_id INTEGER,
  min_price INTEGER NOT NULL DEFAULT 0,
  realistic_price INTEGER NOT NULL DEFAULT 0,
  max_price INTEGER NOT NULL DEFAULT 0,
  probability INTEGER,
  motorcycle_type_id INTEGER,
  confidence REAL DEFAULT 0,
  valuation_source TEXT DEFAULT 'generic',
  updated_at TEXT,
  observation_count INTEGER DEFAULT 0,
  FOREIGN KEY (part_template_id) REFERENCES part_templates(id) ON DELETE CASCADE,
  FOREIGN KEY (motorcycle_id) REFERENCES motorcycles(id) ON DELETE CASCADE,
  FOREIGN KEY (motorcycle_type_id) REFERENCES motorcycle_types(id) ON DELETE CASCADE,
  UNIQUE(part_template_id,scope_type,scope_key,motorcycle_id)
);

CREATE TABLE IF NOT EXISTS price_observations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  part_template_id INTEGER NOT NULL,
  motorcycle_id INTEGER,
  motorcycle_type_id INTEGER,
  series_id INTEGER,
  market_scope_key TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL CHECK (source IN ('ebay','kleinanzeigen','manuell','sonstige')),
  listing_type TEXT NOT NULL DEFAULT 'angebot' CHECK (listing_type IN ('angebot','verkauft')),
  price INTEGER NOT NULL CHECK (price >= 0),
  shipping_price INTEGER NOT NULL DEFAULT 0 CHECK (shipping_price >= 0),
  currency TEXT NOT NULL DEFAULT 'EUR',
  condition TEXT,
  title TEXT,
  url TEXT NOT NULL,
  external_id TEXT,
  image_url TEXT,
  query TEXT,
  observed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  sold_at TEXT,
  raw_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (part_template_id) REFERENCES part_templates(id) ON DELETE CASCADE,
  FOREIGN KEY (motorcycle_id) REFERENCES motorcycles(id) ON DELETE CASCADE,
  FOREIGN KEY (motorcycle_type_id) REFERENCES motorcycle_types(id) ON DELETE SET NULL,
  FOREIGN KEY (series_id) REFERENCES series(id) ON DELETE SET NULL
);

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
  FOREIGN KEY (part_template_id) REFERENCES part_templates(id) ON DELETE CASCADE,
  FOREIGN KEY (series_id) REFERENCES series(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  motorcycle_id INTEGER,
  status TEXT NOT NULL DEFAULT 'Offen',
  purchase_price INTEGER NOT NULL DEFAULT 0,
  source_url TEXT,
  location TEXT,
  notes TEXT,
  payload_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (motorcycle_id) REFERENCES motorcycles(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS inventory_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  part_template_id INTEGER,
  name TEXT NOT NULL,
  condition TEXT,
  shelf_location TEXT,
  status TEXT NOT NULL DEFAULT 'eingelagert',
  expected_price INTEGER NOT NULL DEFAULT 0,
  asking_price INTEGER NOT NULL DEFAULT 0,
  acquired_at TEXT,
  listed_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (part_template_id) REFERENCES part_templates(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  inventory_item_id INTEGER,
  project_id TEXT NOT NULL,
  platform TEXT,
  sale_price INTEGER NOT NULL DEFAULT 0,
  platform_fee INTEGER NOT NULL DEFAULT 0,
  shipping_cost INTEGER NOT NULL DEFAULT 0,
  buyer_reference TEXT,
  sold_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,
  FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE SET NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS project_expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  category TEXT NOT NULL,
  amount INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  occurred_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_motorcycles_brand_model ON motorcycles(brand,model);
CREATE INDEX IF NOT EXISTS idx_motorcycles_family ON motorcycles(family);
CREATE UNIQUE INDEX IF NOT EXISTS idx_motorcycles_catalog_key ON motorcycles(catalog_key) WHERE catalog_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_aliases_value ON aliases(value);
CREATE UNIQUE INDEX IF NOT EXISTS idx_aliases_motorcycle_value ON aliases(motorcycle_id,value);
CREATE INDEX IF NOT EXISTS idx_series_code ON series(code);
CREATE INDEX IF NOT EXISTS idx_part_values_scope ON part_values(scope_type,scope_key,motorcycle_id);
CREATE INDEX IF NOT EXISTS idx_price_observations_lookup ON price_observations(motorcycle_id,part_template_id,observed_at);
DROP INDEX IF EXISTS idx_price_observations_external;
CREATE UNIQUE INDEX IF NOT EXISTS idx_price_observations_external ON price_observations(source,external_id,part_template_id,motorcycle_id,COALESCE(series_id,0),market_scope_key) WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_market_refresh_recent ON market_refresh_log(motorcycle_id,market_scope_key,part_template_id,provider,refreshed_at);

CREATE INDEX IF NOT EXISTS idx_projects_motorcycle ON projects(motorcycle_id,status);
CREATE INDEX IF NOT EXISTS idx_inventory_project_status ON inventory_items(project_id,status);
CREATE INDEX IF NOT EXISTS idx_sales_project_date ON sales(project_id,sold_at);
CREATE INDEX IF NOT EXISTS idx_expenses_project_date ON project_expenses(project_id,occurred_at);
