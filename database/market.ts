import db from "./db";
import { getMotorcycleById } from "./findMotorcycle";
import { getPartProfile, detectMarketCondition } from "./import/partProfiles";
import { buildEbayQueries, decideEbayListing, selectListingsForStatistics } from "../lib/marketSearch";
import { searchEbay, isEbayConfigured, type EbayListing } from "../lib/ebay";
import { getPriceStatistics } from "./getPriceStatistics";
import {
  getRemoteMarketChecks,
  deactivateRemoteObservations,
  upsertRemoteCache,
  upsertRemoteMarketCheck,
  upsertRemoteObservations,
  type RemoteObservation,
} from "../lib/remoteMarketStore";
import {
  compactMarketText as compact,
  listingMatchesMotorcycle,
  normalizeMarketText as normalize,
  type MotorcycleMarketIdentity,
} from "../lib/modelIsolation";

type PartTemplate = { id: number; name: string; category: string };
type AliasRow = { value: string };
type SeriesRow = { id: number; code: string | null; variant: string | null; from_year: number; to_year: number };
type RefreshLogRow = {
  part_template_id: number;
  last_success_at: string | null;
  last_attempt_at: string | null;
  last_status: string | null;
};

export type MarketSeriesInput = {
  seriesId?: number | null;
  seriesCode?: string | null;
  seriesVariant?: string | null;
  modelYear?: number | null;
};

export type MarketRefreshProgress = {
  total: number;
  fresh: number;
  stale: number;
  priced: number;
  eligible: number;
  recentlyAttempted: number;
  lastSuccessAt: string | null;
};

export const MARKET_MATCHER_VERSION = "2026-08-object-v5-zero";

const IMPORTANT_PARTS = [
  "Motor komplett", "Tank", "Vergaseranlage komplett",
  "Gabel komplett", "Vorderrad komplett", "Hinterrad komplett", "Felgensatz",
  "Auspuffanlage komplett", "Tacho / Kombiinstrument", "Cockpit komplett",
  "ECU / CDI", "Rahmen", "Sitzbank",
];

function unique(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))];
}

function normalizedSeriesCode(seriesCode?: string | null) {
  return seriesCode?.trim().toUpperCase() || "";
}

function validYear(value?: number | null) {
  return Number.isInteger(value) && Number(value) >= 1900 && Number(value) <= new Date().getFullYear() + 1
    ? Number(value)
    : null;
}

function generationTokens(variant?: string | null, code?: string | null) {
  const codeCompact = compact(code || "");
  return unique(normalize(variant || "").split(" ")
    .filter((token) =>
      (token.length >= 3 || /[a-z]\d|\d[a-z]/.test(token))
      && !/^\d{4}$/.test(token)
      && compact(token) !== codeCompact,
    ));
}

const competingModelTermsCache = new Map<number, string[]>();

function competingModelTerms(
  motorcycleId: number,
  brand: string,
  targetTerms: string[],
) {
  const cached = competingModelTermsCache.get(motorcycleId);
  if (cached) return cached;
  const targetCompacts = new Set(targetTerms.map(compact).filter(Boolean));
  const rows = db.prepare(`
    SELECT model AS value FROM motorcycles WHERE brand=? AND id<>?
    UNION ALL
    SELECT a.value
    FROM aliases a
    INNER JOIN motorcycles m ON m.id=a.motorcycle_id
    WHERE m.brand=? AND m.id<>?
  `).all(brand, motorcycleId, brand, motorcycleId) as Array<{ value: string }>;
  const terms = unique(rows.map((row) => row.value))
    .filter((value) => {
      const candidate = compact(value);
      if (candidate.length < 3 || targetCompacts.has(candidate)) return false;
      // A broader sibling label such as R100 must not reject the more specific
      // target R100GS. A more specific sibling such as R100GS must reject R100.
      return ![...targetCompacts].some((target) => target.includes(candidate));
    });
  competingModelTermsCache.set(motorcycleId, terms);
  return terms;
}

