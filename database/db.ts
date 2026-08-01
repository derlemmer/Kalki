import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const projectDatabaseDir = path.join(process.cwd(), "database");
const sourceDatabasePath = path.join(projectDatabaseDir, "kalki.db");
const schemaPath = path.join(projectDatabaseDir, "schema.sql");
const isVercel = Boolean(process.env.VERCEL);

let databasePath = sourceDatabasePath;
if (isVercel) {
  const temporaryDatabasePath = path.join("/tmp", "kalki.db");
  if (!fs.existsSync(sourceDatabasePath)) throw new Error(`SQLite-Datenbank wurde im Deployment nicht gefunden: ${sourceDatabasePath}`);
  if (!fs.existsSync(temporaryDatabasePath)) fs.copyFileSync(sourceDatabasePath, temporaryDatabasePath);
  databasePath = temporaryDatabasePath;
} else if (!fs.existsSync(projectDatabaseDir)) {
  fs.mkdirSync(projectDatabaseDir, { recursive: true });
}

const db = new Database(databasePath);
db.pragma("foreign_keys = ON");
db.pragma(isVercel ? "journal_mode = DELETE" : "journal_mode = WAL");

if (fs.existsSync(schemaPath)) db.exec(fs.readFileSync(schemaPath, "utf8"));

// KALKI 1.5: bewusst gestrichene Doppel-/Zubehörpositionen werden global
// aus jeder Modellliste, allen Marktwerten und alten Datenbanken entfernt.
const removedPartTemplates = ["Endschalldämpfer Zubehör", "Hitzeschutzblech", "Sammler / Kat", "ABS-Modulator", "ABS-Sensor hinten", "ABS-Sensor vorne", "Bremssattel vorne links", "Bremssattel vorne rechts", "Blinker einzeln", "Sensoren / Geber", "Zündspule einzeln", "Drosselklappengehäuse"];
const removedPlaceholders = removedPartTemplates.map(() => "?").join(",");
if (removedPlaceholders) db.prepare(`DELETE FROM part_templates WHERE name IN (${removedPlaceholders})`).run(...removedPartTemplates);

function columns(table: string) {
  return new Set((db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map((row) => row.name));
}
function ensureColumn(table: string, definition: string) {
  const name = definition.split(/\s+/)[0];
  if (!columns(table).has(name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
}

// Lightweight runtime migrations keep older ZIP/database versions compatible.
ensureColumn("motorcycles", "catalog_key TEXT");
ensureColumn("motorcycles", "source_notes TEXT");
ensureColumn("price_observations", "external_id TEXT");
ensureColumn("price_observations", "currency TEXT NOT NULL DEFAULT 'EUR'");
ensureColumn("price_observations", "image_url TEXT");
ensureColumn("price_observations", "query TEXT");
ensureColumn("price_observations", "last_seen_at TEXT");
ensureColumn("price_observations", "is_active INTEGER NOT NULL DEFAULT 1");
ensureColumn("price_observations", "raw_json TEXT");
ensureColumn("price_observations", "series_id INTEGER");
ensureColumn("price_observations", "market_scope_key TEXT NOT NULL DEFAULT ''");
ensureColumn("market_refresh_log", "series_code TEXT NOT NULL DEFAULT ''");
ensureColumn("market_refresh_log", "series_id INTEGER");
ensureColumn("market_refresh_log", "market_scope_key TEXT NOT NULL DEFAULT ''");

db.exec(`
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
  DROP INDEX IF EXISTS idx_market_refresh_recent;
  CREATE INDEX IF NOT EXISTS idx_market_refresh_recent ON market_refresh_log(motorcycle_id,market_scope_key,part_template_id,provider,refreshed_at);
`);

export default db;
