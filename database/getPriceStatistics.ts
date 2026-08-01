import db from "./db";

export type PriceStatistics = {
  partTemplateId: number;
  motorcycleId: number | null;
  seriesId: number | null;
  count: number;
  soldCount: number;
  offerCount: number;
  minimum: number;
  lowerQuartile: number;
  median: number;
  average: number;
  upperQuartile: number;
  maximum: number;
  realisticPrice: number;
  confidence: number;
  updatedAt: string | null;
  sources: Record<string, number>;
};

type ObservationRow = {
  price: number;
  shipping_price: number;
  listing_type: "angebot" | "verkauft";
  source: string;
  observed_at: string;
};

function percentile(values: number[], p: number) {
  if (!values.length) return 0;
  if (values.length === 1) return values[0];
  const position = (values.length - 1) * p;
  const lower = Math.floor(position), upper = Math.ceil(position);
  if (lower === upper) return values[lower];
  const weight = position - lower;
  return Math.round(values[lower] * (1 - weight) + values[upper] * weight);
}

function trimOutliers(values: number[]) {
  if (values.length < 5) return values;
  const q1 = percentile(values, 0.25), q3 = percentile(values, 0.75), iqr = q3 - q1;
  const filtered = values.filter((value) => value >= Math.max(1, q1 - 1.5 * iqr) && value <= q3 + 1.5 * iqr);
  return filtered.length >= 3 ? filtered : values;
}

function confidence(count: number, soldCount: number, sourceCount: number) {
  return Math.min(95, Math.round(Math.min(65, count * 5) + Math.min(15, soldCount * 5) + Math.min(10, Math.max(0, sourceCount - 1) * 5)));
}

export function getPriceStatistics(
  partTemplateId: number,
  motorcycleId?: number | null,
  seriesId?: number | null,
  marketScopeKey?: string | null,
): PriceStatistics | null {
  if (!Number.isInteger(partTemplateId) || partTemplateId <= 0) throw new Error("Ungültige partTemplateId.");
  if (motorcycleId != null && (!Number.isInteger(motorcycleId) || motorcycleId <= 0)) throw new Error("Ungültige motorcycleId.");
  if (seriesId != null && (!Number.isInteger(seriesId) || seriesId <= 0)) throw new Error("Ungültige seriesId.");

  let clause = "motorcycle_id IS NULL AND COALESCE(series_id,0)=0";
  const parameters: Array<number | string | null> = [partTemplateId];
  if (motorcycleId != null) {
    clause = "motorcycle_id=? AND COALESCE(series_id,0)=COALESCE(?,0)";
    parameters.push(motorcycleId, seriesId ?? null);
    if (marketScopeKey) {
      clause += " AND market_scope_key=?";
      parameters.push(marketScopeKey);
    }
  }

  const rows = db.prepare(`
    SELECT price,shipping_price,listing_type,source,observed_at
    FROM price_observations
    WHERE part_template_id=? AND ${clause}
      AND COALESCE(is_active,1)=1 AND observed_at >= datetime('now','-365 days') AND price >= 5
    ORDER BY observed_at DESC
  `).all(...parameters) as ObservationRow[];
  if (!rows.length) return null;

  const weighted: number[] = [];
  let soldCount = 0, offerCount = 0;
  const sources: Record<string, number> = {};
  let updatedAt: string | null = null;
  for (const row of rows) {
    const total = Math.round(Number(row.price) + Number(row.shipping_price || 0));
    if (!Number.isFinite(total) || total <= 0) continue;
    sources[row.source] = (sources[row.source] ?? 0) + 1;
    if (!updatedAt || row.observed_at > updatedAt) updatedAt = row.observed_at;
    if (row.listing_type === "verkauft") { soldCount += 1; weighted.push(total, total); }
    else { offerCount += 1; weighted.push(total); }
  }
  if (!weighted.length) return null;
  weighted.sort((a, b) => a - b);
  const filtered = trimOutliers(weighted);
  const average = Math.round(filtered.reduce((sum, value) => sum + value, 0) / filtered.length);
  const singleValue = filtered.length === 1 ? filtered[0] : null;
  // One clean, model-specific offer is still more useful than a generic
  // estimate. Give it a cautious range instead of pretending min=max.
  const minimum = singleValue == null ? percentile(filtered, 0.1) : Math.max(1, Math.round(singleValue * 0.82));
  const lowerQuartile = singleValue == null ? percentile(filtered, 0.25) : Math.max(1, Math.round(singleValue * 0.9));
  const median = singleValue == null ? percentile(filtered, 0.5) : singleValue;
  const upperQuartile = singleValue == null ? percentile(filtered, 0.75) : Math.round(singleValue * 1.1);
  const maximum = singleValue == null ? percentile(filtered, 0.9) : Math.round(singleValue * 1.18);
  return {
    partTemplateId, motorcycleId: motorcycleId ?? null, seriesId: seriesId ?? null,
    count: rows.length, soldCount, offerCount, minimum, lowerQuartile, median, average, upperQuartile, maximum,
    realisticPrice: Math.round(median * 0.8 + average * 0.2),
    confidence: confidence(rows.length, soldCount, Object.keys(sources).length), updatedAt, sources,
  };
}
