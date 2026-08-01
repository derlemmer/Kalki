import db from "./db";

type MotorcycleRow = {
  id: number;
  brand: string;
  family: string | null;
  model: string;
  variant: string | null;
  display_name: string | null;
  production_from: number;
  production_to: number;
  engine_cc: number | null;
  cylinders: number | null;
  hp: number | null;
  cooling: string | null;
  fuel: string | null;
  abs: number;
  data_status: string;
};

type AliasRow = { motorcycle_id: number; value: string };
type SeriesRow = {
  id: number;
  motorcycle_id: number;
  code: string | null;
  variant: string | null;
  from_year: number;
  to_year: number;
  market: string | null;
};

export type MotorcycleSummary = {
  id: number;
  brand: string;
  family: string | null;
  model: string;
  variant: string | null;
  displayName: string | null;
  production: { from: number; to: number };
  engineCc: number | null;
  cylinders: number | null;
  hp: number | null;
  cooling: string | null;
  fuel: string | null;
  abs: boolean;
  dataStatus: string;
};

export type MotorcycleSearchResult = {
  motorcycle: MotorcycleSummary;
  matchedSeries: {
    id: number;
    code: string | null;
    variant: string | null;
    from: number;
    to: number;
    market: string[];
  } | null;
  aliases: string[];
  score: number;
  alternatives?: Array<{ motorcycle: MotorcycleSummary; score: number }>;
};

type CatalogEntry = {
  motorcycle: MotorcycleSummary;
  aliases: string[];
  series: SeriesRow[];
  normalizedBrand: string;
  normalizedModel: string;
  compactModel: string;
};

