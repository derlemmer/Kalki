"use client";

import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { automaticallyIrrelevantPartNames, fairingIsValueCritical } from "../lib/modelRelevance";

type PartCondition = "Ungeprüft" | "Sehr gut" | "Gut" | "Gebraucht" | "Defekt" | "Fehlt" | "Nicht relevant";
type PartStatus = "Offen" | "Bewertet" | "Inseriert" | "Verkauft";

type PriceFilter = "all" | "missing" | "market" | "manual";
type Scenario = "Vorsichtig" | "Realistisch" | "Optimistisch";
type PhotoSource = "listing" | "manual";
type ProjectPhoto = { id: string; url: string; source: PhotoSource; section: string; addedAt: string };
type InspectionAnswers = Record<string, string>;

type InspectionItem = {
  id: string;
  group: string;
  label: string;
  options: Array<{ value: string; label: string }>;
  flatEffects?: Record<string, number>;
  hint?: string;
};
type PartSource = "generic" | "family" | "motorcycle" | "market" | "manual";

type Part = {
  id: string;
  name: string;
  available: boolean;
  min: number;
  realistic: number;
  max: number;
  condition: PartCondition;
  probability: number;
  status: PartStatus;
  note: string;
  custom?: boolean;
  source?: PartSource;
  observationCount?: number;
  confidence?: number;
  marketUpdatedAt?: string | null;
  marketCheckedAt?: string | null;
  marketCheckStatus?: string | null;
};

type Category = { id: string; name: string; icon: string; parts: Part[] };

type MotorcycleSummary = {
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

type FormState = {
  projectId: string;
  projectStatus: "Offen" | "Gekauft" | "Zerlegt" | "Abgeschlossen" | "Verworfen";
  motorcycleId: number | null;
  seriesId: number | null;
  seriesCode: string;
  seriesVariant: string;
  seriesFrom: number | null;
  seriesTo: number | null;
  marketScopeKey: string;
  recognitionScore: number;
  url: string;
  title: string;
  brand: string;
  model: string;
  motorcycleFamily: string;
  year: string;
  mileage: string;
  price: number;
  location: string;
  description: string;
  oneWayKm: number;
  roundTripKm: number;
  routeMinutes: number;
  consumption: number;
  dieselPrice: number;
  fuelSource: string;
  fuelUpdatedAt: string;
  trailerCost: number;
  materialCost: number;
  disposalCost: number;
  platformFeePercent: number;
  laborEnabled: boolean;
  laborHours: number;
  hourlyRate: number;
  targetProfit: number;
  riskMotor: boolean;
  riskPapers: boolean;
  riskFrame: boolean;
  riskMissingParts: boolean;
  motorcycleFuel: string;
  motorcycleCooling: string;
  motorcycleAbs: boolean | null;
  scenario: Scenario;
  photos: ProjectPhoto[];
  listingImportedAt: string;
  photoSection: string;
  rejectedOffers: Record<string, string[]>;
  inspection: InspectionAnswers;
  inspectionNotes: Record<string, string>;
  inspectionBaseline: number | null;
  inspectionBaseConditions: Record<string, PartCondition>;
  ownOffer: number;
  sellerCounterOffer: number;
  negotiationLimit: number;
  notes: string;
};

type SavedProject = {
  id: string;
  name: string;
  updatedAt: string;
  form: FormState;
  categories: Category[];
};

type SystemStatus = {
  version: string;
  catalog: { motorcycles: number; brands: number; partTemplates: number };
  market: { ebayConfigured: boolean; persistentCacheConfigured: boolean; observations: number; newestObservation: string | null; matcherVersion?: string };
};

type AutoMarketState = {
  running: boolean;
  total: number;
  fresh: number;
  stale: number;
  priced: number;
  remaining: number;
  errors: number;
};

type MarketObservation = {
  price: number;
  shipping_price: number;
  source: string;
  title: string;
  url: string;
  observed_at: string;
  image_url?: string | null;
};

type MarketData = {
  statistics: null | {
    count: number;
    minimum: number;
    median: number;
    maximum: number;
    realisticPrice: number;
    confidence: number;
    updatedAt: string | null;
    sources: Record<string, number>;
  };
  observations: MarketObservation[];
};

type BrowserMarketRow = {
  scopeKey: string;
  partTemplateId: number;
  checkedAt: string;
  resultCount: number;
  minimum: number | null;
  realisticPrice: number | null;
  maximum: number | null;
  observationCount: number;
  confidence: number;
  updatedAt: string | null;
  offers?: MarketObservation[];
};

type MarketBatchResult = {
  partTemplateId?: number;
  ok?: boolean;
  skipped?: boolean;
  imported?: number;
  checkedAt?: string | null;
  offers?: MarketObservation[];
  statistics?: null | {
    count: number;
    minimum: number;
    realisticPrice: number;
    maximum: number;
    confidence: number;
    updatedAt: string | null;
  };
};

const BROWSER_MARKET_STORAGE = "kalki-market-cache-v124-offer-links-v1";
const MARKET_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function readBrowserMarketRows(): BrowserMarketRow[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(BROWSER_MARKET_STORAGE) || "[]") as unknown;
    return Array.isArray(value) ? value.filter((row): row is BrowserMarketRow =>
      Boolean(row && typeof row === "object" && typeof (row as BrowserMarketRow).scopeKey === "string"
        && Number.isInteger(Number((row as BrowserMarketRow).partTemplateId)))) : [];
  } catch {
    return [];
  }
}

function browserRowsForScope(scopeKey: string) {
  return readBrowserMarketRows().filter((row) => row.scopeKey === scopeKey);
}

function normalizeMarketOffer(value: unknown): MarketObservation | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<MarketObservation>;
  const price = Number(row.price);
  const shipping = Number(row.shipping_price || 0);
  const url = typeof row.url === "string" ? row.url.trim() : "";
  const title = typeof row.title === "string" ? row.title.trim() : "";
  if (!url.startsWith("http") || !title || !Number.isFinite(price) || price <= 0) return null;
  return {
    price,
    shipping_price: Number.isFinite(shipping) ? shipping : 0,
    source: typeof row.source === "string" && row.source ? row.source : "ebay",
    title,
    url,
    observed_at: typeof row.observed_at === "string" && row.observed_at ? row.observed_at : new Date().toISOString(),
    image_url: typeof row.image_url === "string" ? row.image_url : null,
  };
}

function mergeMarketOffers(...groups: Array<unknown[] | undefined>): MarketObservation[] {
  const byUrl = new Map<string, MarketObservation>();
  for (const group of groups) {
    for (const value of group || []) {
      const offer = normalizeMarketOffer(value);
      if (!offer) continue;
      const current = byUrl.get(offer.url);
      if (!current || Date.parse(offer.observed_at) >= Date.parse(current.observed_at)) byUrl.set(offer.url, offer);
    }
  }
  return [...byUrl.values()]
    .sort((a, b) => Date.parse(a.observed_at) - Date.parse(b.observed_at))
    .slice(-80);
}

function browserOffersForPart(scopeKey: string, partTemplateId: number) {
  const row = browserRowsForScope(scopeKey).find((item) => item.partTemplateId === partTemplateId);
  return mergeMarketOffers(row?.offers);
}

function isBrowserRowFresh(row: BrowserMarketRow) {
  const timestamp = Date.parse(row.checkedAt);
  return Number.isFinite(timestamp) && timestamp >= Date.now() - MARKET_MAX_AGE_MS;
}

function saveBrowserMarketResults(scopeKey: string, results: MarketBatchResult[]) {
  if (typeof window === "undefined" || !scopeKey) return;
  const existing = readBrowserMarketRows();
  const byKey = new Map(existing.map((row) => [`${row.scopeKey}:${row.partTemplateId}`, row]));
  const now = new Date().toISOString();

  for (const result of results) {
    const partTemplateId = Number(result.partTemplateId);
    if (!result.ok || !Number.isInteger(partTemplateId) || partTemplateId <= 0) continue;
    const statistics = result.statistics;
    const key = `${scopeKey}:${partTemplateId}`;
    const previous = byKey.get(key);
    const offers = Array.isArray(result.offers)
      ? mergeMarketOffers(result.offers)
      : mergeMarketOffers(previous?.offers);
    byKey.set(key, {
      scopeKey,
      partTemplateId,
      checkedAt: result.checkedAt || now,
      resultCount: Number(result.imported || statistics?.count || offers.length || 0),
      minimum: statistics && statistics.count >= 1 ? Number(statistics.minimum) : null,
      realisticPrice: statistics && statistics.count >= 1 ? Number(statistics.realisticPrice) : null,
      maximum: statistics && statistics.count >= 1 ? Number(statistics.maximum) : null,
      observationCount: Number(statistics?.count || offers.length || 0),
      confidence: Number(statistics?.confidence || 0),
      updatedAt: statistics?.updatedAt || null,
      offers,
    });
  }

  const rows = [...byKey.values()]
    .sort((a, b) => Date.parse(b.checkedAt) - Date.parse(a.checkedAt))
    .slice(0, 600);
  window.localStorage.setItem(BROWSER_MARKET_STORAGE, JSON.stringify(rows));
}

function overlayBrowserMarketRows(rawParts: Array<Record<string, unknown>>, scopeKey: string) {
  if (!scopeKey) return rawParts;
  const byPart = new Map(browserRowsForScope(scopeKey).map((row) => [row.partTemplateId, row]));
  return rawParts.map((part) => {
    const cached = byPart.get(Number(part.id));
    if (!cached) return part;
    const merged: Record<string, unknown> = {
      ...part,
      market_checked_at: cached.checkedAt,
      market_check_status: "ok",
    };
    if (cached.observationCount >= 1 && cached.minimum != null
      && cached.realisticPrice != null && cached.maximum != null) {
      merged.min_price = cached.minimum;
      merged.realistic_price = cached.realisticPrice;
      merged.max_price = cached.maximum;
      merged.observation_count = cached.observationCount;
      merged.confidence = cached.confidence;
      merged.market_updated_at = cached.updatedAt;
      merged.source = "market";
    }
    return merged;
  });
}

const money = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const number = new Intl.NumberFormat("de-DE");
const slug = (value: string) => value.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));

const REMOVED_PART_NAMES = new Set([
  "Endschalldämpfer Zubehör", "Hitzeschutzblech", "Sammler / Kat", "ABS-Modulator",
  "ABS-Sensor hinten", "ABS-Sensor vorne", "Bremssattel vorne links", "Bremssattel vorne rechts",
  "Blinker einzeln", "Sensoren / Geber", "Zündspule einzeln", "Drosselklappengehäuse",
]);

const CRITICAL_PART_NAMES = [
  "Motor komplett", "Rahmen mit Papieren", "Tank", "Gabel komplett", "Felgensatz",
  "Auspuffanlage komplett", "ECU / CDI", "Verkleidungssatz komplett",
];

const STANDARD_INSPECTION_OPTIONS = [
  { value: "yes", label: "JA" },
  { value: "no", label: "NEIN" },
  { value: "unknown", label: "UNGEKLÄRT" },
  { value: "not_checked", label: "NICHT GEPRÜFT" },
];