export function resolveMarketSeries(motorcycleId: number, input: MarketSeriesInput = {}): SeriesRow | null {
  const requestedId = Number(input.seriesId);
  if (Number.isInteger(requestedId) && requestedId > 0) {
    const row = db.prepare(`
      SELECT id,code,variant,from_year,to_year FROM series
      WHERE id=? AND motorcycle_id=? LIMIT 1
    `).get(requestedId, motorcycleId) as SeriesRow | undefined;
    if (!row) throw new Error("Die erkannte Baureihe gehört nicht zu diesem Motorrad.");
    return row;
  }

  const code = normalizedSeriesCode(input.seriesCode);
  const year = validYear(input.modelYear);
  const variant = normalize(input.seriesVariant || "");
  const rows = db.prepare(`
    SELECT id,code,variant,from_year,to_year FROM series
    WHERE motorcycle_id=?
    ORDER BY from_year,to_year,id
  `).all(motorcycleId) as SeriesRow[];

  if (!code && year == null && !variant) return null;

  const candidates = rows.filter((row) => !code || normalizedSeriesCode(row.code) === code);
  if (!candidates.length) {
    if (code) throw new Error(`Typcode ${code} ist diesem Motorrad nicht zugeordnet.`);
    return null;
  }

  const ranked = candidates
    .map((row) => {
      let score = 0;
      if (code && normalizedSeriesCode(row.code) === code) score += 100;
      if (year != null && year >= row.from_year && year <= row.to_year) score += 80;
      if (variant && normalize(row.variant || "") === variant) score += 60;
      return { row, score };
    })
    .sort((a, b) => b.score - a.score || a.row.from_year - b.row.from_year);

  const best = ranked[0];
  if (!best || best.score <= 0) return null;
  const equallyGood = ranked.filter((candidate) => candidate.score === best.score);
  return equallyGood.length === 1 ? best.row : null;
}

export function getMotorcycleMarketScopeKey(
  motorcycleId: number,
  input: MarketSeriesInput = {},
  brand?: string,
  model?: string,
) {
  const motorcycle = db.prepare(`SELECT catalog_key,brand,model FROM motorcycles WHERE id=?`).get(motorcycleId) as
    { catalog_key: string | null; brand: string; model: string } | undefined;
  const base = motorcycle?.catalog_key || `${brand || motorcycle?.brand || "unknown"}:${model || motorcycle?.model || motorcycleId}`;
  const series = resolveMarketSeries(motorcycleId, input);
  if (!series) return `${base}:family:matcher:${MARKET_MATCHER_VERSION}`;
  return `${base}:series:${series.id}:${normalizedSeriesCode(series.code) || "NO-CODE"}:${series.from_year}-${series.to_year}:${compact(series.variant || "base")}:matcher:${MARKET_MATCHER_VERSION}`;
}

export function getMotorcycleMarketIdentity(
  motorcycleId: number,
  input: MarketSeriesInput = {},
): MotorcycleMarketIdentity {
  const motorcycle = getMotorcycleById(motorcycleId);
  if (!motorcycle) throw new Error("Motorrad wurde nicht gefunden.");
  const series = resolveMarketSeries(motorcycleId, input);

  const aliases = (db.prepare(`SELECT value FROM aliases WHERE motorcycle_id=?`).all(motorcycleId) as AliasRow[])
    .map((row) => row.value);
  const allSeries = db.prepare(`SELECT id,code,variant,from_year,to_year FROM series WHERE motorcycle_id=?`).all(motorcycleId) as SeriesRow[];
  const knownCodes = unique(allSeries.map((row) => row.code));
  const knownSeriesTerms = new Set(allSeries.flatMap((row) => [row.code, row.variant]).filter(Boolean).map((value) => compact(String(value))));
  const targetTerms = new Set([series?.code, series?.variant].filter(Boolean).map((value) => compact(String(value))));
  const safeAliases = aliases.filter((alias) => !knownSeriesTerms.has(compact(alias)) || targetTerms.has(compact(alias)));
  const knownBrands = (db.prepare(`SELECT DISTINCT brand FROM motorcycles ORDER BY brand`).all() as Array<{ brand: string }>).map((row) => row.brand);
  const sameCodeRows = series
    ? allSeries.filter((row) => normalizedSeriesCode(row.code) === normalizedSeriesCode(series.code))
    : [];
  const targetGenerationTokens = generationTokens(series?.variant, series?.code);
  const siblingGenerationTokens = new Set(
    sameCodeRows
      .filter((row) => row.id !== series?.id)
      .flatMap((row) => generationTokens(row.variant, row.code)),
  );
  const requiredGenerationTerms = sameCodeRows.length > 1
    ? targetGenerationTokens.filter((token) => !siblingGenerationTokens.has(token))
    : targetGenerationTokens;

  const targetModelTerms = unique([motorcycle.model, motorcycle.displayName, motorcycle.variant, ...safeAliases]);

  return {
    motorcycleId,
    brand: motorcycle.brand,
    model: motorcycle.model,
    aliases: targetModelTerms,
    competingModelTerms: competingModelTerms(motorcycleId, motorcycle.brand, targetModelTerms),
    seriesCodes: series?.code ? [series.code] : [],
    requiredSeriesCode: series?.code ?? null,
    requiredVariant: series?.variant ?? null,
    seriesFrom: series?.from_year ?? null,
    seriesTo: series?.to_year ?? null,
    modelYear: validYear(input.modelYear),
    // Exact unique type codes (for example GR7DB or SC57) identify the
    // generation on their own. Only reused codes need an extra year/variant.
    requireGenerationMarker: Boolean(series && sameCodeRows.length > 1),
    requiredGenerationTerms,
    knownSeriesCodes: knownCodes,
    knownBrands,
  };
}