function normalizeText(value: string): string {
  return value
    .toLocaleLowerCase("de-DE")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactText(value: string): string {
  return normalizeText(value).replace(/\s+/g, "");
}

function tokenContains(haystack: string, needle: string): boolean {
  if (!needle) return false;
  return (` ${haystack} `).includes(` ${needle} `);
}

function extractYear(input: string): number | null {
  const labelled = input.match(/(?:Erstzulassung|Erstzul\.|Baujahr|Modelljahr|\bEZ)\s*[:\-]?\s*(?:\d{1,2}[./-])?((?:19|20)\d{2})\b/i)?.[1];
  if (labelled) return Number(labelled);
  const candidates = [...input.matchAll(/\b(19\d{2}|20\d{2})\b/g)]
    .filter((match) => {
      const start = Math.max(0, (match.index ?? 0) - 18);
      const context = input.slice(start, (match.index ?? 0) + match[0].length + 4);
      return !/(?:TÜV|HU|AU)\s*(?:bis)?\s*(?:\d{1,2}[./-])?\s*$/i.test(context.slice(0, -4));
    })
    .map((match) => Number(match[1]));
  return candidates.find(Number.isInteger) ?? null;
}

let cachedCatalog: CatalogEntry[] | null = null;

function loadCatalog(): CatalogEntry[] {
  if (cachedCatalog) return cachedCatalog;

  const motorcycles = db.prepare(`
    SELECT id, brand, family, model, variant, display_name,
      production_from, production_to, engine_cc, cylinders, hp,
      cooling, fuel, abs, data_status
    FROM motorcycles
    ORDER BY brand, model
  `).all() as MotorcycleRow[];

  const aliasRows = db.prepare(`SELECT motorcycle_id, value FROM aliases`).all() as AliasRow[];
  const seriesRows = db.prepare(`
    SELECT id, motorcycle_id, code, variant, from_year, to_year, market
    FROM series
  `).all() as SeriesRow[];

  const aliasesByMotorcycle = new Map<number, string[]>();
  for (const row of aliasRows) {
    const values = aliasesByMotorcycle.get(row.motorcycle_id) ?? [];
    values.push(row.value);
    aliasesByMotorcycle.set(row.motorcycle_id, values);
  }

  const seriesByMotorcycle = new Map<number, SeriesRow[]>();
  for (const row of seriesRows) {
    const values = seriesByMotorcycle.get(row.motorcycle_id) ?? [];
    values.push(row);
    seriesByMotorcycle.set(row.motorcycle_id, values);
  }

  cachedCatalog = motorcycles.map((row) => {
    const motorcycle: MotorcycleSummary = {
      id: row.id,
      brand: row.brand,
      family: row.family,
      model: row.model,
      variant: row.variant,
      displayName: row.display_name,
      production: { from: row.production_from, to: row.production_to },
      engineCc: row.engine_cc,
      cylinders: row.cylinders,
      hp: row.hp,
      cooling: row.cooling,
      fuel: row.fuel,
      abs: row.abs === 1,
      dataStatus: row.data_status,
    };

    return {
      motorcycle,
      aliases: aliasesByMotorcycle.get(row.id) ?? [],
      series: seriesByMotorcycle.get(row.id) ?? [],
      normalizedBrand: normalizeText(row.brand),
      normalizedModel: normalizeText(row.model),
      compactModel: compactText(row.model),
    };
  });

  return cachedCatalog;
}

function scoreEntry(entry: CatalogEntry, input: string, year: number | null) {
  const normalizedInput = normalizeText(input);
  const compactInput = compactText(input);
  const brandMatched = tokenContains(normalizedInput, entry.normalizedBrand) ||
    compactInput.includes(compactText(entry.motorcycle.brand));

  let score = brandMatched ? 35 : 0;
  let modelMatched = false;

  if (tokenContains(normalizedInput, entry.normalizedModel)) {
    score += 120;
    modelMatched = true;
  } else if (entry.compactModel.length >= 3 && compactInput.includes(entry.compactModel)) {
    score += 105;
    modelMatched = true;
  }

  let bestAliasScore = 0;
  for (const alias of entry.aliases) {
    const normalizedAlias = normalizeText(alias);
    const compactAlias = compactText(alias);
    if (!compactAlias) continue;

    const exactToken = tokenContains(normalizedInput, normalizedAlias);
    const compactMatch = compactAlias.length >= 3 && compactInput.includes(compactAlias);
    if (!exactToken && !compactMatch) continue;

    // Very short labels such as R1/K1 are useful only together with the brand.
    if (compactAlias.length <= 2 && !brandMatched) continue;
    const aliasScore = Math.min(95, 30 + compactAlias.length * 4);
    bestAliasScore = Math.max(bestAliasScore, aliasScore);
    modelMatched = true;
  }
  score += bestAliasScore;

  const rankedSeries = entry.series
    .map((series) => {
      let seriesScore = 0;
      const code = series.code ? normalizeText(series.code) : "";
      const variant = series.variant ? normalizeText(series.variant) : "";
      if (code && tokenContains(normalizedInput, code)) seriesScore += 135;
      else if (code && compactInput.includes(compactText(code))) seriesScore += 120;
      if (variant && tokenContains(normalizedInput, variant)) seriesScore += 45;
      if (year !== null && year >= series.from_year && year <= series.to_year) seriesScore += 25;
      return { series, seriesScore };
    })
    .sort((a, b) => b.seriesScore - a.seriesScore || a.series.from_year - b.series.from_year);
  const bestSeriesScore = rankedSeries[0]?.seriesScore ?? 0;
  const topSeries = rankedSeries.filter((candidate) => candidate.seriesScore === bestSeriesScore && bestSeriesScore > 0);
  const matchedSeries: SeriesRow | null = topSeries.length === 1 ? topSeries[0].series : null;
  score += bestSeriesScore;

  if (year !== null) {
    if (year >= entry.motorcycle.production.from && year <= entry.motorcycle.production.to) score += 25;
    else score -= 55;
  }

  if (modelMatched) score += Math.min(20, entry.compactModel.length);
  if (!modelMatched && bestSeriesScore === 0) score = 0;
  if (!brandMatched && bestSeriesScore === 0) score -= 15;

  return { score, matchedSeries };
}

export function findMotorcycleFromDatabase(input: string, preferredYear?: number | null): MotorcycleSearchResult | null {
  const searchText = input.trim();
  if (!searchText) return null;
  const year = preferredYear != null && Number.isInteger(preferredYear) ? preferredYear : extractYear(searchText);

  const ranked = loadCatalog()
    .map((entry) => ({ entry, ...scoreEntry(entry, searchText, year) }))
    .filter((item) => item.score >= 65)
    .sort((a, b) => b.score - a.score || b.entry.compactModel.length - a.entry.compactModel.length);

  const best = ranked[0];
  if (!best) return null;

  const alternatives = ranked
    .slice(1, 5)
    .filter((item) => best.score - item.score <= 25)
    .map((item) => ({ motorcycle: item.entry.motorcycle, score: item.score }));

  const series = best.matchedSeries;
  return {
    motorcycle: best.entry.motorcycle,
    matchedSeries: series ? {
      id: series.id,
      code: series.code,
      variant: series.variant,
      from: series.from_year,
      to: series.to_year,
      market: series.market ? series.market.split(",").map((value) => value.trim()).filter(Boolean) : [],
    } : null,
    aliases: best.entry.aliases,
    score: best.score,
    alternatives,
  };
}

export function listMotorcycleBrands(): string[] {
  return [...new Set(loadCatalog().map((entry) => entry.motorcycle.brand))].sort((a, b) => a.localeCompare(b, "de"));
}

export function searchMotorcycles(options: { brand?: string; query?: string; limit?: number } = {}): MotorcycleSummary[] {
  const brand = normalizeText(options.brand ?? "");
  const query = normalizeText(options.query ?? "");
  const compactQuery = compactText(options.query ?? "");
  const limit = Math.max(1, Math.min(100, options.limit ?? 30));

  return loadCatalog()
    .filter((entry) => !brand || entry.normalizedBrand === brand)
    .filter((entry) => {
      if (!query) return true;
      if (entry.normalizedModel.includes(query) || entry.compactModel.includes(compactQuery)) return true;
      return entry.aliases.some((alias) => normalizeText(alias).includes(query) || compactText(alias).includes(compactQuery));
    })
    .slice(0, limit)
    .map((entry) => entry.motorcycle);
}

export function getMotorcycleById(id: number): MotorcycleSummary | null {
  return loadCatalog().find((entry) => entry.motorcycle.id === id)?.motorcycle ?? null;
}