const INSPECTION_ITEMS: InspectionItem[] = [
  { id: "motorRuns", group: "Motor & Technik", label: "Motor läuft", options: STANDARD_INSPECTION_OPTIONS, hint: "Beeinflusst den Zustand des kompletten Motors." },
  { id: "engineTurns", group: "Motor & Technik", label: "Motor dreht frei", options: STANDARD_INSPECTION_OPTIONS },
  { id: "engineNoise", group: "Motor & Technik", label: "Ungewöhnliche Geräusche", options: [{ value: "no", label: "NEIN" }, { value: "yes", label: "JA" }, { value: "unknown", label: "UNGEKLÄRT" }] },
  { id: "oilLeak", group: "Motor & Technik", label: "Ölverlust sichtbar", options: [{ value: "no", label: "NEIN" }, { value: "yes", label: "JA" }, { value: "unknown", label: "UNGEKLÄRT" }] },
  { id: "coolantLeak", group: "Motor & Technik", label: "Kühlmittelverlust", options: [{ value: "no", label: "NEIN" }, { value: "yes", label: "JA" }, { value: "unknown", label: "UNGEKLÄRT" }] },
  { id: "gearboxWorks", group: "Motor & Technik", label: "Getriebe schaltet", options: STANDARD_INSPECTION_OPTIONS },
  { id: "clutchWorks", group: "Motor & Technik", label: "Kupplung funktioniert", options: STANDARD_INSPECTION_OPTIONS },

  { id: "frameStraight", group: "Fahrwerk & Rahmen", label: "Rahmen augenscheinlich gerade", options: STANDARD_INSPECTION_OPTIONS },
  { id: "forkStraight", group: "Fahrwerk & Rahmen", label: "Gabel gerade", options: STANDARD_INSPECTION_OPTIONS },
  { id: "forkLeaks", group: "Fahrwerk & Rahmen", label: "Gabel undicht", options: [{ value: "no", label: "NEIN" }, { value: "yes", label: "JA" }, { value: "unknown", label: "UNGEKLÄRT" }] },
  { id: "rimsDamaged", group: "Fahrwerk & Rahmen", label: "Felgen beschädigt", options: [{ value: "no", label: "NEIN" }, { value: "yes", label: "JA" }, { value: "unknown", label: "UNGEKLÄRT" }] },
  { id: "swingarmDamaged", group: "Fahrwerk & Rahmen", label: "Schwinge beschädigt", options: [{ value: "no", label: "NEIN" }, { value: "yes", label: "JA" }, { value: "unknown", label: "UNGEKLÄRT" }] },
  { id: "steeringStops", group: "Fahrwerk & Rahmen", label: "Lenkanschläge beschädigt", options: [{ value: "no", label: "NEIN" }, { value: "yes", label: "JA" }, { value: "unknown", label: "UNGEKLÄRT" }], flatEffects: { yes: -100 } },

  { id: "ignitionWorks", group: "Elektrik", label: "Zündung funktioniert", options: STANDARD_INSPECTION_OPTIONS },
  { id: "dashWorks", group: "Elektrik", label: "Tacho funktioniert", options: STANDARD_INSPECTION_OPTIONS },
  { id: "headlightWorks", group: "Elektrik", label: "Scheinwerfer funktioniert", options: STANDARD_INSPECTION_OPTIONS },
  { id: "ecuPresent", group: "Elektrik", label: "Steuergerät vorhanden", options: STANDARD_INSPECTION_OPTIONS },
  { id: "wiringComplete", group: "Elektrik", label: "Kabelbaum vollständig", options: STANDARD_INSPECTION_OPTIONS },

  { id: "titlePresent", group: "Papiere & Schlüssel", label: "Fahrzeugbrief vorhanden", options: [{ value: "yes", label: "JA" }, { value: "no", label: "NEIN" }, { value: "unknown", label: "UNGEKLÄRT" }], flatEffects: { no: -250 } },
  { id: "registrationPresent", group: "Papiere & Schlüssel", label: "Fahrzeugschein vorhanden", options: [{ value: "yes", label: "JA" }, { value: "no", label: "NEIN" }, { value: "unknown", label: "UNGEKLÄRT" }], flatEffects: { no: -100 } },
  { id: "keys", group: "Papiere & Schlüssel", label: "Anzahl Schlüssel", options: [{ value: "0", label: "0" }, { value: "1", label: "1" }, { value: "2", label: "2" }, { value: "more", label: "MEHR" }, { value: "unknown", label: "UNGEKLÄRT" }], flatEffects: { "0": -180, "2": 30, more: 50 } },
  { id: "tuvReport", group: "Papiere & Schlüssel", label: "TÜV-Bericht vorhanden", options: [{ value: "yes", label: "JA" }, { value: "no", label: "NEIN" }, { value: "unknown", label: "UNGEKLÄRT" }] },
  { id: "serviceBook", group: "Papiere & Schlüssel", label: "Serviceheft / Rechnungen", options: [{ value: "yes", label: "JA" }, { value: "no", label: "NEIN" }, { value: "unknown", label: "UNGEKLÄRT" }] },
];

function validPriceOrder(part: Pick<Part, "min" | "realistic" | "max">) {
  const min = Number(part.min || 0);
  const realistic = Number(part.realistic || 0);
  const max = Number(part.max || 0);
  if (min === 0 && realistic === 0 && max === 0) return true;
  return min > 0 && realistic > 0 && max > 0 && min <= realistic && realistic <= max;
}

function hasVerifiedPartPrice(part: Part) {
  const hasCompletePrice = Number(part.min || 0) > 0 && Number(part.realistic || 0) > 0 && Number(part.max || 0) > 0;
  return hasCompletePrice && validPriceOrder(part) && (
    (part.source === "market" && Number(part.observationCount || 0) > 0)
    || part.source === "manual"
    || Boolean(part.custom)
  );
}

function isInactivePart(part: Part) {
  return !part.available || part.condition === "Fehlt" || part.condition === "Nicht relevant";
}

function isMissingPartPrice(part: Part) {
  return !isInactivePart(part) && part.condition !== "Defekt" && !hasVerifiedPartPrice(part);
}

function calculateOfferStatistics(offers: MarketObservation[]) {
  const values = offers
    .map((offer) => Number(offer.price) + Number(offer.shipping_price || 0))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);
  if (!values.length) return null;
  const quantile = (q: number) => {
    const position = (values.length - 1) * q;
    const base = Math.floor(position);
    const rest = position - base;
    return values[base + 1] == null ? values[base] : values[base] + rest * (values[base + 1] - values[base]);
  };
  return {
    count: values.length,
    minimum: Math.round(quantile(values.length >= 4 ? 0.15 : 0)),
    realisticPrice: Math.round(quantile(0.5)),
    maximum: Math.round(quantile(values.length >= 4 ? 0.85 : 1)),
    confidence: Math.min(95, 30 + values.length * 10),
  };
}

function inspectionFlatAdjustment(answers: InspectionAnswers) {
  return INSPECTION_ITEMS.reduce((sum, item) => sum + Number(item.flatEffects?.[answers[item.id]] || 0), 0);
}

function inspectionConditionOverrides(answers: InspectionAnswers) {
  const overrides = new Map<string, PartCondition>();
  const binary = (id: string, part: string, yes: PartCondition = "Gut", no: PartCondition = "Defekt") => {
    const answer = answers[id];
    if (answer === "yes") overrides.set(part, yes);
    else if (answer === "no") overrides.set(part, no);
    else if (answer === "unknown" || answer === "not_checked") overrides.set(part, "Ungeprüft");
  };

  const motorAnswer = answers.motorRuns;
  if (motorAnswer === "no" || answers.engineTurns === "no") overrides.set("Motor komplett", "Defekt");
  else if (answers.engineNoise === "yes" || answers.oilLeak === "yes" || answers.coolantLeak === "yes") overrides.set("Motor komplett", "Gebraucht");
  else if (motorAnswer === "yes") overrides.set("Motor komplett", "Gut");
  else if (motorAnswer || answers.engineTurns) overrides.set("Motor komplett", "Ungeprüft");

  binary("gearboxWorks", "Getriebe");
  binary("clutchWorks", "Kupplung komplett");
  binary("frameStraight", "Rahmen mit Papieren");

  if (answers.forkStraight === "no") overrides.set("Gabel komplett", "Defekt");
  else if (answers.forkLeaks === "yes") overrides.set("Gabel komplett", "Gebraucht");
  else if (answers.forkStraight === "yes" && answers.forkLeaks === "no") overrides.set("Gabel komplett", "Gut");
  else if (answers.forkStraight || answers.forkLeaks) overrides.set("Gabel komplett", "Ungeprüft");

  if (answers.rimsDamaged === "yes") overrides.set("Felgensatz", "Defekt");
  else if (answers.rimsDamaged === "no") overrides.set("Felgensatz", "Gut");
  else if (answers.rimsDamaged) overrides.set("Felgensatz", "Ungeprüft");
  if (answers.swingarmDamaged === "yes") overrides.set("Schwinge", "Defekt");
  else if (answers.swingarmDamaged === "no") overrides.set("Schwinge", "Gut");
  else if (answers.swingarmDamaged) overrides.set("Schwinge", "Ungeprüft");

  binary("ignitionWorks", "Zündschloss mit Schlüsseln");
  binary("dashWorks", "Tacho / Kombiinstrument");
  binary("headlightWorks", "Scheinwerfer");
  binary("ecuPresent", "ECU / CDI");
  binary("wiringComplete", "Kabelbaum");
  return overrides;
}

function applyInspectionConditions(categories: Category[], baseConditions: Record<string, PartCondition>, answers: InspectionAnswers) {
  const overrides = inspectionConditionOverrides(answers);
  return categories.map((category) => ({
    ...category,
    parts: category.parts.map((part) => ({
      ...part,
      condition: overrides.get(part.name) ?? baseConditions[part.id] ?? part.condition,
    })),
  }));
}

function applyModelRelevance(categories: Category[], metadata: Pick<FormState, "brand" | "model" | "motorcycleFamily" | "seriesVariant" | "year" | "motorcycleFuel" | "motorcycleCooling">): Category[] {
  const irrelevant = automaticallyIrrelevantPartNames(metadata);
  if (!irrelevant.size) return categories;
  return categories.map((category) => ({
    ...category,
    parts: category.parts.map((part) => irrelevant.has(part.name) && part.condition === "Ungeprüft"
      ? { ...part, condition: "Nicht relevant" as PartCondition, note: part.note || "Automatisch anhand sicherer Modelldaten ausgeblendet" }
      : part),
  }));
}

const conditionFactor: Record<PartCondition, number> = {
  "Ungeprüft": 0.85,
  "Sehr gut": 1.1,
  "Gut": 1,
  "Gebraucht": 0.82,
  "Defekt": 0.32,
  "Fehlt": 0,
  "Nicht relevant": 0,
};

const categoryIcons: Record<string, string> = {
  "Motor & Antrieb": "⚙",
  "Gemischaufbereitung": "◉",
  "Fahrwerk": "⇅",
  "Bremsanlage": "⊘",
  "Lenker & Cockpit": "⌁",
  "Elektrik & Steuergeräte": "ϟ",
  "Verkleidung & Karosserie": "◇",
  "Tank & Sitz": "▰",
  "Auspuffanlage": "≈",
  "Rahmen & Anbauteile": "△",
  "Zubehör": "+",
};

function rejectedOfferKey(scopeKey: string, partId: string) {
  return `${scopeKey || "NO-SCOPE"}:${partId}`;
}

function applyRejectedOfferPricing(categories: Category[], scopeKey: string, rejectedOffers: Record<string, string[]>) {
  if (!scopeKey) return categories;
  return categories.map((category) => ({
    ...category,
    parts: category.parts.map((part) => {
      if (part.source === "manual" || part.custom) return part;
      const rejected = new Set(rejectedOffers[rejectedOfferKey(scopeKey, part.id)] || []);
      if (!rejected.size) return part;
      const offers = browserOffersForPart(scopeKey, Number(part.id)).filter((offer) => !rejected.has(offer.url));
      const stats = calculateOfferStatistics(offers);
      if (!stats) return { ...part, min: 0, realistic: 0, max: 0, source: "generic" as PartSource, observationCount: 0, confidence: 0 };
      return {
        ...part,
        min: stats.minimum,
        realistic: stats.realisticPrice,
        max: stats.maximum,
        source: "market" as PartSource,
        observationCount: stats.count,
        confidence: stats.confidence,
      };
    }),
  }));
}

function createDefaultForm(): FormState {
  return {
    projectId: "new-project",
    projectStatus: "Offen",
    motorcycleId: null,
    seriesId: null,
    seriesCode: "",
    seriesVariant: "",
    seriesFrom: null,
    seriesTo: null,
    marketScopeKey: "",
    recognitionScore: 0,
    url: "",
    title: "",
    brand: "",
    model: "",
    motorcycleFamily: "",
    year: "",
    mileage: "",
    price: 0,
    location: "",
    description: "",
    oneWayKm: 0,
    roundTripKm: 0,
    routeMinutes: 0,
    consumption: 7.5,
    dieselPrice: 1.84,
    fuelSource: "Ersatzwert",
    fuelUpdatedAt: "",
    trailerCost: 0,
    materialCost: 40,
    disposalCost: 0,
    platformFeePercent: 12,
    laborEnabled: false,
    laborHours: 0,
    hourlyRate: 25,
    targetProfit: 300,
    riskMotor: false,
    riskPapers: false,
    riskFrame: false,
    riskMissingParts: false,
    motorcycleFuel: "",
    motorcycleCooling: "",
    motorcycleAbs: null,
    scenario: "Vorsichtig",
    photos: [],
    listingImportedAt: "",
    photoSection: "Besichtigung",
    rejectedOffers: {},
    inspection: {},
    inspectionNotes: {},
    inspectionBaseline: null,
    inspectionBaseConditions: {},
    ownOffer: 0,
    sellerCounterOffer: 0,
    negotiationLimit: 0,
    notes: "",
  };
}

function normalizeFormState(value?: Partial<FormState> | null): FormState {
  const defaults = createDefaultForm();
  const merged = { ...defaults, ...(value || {}) };
  return {
    ...merged,
    photos: Array.isArray(value?.photos) ? value.photos.filter((photo): photo is ProjectPhoto => Boolean(photo?.url)) : [],
    rejectedOffers: value?.rejectedOffers && typeof value.rejectedOffers === "object" ? value.rejectedOffers : {},
    inspection: value?.inspection && typeof value.inspection === "object" ? value.inspection : {},
    inspectionNotes: value?.inspectionNotes && typeof value.inspectionNotes === "object" ? value.inspectionNotes : {},
    inspectionBaseConditions: value?.inspectionBaseConditions && typeof value.inspectionBaseConditions === "object" ? value.inspectionBaseConditions : {},
  };
}

async function compressProjectImage(file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Bitte nur Bilddateien auswählen.");
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("Bild konnte nicht gelesen werden."));
      element.src = objectUrl;
    });
    const maxSide = 1200;
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Bildverarbeitung wird auf diesem Gerät nicht unterstützt.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.76);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function makePart(name: string, suffix = ""): Part {
  return {
    id: `${slug(name)}${suffix ? `-${suffix}` : ""}`,
    name,
    available: true,
    min: 0,
    realistic: 0,
    max: 0,
    condition: "Ungeprüft",
    probability: 70,
    status: "Offen",
    note: "",
    custom: true,
  };
}