async function hydrateRemoteChecks(motorcycleId: number, input: MarketSeriesInput) {
  const scopeKey = getMotorcycleMarketScopeKey(motorcycleId, input);
  const series = resolveMarketSeries(motorcycleId, input);
  const rows = await getRemoteMarketChecks(scopeKey).catch(() => []);
  if (!rows.length) return;

  const latest = db.prepare(`
    SELECT refreshed_at FROM market_refresh_log
    WHERE motorcycle_id=? AND market_scope_key=? AND part_template_id=? AND provider=?
    ORDER BY refreshed_at DESC,id DESC LIMIT 1
  `);
  const insert = db.prepare(`
    INSERT INTO market_refresh_log(
      motorcycle_id,series_code,series_id,market_scope_key,part_template_id,provider,query,status,
      result_count,error_message,refreshed_at
    ) VALUES(?,?,?,?,?,?,?,?,?,?,datetime(?))
  `);
  db.transaction(() => {
    for (const row of rows) {
      const local = latest.get(motorcycleId, scopeKey, row.part_template_id, row.provider) as { refreshed_at: string } | undefined;
      if (local?.refreshed_at && Date.parse(local.refreshed_at.replace(" ", "T") + "Z") >= Date.parse(row.checked_at)) continue;
      insert.run(motorcycleId, normalizedSeriesCode(series?.code), series?.id ?? null, scopeKey, row.part_template_id,
        row.provider, row.query || "remote-cache", row.status, row.result_count, row.error_message, row.checked_at);
    }
  })();
}

function latestRefresh(motorcycleId: number, partTemplateId: number, input: MarketSeriesInput, provider = "ebay") {
  const scopeKey = getMotorcycleMarketScopeKey(motorcycleId, input);
  return db.prepare(`
    SELECT status,refreshed_at FROM market_refresh_log
    WHERE motorcycle_id=? AND market_scope_key=? AND part_template_id=? AND provider=?
    ORDER BY refreshed_at DESC,id DESC LIMIT 1
  `).get(motorcycleId, scopeKey, partTemplateId, provider) as { status: string; refreshed_at: string } | undefined;
}

export function isPartMarketFresh(motorcycleId: number, partTemplateId: number, input: MarketSeriesInput = {}, maxAgeDays = 7) {
  const scopeKey = getMotorcycleMarketScopeKey(motorcycleId, input);
  const row = db.prepare(`
    SELECT 1 AS fresh FROM market_refresh_log
    WHERE motorcycle_id=? AND market_scope_key=? AND part_template_id=? AND provider='ebay' AND status='ok'
      AND refreshed_at >= datetime('now',?) LIMIT 1
  `).get(motorcycleId, scopeKey, partTemplateId, `-${Math.max(1, Math.floor(maxAgeDays))} days`) as { fresh: number } | undefined;
  return Boolean(row?.fresh);
}

