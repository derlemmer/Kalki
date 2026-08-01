import db from "./db";
import { getPriceStatistics } from "./getPriceStatistics";

export type PartSource =
  | "generic"
  | "family"
  | "motorcycle"
  | "market";

export type PartRow = {
  id: number;
  motorcycle_id: number;
  name: string;
  category: string;
  min_price: number;
  realistic_price: number;
  max_price: number;
  probability: number;
  source: PartSource;
  observation_count: number;
  confidence: number;
  market_updated_at: string | null;
  market_checked_at: string | null;
  market_check_status: string | null;
};

type MotorcycleRow = {
  id: number;
  brand: string;
  model: string;
};

type DatabasePartRow = {
  template_id: number;
  name: string;
  category: string;
  min_price: number;
  realistic_price: number;
  max_price: number;
  probability: number;
  scope_type: Exclude<PartSource, "market">;
};

function deriveFamilyKey(model: string): string | null {
  const normalized = model
    .trim()
    .toUpperCase()
    .replace(/[\s_-]+/g, "");

  const match = normalized.match(/^([A-Z]+)(?=\d)/);

  return match?.[1] ?? null;
}

export function getPartsForMotorcycle(
  motorcycleId: number,
  seriesId?: number | null,
  marketScopeKey?: string | null,
): PartRow[] {
  if (!Number.isInteger(motorcycleId) || motorcycleId <= 0) {
    throw new Error("Ungültige motorcycleId.");
  }

  const motorcycle = db.prepare(`
    SELECT id, brand, model
    FROM motorcycles
    WHERE id = ?
  `).get(motorcycleId) as MotorcycleRow | undefined;

  if (!motorcycle) {
    throw new Error(
      `Motorrad mit ID ${motorcycleId} wurde nicht gefunden.`,
    );
  }

  const familyKey = deriveFamilyKey(motorcycle.model);
  const normalizedSeriesId = Number.isInteger(Number(seriesId)) && Number(seriesId) > 0 ? Number(seriesId) : null;
  if (normalizedSeriesId) {
    const valid = db.prepare(`SELECT id FROM series WHERE id=? AND motorcycle_id=?`).get(normalizedSeriesId, motorcycleId);
    if (!valid) throw new Error("Die Baureihe gehört nicht zu diesem Motorrad.");
  }
  const scopeKey = marketScopeKey?.trim() || (normalizedSeriesId ? `series:${normalizedSeriesId}` : `family:${motorcycleId}`);

  const rows = db.prepare(`
    SELECT
      pt.id AS template_id,
      pt.name,
      pt.category,
      pv.min_price,
      pv.realistic_price,
      pv.max_price,
      COALESCE(
        pv.probability,
        pt.default_probability,
        70
      ) AS probability,
      pv.scope_type
    FROM part_templates AS pt
    INNER JOIN part_values AS pv
      ON pv.part_template_id = pt.id
    WHERE
      pt.name NOT IN (
        'Endschalldämpfer Zubehör','Hitzeschutzblech','Sammler / Kat','ABS-Modulator',
        'ABS-Sensor hinten','ABS-Sensor vorne','Bremssattel vorne links','Bremssattel vorne rechts',
        'Blinker einzeln','Sensoren / Geber','Zündspule einzeln','Drosselklappengehäuse'
      )
      AND (
        (
        pv.scope_type = 'generic'
        AND pv.scope_key IS NULL
        AND pv.motorcycle_id IS NULL
        AND pv.motorcycle_type_id IS NULL
      )
      OR
      (
        ? IS NOT NULL
        AND pv.scope_type = 'family'
        AND UPPER(pv.scope_key) = UPPER(?)
        AND pv.motorcycle_id IS NULL
        AND pv.motorcycle_type_id IS NULL
      )
      OR
      (
        pv.scope_type = 'motorcycle'
        AND pv.scope_key IS NULL
        AND pv.motorcycle_id = ?
        AND pv.motorcycle_type_id IS NULL
      )
      )
    ORDER BY
      CASE pv.scope_type
        WHEN 'generic' THEN 1
        WHEN 'family' THEN 2
        WHEN 'motorcycle' THEN 3
        ELSE 0
      END,
      pv.id
  `).all(
    familyKey,
    familyKey,
    motorcycleId,
  ) as DatabasePartRow[];

  /*
   * Die Reihenfolge sorgt dafür:
   *
   * generic wird zuerst gesetzt,
   * family überschreibt generic,
   * motorcycle überschreibt family.
   */
  const merged = new Map<number, PartRow>();

  for (const row of rows) {
    merged.set(row.template_id, {
      id: row.template_id,
      motorcycle_id: motorcycleId,
      name: row.name,
      category: row.category,
      // Keine Marktdaten = kein Preis. Historische generische, Familien- und
      // Modellschätzungen werden bewusst nicht mehr ausgeliefert.
      min_price: 0,
      realistic_price: 0,
      max_price: 0,
      probability: row.probability,
      source: row.scope_type,
      observation_count: 0,
      confidence: 0,
      market_updated_at: null,
      market_checked_at: null,
      market_check_status: null,
    });
  }

  const refreshRows = db.prepare(`
    SELECT part_template_id, status, refreshed_at
    FROM (
      SELECT part_template_id, status, refreshed_at,
        ROW_NUMBER() OVER (PARTITION BY part_template_id ORDER BY refreshed_at DESC, id DESC) AS rn
      FROM market_refresh_log
      WHERE motorcycle_id = ? AND provider = 'ebay' AND market_scope_key = ? AND part_template_id IS NOT NULL
    )
    WHERE rn = 1
  `).all(motorcycleId, scopeKey) as Array<{ part_template_id: number; status: string; refreshed_at: string }>;
  const refreshByPart = new Map(refreshRows.map((row) => [row.part_template_id, row]));

  for (const part of merged.values()) {
    const refresh = refreshByPart.get(part.id);
    if (refresh) {
      part.market_checked_at = refresh.refreshed_at;
      part.market_check_status = refresh.status;
    }
  }

  /*
   * Marktbeobachtungen haben höchste Priorität.
   *
   * Die Verkaufswahrscheinlichkeit aus der bisherigen
   * Teilebewertung bleibt erhalten. Der Markt-Confidence-Wert
   * beschreibt nur die Sicherheit des Preises und ersetzt
   * deshalb nicht automatisch probability.
   */
  for (const part of merged.values()) {
    const statistics = getPriceStatistics(part.id, motorcycleId, normalizedSeriesId, scopeKey);
    if (!statistics || statistics.count < 1) continue;

    part.min_price = statistics.minimum;
    part.realistic_price = statistics.realisticPrice;
    part.max_price = statistics.maximum;
    part.source = "market";
    part.observation_count = statistics.count;
    part.confidence = statistics.confidence;
    part.market_updated_at = statistics.updatedAt;
  }

  return [...merged.values()].sort((a, b) => {
    const categoryComparison = a.category.localeCompare(
      b.category,
      "de",
    );

    if (categoryComparison !== 0) {
      return categoryComparison;
    }

    return a.name.localeCompare(b.name, "de");
  });
}