function removeUnverifiedPrices(categories: Category[]): Category[] {
  return categories
    .map((category) => ({
      ...category,
      parts: category.parts
        .filter((part) => !REMOVED_PART_NAMES.has(part.name))
        .map((part) => {
          const condition: PartCondition = part.condition === "Nicht relevant" ? "Nicht relevant" : part.condition || "Ungeprüft";
          if (part.custom || part.source === "manual") return { ...part, condition };
          // Gespeicherte Marktwerte können aus einer älteren Filterversion stammen.
          // Sie werden beim Öffnen neutralisiert und aus dem aktuellen Scope neu geladen.
          return { ...part, condition, min: 0, realistic: 0, max: 0, source: "generic" as PartSource, observationCount: 0, confidence: 0 };
        }),
    }))
    .filter((category) => category.parts.length > 0);
}

function userPartMap(categories: Category[]) {
  return new Map(categories.flatMap((category) => category.parts).map((part) => [part.id, part]));
}

function groupParts(rawParts: Array<Record<string, unknown>>, previous: Category[] = []): Category[] {
  const old = userPartMap(previous);
  const groups = new Map<string, Category>();

  for (const raw of rawParts) {
    if (REMOVED_PART_NAMES.has(String(raw.name || ""))) continue;
    const categoryName = String(raw.category || "Sonstiges");
    const id = String(raw.id);
    if (!groups.has(categoryName)) {
      groups.set(categoryName, {
        id: slug(categoryName),
        name: categoryName,
        icon: categoryIcons[categoryName] || "□",
        parts: [],
      });
    }
    const saved = old.get(id);
    const observationCount = Number(raw.observation_count || 0);
    const hasMarketPrice = String(raw.source || "generic") === "market" && observationCount >= 1;
    const hasManualPrice = saved?.source === "manual";
    groups.get(categoryName)!.parts.push({
      id,
      name: String(raw.name || "Teil"),
      available: saved?.available ?? true,
      // Globale Sicherheitsregel: Ohne echte Markttreffer bleiben alle drei
      // Preisfelder bei 0 €. Nicht verifizierte Modell-/Familien-/Schätzwerte
      // dürfen niemals in Kaufempfehlung oder Gesamtwert einfließen.
      min: hasManualPrice ? Number(saved?.min || 0) : hasMarketPrice ? Number(raw.min_price || 0) : 0,
      realistic: hasManualPrice ? Number(saved?.realistic || 0) : hasMarketPrice ? Number(raw.realistic_price || 0) : 0,
      max: hasManualPrice ? Number(saved?.max || 0) : hasMarketPrice ? Number(raw.max_price || 0) : 0,
      condition: saved?.condition ?? "Ungeprüft",
      probability: saved?.probability ?? Number(raw.probability || 70),
      status: saved?.status ?? "Offen",
      note: saved?.note ?? "",
      source: hasManualPrice ? "manual" : hasMarketPrice ? "market" : "generic",
      observationCount,
      confidence: Number(raw.confidence || 0),
      marketUpdatedAt: raw.market_updated_at ? String(raw.market_updated_at) : null,
      marketCheckedAt: raw.market_checked_at ? String(raw.market_checked_at) : null,
      marketCheckStatus: raw.market_check_status ? String(raw.market_check_status) : null,
    });
  }

  const custom = previous.flatMap((category) => category.parts).filter((part) => part.custom);
  if (custom.length) {
    groups.set("Sonstiges", { id: "sonstiges", name: "Sonstiges", icon: "+", parts: custom });
  }
  return [...groups.values()];
}

async function readJson(response: Response) {
  const text = await response.text();
  if (!text.trim()) throw new Error(`Leere Serverantwort (HTTP ${response.status}).`);
  try { return JSON.parse(text); } catch { throw new Error(`Ungültige Serverantwort (HTTP ${response.status}).`); }
}

type MarketContext = {
  seriesId: number | null;
  seriesCode: string;
  seriesVariant: string;
  modelYear: number | null;
  marketScopeKey: string;
};

function marketContext(form: FormState): MarketContext {
  const year = Number(form.year);
  return {
    seriesId: form.seriesId,
    seriesCode: form.seriesCode,
    seriesVariant: form.seriesVariant,
    modelYear: Number.isInteger(year) ? year : null,
    marketScopeKey: form.marketScopeKey,
  };
}

function marketSearchParams(context: MarketContext) {
  const params = new URLSearchParams();
  if (context.seriesId) params.set("seriesId", String(context.seriesId));
  if (context.seriesCode) params.set("seriesCode", context.seriesCode);
  if (context.seriesVariant) params.set("seriesVariant", context.seriesVariant);
  if (context.modelYear) params.set("modelYear", String(context.modelYear));
  return params.toString();
}

function marketRunKey(motorcycleId: number, context: MarketContext) {
  const scope = context.marketScopeKey
    || (context.seriesId ? `series:${context.seriesId}` : "")
    || [context.seriesCode, context.seriesVariant].filter(Boolean).join(":")
    || "FAMILY";
  return `${motorcycleId}:${scope}:${context.modelYear || "NOYEAR"}`;
}