function refreshRows(motorcycleId: number, input: MarketSeriesInput): RefreshLogRow[] {
  const scopeKey = getMotorcycleMarketScopeKey(motorcycleId, input);
  return db.prepare(`
    WITH latest AS (
      SELECT l.part_template_id,l.status,l.refreshed_at,
        ROW_NUMBER() OVER (PARTITION BY l.part_template_id ORDER BY l.refreshed_at DESC,l.id DESC) rn
      FROM market_refresh_log l
      WHERE l.motorcycle_id=? AND l.market_scope_key=? AND l.provider='ebay' AND l.part_template_id IS NOT NULL
    ), successes AS (
      SELECT part_template_id,MAX(refreshed_at) last_success_at
      FROM market_refresh_log
      WHERE motorcycle_id=? AND market_scope_key=? AND provider='ebay' AND status='ok' AND part_template_id IS NOT NULL
      GROUP BY part_template_id
    )
    SELECT pt.id part_template_id,s.last_success_at,latest.refreshed_at last_attempt_at,latest.status last_status
    FROM part_templates pt
    LEFT JOIN successes s ON s.part_template_id=pt.id
    LEFT JOIN latest ON latest.part_template_id=pt.id AND latest.rn=1
  `).all(motorcycleId, scopeKey, motorcycleId, scopeKey) as RefreshLogRow[];
}

function isoIsNewerThan(value: string | null, milliseconds: number) {
  if (!value) return false;
  const time = Date.parse(value.replace(" ", "T") + (value.includes("Z") || value.includes("+") ? "" : "Z"));
  return Number.isFinite(time) && time >= Date.now() - milliseconds;
}

export function getMarketRefreshProgress(
  motorcycleId: number,
  maxAgeDays = 7,
  input: MarketSeriesInput = {},
  clientFreshPartIds: number[] = [],
  clientPricedPartIds: number[] = [],
): MarketRefreshProgress {
  const rows = refreshRows(motorcycleId, input);
  const clientFresh = new Set(clientFreshPartIds.filter((id) => Number.isInteger(id) && id > 0));
  const clientPriced = new Set(clientPricedPartIds.filter((id) => Number.isInteger(id) && id > 0));
  const freshMs = Math.max(1, maxAgeDays) * 86_400_000;
  const cooldownMs = 10 * 60_000;
  let fresh = 0, eligible = 0, recentlyAttempted = 0;
  let lastSuccessAt: string | null = null;
  for (const row of rows) {
    if (clientFresh.has(row.part_template_id) || isoIsNewerThan(row.last_success_at, freshMs)) {
      fresh += 1;
      if (!lastSuccessAt || (row.last_success_at ?? "") > lastSuccessAt) lastSuccessAt = row.last_success_at;
    } else if (isoIsNewerThan(row.last_attempt_at, cooldownMs)) recentlyAttempted += 1;
    else eligible += 1;
  }
  const scopeKey = getMotorcycleMarketScopeKey(motorcycleId, input);
  const serverPricedRows = db.prepare(`
    SELECT DISTINCT part_template_id
    FROM price_observations
    WHERE motorcycle_id=? AND market_scope_key=? AND COALESCE(is_active,1)=1
  `).all(motorcycleId, scopeKey) as Array<{ part_template_id: number }>;
  const pricedParts = new Set([
    ...serverPricedRows.map((row) => row.part_template_id),
    ...clientPriced,
  ]);
  return {
    total: rows.length,
    fresh,
    stale: rows.length - fresh,
    priced: Math.min(rows.length, pricedParts.size),
    eligible,
    recentlyAttempted,
    lastSuccessAt,
  };
}

function staleTargets(
  motorcycleId: number,
  maxAgeDays: number,
  limit: number,
  input: MarketSeriesInput,
  clientFreshPartIds: number[] = [],
) {
  const clientFresh = new Set(clientFreshPartIds.filter((id) => Number.isInteger(id) && id > 0));
  const freshMs = Math.max(1, maxAgeDays) * 86_400_000;
  const cooldownMs = 10 * 60_000;
  const eligibleIds = refreshRows(motorcycleId, input)
    .filter((row) => !clientFresh.has(row.part_template_id)
      && !isoIsNewerThan(row.last_success_at, freshMs)
      && !isoIsNewerThan(row.last_attempt_at, cooldownMs))
    .map((row) => row.part_template_id);
  if (!eligibleIds.length) return [] as PartTemplate[];
  const placeholders = eligibleIds.map(() => "?").join(",");
  const parts = db.prepare(`SELECT id,name,category FROM part_templates WHERE id IN (${placeholders})`).all(...eligibleIds) as PartTemplate[];
  const priority = new Map(IMPORTANT_PARTS.map((name, index) => [name, index]));
  return parts.sort((a, b) => (priority.get(a.name) ?? 999) - (priority.get(b.name) ?? 999)
    || a.category.localeCompare(b.category, "de") || a.name.localeCompare(b.name, "de"))
    .slice(0, Math.max(1, Math.min(8, limit)));
}

