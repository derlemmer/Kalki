export type MotorcycleMarketIdentity = {
  motorcycleId: number;
  brand: string;
  model: string;
  aliases: string[];
  seriesCodes: string[];
  requiredSeriesCode?: string | null;
  requiredVariant?: string | null;
  seriesFrom?: number | null;
  seriesTo?: number | null;
  modelYear?: number | null;
  requireGenerationMarker?: boolean;
  requiredGenerationTerms?: string[];
  competingModelTerms?: string[];
  knownSeriesCodes?: string[];
  knownBrands: string[];
};

export function normalizeMarketText(value: string) {
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

export function compactMarketText(value: string) {
  return normalizeMarketText(value).replace(/\s+/g, "");
}

export function tokenContainsMarketText(haystack: string, needle: string) {
  if (!needle) return false;
  return (` ${haystack} `).includes(` ${needle} `);
}

function appears(title: string, compactTitle: string, value: string) {
  const normalized = normalizeMarketText(value);
  const compact = compactMarketText(value);
  if (!compact) return false;
  if (compact.length <= 2) return tokenContainsMarketText(title, normalized);
  return tokenContainsMarketText(title, normalized) || compactTitle.includes(compact);
}

function expandShortYear(value: number) {
  // KALKI's catalogue currently covers 1970-2010. Two-digit years in parts
  // titles therefore map unambiguously enough for generation matching.
  return value >= 70 ? 1900 + value : 2000 + value;
}

function titleYears(value: string) {
  const years = new Set<number>();
  for (const match of value.matchAll(/\b(19\d{2}|20\d{2})\b/g)) years.add(Number(match[1]));

  // Common eBay forms: "Bj. 99", "96-99", "98/99", "K1 01-02".
  // A bare price or part number must never become a year, so short years are
  // only accepted near a year label or as an explicit two-year range.
  const shortPatterns = [
    /\b(?:bj|baujahr|ez|modelljahr|model year|year)\.?\s*[:/-]?\s*(\d{2})\b/gi,
    /\b(\d{2})\s*[-/]\s*(\d{2})\b/g,
  ];
  for (const pattern of shortPatterns) {
    for (const match of value.matchAll(pattern)) {
      for (const group of match.slice(1)) {
        if (group != null) years.add(expandShortYear(Number(group)));
      }
    }
  }
  return [...years];
}

function variantSignals(variant: string | null | undefined) {
  if (!variant) return [];
  const ignored = new Set(["modell", "model", "base"]);
  return normalizeMarketText(variant)
    .split(" ")
    .filter((token) =>
      (token.length >= 3 || /[a-z]\d|\d[a-z]/.test(token))
      && !/^\d{4}$/.test(token)
      && !ignored.has(token),
    );
}

/**
 * Strictly isolates brand, model and (when available) generation. A listing
 * mentioning another motorcycle brand or another known type code is rejected.
 * For series sharing the same type code, a generation marker such as a year,
 * facelift name or S/N variant is additionally required.
 */
export type MotorcycleListingMatch = {
  accepted: boolean;
  quality: "exact" | "compatible" | null;
  reason: string;
};

/**
 * Classifies a title before part matching. "compatible" is deliberately
 * narrow: correct brand, correct model and the correct reused type code, but
 * no year/facelift marker. An explicit year from a sibling generation is
 * always rejected.
 */
export function classifyMotorcycleListing(
  title: string,
  identity: MotorcycleMarketIdentity,
): MotorcycleListingMatch {
  const normalizedTitle = normalizeMarketText(title);
  const compactTitle = compactMarketText(title);
  const normalizedBrand = normalizeMarketText(identity.brand);
  const reject = (reason: string): MotorcycleListingMatch => ({ accepted: false, quality: null, reason });
  const exact = (reason: string): MotorcycleListingMatch => ({ accepted: true, quality: "exact", reason });
  const compatible = (reason: string): MotorcycleListingMatch => ({ accepted: true, quality: "compatible", reason });

  if (!appears(normalizedTitle, compactTitle, identity.brand)) return reject("brand-missing");

  const competingBrand = identity.knownBrands.find((brand) =>
    normalizeMarketText(brand) !== normalizedBrand && appears(normalizedTitle, compactTitle, brand),
  );
  if (competingBrand) return reject(`competing-brand:${competingBrand}`);

  const codeAppears = (code: string) => appears(normalizedTitle, compactTitle, code);
  const requiredCodePresent = identity.requiredSeriesCode ? codeAppears(identity.requiredSeriesCode) : false;
  const modelCandidates = [...new Set([identity.model, ...identity.aliases].map((value) => value.trim()).filter(Boolean))];
  const competingModel = (identity.competingModelTerms ?? [])
    .find((candidate) => appears(normalizedTitle, compactTitle, candidate));
  if (competingModel) return reject(`competing-model:${competingModel}`);

  const modelPresent = modelCandidates.some((candidate) => appears(normalizedTitle, compactTitle, candidate));
  if (!modelPresent && !requiredCodePresent) return reject("model-missing");

  const requiredCompact = compactMarketText(identity.requiredSeriesCode || "");
  const competingSeriesCode = (identity.knownSeriesCodes ?? []).find((code) =>
    compactMarketText(code) !== requiredCompact && codeAppears(code),
  );
  if (competingSeriesCode) return reject(`competing-series:${competingSeriesCode}`);

  const years = titleYears(title);
  const yearSignal = years.some((year) => {
    if (identity.modelYear && year === identity.modelYear) return true;
    return identity.seriesFrom != null && identity.seriesTo != null
      && year >= identity.seriesFrom && year <= identity.seriesTo;
  });
  const explicitYearConflict = years.length > 0
    && identity.seriesFrom != null
    && identity.seriesTo != null
    && !yearSignal;

  const generationTerms = identity.requiredGenerationTerms !== undefined
    ? identity.requiredGenerationTerms
    : variantSignals(identity.requiredVariant)
      .filter((token) => compactMarketText(token) !== requiredCompact);
  const variantSignal = generationTerms
    .some((token) => appears(normalizedTitle, compactTitle, token));

  if (identity.requiredSeriesCode) {
    if (!identity.requireGenerationMarker) {
      if (!requiredCodePresent) return reject("required-series-missing");
    } else {
      if (!yearSignal && !variantSignal) {
        if (requiredCodePresent) {
          // eBay dismantlers often state the donor year even when the same
          // German type code covers several compatible years. Keep those as a
          // lower-confidence fallback; exact target-year matches always win.
          // Explicitly different S/N body variants remain forbidden below.
          if (/^SV1000[SN]$/i.test(identity.requiredVariant || "")
            && !appears(normalizedTitle, compactTitle, identity.requiredVariant || "")) {
            return reject("required-variant-missing");
          }
          return compatible(explicitYearConflict
            ? "shared-series-code-sibling-generation"
            : "shared-series-code-without-generation-marker");
        }
        return reject(explicitYearConflict ? "wrong-generation-year" : "generation-marker-missing");
      }
    }
  } else if (identity.requireGenerationMarker) {
    if (explicitYearConflict) return reject("wrong-generation-year");
    if (!yearSignal && !variantSignal) return reject("generation-marker-missing");
  }

  // S and N variants need the compact full designation; a single letter alone
  // would match far too many unrelated words.
  if (/^SV1000[SN]$/i.test(identity.requiredVariant || "")) {
    if (!appears(normalizedTitle, compactTitle, identity.requiredVariant || "")) {
      return reject("required-variant-missing");
    }
  }

  return exact(yearSignal || variantSignal ? "generation-exact" : "model-and-series-exact");
}

/** Strict match used by catalogue/isolation tests and anywhere ambiguity is not allowed. */
export function listingMatchesMotorcycle(title: string, identity: MotorcycleMarketIdentity) {
  return classifyMotorcycleListing(title, identity).quality === "exact";
}

/** Market-import match: also permits the narrow reused-code fallback above. */
export function listingMatchesMotorcycleCompatible(title: string, identity: MotorcycleMarketIdentity) {
  return classifyMotorcycleListing(title, identity).accepted;
}