export default function Home() {
  const [form, setForm] = useState<FormState>(() => createDefaultForm());
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [models, setModels] = useState<MotorcycleSummary[]>([]);
  const [projects, setProjects] = useState<SavedProject[]>([]);
  const [newPartName, setNewPartName] = useState("");
  const [partFilter, setPartFilter] = useState("");
  const [priceFilter, setPriceFilter] = useState<PriceFilter>("all");
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  const [marketData, setMarketData] = useState<MarketData>({ statistics: null, observations: [] });
  const [marketDataLoading, setMarketDataLoading] = useState(false);
  const [marketCacheRevision, setMarketCacheRevision] = useState(0);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [marketBusy, setMarketBusy] = useState<string | null>(null);
  const [autoMarket, setAutoMarket] = useState<AutoMarketState>({ running: false, total: 0, fresh: 0, stale: 0, priced: 0, remaining: 0, errors: 0 });
  const marketRunRef = useRef(0);
  const lastAutoModelRef = useRef<string | null>(null);
  const [message, setMessage] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">("saved");
  const [activePhoto, setActivePhoto] = useState<ProjectPhoto | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [undoLabel, setUndoLabel] = useState("");
  const undoRef = useRef<{ form: FormState; categories: Category[]; label: string } | null>(null);

  useEffect(() => {
    try {
      const current = localStorage.getItem("kalki-v1-current");
      const storedProjects = localStorage.getItem("kalki-v1-projects");
      if (current) {
        const parsed = JSON.parse(current) as { form?: FormState; categories?: Category[]; savedAt?: string };
        if (parsed.form) setForm(normalizeFormState(parsed.form));
        if (parsed.categories) setCategories(removeUnverifiedPrices(parsed.categories));
        if (parsed.savedAt) setLastSavedAt(parsed.savedAt);
      } else {
        setForm({ ...createDefaultForm(), projectId: crypto.randomUUID() });
      }
      if (storedProjects) {
        const parsedProjects = JSON.parse(storedProjects) as SavedProject[];
        setProjects(parsedProjects.map((project) => ({ ...project, form: normalizeFormState(project.form), categories: removeUnverifiedPrices(project.categories || []) })));
      }
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    fetch("/api/system/status", { cache: "no-store" })
      .then(readJson)
      .then(setSystemStatus)
      .catch(() => setSystemStatus(null));
  }, []);

  useEffect(() => {
    fetch("/api/motorcycles?limit=1")
      .then(readJson)
      .then((data) => setBrands(Array.isArray(data.brands) ? data.brands : []))
      .catch(() => setMessage("Motorradkatalog konnte nicht geladen werden."));
  }, []);

  useEffect(() => {
    if (!form.brand) { setModels([]); return; }
    fetch(`/api/motorcycles?brand=${encodeURIComponent(form.brand)}&limit=100`)
      .then(readJson)
      .then((data) => setModels(Array.isArray(data.motorcycles) ? data.motorcycles : []))
      .catch(() => setModels([]));
  }, [form.brand]);

  useEffect(() => {
    if (!hydrated) return;
    setSaveStatus("saving");
    const timer = window.setTimeout(() => {
      try {
        const savedAt = new Date().toISOString();
        localStorage.setItem("kalki-v1-current", JSON.stringify({ form, categories, savedAt }));
        setLastSavedAt(savedAt);
        setSaveStatus("saved");
      } catch {
        setSaveStatus("error");
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [form, categories, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem("kalki-v1-projects", JSON.stringify(projects)); }
    catch { setSaveStatus("error"); }
  }, [projects, hydrated]);

  useEffect(() => {
    if (!hydrated || !form.motorcycleId) return;
    const scopeKey = marketRunKey(form.motorcycleId, marketContext(form));
    if (lastAutoModelRef.current === scopeKey) return;
    const timer = window.setTimeout(() => {
      void autoRefreshAllPrices(form.motorcycleId as number, marketContext(form));
    }, 800);
    return () => window.clearTimeout(timer);
  }, [hydrated, form.motorcycleId, form.seriesId, form.seriesCode, form.seriesVariant, form.marketScopeKey, form.year]);

  const allParts = useMemo(() => categories.flatMap((category) => category.parts), [categories]);
  const selectedPart = selectedPartId ? allParts.find((part) => part.id === selectedPartId) ?? null : null;

  const totals = useMemo(() => {
    const verified = allParts.filter((part) => !isInactivePart(part) && hasVerifiedPartPrice(part));
    const adjusted = (part: Part, field: "min" | "realistic" | "max") => Number(part[field] || 0) * conditionFactor[part.condition];
    const scenarioConfig = form.scenario === "Vorsichtig"
      ? { discount: 0.20, probabilityFactor: 0.90 }
      : form.scenario === "Optimistisch"
        ? { discount: 0, probabilityFactor: 1.05 }
        : { discount: 0.10, probabilityFactor: 1 };

    const minValue = verified.reduce((sum, part) => sum + adjusted(part, "min"), 0);
    const realisticValue = verified.reduce((sum, part) => sum + adjusted(part, "realistic"), 0);
    const maxValue = verified.reduce((sum, part) => sum + adjusted(part, "max"), 0);
    const expectedValue = verified.reduce((sum, part) => {
      const probability = clamp(part.probability * scenarioConfig.probabilityFactor);
      return sum + adjusted(part, "realistic") * probability / 100;
    }, 0);
    // Alte Risiko-Häkchen aus früheren Versionen bleiben nur für die Datenmigration im FormState.
    // Sie dürfen keine unsichtbaren Doppelabzüge erzeugen; Risiken werden ausschließlich im Besichtigungsmodus erfasst.
    const legacyRiskPercent = 0;
    const beforeInspectionValue = expectedValue * (1 - scenarioConfig.discount);
    const inspectionAdjustment = inspectionFlatAdjustment(form.inspection);
    const riskAdjustedValue = Math.max(0, beforeInspectionValue + inspectionAdjustment);
    const liters = form.roundTripKm * form.consumption / 100;
    const fuel = liters * form.dieselPrice;
    const transport = fuel + form.trailerCost;
    const labor = form.laborEnabled ? form.laborHours * form.hourlyRate : 0;
    const platformFees = riskAdjustedValue * clamp(form.platformFeePercent, 0, 40) / 100;
    const costsWithoutPurchase = transport + labor + form.materialCost + form.disposalCost + platformFees;
    const totalCosts = form.price + costsWithoutPurchase;
    const expectedProfit = riskAdjustedValue - totalCosts;
    const maxPurchase = riskAdjustedValue - costsWithoutPurchase - form.targetProfit;
    const roi = totalCosts > 0 ? expectedProfit / totalCosts * 100 : 0;
    const missingCount = allParts.filter(isMissingPartPrice).length;
    const marketCount = verified.filter((part) => part.source === "market").length;
    const manualCount = verified.filter((part) => part.source === "manual" || part.custom).length;
    const criticalMissing = CRITICAL_PART_NAMES.filter((name) => {
      if (name === "Verkleidungssatz komplett" && !fairingIsValueCritical(form)) return false;
      const part = allParts.find((candidate) => candidate.name === name);
      return part && !isInactivePart(part) && part.condition !== "Defekt" && !hasVerifiedPartPrice(part);
    });
    const dataCompleteEnough = criticalMissing.length === 0 && verified.length >= 5;
    const recommendation = !dataCompleteEnough
      ? "DATEN FEHLEN"
      : expectedProfit >= form.targetProfit
        ? "KAUFEN"
        : expectedProfit >= 0
          ? "NUR GÜNSTIGER"
          : "FINGER WEG";
    const inspectionDelta = form.inspectionBaseline == null ? 0 : riskAdjustedValue - form.inspectionBaseline;
    return {
      minValue, realisticValue, maxValue, expectedValue, riskAdjustedValue, beforeInspectionValue,
      inspectionAdjustment, inspectionDelta, riskPercent: Math.round(scenarioConfig.discount * 100) + legacyRiskPercent,
      marketDiscount: Math.round(scenarioConfig.discount * 100), liters, fuel, transport, labor,
      platformFees, costsWithoutPurchase, totalCosts, expectedProfit, maxPurchase, roi, recommendation,
      missingCount, marketCount, manualCount, verifiedCount: verified.length, criticalMissing,
    };
  }, [allParts, form]);

  useEffect(() => {
    if (!form.motorcycleId || !selectedPart) {
      setMarketData({ statistics: null, observations: [] });
      setMarketDataLoading(false);
      return;
    }
    let cancelled = false;
    setMarketDataLoading(true);
    const query = marketSearchParams(marketContext(form));
    const browserOffers = browserOffersForPart(form.marketScopeKey, Number(selectedPart.id));
    fetch(`/api/market/history?motorcycleId=${form.motorcycleId}&partTemplateId=${selectedPart.id}${query ? `&${query}` : ""}`, { cache: "no-store" })
      .then(readJson)
      .then((data) => {
        if (cancelled) return;
        setMarketData({
          statistics: data.statistics || null,
          observations: mergeMarketOffers(data.observations, browserOffers),
        });
      })
      .catch(() => {
        if (!cancelled) setMarketData({ statistics: null, observations: browserOffers });
      })
      .finally(() => { if (!cancelled) setMarketDataLoading(false); });
    return () => { cancelled = true; };
  }, [
    form.motorcycleId,
    form.seriesId,
    form.seriesCode,
    form.seriesVariant,
    form.marketScopeKey,
    form.year,
    selectedPart?.id,
    marketCacheRevision,
  ]);

  const selectedOfferKey = selectedPart ? rejectedOfferKey(form.marketScopeKey, selectedPart.id) : "";
  const selectedRejectedUrls = new Set(selectedOfferKey ? (form.rejectedOffers[selectedOfferKey] || []) : []);
  const activeSelectedOffers = marketData.observations.filter((offer) => !selectedRejectedUrls.has(offer.url));
  const activeSelectedStats = calculateOfferStatistics(activeSelectedOffers);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((old) => ({ ...old, [key]: value }));

  function rememberUndo(label: string) {
    undoRef.current = { form: structuredClone(form), categories: structuredClone(categories), label };
    setUndoLabel(label);
  }

  function undoLast() {
    const snapshot = undoRef.current;
    if (!snapshot) return;
    setForm(snapshot.form);
    setCategories(snapshot.categories);
    undoRef.current = null;
    setUndoLabel("");
    setMessage(`${snapshot.label} rückgängig gemacht.`);
  }

  async function loadParts(
    motorcycleId: number,
    preserveUserState = true,
    context: MarketContext = marketContext(form),
    motorcycle: MotorcycleSummary | null = null,
  ) {
    const query = marketSearchParams(context);
    const response = await fetch(`/api/parts?motorcycleId=${motorcycleId}${query ? `&${query}` : ""}`, { cache: "no-store" });
    const data = await readJson(response);
    if (!response.ok) throw new Error(data.error || "Teile konnten nicht geladen werden.");
    const scopeKey = String(data.marketScopeKey || context.marketScopeKey || "");
    const partsWithBrowserCache = overlayBrowserMarketRows(data.parts || [], scopeKey);
    setCategories((old) => {
      const grouped = groupParts(partsWithBrowserCache, preserveUserState ? old : []);
      const withRelevance = applyModelRelevance(grouped, {
        brand: motorcycle?.brand || form.brand,
        model: motorcycle?.model || form.model,
        motorcycleFamily: motorcycle?.family || form.motorcycleFamily,
        seriesVariant: context.seriesVariant || form.seriesVariant,
        year: context.modelYear ? String(context.modelYear) : form.year,
        motorcycleFuel: motorcycle?.fuel || form.motorcycleFuel,
        motorcycleCooling: motorcycle?.cooling || form.motorcycleCooling,
      });
      return applyRejectedOfferPricing(withRelevance, scopeKey, form.rejectedOffers);
    });
    setForm((old) => ({
      ...old,
      seriesId: Number(data.seriesId) || context.seriesId || null,
      marketScopeKey: scopeKey,
    }));
  }

  async function autoRefreshAllPrices(
    motorcycleId: number,
    context: MarketContext = marketContext(form),
  ) {
    lastAutoModelRef.current = marketRunKey(motorcycleId, context);
    const runId = ++marketRunRef.current;
    setAutoMarket({ running: true, total: 0, fresh: 0, stale: 0, priced: 0, remaining: 0, errors: 0 });
    let errors = 0;
    let loops = 0;
    let finalRemaining = 0;
    let scopeKey = context.marketScopeKey;

    try {
      while (runId === marketRunRef.current && loops < 40) {
        loops += 1;
        const response = await fetch("/api/market/refresh-all", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            motorcycleId,
            ...context,
            maxAgeDays: 7,
            batchSize: 3,
            clientFreshPartIds: browserRowsForScope(scopeKey).filter(isBrowserRowFresh).map((row) => row.partTemplateId),
            clientPricedPartIds: browserRowsForScope(scopeKey)
              .filter((row) => row.observationCount >= 1)
              .map((row) => row.partTemplateId),
          }),
        });
        const data = await readJson(response);
        if (!response.ok) throw new Error(data.error || "Automatische Preisaktualisierung fehlgeschlagen.");
        if (!data.configured) {
          setAutoMarket({ running: false, total: data.after?.total || 0, fresh: data.after?.fresh || 0, stale: data.after?.stale || 0, priced: data.after?.priced || 0, remaining: data.after?.eligible || 0, errors });
          setMessage("eBay ist noch nicht verbunden. Nach Eintragen der beiden Vercel-Schlüssel startet der 7-Tage-Preischeck automatisch.");
          return;
        }

        scopeKey = String(data.scopeKey || scopeKey || context.marketScopeKey || "");
        if (Array.isArray(data.results)) {
          saveBrowserMarketResults(scopeKey, data.results as MarketBatchResult[]);
          setMarketCacheRevision((value) => value + 1);
        }
        errors += Array.isArray(data.results) ? data.results.filter((item: { ok?: boolean }) => !item.ok).length : 0;
        const progress = data.after || data.before;
        const browserRows = browserRowsForScope(scopeKey);
        const browserFreshCount = browserRows.filter(isBrowserRowFresh).length;
        const browserPricedCount = browserRows.filter((row) => row.observationCount >= 1).length;
        const total = Number(progress?.total || 0);
        const fresh = Math.max(Number(progress?.fresh || 0), browserFreshCount);
        const priced = Math.max(Number(progress?.priced || 0), browserPricedCount);
        const remaining = Math.max(0, total - fresh - Number(progress?.recentlyAttempted || 0));
        finalRemaining = remaining;
        setAutoMarket({ running: remaining > 0, total, fresh, stale: Math.max(0, total - fresh), priced, remaining, errors });
        setMessage(`eBay-Preischeck: ${fresh}/${total} Teile geprüft · ${priced} Teile mit echten Markttreffern${errors ? ` · ${errors} Fehler` : ""}.`);

        if (loops % 2 === 0 || remaining === 0) await loadParts(motorcycleId, true, context);
        if (remaining <= 0) break;
        await new Promise((resolve) => window.setTimeout(resolve, 350));
      }

      if (runId !== marketRunRef.current) return;
      await loadParts(motorcycleId, true, context);
      const unfinished = finalRemaining > 0;
      setAutoMarket((old) => ({ ...old, running: false }));
      setMessage(unfinished
        ? "Der Preischeck wurde nach 40 Paketen beendet. Noch offene Teile werden beim nächsten Öffnen weiter geprüft."
        : errors
          ? `Automatischer Preischeck beendet. ${errors} Abfragen konnten nicht geladen werden und werden nach der Sperrfrist erneut versucht.`
          : "Alle Modellteile wurden geprüft. Marktwerte sind sieben Tage gültig; danach aktualisiert KALKI dieses Motorrad beim nächsten Öffnen automatisch.");
    } catch (error) {
      if (runId !== marketRunRef.current) return;
      setAutoMarket((old) => ({ ...old, running: false, errors: old.errors + 1 }));
      setMessage(error instanceof Error ? error.message : "Automatische Preisaktualisierung abgebrochen.");
    }
  }

  async function chooseMotorcycle(motorcycle: MotorcycleSummary, year?: string, score = 100) {
    setSelectedPartId(null);
    const context: MarketContext = {
      seriesId: null,
      seriesCode: "",
      seriesVariant: "",
      modelYear: Number.isInteger(Number(year)) ? Number(year) : null,
      marketScopeKey: "",
    };
    setForm((old) => ({
      ...old,
      motorcycleId: motorcycle.id,
      brand: motorcycle.brand,
      model: motorcycle.model,
      motorcycleFamily: motorcycle.family || "",
      year: year || old.year,
      seriesId: null,
      seriesCode: "",
      seriesVariant: "",
      seriesFrom: null,
      seriesTo: null,
      marketScopeKey: "",
      recognitionScore: score,
      motorcycleFuel: motorcycle.fuel || "",
      motorcycleCooling: motorcycle.cooling || "",
      motorcycleAbs: motorcycle.abs,
    }));
    await loadParts(motorcycle.id, false, context, motorcycle);
  }

  async function handleManualModel(id: number) {
    const motorcycle = models.find((item) => item.id === id);
    if (!motorcycle) return;
    setBusy(true);
    try {
      await chooseMotorcycle(motorcycle, form.year, 100);
      setMessage(`${motorcycle.brand} ${motorcycle.model} geladen. Ohne erkannte Baureihe werden zunächst Familienwerte verwendet.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Modell konnte nicht geladen werden.");
    } finally {
      setBusy(false);
    }
  }

  async function analyze() {
    if (!form.url.trim()) return setMessage("Bitte zuerst einen Inserat-Link einfügen.");
    setSelectedPartId(null);
    setBusy(true);
    setMessage("Inserat wird gelesen …");
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: form.url }),
      });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error || "Analyse fehlgeschlagen.");
      const listing = data.listing;
      const recognitionText = [listing.brand, listing.model, listing.title, listing.description]
        .filter(Boolean)
        .join(" ");
      const resolveResponse = await fetch("/api/motorcycle/resolve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input: recognitionText, year: listing.year || null }),
      });
      const resolvedData = await readJson(resolveResponse);
      if (!resolveResponse.ok) throw new Error(resolvedData.error || "Motorrad konnte nicht zugeordnet werden.");
      const resolved = resolvedData.result;
      const resolvedYear = resolved?.year ? String(resolved.year) : String(listing.year || "");
      const context: MarketContext = {
        seriesId: Number(resolved?.seriesId) || null,
        seriesCode: String(resolved?.seriesCode || ""),
        seriesVariant: String(resolved?.seriesVariant || ""),
        modelYear: Number.isInteger(Number(resolvedYear)) ? Number(resolvedYear) : null,
        marketScopeKey: String(resolved?.marketScopeKey || ""),
      };

      setForm((old) => ({
        ...old,
        title: listing.title || old.title,
        brand: resolved?.motorcycle?.brand || listing.brand || old.brand,
        model: resolved?.motorcycle?.model || listing.model || old.model,
        motorcycleFamily: resolved?.motorcycle?.family || old.motorcycleFamily,
        year: resolvedYear || old.year,
        mileage: listing.mileage || old.mileage,
        price: Number(listing.price) || old.price,
        location: listing.location || old.location,
        description: listing.description || old.description,
        motorcycleId: resolved?.motorcycle?.id || null,
        seriesId: context.seriesId,
        seriesCode: context.seriesCode,
        seriesVariant: context.seriesVariant,
        seriesFrom: Number(resolved?.seriesFrom) || null,
        seriesTo: Number(resolved?.seriesTo) || null,
        marketScopeKey: context.marketScopeKey,
        recognitionScore: Number(resolved?.score) || 0,
        motorcycleFuel: String(resolved?.motorcycle?.fuel || ""),
        motorcycleCooling: String(resolved?.motorcycle?.cooling || ""),
        motorcycleAbs: typeof resolved?.motorcycle?.abs === "boolean" ? resolved.motorcycle.abs : null,
        listingImportedAt: new Date().toISOString(),
        photos: [
          ...(old.photos || []).filter((photo) => photo.source === "manual"),
          ...((Array.isArray(listing.images) ? listing.images : []) as string[]).map((url, index) => ({
            id: `listing-${Date.now()}-${index}`, url, source: "listing" as const, section: "Inserat", addedAt: new Date().toISOString(),
          })),
        ],
      }));

      if (resolved?.motorcycle?.id) {
        await loadParts(resolved.motorcycle.id, false, context, resolved.motorcycle);
      }
      if (listing.location) await calculateRoute(listing.location);
      await updateFuel();

      const seriesLabel = [context.seriesCode, context.seriesVariant].filter(Boolean).join(" · ");
      setMessage(resolved
        ? `Erkannt: ${resolved.motorcycle.brand} ${resolved.motorcycle.model}${seriesLabel ? ` · ${seriesLabel}` : ""}${resolvedYear ? ` · ${resolvedYear}` : ""}. Teile und 7-Tage-Marktcheck wurden gestartet.`
        : "Inserat gelesen, Modell bitte manuell auswählen.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Analyse fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  async function calculateRoute(destination = form.location) {
    if (!destination.trim()) throw new Error("Standort fehlt.");
    const response = await fetch("/api/route", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ destination }) });
    const data = await readJson(response);
    if (!response.ok) throw new Error(data.error || "Route fehlgeschlagen.");
    setForm((old) => ({ ...old, location: destination, oneWayKm: data.oneWayKm, roundTripKm: data.roundTripKm, routeMinutes: data.roundTripMinutes }));
  }

  async function updateFuel() {
    const response = await fetch("/api/fuel", { cache: "no-store" });
    const data = await readJson(response);
    setForm((old) => ({ ...old, dieselPrice: Number(data.price) || old.dieselPrice, fuelSource: data.source || "", fuelUpdatedAt: data.updatedAt || "" }));
  }

  function updatePart(categoryId: string, partId: string, changes: Partial<Part>) {
    rememberUndo("Teiländerung");
    setCategories((old) => old.map((category) => category.id === categoryId
      ? { ...category, parts: category.parts.map((part) => part.id === partId ? { ...part, ...changes } : part) }
      : category));
  }

  function bulkSetCategory(categoryId: string, condition: PartCondition) {
    rememberUndo(`Kategorie auf ${condition} gesetzt`);
    setCategories((old) => old.map((category) => category.id === categoryId
      ? { ...category, parts: category.parts.map((part) => ({ ...part, condition })) }
      : category));
  }

  function applyOfferPrices(part: Part, offer: MarketObservation) {
    const total = Math.round(Number(offer.price) + Number(offer.shipping_price || 0));
    const location = categories.find((category) => category.parts.some((candidate) => candidate.id === part.id));
    if (!location || total <= 0) return;
    rememberUndo("Angebot als Richtwert übernommen");
    setCategories((old) => old.map((category) => category.id === location.id
      ? { ...category, parts: category.parts.map((candidate) => candidate.id === part.id ? {
        ...candidate,
        min: Math.max(1, Math.round(total * 0.85)),
        realistic: total,
        max: Math.max(total, Math.round(total * 1.15)),
        source: "manual" as PartSource,
      } : candidate) }
      : category));
    setMessage(`${part.name}: ${money.format(total)} als manueller Richtwert übernommen.`);
  }

  function rejectOffer(part: Part, offer: MarketObservation) {
    const key = rejectedOfferKey(form.marketScopeKey, part.id);
    const current = new Set(form.rejectedOffers[key] || []);
    current.add(offer.url);
    const rejectedOffers = { ...form.rejectedOffers, [key]: [...current] };
    const remaining = marketData.observations.filter((candidate) => !current.has(candidate.url));
    const stats = calculateOfferStatistics(remaining);
    const location = categories.find((category) => category.parts.some((candidate) => candidate.id === part.id));
    rememberUndo("Markttreffer ausgeschlossen");
    setForm((old) => ({ ...old, rejectedOffers }));
    if (location) {
      setCategories((old) => old.map((category) => category.id === location.id
        ? { ...category, parts: category.parts.map((candidate) => candidate.id === part.id ? (stats ? {
          ...candidate, min: stats.minimum, realistic: stats.realisticPrice, max: stats.maximum,
          source: "market" as PartSource, observationCount: stats.count, confidence: stats.confidence,
        } : {
          ...candidate, min: 0, realistic: 0, max: 0, source: "generic" as PartSource, observationCount: 0, confidence: 0,
        }) : candidate) }
        : category));
    }
  }

  function restoreRejectedOffers(part: Part) {
    const key = rejectedOfferKey(form.marketScopeKey, part.id);
    if (!(form.rejectedOffers[key] || []).length) return;
    rememberUndo("Ausgeschlossene Treffer wiederhergestellt");
    const next = { ...form.rejectedOffers };
    delete next[key];
    setForm((old) => ({ ...old, rejectedOffers: next }));
    const stats = calculateOfferStatistics(marketData.observations);
    const location = categories.find((category) => category.parts.some((candidate) => candidate.id === part.id));
    if (location && stats) setCategories((old) => old.map((category) => category.id === location.id
      ? { ...category, parts: category.parts.map((candidate) => candidate.id === part.id ? {
        ...candidate, min: stats.minimum, realistic: stats.realisticPrice, max: stats.maximum,
        source: "market" as PartSource, observationCount: stats.count, confidence: stats.confidence,
      } : candidate) }
      : category));
  }

  function setInspectionAnswer(itemId: string, value: string) {
    rememberUndo("Besichtigungsangabe geändert");
    const nextInspection = { ...form.inspection, [itemId]: value };
    const baseConditions = Object.keys(form.inspectionBaseConditions).length
      ? form.inspectionBaseConditions
      : Object.fromEntries(allParts.map((part) => [part.id, part.condition]));
    setForm((old) => ({
      ...old,
      inspection: nextInspection,
      inspectionBaseline: old.inspectionBaseline ?? totals.riskAdjustedValue,
      inspectionBaseConditions: baseConditions,
    }));
    setCategories((old) => applyInspectionConditions(old, baseConditions, nextInspection));
  }

  function resetInspection() {
    if (!Object.keys(form.inspection).length) return;
    rememberUndo("Besichtigung zurückgesetzt");
    setCategories((old) => old.map((category) => ({
      ...category,
      parts: category.parts.map((part) => ({ ...part, condition: form.inspectionBaseConditions[part.id] ?? part.condition })),
    })));
    setForm((old) => ({ ...old, inspection: {}, inspectionNotes: {}, inspectionBaseline: null, inspectionBaseConditions: {} }));
  }

  async function uploadPhotos(files: FileList | null) {
    if (!files?.length) return;
    if (form.photos.filter((photo) => photo.source === "manual").length + files.length > 12) {
      setMessage("Maximal 12 eigene Projektfotos sind vorgesehen, damit die lokale Speicherung stabil bleibt.");
      return;
    }
    setUploadingPhoto(true);
    try {
      const photos: ProjectPhoto[] = [];
      for (const file of Array.from(files)) {
        const url = await compressProjectImage(file);
        photos.push({ id: crypto.randomUUID(), url, source: "manual", section: form.photoSection || "Besichtigung", addedAt: new Date().toISOString() });
      }
      rememberUndo("Fotos hinzugefügt");
      setForm((old) => ({ ...old, photos: [...old.photos, ...photos] }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Fotos konnten nicht gespeichert werden.");
    } finally {
      setUploadingPhoto(false);
    }
  }

  function removePhoto(id: string) {
    rememberUndo("Foto entfernt");
    setForm((old) => ({ ...old, photos: old.photos.filter((photo) => photo.id !== id) }));
    if (activePhoto?.id === id) setActivePhoto(null);
  }

  function addCustomPart() {
    const name = newPartName.trim();
    if (!name) return;
    rememberUndo("Eigenes Teil hinzugefügt");
    setCategories((old) => {
      const custom = makePart(name, String(Date.now()));
      const existing = old.find((category) => category.id === "sonstiges");
      if (existing) return old.map((category) => category.id === "sonstiges" ? { ...category, parts: [...category.parts, custom] } : category);
      return [...old, { id: "sonstiges", name: "Sonstiges", icon: "+", parts: [custom] }];
    });
    setNewPartName("");
  }

  async function refreshMarket(partId: string) {
    if (!form.motorcycleId) return setMessage("Bitte zuerst ein Motorrad auswählen.");
    setMarketBusy(partId);
    try {
      const response = await fetch("/api/market/refresh", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ motorcycleId: form.motorcycleId, partTemplateId: Number(partId), ...marketContext(form), force: true }) });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error || "Marktpreis konnte nicht geladen werden.");
      if (!data.configured) setMessage("eBay ist vorbereitet. Trage Client ID und Secret bei Vercel ein, dann funktionieren Live-Preise.");
      else {
        const scopeKey = String(data.scopeKey || form.marketScopeKey || "");
        saveBrowserMarketResults(scopeKey, [{ ...data, partTemplateId: Number(partId), ok: true }]);
        setMarketCacheRevision((value) => value + 1);
        setMessage(`${data.imported} passende eBay-Angebote übernommen, ${data.rejected} unpassende aussortiert.`);
      }
      await loadParts(form.motorcycleId, true, marketContext(form));
      setSelectedPartId(partId);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Marktpreis fehlgeschlagen."); }
    finally { setMarketBusy(null); }
  }

  async function refreshTopParts() {
    if (!form.motorcycleId) return setMessage("Bitte zuerst ein Motorrad auswählen.");
    await autoRefreshAllPrices(form.motorcycleId, marketContext(form));
  }

  function saveProject() {
    const name = [form.brand, form.model, form.year].filter(Boolean).join(" ") || "Neues Motorrad";
    const project: SavedProject = { id: form.projectId, name, updatedAt: new Date().toISOString(), form, categories };
    setProjects((old) => [project, ...old.filter((item) => item.id !== project.id)].slice(0, 50));
    setMessage("Projekt gespeichert.");
  }

  function openProject(id: string) {
    const project = projects.find((item) => item.id === id);
    if (!project) return;
    setForm(normalizeFormState(project.form));
    setCategories(removeUnverifiedPrices(project.categories || []));
    setMessage(`${project.name} geöffnet.`);
  }

  function newProject() {
    marketRunRef.current += 1;
    lastAutoModelRef.current = null;
    if ((form.brand || categories.length) && !window.confirm("Neues Projekt starten? Der aktuelle Stand bleibt nur erhalten, wenn du ihn als Projekt gespeichert hast.")) return;
    setForm({ ...createDefaultForm(), projectId: crypto.randomUUID() });
    setCategories([]);
    setSelectedPartId(null);
    setMessage("Neues Projekt angelegt.");
  }

  function exportBackup() {
    const payload = JSON.stringify({ version: "1.5.0", exportedAt: new Date().toISOString(), current: { form, categories }, projects }, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `kalki-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function printReport() { window.print(); }

  const bikeName = [form.brand, form.model].filter(Boolean).join(" ") || "Motorrad noch nicht ausgewählt";
  const confidence = form.recognitionScore ? Math.min(99, Math.round(form.recognitionScore / 2.4)) : form.motorcycleId ? 100 : 0;
  const recommendationClass = totals.recommendation === "KAUFEN" ? "buy" : totals.recommendation === "FINGER WEG" ? "avoid" : "negotiate";
  const kleinanzeigenQuery = [form.brand, form.model, form.seriesCode, form.seriesVariant, form.year, selectedPart?.name].filter(Boolean).join(" ");
  const kleinanzeigenUrl = kleinanzeigenQuery
    ? `https://www.kleinanzeigen.de/s-motorraeder-roller/${slug(kleinanzeigenQuery)}/k0c305`
    : "https://www.kleinanzeigen.de/s-motorraeder-roller/k0c305";
  const normalizedPartFilter = partFilter.toLocaleLowerCase("de-DE").trim();
  const filteredCategories = categories.map((category) => ({
    ...category,
    parts: category.parts
      .filter((part) => !normalizedPartFilter || `${part.name} ${category.name} ${part.note}`.toLocaleLowerCase("de-DE").includes(normalizedPartFilter))
      .filter((part) => priceFilter === "all"
        || (priceFilter === "missing" && isMissingPartPrice(part))
        || (priceFilter === "market" && part.source === "market" && hasVerifiedPartPrice(part))
        || (priceFilter === "manual" && (part.source === "manual" || part.custom)))
      .sort((a, b) => {
        const priority = (part: Part) => isMissingPartPrice(part) ? 0
          : !validPriceOrder(part) ? 1
            : part.source === "manual" || part.custom ? 2
              : part.source === "market" ? 3
                : isInactivePart(part) || part.condition === "Defekt" ? 5 : 4;
        return priority(a) - priority(b) || a.name.localeCompare(b.name, "de");
      }),
  })).filter((category) => category.parts.length);

  const inspectionGroups = [...new Set(INSPECTION_ITEMS.map((item) => item.group))];
  const inspectionChecked = INSPECTION_ITEMS.filter((item) => form.inspection[item.id] && !["unknown", "not_checked"].includes(form.inspection[item.id])).length;
  const inspectionUnclear = INSPECTION_ITEMS.filter((item) => !form.inspection[item.id] || ["unknown", "not_checked"].includes(form.inspection[item.id])).length;
  const inspectionImpactRows = (() => {
    const rows: Array<{ label: string; value: number; detail: string }> = [];
    for (const item of INSPECTION_ITEMS) {
      const answer = form.inspection[item.id];
      const value = Number(item.flatEffects?.[answer] || 0);
      if (value) rows.push({ label: item.label, value, detail: item.options.find((option) => option.value === answer)?.label || answer });
    }
    const overrides = inspectionConditionOverrides(form.inspection);
    const config = form.scenario === "Vorsichtig" ? { discount: .20, probability: .90 } : form.scenario === "Optimistisch" ? { discount: 0, probability: 1.05 } : { discount: .10, probability: 1 };
    for (const [name, condition] of overrides) {
      const part = allParts.find((candidate) => candidate.name === name);
      if (!part || !hasVerifiedPartPrice(part)) continue;
      const base = form.inspectionBaseConditions[part.id] || "Ungeprüft";
      const raw = Number(part.realistic || 0) * clamp(part.probability * config.probability) / 100 * (1 - config.discount);
      const delta = raw * (conditionFactor[condition] - conditionFactor[base]);
      if (Math.abs(delta) >= 1) rows.push({ label: name, value: Math.round(delta), detail: `${base} → ${condition}` });
    }
    return rows;
  })();
  const inspectionBefore = form.inspectionBaseline ?? totals.riskAdjustedValue;
  const photoSections = ["Inserat", "Besichtigung", "Motor", "Fahrwerk", "Papiere", "Abholung", "Zerlegung", "Sonstiges"];


  return (
    <div className="appShell">
      <aside className="sidebar noPrint">
        <div className="sidebarBrand"><div className="brandWord">KALKI</div><div>AUSSCHLACHT KALKULATION</div><small>EST. 2026</small></div>
        <nav>
          <Nav href="#overview" icon="⌂">Übersicht</Nav>
          <Nav href="#vehicle" icon="▣">Fahrzeug</Nav>
          <Nav href="#photos" icon="▧">Fotos</Nav>
          <Nav href="#inspection" icon="✓">Besichtigung</Nav>
          <Nav href="#parts" icon="⌘">Teile & Werte</Nav>
          <Nav href="#market" icon="▥">Marktanalyse</Nav>
          <Nav href="#calculation" icon="▰">Kalkulation</Nav>
          <Nav href="#notes" icon="▤">Notizen</Nav>
          <Nav href="#projects" icon="▧">Projekte</Nav>
          <Nav href="#settings" icon="⚙">Einstellungen</Nav>
        </nav>
        <button className={`savePanel ${saveStatus}`} onClick={saveProject}><strong>PROJEKT SPEICHERN</strong><span>{saveStatus === "error" ? "NICHT GESPEICHERT" : saveStatus === "saving" ? "WIRD GESPEICHERT" : "AUTOMATISCH GESPEICHERT"}</span><b>{lastSavedAt ? new Date(lastSavedAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) : "noch nicht"}</b><i>{saveStatus === "error" ? "!" : "✓"}</i></button>
        <div className="garageMark"><span>BUILT TO RIDE</span><b>⚒</b><span>NOT TO RUST</span></div>
        <div className="version">VERSION 1.5.0</div>
      </aside>

      <main className="mainArea">
        <header className="topbar noPrint">
          <div><span className="eyebrow">FAHRZEUGAKTE</span><b> NR. {form.projectId.slice(0, 8).toUpperCase()}</b></div>
          <div className="topActions">
            <button className="darkButton" onClick={newProject}>NEUES PROJEKT ＋</button>
            <button className="paperButton" onClick={printReport}>EXPORT / DRUCK ⎙</button>
          </div>
        </header>

        {message && <div className="notice noPrint"><span>★</span>{message}<button onClick={() => setMessage("")}>×</button></div>}
        {undoLabel && <button className="undoToast noPrint" onClick={undoLast}>↶ {undoLabel} · RÜCKGÄNGIG</button>}

        <section id="overview" className="vehicleGrid">
          <article className="paperPanel vehicleCard">
            <div className="bikeIllustration" aria-hidden="true"><span>🏍</span><small>{form.seriesCode || "KALKI"}</small></div>
            <div className="vehicleIdentity">
              <div className="sectionKicker">FAHRZEUG ERKANNT ★</div>
              <h1>{bikeName}</h1>
              <div className="vehicleFacts">
                <span><b>BAUJAHR</b>{form.year || "—"}</span>
                <span><b>KILOMETERSTAND</b>{form.mileage ? `${number.format(Number(form.mileage))} km` : "—"}</span>
                <span><b>KAUFPREIS</b>{money.format(form.price)}</span>
              </div>
              <div className="tags"><span>{form.seriesCode ? `TYP ${form.seriesCode}` : "TYP OFFEN"}</span><span>{form.location || "STANDORT OFFEN"}</span></div>
            </div>
            <div className="confidenceStamp"><span>ERKANNT MIT</span><b>{confidence}%</b><small>SICHERHEIT</small><div>★★★★★</div></div>
          </article>

          <article className="paperPanel calculationSummary" id="calculation">
            <div className="summaryTitleRow">
              <div><div className="sectionKicker">KALKULATIONSZUSAMMENFASSUNG</div><small>Nur echte Marktdaten und gültige manuelle Preise werden gerechnet.</small></div>
              <div className="scenarioSwitch noPrint" aria-label="Kalkulationsszenario">
                {(["Vorsichtig", "Realistisch", "Optimistisch"] as Scenario[]).map((scenario) => <button key={scenario} className={form.scenario === scenario ? "active" : ""} onClick={() => setField("scenario", scenario)}>{scenario}</button>)}
              </div>
            </div>
            <div className="summaryStrip">
              <Metric label="BELEGTER ANGEBOTSWERT" value={money.format(totals.realisticValue)} />
              <Metric label={`${form.scenario.toUpperCase()}ER ERLÖS`} value={money.format(totals.riskAdjustedValue)} positive />
              <Metric label="NOCH OFFEN" value={`${totals.missingCount} TEILE`} />
              <Metric label="GESAMTKOSTEN" value={`−${money.format(totals.totalCosts)}`} />
            </div>
            <div className="recommendationRow">
              <div className={`recommendation ${recommendationClass}`}><span>EMPFEHLUNG ★</span><small>{totals.recommendation === "DATEN FEHLEN" ? "NOCH KEINE SICHERE KAUFEMPFEHLUNG" : "KAUFEN BIS MAXIMAL"}</small><b>{money.format(Math.max(0, totals.maxPurchase))}</b><i>{totals.recommendation}</i></div>
              <div className="projectStatus"><span>DATENLAGE</span><b>{totals.marketCount} MARKT · {totals.manualCount} MANUELL</b><small>{totals.criticalMissing.length ? `Kritisch offen: ${totals.criticalMissing.join(", ")}` : `${totals.verifiedCount} Positionen vollständig bepreist`}</small></div>
            </div>
          </article>
        </section>

        <section className="valueCards">
          <MetricCard label="TEILEWERT (MINIMUM)" value={money.format(totals.minValue)} sub="nur belegte Positionen" icon="◇" />
          <MetricCard label="TEILEWERT (REALISTISCH)" value={money.format(totals.realisticValue)} sub="nach Zustand angepasst" icon="⚙" emphasis />
          <MetricCard label="TEILEWERT (MAXIMUM)" value={money.format(totals.maxValue)} sub="nur belegte Positionen" icon="◆" />
          <MetricCard label="VORSICHTIGER ERLÖS" value={money.format(totals.riskAdjustedValue)} sub={`${totals.marketDiscount}% Marktabschlag · Chance berücksichtigt`} icon="↗" positive />
        </section>

        <section id="vehicle" className="paperPanel inputSection noPrint">
          <div className="sectionHeading"><div><span>★ FAHRZEUG & INSERAT</span><h2>Inserat einlesen oder Motorrad manuell wählen</h2></div><div className="catalogBadge">{systemStatus?.catalog.motorcycles ?? 638} MODELLE · {systemStatus?.catalog.brands ?? 15} HERSTELLER</div></div>
          <div className="linkImport"><input value={form.url} onChange={(event) => setField("url", event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") analyze(); }} placeholder="Kleinanzeigen- oder eBay-Link einfügen"/><button onClick={analyze} disabled={busy}>{busy ? "ARBEITET …" : "INSERAT ANALYSIEREN"}</button></div>
          <div className="formGrid">
            <Field label="Hersteller"><select value={form.brand} onChange={(event) => setForm((old) => ({ ...old, brand: event.target.value, model: "", motorcycleId: null }))}><option value="">Bitte wählen</option>{brands.map((brand) => <option key={brand}>{brand}</option>)}</select></Field>
            <Field label="Modell / Baureihe"><select value={form.motorcycleId ?? ""} onChange={(event) => handleManualModel(Number(event.target.value))} disabled={!form.brand || busy}><option value="">Bitte wählen</option>{models.map((model) => <option value={model.id} key={model.id}>{model.model} · {model.production.from}–{model.production.to}</option>)}</select></Field>
            <Field label="Typcode"><input value={form.seriesCode} onChange={(event) => setField("seriesCode", event.target.value.toUpperCase())} placeholder="z. B. PC31, RN01, 2A2"/></Field>
            <Field label="Baujahr"><input inputMode="numeric" value={form.year} onChange={(event) => setField("year", event.target.value)} /></Field>
            <Field label="Kilometerstand"><input inputMode="numeric" value={form.mileage} onChange={(event) => setField("mileage", event.target.value.replace(/\D/g, ""))} /></Field>
            <Field label="Kaufpreis (€)"><input type="number" value={form.price} onChange={(event) => setField("price", Number(event.target.value))} /></Field>
            <Field label="Standort"><div className="inlineField"><input value={form.location} onChange={(event) => setField("location", event.target.value)} placeholder="PLZ Ort"/><button onClick={() => calculateRoute().catch((error) => setMessage(error.message))}>ROUTE</button></div></Field>
            <Field label="Projektstatus"><select value={form.projectStatus} onChange={(event) => setField("projectStatus", event.target.value as FormState["projectStatus"])}><option>Offen</option><option>Gekauft</option><option>Zerlegt</option><option>Abgeschlossen</option><option>Verworfen</option></select></Field>
            <Field label="Inserat-Titel" wide><input value={form.title} onChange={(event) => setField("title", event.target.value)} /></Field>
            <Field label="Beschreibung" wide><textarea value={form.description} onChange={(event) => setField("description", event.target.value)} /></Field>
          </div>
        </section>

        <section className="paperPanel costsPanel noPrint">
          <div className="sectionHeading"><div><span>★ KOSTEN & TRANSPORT</span><h2>Abholung ab 57627 Hachenburg</h2></div><button className="smallButton" onClick={() => updateFuel().catch(() => setMessage("Dieselpreis konnte nicht geladen werden."))}>DIESEL AKTUALISIEREN</button></div>
          <div className="formGrid compact">
            <Field label="Entfernung einfach"><input type="number" value={form.oneWayKm} onChange={(event) => { const value = Number(event.target.value); setForm((old) => ({ ...old, oneWayKm: value, roundTripKm: value * 2 })); }} /></Field>
            <Field label="Hin & zurück"><input type="number" value={form.roundTripKm} onChange={(event) => setField("roundTripKm", Number(event.target.value))} /></Field>
            <Field label="Verbrauch l/100 km"><input type="number" step="0.1" value={form.consumption} onChange={(event) => setField("consumption", Number(event.target.value))} /></Field>
            <Field label="Diesel €/l"><input type="number" step="0.001" value={form.dieselPrice} onChange={(event) => setField("dieselPrice", Number(event.target.value))} /></Field>
            <Field label="Anhänger / Zusatz"><input type="number" value={form.trailerCost} onChange={(event) => setField("trailerCost", Number(event.target.value))} /></Field>
            <Field label="Material / Kleinteile"><input type="number" value={form.materialCost} onChange={(event) => setField("materialCost", Number(event.target.value))} /></Field>
            <Field label="Entsorgung"><input type="number" value={form.disposalCost} onChange={(event) => setField("disposalCost", Number(event.target.value))} /></Field>
            <Field label="Plattformgebühren %"><input type="number" value={form.platformFeePercent} onChange={(event) => setField("platformFeePercent", Number(event.target.value))} /></Field>
            <Field label="Arbeitszeit"><select value={form.laborEnabled ? "ja" : "nein"} onChange={(event) => setField("laborEnabled", event.target.value === "ja")}><option value="nein">Nicht einrechnen</option><option value="ja">Einrechnen</option></select></Field>
            <Field label="Stunden × Satz"><div className="inlineField"><input type="number" disabled={!form.laborEnabled} value={form.laborHours} onChange={(event) => setField("laborHours", Number(event.target.value))}/><input type="number" disabled={!form.laborEnabled} value={form.hourlyRate} onChange={(event) => setField("hourlyRate", Number(event.target.value))}/></div></Field>
            <Field label="Gewinnziel"><input type="number" value={form.targetProfit} onChange={(event) => setField("targetProfit", Number(event.target.value))} /></Field>
            <div className="costResult"><span>TRANSPORT</span><b>{money.format(totals.transport)}</b><small>{form.roundTripKm} km · {totals.liters.toFixed(1)} l</small></div>
          </div>
          <p className="sourceLine">{form.fuelSource}{form.fuelUpdatedAt ? ` · ${new Date(form.fuelUpdatedAt).toLocaleString("de-DE")}` : ""}</p>
        </section>

        <section id="photos" className="paperPanel photoPanel noPrint">
          <div className="sectionHeading"><div><span>★ FOTOS & INSERAT-SNAPSHOT</span><h2>{form.photos.length ? `${form.photos.length} Bilder zum Projekt` : "Inseratbilder automatisch laden oder eigene Fotos hinzufügen"}</h2></div>{form.url && <a className="smallButton" href={form.url} target="_blank" rel="noreferrer">ORIGINALINSERAT ↗</a>}</div>
          <div className="photoToolbar">
            <label><span>Bereich</span><select value={form.photoSection} onChange={(event) => setField("photoSection", event.target.value)}>{photoSections.map((section) => <option key={section}>{section}</option>)}</select></label>
            <label className="photoUploadButton"><input type="file" accept="image/*" multiple onChange={(event) => { void uploadPhotos(event.target.files); event.currentTarget.value = ""; }}/>{uploadingPhoto ? "BILDER WERDEN VERKLEINERT …" : "＋ EIGENE FOTOS HINZUFÜGEN"}</label>
            <small>Inseratbilder bleiben als Links gespeichert. Eigene Bilder werden verkleinert und lokal im Projekt gesichert.</small>
          </div>
          {form.photos.length ? <div className="photoGallery">{form.photos.map((photo, index) => <article key={photo.id}>
            <button className="photoOpen" onClick={() => setActivePhoto(photo)}><img src={photo.url} alt={`${photo.section} ${index + 1}`} loading="lazy"/><span>{photo.source === "listing" ? "INSERAT" : photo.section.toUpperCase()}</span></button>
            <button className="photoDelete" onClick={() => removePhoto(photo.id)} title="Foto entfernen">×</button>
          </article>)}</div> : <div className="emptyState compact"><b>NOCH KEINE FOTOS</b><span>Beim nächsten Inseratimport versucht KALKI die Bilder automatisch zu übernehmen.</span></div>}
          {(form.title || form.description) && <details className="listingSnapshot"><summary>GESPEICHERTEN INSERAT-SNAPSHOT ANZEIGEN</summary><b>{form.title}</b><small>{form.listingImportedAt ? `Importiert am ${new Date(form.listingImportedAt).toLocaleString("de-DE")}` : "Manuell erfasst"}</small><p>{form.description}</p></details>}
        </section>

        <section id="inspection" className="paperPanel inspectionPanel noPrint">
          <div className="sectionHeading"><div><span>★ BESICHTIGUNGSMODUS</span><h2>Am Motorrad prüfen und den Wert live verfolgen</h2></div><button className="smallButton dangerButton" onClick={resetInspection} disabled={!Object.keys(form.inspection).length}>BESICHTIGUNG ZURÜCKSETZEN</button></div>
          <div className="inspectionProgress"><b>{inspectionChecked} Punkte geprüft</b><span>{inspectionUnclear} offen oder ungeklärt</span><progress max={INSPECTION_ITEMS.length} value={inspectionChecked}/></div>
          <div className="inspectionGroups">
            {inspectionGroups.map((group) => <details key={group} open={group === "Motor & Technik"}>
              <summary>{group}<span>{INSPECTION_ITEMS.filter((item) => item.group === group && form.inspection[item.id] && !["unknown", "not_checked"].includes(form.inspection[item.id])).length}/{INSPECTION_ITEMS.filter((item) => item.group === group).length}</span></summary>
              <div className="inspectionList">
                {INSPECTION_ITEMS.filter((item) => item.group === group).map((item) => <article key={item.id} className={form.inspection[item.id] ? "answered" : ""}>
                  <div><b>{item.label}</b>{item.hint && <small>{item.hint}</small>}</div>
                  <div className="inspectionOptions">{item.options.map((option) => <button key={option.value} className={form.inspection[item.id] === option.value ? "active" : ""} onClick={() => setInspectionAnswer(item.id, option.value)}>{option.label}</button>)}</div>
                </article>)}
              </div>
              <textarea value={form.inspectionNotes[group] || ""} onChange={(event) => setForm((old) => ({ ...old, inspectionNotes: { ...old.inspectionNotes, [group]: event.target.value } }))} placeholder={`Notizen zu ${group} …`}/>
            </details>)}
          </div>
          <div className="negotiationPanel">
            <div><span>PREISVERHANDLUNG</span><h3>Direkt bei der Besichtigung</h3></div>
            <Field label="Eigenes Angebot"><input type="number" value={form.ownOffer} onChange={(event) => setField("ownOffer", Number(event.target.value))}/></Field>
            <Field label="Gegenangebot Verkäufer"><input type="number" value={form.sellerCounterOffer} onChange={(event) => setField("sellerCounterOffer", Number(event.target.value))}/></Field>
            <Field label="Eigene Schmerzgrenze"><input type="number" value={form.negotiationLimit} onChange={(event) => setField("negotiationLimit", Number(event.target.value))}/></Field>
            <div className="negotiationComparison"><span>KALKI MAX.</span><b>{money.format(Math.max(0, totals.maxPurchase))}</b><small>{form.sellerCounterOffer ? `Verkäufer liegt ${money.format(Math.abs(form.sellerCounterOffer - Math.max(0, totals.maxPurchase)))} ${form.sellerCounterOffer > totals.maxPurchase ? "darüber" : "darunter"}` : "Gegenangebot noch offen"}</small></div>
          </div>
          <div className="inspectionImpact">
            <div><span>VOR BESICHTIGUNG</span><b>{money.format(inspectionBefore)}</b></div>
            <div className={totals.inspectionDelta >= 0 ? "positive" : "negative"}><span>ÄNDERUNGEN</span><b>{totals.inspectionDelta >= 0 ? "+" : ""}{money.format(totals.inspectionDelta)}</b></div>
            <div><span>NEUER VORSICHTIGER WERT</span><b>{money.format(totals.riskAdjustedValue)}</b></div>
            <div><span>MAX. EINKAUF</span><b>{money.format(Math.max(0, totals.maxPurchase))}</b></div>
          </div>
          {inspectionImpactRows.length > 0 && <details className="impactBreakdown"><summary>WERTÄNDERUNGEN ANZEIGEN</summary>{inspectionImpactRows.map((row, index) => <div key={`${row.label}-${index}`}><span><b>{row.label}</b><small>{row.detail}</small></span><strong className={row.value >= 0 ? "positive" : "negative"}>{row.value >= 0 ? "+" : ""}{money.format(row.value)}</strong></div>)}</details>}
        </section>

        <section id="parts" className="paperPanel partsPanel">
          <div className="sectionHeading"><div><span>★ BAUGRUPPEN IM DETAIL ★</span><h2>{allParts.length ? `${allParts.length} bereinigte Teile für ${bikeName}` : "Motorrad auswählen, dann erscheinen die Teile"}</h2></div><div className="partTools noPrint"><input value={partFilter} onChange={(event) => setPartFilter(event.target.value)} placeholder="Teil suchen …"/><button onClick={refreshTopParts} disabled={busy || autoMarket.running || !form.motorcycleId}>{autoMarket.running ? "PREISE WERDEN GELADEN …" : "ALLE PREISE PRÜFEN"}</button></div></div>
          <div className="priceFilterBar noPrint">
            {([[
              "all", `ALLE ${allParts.length}`,
            ], ["missing", `⚠ OHNE PREIS ${totals.missingCount}`], ["market", `MARKTDATEN ${totals.marketCount}`], ["manual", `MANUELL ${totals.manualCount}`]] as Array<[PriceFilter, string]>).map(([value, label]) => <button key={value} className={priceFilter === value ? "active" : ""} onClick={() => setPriceFilter(value)}>{label}</button>)}
          </div>
          {(autoMarket.running || autoMarket.total > 0) && <div className={`marketRefreshBanner ${autoMarket.running ? "running" : "done"}`}><div><b>{autoMarket.running ? "AUTOMATISCHER 7-TAGE-PREISCHECK" : "PREISCHECK"}</b><span>{autoMarket.fresh} von {autoMarket.total} Teilen geprüft · {autoMarket.priced} mit echten Marktpreisen{autoMarket.errors ? ` · ${autoMarket.errors} Fehler` : ""}</span></div><progress max={Math.max(1, autoMarket.total)} value={Math.max(0, autoMarket.fresh)} /></div>}
          {filteredCategories.length === 0 && <div className="emptyState"><b>{categories.length ? "KEINE PASSENDEN POSITIONEN" : "NOCH KEINE BAUGRUPPEN"}</b><span>{categories.length ? "Filter ändern oder Suchbegriff löschen." : "Wähle oben Hersteller und Modell oder analysiere ein Inserat."}</span></div>}
          <div className="categoryList">
            {filteredCategories.map((category, index) => {
              const categoryValue = category.parts.reduce((sum, part) => sum + (hasVerifiedPartPrice(part) ? part.realistic * conditionFactor[part.condition] : 0), 0);
              const missingPriceCount = category.parts.filter(isMissingPartPrice).length;
              const marketPriceCount = category.parts.filter((part) => part.source === "market" && hasVerifiedPartPrice(part)).length;
              const activeCount = category.parts.filter((part) => !isInactivePart(part) && part.condition !== "Defekt").length;
              const complete = activeCount > 0 && missingPriceCount === 0;
              return <details className={`retroCategory ${missingPriceCount ? "hasMissingPrices" : complete ? "pricesComplete" : "pricesInactive"}`} key={category.id} open={priceFilter === "missing" || Boolean(normalizedPartFilter) || index < 2}>
                <summary>
                  <span className="categoryIcon">{category.icon}</span>
                  <b>{category.name}</b>
                  <small>{category.parts.length} Positionen · {marketPriceCount} mit Marktdaten</small>
                  {missingPriceCount > 0
                    ? <span className="missingPriceBadge">⚠ {missingPriceCount} OHNE PREIS</span>
                    : complete
                      ? <span className="completePriceBadge">✓ ALLE AKTIVEN BEPREIST</span>
                      : <span className="inactivePriceBadge">— KEINE OFFENEN PREISE</span>}
                  <strong>{money.format(categoryValue)}</strong>
                </summary>
                <div className="categoryQuickActions noPrint"><span>GANZE KATEGORIE:</span><button onClick={() => bulkSetCategory(category.id, "Ungeprüft")}>UNGEPRÜFT</button><button onClick={() => bulkSetCategory(category.id, "Defekt")}>DEFEKT</button><button onClick={() => bulkSetCategory(category.id, "Fehlt")}>FEHLT</button><button onClick={() => bulkSetCategory(category.id, "Nicht relevant")}>NICHT RELEVANT</button></div>
                <div className="partsTableWrap"><table className="partsTable"><thead><tr><th>BAUGRUPPE</th><th>ZUSTAND</th><th>CHANCE</th><th>MIN.</th><th>REAL.</th><th>MAX.</th><th>QUELLE</th><th>AKTION</th></tr></thead><tbody>
                  {category.parts.map((part) => {
                    const isSelected = selectedPart?.id === part.id;
                    const missingPrice = isMissingPartPrice(part);
                    const invalidPrice = !validPriceOrder(part);
                    const rowClass = [
                      isInactivePart(part) ? "disabledRow" : "",
                      isSelected ? "selectedRow" : "",
                      missingPrice ? "noPriceRow" : "",
                      invalidPrice ? "invalidPriceRow" : "",
                    ].filter(Boolean).join(" ");
                    return <Fragment key={part.id}>
                      <tr className={rowClass} onClick={() => setSelectedPartId(isSelected ? null : part.id)}>
                        <td data-label="BAUTEIL"><div className="partName"><span>{missingPrice ? "⚠" : category.icon}</span><div><b>{part.name}</b>{missingPrice && <em className="noPriceHint">KEIN PREIS – öffnen oder händisch eintragen</em>}{invalidPrice && <em className="priceOrderError">MIN ≤ REAL ≤ MAX erforderlich – wird nicht gerechnet</em>}<small><input className="noteInput" value={part.note} onChange={(event) => updatePart(category.id, part.id, { note: event.target.value })} onClick={(event) => event.stopPropagation()} placeholder="Notiz …"/></small></div></div></td>
                        <td data-label="ZUSTAND"><select value={part.condition} onChange={(event) => updatePart(category.id, part.id, { condition: event.target.value as PartCondition })} onClick={(event) => event.stopPropagation()}><option>Ungeprüft</option><option>Sehr gut</option><option>Gut</option><option>Gebraucht</option><option>Defekt</option><option>Fehlt</option><option>Nicht relevant</option></select></td>
                        <td data-label="CHANCE"><div className="chance"><input type="number" min="0" max="100" value={part.probability} onChange={(event) => updatePart(category.id, part.id, { probability: clamp(Number(event.target.value)) })} onClick={(event) => event.stopPropagation()}/><span>%</span></div></td>
                        <td data-label="MIN."><MoneyInput value={part.min} onChange={(value) => updatePart(category.id, part.id, { min: value, source: "manual" as PartSource })}/></td>
                        <td data-label="REAL."><MoneyInput value={part.realistic} onChange={(value) => updatePart(category.id, part.id, { realistic: value, source: "manual" as PartSource })} strong/></td>
                        <td data-label="MAX."><MoneyInput value={part.max} onChange={(value) => updatePart(category.id, part.id, { max: value, source: "manual" as PartSource })}/></td>
                        <td data-label="QUELLE"><SourceBadge part={part}/></td>
                        <td data-label="AKTION"><div className="rowActions noPrint"><button className="detailsButton" title="Treffer und Angebotslinks anzeigen" onClick={(event) => { event.stopPropagation(); setSelectedPartId(isSelected ? null : part.id); }}>{isSelected ? "SCHLIESSEN ▴" : part.observationCount ? `${part.observationCount} TREFFER 🔎` : "PREIS EINTRAGEN ✎"}</button><button className="arrowButton" title="eBay erneut prüfen" disabled={Boolean(marketBusy) || part.custom} onClick={(event) => { event.stopPropagation(); void refreshMarket(part.id); }}>{marketBusy === part.id ? "…" : "↻"}</button></div></td>
                      </tr>
                      {isSelected && <tr className="inlineMarketRow"><td colSpan={8}><InlineMarketDetails
                        part={part}
                        offers={activeSelectedOffers}
                        statistics={activeSelectedStats}
                        rejectedCount={selectedRejectedUrls.size}
                        loading={marketDataLoading}
                        busy={marketBusy === part.id}
                        kleinanzeigenUrl={kleinanzeigenUrl}
                        onRefresh={() => void refreshMarket(part.id)}
                        onUseOffer={(offer) => applyOfferPrices(part, offer)}
                        onReject={(offer) => rejectOffer(part, offer)}
                        onRestore={() => restoreRejectedOffers(part)}
                      /></td></tr>}
                    </Fragment>;
                  })}
                </tbody></table></div>
              </details>;
            })}
          </div>
          <div className="addCustom noPrint"><input value={newPartName} onChange={(event) => setNewPartName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") addCustomPart(); }} placeholder="Eigenes Teil ergänzen"/><button onClick={addCustomPart}>＋ TEIL HINZUFÜGEN</button></div>
        </section>

        <section id="market" className="marketNotesGrid">
          <article className="paperPanel marketPanel">
            <div className="sectionHeading"><div><span>MARKTANALYSE ★</span><h2>{selectedPart?.name || "Teil auswählen"}</h2></div><div className="marketActions noPrint"><a className="smallButton" href={kleinanzeigenUrl} target="_blank" rel="noreferrer">KLEINANZEIGEN ÖFFNEN</a><button className="smallButton" disabled={!selectedPart || Boolean(marketBusy) || selectedPart.custom} onClick={() => selectedPart && refreshMarket(selectedPart.id)}>{marketBusy ? "LÄDT …" : "EBAY AKTUALISIEREN"}</button></div></div>
            <div className="marketTabs"><b>EBAY</b><span>KLEINANZEIGEN-SUCHE</span><small>Cache wird sofort angezeigt</small></div>
            <div className="marketOverview">
              <div className="chartBlock"><span>PREISVERLAUF (ANGEBOTE)</span><PriceChart observations={activeSelectedOffers}/></div>
              <div className="marketNumbers"><span>AKTUELLE ANGEBOTE</span><b>{activeSelectedStats?.count ?? 0}</b><small>{selectedRejectedUrls.size ? `${selectedRejectedUrls.size} unpassende ausgeblendet` : "passende Beobachtungen"}</small><hr/><span>REALISTISCH</span><strong>{money.format(activeSelectedStats?.realisticPrice ?? selectedPart?.realistic ?? 0)}</strong><small>Sicherheit {activeSelectedStats?.confidence ?? selectedPart?.confidence ?? 0}%</small></div>
            </div>
            <div className="listingPreview">{activeSelectedOffers.slice(-12).reverse().map((observation) => <a href={observation.url} target="_blank" rel="noreferrer" key={`${observation.url}-${observation.observed_at}`}><span>{observation.source}</span><b>{observation.title}</b><strong>{money.format(Number(observation.price) + Number(observation.shipping_price || 0))}</strong></a>)}{!activeSelectedOffers.length && <p>Keine passenden Marktdaten gefunden. Min., Real. und Max. bleiben deshalb bei 0 €. Öffne die Position und trage bei Bedarf bewusst einen manuellen Preis ein.</p>}</div>
          </article>

          <article id="notes" className="paperPanel notesPanel">
            <div className="sectionKicker">NOTIZEN</div>
            <textarea value={form.notes} onChange={(event) => setField("notes", event.target.value)} placeholder={"• Allgemeine Hinweise\n• Abholung\n• Verkäuferangaben\n• Besonderheiten"}/>
            <p className="riskHint">Zustand, Papiere und Schlüssel werden im Bereich <b>BESICHTIGUNG</b> erfasst. So wird nichts doppelt abgezogen.</p>
          </article>
        </section>

        <section id="projects" className="paperPanel projectsPanel noPrint">
          <div className="sectionHeading"><div><span>★ PROJEKTE</span><h2>Gespeicherte Kalkulationen</h2></div><button className="smallButton" onClick={saveProject}>AKTUELLEN STAND SPEICHERN</button></div>
          <div className="projectGrid">{projects.map((project) => <button key={project.id} onClick={() => openProject(project.id)}><b>{project.name}</b><span>{project.form.projectStatus} · {new Date(project.updatedAt).toLocaleDateString("de-DE")}</span><strong>{money.format(project.form.price)}</strong></button>)}{!projects.length && <p>Noch keine Projekte gespeichert.</p>}</div>
        </section>


        <section id="settings" className="paperPanel settingsPanel noPrint">
          <div className="sectionHeading"><div><span>★ EINSTELLUNGEN & SYSTEM</span><h2>KALKI-Verbindungen und Datensicherung</h2></div><button className="smallButton" onClick={exportBackup}>DATEN ALS JSON SICHERN</button></div>
          <div className="settingsGrid">
            <div><span>KATALOG</span><b>{systemStatus?.catalog.motorcycles ?? 638} Modelle</b><small>{systemStatus?.catalog.brands ?? 15} Hersteller · {systemStatus?.catalog.partTemplates ?? 108} Teilevorlagen</small></div>
            <div className={systemStatus?.market.ebayConfigured ? "connected" : "pending"}><span>EBAY API</span><b>{systemStatus?.market.ebayConfigured ? "VERBUNDEN" : "NOCH OFFEN"}</b><small>Client ID und Secret werden nur serverseitig gelesen.</small></div>
            <div className={systemStatus?.market.persistentCacheConfigured ? "connected" : "pending"}><span>DAUERHAFTER CACHE</span><b>{systemStatus?.market.persistentCacheConfigured ? "SUPABASE AKTIV" : "NUR LOKAL"}</b><small>{systemStatus?.market.observations ?? 0} Preisbeobachtungen in der Grunddatenbank</small></div>
            <div><span>VERSION</span><b>{systemStatus?.version ?? "1.5.0"}</b><small>Inventar-, Verkauf- und Ausgabentabellen sind für den nächsten Ausbau vorbereitet.</small></div>
          </div>
        </section>

        <footer><span>KALKI – AUSSCHLACHT KALKULATION</span><b>RIDE HARD. SELL SMART. ★</b></footer>
      </main>

      <div className="mobileValueBar noPrint"><a href="#calculation"><span>VORSICHTIG</span><b>{money.format(totals.riskAdjustedValue)}</b></a><a href="#parts"><span>OFFEN</span><b>{totals.missingCount}</b></a><a href="#inspection"><span>MAX. EINKAUF</span><b>{money.format(Math.max(0, totals.maxPurchase))}</b></a></div>
      <nav className="mobileNav noPrint"><a href="#overview">⌂<span>Übersicht</span></a><a href="#parts">⌘<span>Teile</span></a><a href="#inspection">✓<span>Besichtigung</span></a><a href="#photos">▧<span>Fotos</span></a><button onClick={saveProject}>{saveStatus === "error" ? "!" : "✓"}<span>Speichern</span></button></nav>
      {activePhoto && <div className="photoLightbox noPrint" role="dialog" aria-modal="true" onClick={() => setActivePhoto(null)}><button onClick={() => setActivePhoto(null)}>×</button><img src={activePhoto.url} alt={activePhoto.section}/><span>{activePhoto.source === "listing" ? "INSERATFOTO" : activePhoto.section.toUpperCase()}</span></div>}
    </div>
  );
}

function Nav({ href, icon, children }: { href: string; icon: string; children: ReactNode }) {
  return <a href={href}><span>{icon}</span>{children}</a>;
}

function Field({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  return <label className={`field ${wide ? "wide" : ""}`}><span>{label}</span>{children}</label>;
}

function Metric({ label, value, positive = false }: { label: string; value: string; positive?: boolean }) {
  return <div className={`metric ${positive ? "positive" : ""}`}><span>{label}</span><b>{value}</b></div>;
}

function MetricCard({ label, value, sub, icon, emphasis = false, positive = false }: { label: string; value: string; sub: string; icon: string; emphasis?: boolean; positive?: boolean }) {
  return <article className={`metricCard ${emphasis ? "emphasis" : ""} ${positive ? "positive" : ""}`}><span>{label}</span><b>{value}</b><small>Ø {sub}</small><i>{icon}</i></article>;
}

function MoneyInput({ value, onChange, strong = false }: { value: number; onChange: (value: number) => void; strong?: boolean }) {
  return <div className={`moneyInput ${strong ? "strong" : ""}`}><input type="number" min="0" value={value} onChange={(event) => onChange(Number(event.target.value))} onClick={(event) => event.stopPropagation()}/><span>€</span></div>;
}

function SourceBadge({ part }: { part: Part }) {
  const checkedWithoutHits = part.source !== "market" && part.source !== "manual" && part.marketCheckStatus === "ok" && Boolean(part.marketCheckedAt);
  const manual = part.source === "manual" || Boolean(part.custom);
  const label = part.condition === "Nicht relevant"
    ? "NICHT RELEVANT"
    : part.condition === "Fehlt"
      ? "FEHLT"
      : part.source === "market" && Number(part.observationCount || 0) > 0 && hasVerifiedPartPrice(part)
        ? `MARKT${part.observationCount ? ` · ${part.observationCount}` : ""}`
        : manual && hasVerifiedPartPrice(part)
          ? "MANUELL"
          : manual && !validPriceOrder(part)
            ? "⚠ PREIS UNGÜLTIG"
            : manual
              ? "⚠ MANUELL UNVOLLST."
              : checkedWithoutHits
                ? "⚠ GEPRÜFT · 0"
                : "⚠ NOCH OFFEN · 0";
  const title = part.marketCheckedAt ? `Zuletzt geprüft: ${new Date(part.marketCheckedAt.replace(" ", "T") + (part.marketCheckedAt.includes("Z") ? "" : "Z")).toLocaleString("de-DE")}` : undefined;
  return <span title={title} className={`sourceBadge ${checkedWithoutHits ? "checked" : manual ? "manual" : part.source || "generic"}`}>{label}</span>;
}

function InlineMarketDetails({
  part, offers, statistics, rejectedCount, loading, busy, kleinanzeigenUrl, onRefresh, onUseOffer, onReject, onRestore,
}: {
  part: Part;
  offers: MarketObservation[];
  statistics: ReturnType<typeof calculateOfferStatistics>;
  rejectedCount: number;
  loading: boolean;
  busy: boolean;
  kleinanzeigenUrl: string;
  onRefresh: () => void;
  onUseOffer: (offer: MarketObservation) => void;
  onReject: (offer: MarketObservation) => void;
  onRestore: () => void;
}) {
  const displayedOffers = [...offers].reverse();
  const count = statistics?.count ?? 0;
  const minimum = statistics?.minimum ?? part.min;
  const realistic = statistics?.realisticPrice ?? part.realistic;
  const maximum = statistics?.maximum ?? part.max;

  return <div className="inlineMarketDetails">
    <div className="inlineMarketHeader">
      <div><span>MARKTTREFFER FÜR</span><b>{part.name}</b>{rejectedCount > 0 && <small>{rejectedCount} unpassende Treffer dauerhaft für dieses Projekt ausgeblendet</small>}</div>
      <div className="inlineMarketStats">
        <span><b>{count}</b> Treffer</span>
        <span><small>MIN.</small><b>{money.format(minimum)}</b></span>
        <span><small>CA. REAL.</small><b>{money.format(realistic)}</b></span>
        <span><small>MAX.</small><b>{money.format(maximum)}</b></span>
      </div>
    </div>

    {loading && <div className="inlineLoading">Angebotslinks werden geladen …</div>}

    {!loading && displayedOffers.length > 0 && <>
      <div className="offerExplanationRow"><p className="offerExplanation">Öffne das konkrete Angebot, übernimm es als Richtwert oder blende Zubehör und falsche Teile aus.</p>{rejectedCount > 0 && <button onClick={onRestore}>AUSGESCHLOSSENE WIEDERHERSTELLEN</button>}</div>
      <div className="offerLinks">
        {displayedOffers.map((offer) => {
          const total = Number(offer.price) + Number(offer.shipping_price || 0);
          return <article key={`${offer.url}-${offer.observed_at}`} className="offerLink">
            <a className="offerMainLink" href={offer.url} target="_blank" rel="noreferrer">
              {offer.image_url ? <img src={offer.image_url} alt="" loading="lazy"/> : <span className="offerImageFallback">EBAY</span>}
              <span className="offerText"><b>{offer.title}</b><small>Artikel {money.format(Number(offer.price))}{offer.shipping_price ? ` + ${money.format(Number(offer.shipping_price))} Versand` : " · Versand inkl./kostenlos"}</small></span>
              <strong>{money.format(total)}<small>ÖFFNEN ↗</small></strong>
            </a>
            <div className="offerDecisionButtons noPrint"><button className="acceptOffer" onClick={() => onUseOffer(offer)}>ALS RICHTWERT ÜBERNEHMEN</button><button className="rejectOffer" onClick={() => onReject(offer)}>UNPASSEND ✕</button></div>
          </article>;
        })}
      </div>
    </>}

    {!loading && displayedOffers.length === 0 && <div className="noMarketOffers">
      <div><b>⚠ KEINE BRAUCHBAREN MARKTPREISE GEFUNDEN</b><span>Min., Real. und Max. bleiben bei 0 €. Du kannst die drei Felder bewusst händisch ausfüllen. Ungültige Reihenfolgen werden nicht gerechnet.</span></div>
      <div className="noMarketActions noPrint"><button disabled={busy || Boolean(part.custom)} onClick={onRefresh}>{busy ? "PRÜFT …" : "EBAY NOCHMAL PRÜFEN"}</button>{rejectedCount > 0 && <button onClick={onRestore}>AUSGESCHLOSSENE WIEDERHERSTELLEN</button>}<a href={kleinanzeigenUrl} target="_blank" rel="noreferrer">KLEINANZEIGEN HÄNDISCH SUCHEN ↗</a></div>
    </div>}
  </div>;
}

function PriceChart({ observations }: { observations: MarketData["observations"] }) {
  const values = observations.map((item) => Number(item.price) + Number(item.shipping_price || 0)).filter((value) => Number.isFinite(value) && value > 0).slice(-20);
  if (values.length < 2) return <div className="emptyChart"><span>NOCH KEINE PREISREIHE</span></div>;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  const points = values.map((value, index) => `${10 + index * (280 / (values.length - 1))},${95 - (value - min) / range * 75}`).join(" ");
  return <svg viewBox="0 0 300 110" role="img" aria-label="Preisverlauf"><line x1="10" y1="95" x2="290" y2="95"/><line x1="10" y1="20" x2="10" y2="95"/><polyline points={points}/>{values.map((value, index) => <circle key={index} cx={10 + index * (280 / (values.length - 1))} cy={95 - (value - min) / range * 75} r="3"/>)}<text x="12" y="16">{money.format(max)}</text><text x="12" y="108">{money.format(min)}</text></svg>;
}