const upsertObservation = db.prepare(`
  INSERT INTO price_observations(
    part_template_id,motorcycle_id,motorcycle_type_id,series_id,market_scope_key,source,listing_type,
    price,shipping_price,condition,title,url,observed_at,external_id,currency,image_url,query,last_seen_at,is_active,raw_json
  ) VALUES(?,?,?,?,?,'ebay','angebot',?,?,?,?,?,CURRENT_TIMESTAMP,?,?,?,?,CURRENT_TIMESTAMP,1,?)
  ON CONFLICT DO UPDATE SET
    price=excluded.price,shipping_price=excluded.shipping_price,condition=excluded.condition,title=excluded.title,
    url=excluded.url,image_url=excluded.image_url,query=excluded.query,motorcycle_type_id=excluded.motorcycle_type_id,
    series_id=excluded.series_id,market_scope_key=excluded.market_scope_key,observed_at=CURRENT_TIMESTAMP,
    last_seen_at=CURRENT_TIMESTAMP,is_active=1,raw_json=excluded.raw_json
`);

function getMotorcycleTypeId(motorcycleId: number, code?: string | null) {
  if (!code) return null;
  const row = db.prepare(`SELECT id FROM motorcycle_types WHERE motorcycle_id=? AND UPPER(type_code)=UPPER(?) LIMIT 1`)
    .get(motorcycleId, code) as { id: number } | undefined;
  return row?.id ?? null;
}

