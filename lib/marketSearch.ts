import { getPartProfile } from "../database/import/partProfiles";
import { matchListingToPart } from "./partTitleMatcher";
import {
  classifyMotorcycleListing,
  compactMarketText as compact,
  normalizeMarketText as normalize,
  type MotorcycleMarketIdentity,
} from "./modelIsolation";
import type { EbayListing } from "./ebay";

export type ListingDecision = { accepted: boolean; reason: string; quality: "exact" | "compatible" | null };

export type ClassifiedEbayListing = {
  listing: EbayListing;
  quality: "exact" | "compatible";
};

export function selectListingsForStatistics(
  exact: ClassifiedEbayListing[],
  compatible: ClassifiedEbayListing[],
  limit = 12,
) {
  const safeLimit = Math.max(1, Math.min(50, Math.floor(limit)));
  // Two exact observations are enough to avoid all broader fallbacks.
  // With zero or one exact observation, same-type-code compatible offers
  // complete the sample without ever admitting another brand/model/code.
  return (exact.length >= 2 ? exact : [...exact, ...compatible]).slice(0, safeLimit);
}

function unique(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))];
}

export function decideEbayListing(
  listing: EbayListing,
  identity: MotorcycleMarketIdentity,
  partName: string,
): ListingDecision {
  if (listing.currency !== "EUR") return { accepted: false, reason: "wrong-currency", quality: null };
  const profile = getPartProfile(partName);
  const total = listing.price + listing.shippingPrice;
  if (total < profile.minPrice) return { accepted: false, reason: "price-too-low", quality: null };
  if (total > profile.maxPrice) return { accepted: false, reason: "price-too-high", quality: null };
  const motorcycleMatch = classifyMotorcycleListing(listing.title, identity);
  if (!motorcycleMatch.accepted) {
    return { accepted: false, reason: `motorcycle:${motorcycleMatch.reason}`, quality: null };
  }

  const partMatch = matchListingToPart(listing.title, partName, profile);
  if (!partMatch.accepted) return { accepted: false, reason: partMatch.reason, quality: null };
  return {
    accepted: true,
    reason: `${motorcycleMatch.reason};${partMatch.reason}`,
    quality: motorcycleMatch.quality,
  };
}

function cleanGenerationLabel(identity: MotorcycleMarketIdentity) {
  const value = normalize(identity.requiredVariant || "")
    .split(" ")
    .filter((token) => compact(token) !== compact(identity.requiredSeriesCode || ""))
    .join(" ")
    .trim();
  return value || null;
}

export function preferredModelSearchTerm(identity: MotorcycleMarketIdentity) {
  const target = compact(identity.model);
  const escapedBrand = identity.brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const brandPattern = new RegExp(`^${escapedBrand}\\s+`, "i");
  const candidates = unique([identity.model, ...identity.aliases])
    .map((value) => value.replace(brandPattern, "").trim())
    .filter((value) => compact(value) === target);

  return candidates.sort((a, b) => {
    const aWords = normalize(a).split(" ").length;
    const bWords = normalize(b).split(" ").length;
    return bWords - aWords || a.length - b.length;
  })[0] || identity.model;
}

export function buildEbayQueries(identity: MotorcycleMarketIdentity, partName: string) {
  const profile = getPartProfile(partName);
  const model = preferredModelSearchTerm(identity);
  const partTerms = unique([
    ...profile.searchTerms,
    ...profile.aliases,
    profile.canonicalName,
    partName,
  ]).slice(0, 2);
  const primary = partTerms[0] || partName;
  const secondary = partTerms[1] || null;
  const generation = cleanGenerationLabel(identity);
  const year = identity.modelYear ? String(identity.modelYear) : null;
  const code = identity.requiredSeriesCode || null;
  const queries: string[] = [];

  // Interleave model strength and part synonyms. The previous implementation
  // spent all query slots on the first part word, so "CDI" was never tried
  // when the first word was "ECU" and many valid parts stayed estimates.
  if (code && year) queries.push(unique([identity.brand, model, code, year, primary]).join(" "));
  if (generation) queries.push(unique([identity.brand, model, generation, primary]).join(" "));

  if (code) queries.push(unique([identity.brand, model, code, primary]).join(" "));
  if (code) queries.push(unique([identity.brand, code, primary]).join(" "));
  if (generation && !year) queries.push(unique([identity.brand, model, generation, primary]).join(" "));
  queries.push(unique([identity.brand, model, primary]).join(" "));

  if (secondary) {
    if (code) queries.push(unique([identity.brand, model, code, secondary]).join(" "));
    else if (generation) queries.push(unique([identity.brand, model, generation, secondary]).join(" "));
    queries.push(unique([identity.brand, model, secondary]).join(" "));
  }

  // Search may be broader than acceptance. The classifier still requires the
  // correct brand/model/type code and rejects explicit sibling generations.
  return unique(queries).slice(0, 7);
}