export async function refreshEbayPrice(options: {
  motorcycleId: number;
  partTemplateId: number;
  seriesId?: number | null;
  seriesCode?: string | null;
  seriesVariant?: string | null;
  modelYear?: number | null;
  maxAgeDays?: number;
  force?: boolean;
}) {
  const input: MarketSeriesInput = options;
  const series = resolveMarketSeries(options.motorcycleId, input);
  const scopeKey = getMotorcycleMarketScopeKey(options.motorcycleId, input);
  const motorcycleTypeId = getMotorcycleTypeId(options.motorcycleId, series?.code);

  if (!isEbayConfigured()) {
    return { configured: false, scopeKey, imported: 0, rejected: 0, skipped: false, query: "",
      statistics: getPriceStatistics(options.partTemplateId, options.motorcycleId, series?.id ?? null, scopeKey) };
  }

  const maxAgeDays = options.maxAgeDays ?? 7;
  if (!options.force && isPartMarketFresh(options.motorcycleId, options.partTemplateId, input, maxAgeDays)) {
    return { configured: true, scopeKey, imported: 0, rejected: 0, skipped: true, query: "",
      checkedAt: latestRefresh(options.motorcycleId, options.partTemplateId, input)?.refreshed_at ?? null,
      statistics: getPriceStatistics(options.partTemplateId, options.motorcycleId, series?.id ?? null, scopeKey) };
  }

  const identity = getMotorcycleMarketIdentity(options.motorcycleId, input);
  const part = db.prepare(`SELECT id,name,category FROM part_templates WHERE id=?`).get(options.partTemplateId) as PartTemplate | undefined;
  if (!part) throw new Error("Bauteil wurde nicht gefunden.");
  const queries = buildEbayQueries(identity, part.name);
  const queryLabel = queries.join(" || ");
  let imported = 0, rejected = 0;
  const rejectionReasons: Record<string, number> = {};
  const seen = new Set<string>();
  const exactAccepted: Array<{ listing: EbayListing; quality: "exact" }> = [];
  const compatibleAccepted: Array<{ listing: EbayListing; quality: "compatible" }> = [];
  let accepted: Array<{ listing: EbayListing; quality: "exact" | "compatible" }> = [];

  try {
    for (const query of queries) {
      const listings = await searchEbay(query, 50);
      for (const listing of listings) {
        if (seen.has(listing.id)) continue;
        seen.add(listing.id);
        const decision = decideEbayListing(listing, identity, part.name);
        if (!decision.accepted || !decision.quality) {
          rejected += 1;
          rejectionReasons[decision.reason] = (rejectionReasons[decision.reason] || 0) + 1;
          continue;
        }
        if (decision.quality === "exact") exactAccepted.push({ listing, quality: "exact" });
        else compatibleAccepted.push({ listing, quality: "compatible" });
      }
      // Prefer a fully generation-specific sample. Compatible reused-code
      // results are only needed when eBay titles omit the year/facelift.
      if (exactAccepted.length >= 8 || exactAccepted.length + compatibleAccepted.length >= 12) break;
    }

    accepted = selectListingsForStatistics(exactAccepted, compatibleAccepted, 12);

    const remoteObservations: RemoteObservation[] = [];
    db.transaction(() => {
      // Ein neuer erfolgreicher Lauf ersetzt die Liste der aktuell sichtbaren
      // Angebote. Alte Beobachtungen bleiben historisch in der Datenbank,
      // werden aber nicht mehr als aktuelle Treffer oder Preisgrundlage gezählt.
      db.prepare(`
        UPDATE price_observations SET is_active=0
        WHERE source='ebay' AND motorcycle_id=? AND part_template_id=? AND market_scope_key=?
      `).run(identity.motorcycleId, part.id, scopeKey);
      for (const acceptedItem of accepted) {
        const { listing, quality } = acceptedItem;
        const profile = getPartProfile(part.name);
        const condition = detectMarketCondition(listing.title, profile);
        upsertObservation.run(part.id, identity.motorcycleId, motorcycleTypeId, series?.id ?? null, scopeKey,
          Math.round(listing.price), Math.round(listing.shippingPrice), condition, listing.title, listing.url,
          listing.id, listing.currency, listing.imageUrl, queryLabel, JSON.stringify({ ...listing, kalkiMatchQuality: quality }));
        remoteObservations.push({ provider: "ebay", external_id: listing.id, motorcycle_key: scopeKey,
          part_template_id: part.id, title: listing.title, url: listing.url, price: Math.round(listing.price),
          shipping_price: Math.round(listing.shippingPrice), currency: listing.currency, condition,
          image_url: listing.imageUrl, query: `${queryLabel} [${quality}]`, observed_at: new Date().toISOString(), is_active: true });
        imported += 1;
      }

      db.prepare(`
        UPDATE price_observations SET is_active=0
        WHERE source='ebay' AND motorcycle_id=? AND part_template_id=? AND market_scope_key=?
          AND external_id IS NOT NULL AND last_seen_at < datetime('now','-21 days')
      `).run(identity.motorcycleId, part.id, scopeKey);
      db.prepare(`
        INSERT INTO market_refresh_log(motorcycle_id,series_code,series_id,market_scope_key,part_template_id,provider,query,status,result_count)
        VALUES(?,?,?,?,?,'ebay',?,'ok',?)
      `).run(identity.motorcycleId, normalizedSeriesCode(series?.code), series?.id ?? null, scopeKey, part.id, queryLabel, imported);
    })();

    try {
      await deactivateRemoteObservations(scopeKey, part.id);
      await upsertRemoteObservations(remoteObservations);
      await upsertRemoteMarketCheck({ motorcycle_key: scopeKey, part_template_id: part.id, provider: "ebay",
        status: "ok", result_count: imported, query: queryLabel, error_message: null, checked_at: new Date().toISOString() });
    } catch (error) { console.warn("Permanenter Marktstatus konnte nicht gespeichert werden:", error); }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    db.prepare(`
      INSERT INTO market_refresh_log(motorcycle_id,series_code,series_id,market_scope_key,part_template_id,provider,query,status,error_message)
      VALUES(?,?,?,?,?,'ebay',?,'error',?)
    `).run(options.motorcycleId, normalizedSeriesCode(series?.code), series?.id ?? null, scopeKey, part.id, queryLabel, message);
    try { await upsertRemoteMarketCheck({ motorcycle_key: scopeKey, part_template_id: part.id, provider: "ebay",
      status: "error", result_count: 0, query: queryLabel, error_message: message, checked_at: new Date().toISOString() }); } catch {}
    throw error;
  }

  const statistics = getPriceStatistics(part.id, options.motorcycleId, series?.id ?? null, scopeKey);
  let remotePersisted = false;
  if (statistics) {
    try {
      await upsertRemoteCache({ motorcycle_key: scopeKey, part_template_id: part.id, min_price: statistics.minimum,
        realistic_price: statistics.realisticPrice, max_price: statistics.maximum,
        observation_count: statistics.count, confidence: statistics.confidence,
        updated_at: statistics.updatedAt || new Date().toISOString() });
      remotePersisted = true;
    } catch (error) { console.warn("Permanenter Markt-Cache konnte nicht aktualisiert werden:", error); }
  }
  const checkedAt = new Date().toISOString();
  return {
    configured: true,
    scopeKey,
    checkedAt,
    imported,
    rejected,
    skipped: false,
    query: queryLabel,
    matcherVersion: MARKET_MATCHER_VERSION,
    rejectionReasons,
    exactMatches: exactAccepted.length,
    compatibleMatches: compatibleAccepted.length,
    // Die geprüften Originalangebote gehen mit an den Browser. Dadurch kann
    // KALKI die exakten eBay-Links auch ohne Supabase im 7-Tage-Browsercache
    // anzeigen, statt nur eine anonyme Anzahl und einen Mittelwert zu nennen.
    offers: accepted.map(({ listing }) => ({
      price: listing.price,
      shipping_price: listing.shippingPrice,
      source: "ebay",
      title: listing.title,
      url: listing.url,
      observed_at: checkedAt,
      image_url: listing.imageUrl,
    })),
    acceptedSamples: accepted.slice(0, 5).map(({ listing, quality }) => ({
      title: listing.title, price: listing.price, url: listing.url, quality,
    })),
    remotePersisted,
    statistics,
  };
}

export async function refreshMotorcyclePricesBatch(options: {
  motorcycleId: number;
  seriesId?: number | null;
  seriesCode?: string | null;
  seriesVariant?: string | null;
  modelYear?: number | null;
  maxAgeDays?: number;
  batchSize?: number;
  clientFreshPartIds?: number[];
  clientPricedPartIds?: number[];
}) {
  const input: MarketSeriesInput = options;
  const maxAgeDays = options.maxAgeDays ?? 7;
  await hydrateRemoteChecks(options.motorcycleId, input);
  const clientFreshPartIds = options.clientFreshPartIds ?? [];
  const clientPricedPartIds = options.clientPricedPartIds ?? [];
  const scopeKey = getMotorcycleMarketScopeKey(options.motorcycleId, input);
  const before = getMarketRefreshProgress(
    options.motorcycleId,
    maxAgeDays,
    input,
    clientFreshPartIds,
    clientPricedPartIds,
  );
  if (!isEbayConfigured()) return { configured: false, scopeKey, before, after: before, results: [] };
  const targets = staleTargets(
    options.motorcycleId,
    maxAgeDays,
    options.batchSize ?? 4,
    input,
    clientFreshPartIds,
  );
  const settled = await Promise.allSettled(targets.map((part) => refreshEbayPrice({ ...options, partTemplateId: part.id, force: false })));
  const results = settled.map((result, index) => ({ partTemplateId: targets[index]?.id, partName: targets[index]?.name,
    ok: result.status === "fulfilled", ...(result.status === "fulfilled" ? result.value
      : { error: result.reason instanceof Error ? result.reason.message : "Unbekannter Fehler" }) }));
  const after = getMarketRefreshProgress(
    options.motorcycleId,
    maxAgeDays,
    input,
    clientFreshPartIds,
    clientPricedPartIds,
  );
  return { configured: true, scopeKey, before, after, results };
}

export function getMarketStatus(motorcycleId: number, input: MarketSeriesInput = {}) {
  const scopeKey = getMotorcycleMarketScopeKey(motorcycleId, input);
  const lastRefresh = db.prepare(`
    SELECT provider,status,result_count,error_message,refreshed_at FROM market_refresh_log
    WHERE motorcycle_id=? AND market_scope_key=? ORDER BY refreshed_at DESC LIMIT 1
  `).get(motorcycleId, scopeKey) as { provider: string; status: string; result_count: number; error_message: string | null; refreshed_at: string } | undefined;
  const observations = db.prepare(`
    SELECT COUNT(*) count,MAX(observed_at) newest FROM price_observations
    WHERE motorcycle_id=? AND market_scope_key=? AND is_active=1
  `).get(motorcycleId, scopeKey) as { count: number; newest: string | null };
  return { ebayConfigured: isEbayConfigured(), lastRefresh: lastRefresh ?? null, observations,
    refreshProgress: getMarketRefreshProgress(motorcycleId, 7, input), scopeKey };
}
