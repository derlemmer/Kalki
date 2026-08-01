export type ParsedListing = {
  title: string;
  brand: string;
  model: string;
  year: string;
  mileage: string;
  price: number;
  location: string;
  description: string;
  images: string[];
};

const MOTORCYCLE_BRANDS = [
  "Aprilia", "BMW", "Benelli", "Ducati", "Harley-Davidson", "Honda",
  "Husqvarna", "Kawasaki", "KTM", "Moto Guzzi", "MV Agusta",
  "Royal Enfield", "Suzuki", "Triumph", "Yamaha",
];

export function decodeHtml(value: string) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

export function cleanHtml(value: string) {
  return decodeHtml(value)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|li|tr|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function meta(html: string, key: string) {
  const escaped = escapeRegex(key);
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${escaped}["'][^>]+content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${escaped}["']`, "i"),
    new RegExp(`<meta[^>]+name=["']${escaped}["'][^>]+content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+name=["']${escaped}["']`, "i"),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return cleanHtml(match[1]);
  }
  return "";
}

function parseJsonLd(html: string): unknown[] {
  const result: unknown[] = [];
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(decodeHtml(match[1]));
      if (Array.isArray(parsed)) result.push(...parsed);
      else result.push(parsed);
    } catch {
      // A malformed optional JSON-LD block must not break the complete listing import.
    }
  }
  return result;
}

function flatten(nodes: unknown[]): Record<string, unknown>[] {
  const output: Record<string, unknown>[] = [];
  const visit = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return void node.forEach(visit);
    const object = node as Record<string, unknown>;
    output.push(object);
    for (const key of ["@graph", "mainEntity", "itemListElement", "offers", "address", "itemOffered"]) {
      if (object[key]) visit(object[key]);
    }
  };
  nodes.forEach(visit);
  return output;
}

function firstString(object: Record<string, unknown> | undefined, keys: string[]) {
  for (const key of keys) {
    const value = object?.[key];
    if (typeof value === "string") return value;
    if (typeof value === "number") return String(value);
    if (value && typeof value === "object") {
      const nested = value as Record<string, unknown>;
      if (typeof nested.value === "string" || typeof nested.value === "number") return String(nested.value);
    }
  }
  return "";
}

export function parseListingPrice(value: string | number | undefined) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (!value) return 0;
  const raw = String(value).trim();
  const normalized = raw
    .replace(/\s/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".")
    .replace(/[^0-9.]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function normalizeMileage(value: string) {
  const match = value.match(/(\d{1,3}(?:[.\s]\d{3})+|\d{1,7})\s*(?:km|kilometer)?\b/i);
  if (!match?.[1]) return "";
  const mileage = Number(match[1].replace(/[.\s]/g, ""));
  return Number.isFinite(mileage) && mileage >= 1 && mileage <= 2_000_000 ? String(mileage) : "";
}

function rawMatch(html: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return cleanHtml(match[1]);
  }
  return "";
}

function extractMileage(html: string, pageText: string, title: string, product?: Record<string, unknown>) {
  const structured = firstString(product, ["mileageFromOdometer", "mileage", "mileageValue"]);
  const candidates = [
    structured,
    rawMatch(html, [
      /"mileageFromOdometer"\s*:\s*\{[\s\S]{0,400}?"value"\s*:\s*"?([\d.\s]+)"?/i,
      /"mileage"\s*:\s*"?([\d.\s]+)\s*(?:km|kilometer)?"?/i,
      /(?:Kilometerstand|Laufleistung)[\s\S]{0,350}?([\d]{1,3}(?:[.\s]\d{3})+|\d{1,7})\s*(?:km|Kilometer)\b/i,
    ]),
    pageText.match(/(?:Kilometerstand|Laufleistung)\s*[:\-]?\s*(\d{1,3}(?:[.\s]\d{3})+|\d{1,7})\s*(?:km|Kilometer)\b/i)?.[1] ?? "",
    title.match(/\b(\d{1,3}(?:[.\s]\d{3})+|\d{1,7})\s*(?:km|Kilometer)\b/i)?.[1] ?? "",
  ];
  for (const candidate of candidates) {
    const normalized = normalizeMileage(candidate);
    if (normalized) return normalized;
  }
  return "";
}

function validVehicleYear(value: string) {
  const fourDigits = value.match(/\b(19\d{2}|20\d{2})\b/);
  let year = fourDigits ? Number(fourDigits[1]) : NaN;
  if (!Number.isFinite(year)) {
    const twoDigits = value.match(/(?:^|[./-])(\d{2})\s*$/)?.[1];
    if (twoDigits) {
      const shortYear = Number(twoDigits);
      year = shortYear >= 70 ? 1900 + shortYear : 2000 + shortYear;
    }
  }
  const maximum = new Date().getFullYear() + 1;
  return Number.isFinite(year) && year >= 1900 && year <= maximum ? String(year) : "";
}

/**
 * Registration/model year is intentionally extracted only from structured data
 * or labels such as Erstzulassung/Baujahr/EZ. A bare year in the title is not
 * used because it is very often the HU/TÜV expiry (for example "TÜV 06/2028").
 */
function extractVehicleYear(html: string, pageText: string, product?: Record<string, unknown>) {
  const candidates = [
    firstString(product, ["dateVehicleFirstRegistered", "vehicleModelDate", "modelDate", "productionDate"]),
    rawMatch(html, [
      /"dateVehicleFirstRegistered"\s*:\s*"([^"]+)"/i,
      /"vehicleModelDate"\s*:\s*"?((?:19|20)\d{2})"?/i,
      /"firstRegistration"\s*:\s*"([^"]+)"/i,
    ]),
    pageText.match(/(?:Erstzulassung|Erstzul\.|Baujahr|Modelljahr|Bj\.?)\s*[:\-]?\s*((?:\d{1,2}[./-])?(?:\d{1,2}[./-])?(?:(?:19|20)\d{2}|\d{2}))\b/i)?.[1] ?? "",
    pageText.match(/\bEZ\s*[:\-]?\s*((?:\d{1,2}[./-])?(?:(?:19|20)\d{2}|\d{2}))\b/i)?.[1] ?? "",
  ];
  for (const candidate of candidates) {
    const year = validVehicleYear(candidate);
    if (year) return year;
  }
  return "";
}

function normalizeLocation(postalCode: string, locality: string) {
  const postal = postalCode.match(/\b\d{5}\b/)?.[0] ?? "";
  let city = cleanHtml(locality)
    .replace(/^\d{5}\s*/, "")
    .replace(/^[A-Za-zÄÖÜäöüß -]+\s+-\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (city.includes(" - ")) city = city.split(" - ").at(-1)?.trim() ?? city;
  return postal && city ? `${postal} ${city}` : city || postal;
}

function extractLocation(html: string, pageText: string, address?: Record<string, unknown>) {
  const postal = rawMatch(html, [/"postalCode"\s*:\s*"(\d{5})"/i]);
  const city = rawMatch(html, [/"addressLocality"\s*:\s*"([^"]+)"/i]);
  const jsonLocation = normalizeLocation(postal, city);
  if (jsonLocation) return jsonLocation;

  const addressLocation = normalizeLocation(
    firstString(address, ["postalCode"]),
    firstString(address, ["addressLocality"]),
  );
  if (addressLocation) return addressLocation;

  const stateLocation = pageText.match(/\b(\d{5})\s+(?:Baden-Württemberg|Bayern|Berlin|Brandenburg|Bremen|Hamburg|Hessen|Mecklenburg-Vorpommern|Niedersachsen|Nordrhein-Westfalen|Rheinland-Pfalz|Saarland|Sachsen-Anhalt|Sachsen|Schleswig-Holstein|Thüringen)\s*-\s*([A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß .'-]{1,60})/i);
  if (stateLocation) return normalizeLocation(stateLocation[1], stateLocation[2]);

  const simple = pageText.match(/\b(\d{5})\s+([A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß .'-]{1,45})\b/);
  return simple ? normalizeLocation(simple[1], simple[2]) : meta(html, "og:locality");
}

export function inferMotorcycleFromText(title: string, description = "") {
  const source = `${title} ${description}`;
  const brand = MOTORCYCLE_BRANDS.find((item) => {
    const pattern = escapeRegex(item).replace(/\\-/g, "[- ]");
    return new RegExp(`\\b${pattern}\\b`, "i").test(source);
  }) ?? "";

  const gsxr = source.match(/\bGSX[\s-]?R\s*(\d{3,4})\b/i);
  if (gsxr) return { brand: brand || "Suzuki", model: `GSX-R${gsxr[1]}` };

  if (/\bCBR\s*1000\s*(?:RR)?\b/i.test(source) && /\b(?:Fireblade|SC\s*5[79]|RR)\b/i.test(source)) {
    return { brand: brand || "Honda", model: "CBR1000RR Fireblade" };
  }

  const sv1000 = source.match(/\bSV[\s-]?1000\s*([SN])?\b/i);
  if (sv1000) return { brand: brand || "Suzuki", model: "SV1000" };

  let model = title
    .replace(/\|.*$/g, "")
    .replace(/\b(gebraucht|motorrad|motorräder|kleinanzeigen|ebay|top zustand)\b/gi, "")
    .replace(/\b\d{1,3}(?:[.,]\d{1,2})?\s*(?:€|eur)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  if (brand) model = model.replace(new RegExp(escapeRegex(brand), "gi"), "").trim();
  return { brand, model: model.split(/[|,]/)[0]?.trim() || "" };
}


function collectImageUrls(html: string, product?: Record<string, unknown>) {
  const urls = new Set<string>();
  const add = (value: unknown) => {
    if (typeof value !== "string") return;
    const clean = decodeHtml(value).replace(/\\u0026/g, "&").replace(/\\\//g, "/").trim();
    try {
      const target = new URL(clean);
      const looksLikeImage = /\.(?:jpe?g|png|webp)(?:[?#]|$)/i.test(clean)
        || /(?:^|\.)(?:img|images|image|photos|cdn)\./i.test(target.hostname)
        || /\/(?:images?|photos?|pictures?)\//i.test(target.pathname);
      if (target.protocol === "https:" && looksLikeImage) urls.add(target.toString());
    } catch {
      // Ungültige oder relative Bildadressen werden nicht in das Projekt übernommen.
    }
  };
  const image = product?.image;
  if (Array.isArray(image)) image.forEach((value) => typeof value === "object" && value ? add((value as Record<string, unknown>).url) : add(value));
  else if (image && typeof image === "object") add((image as Record<string, unknown>).url);
  else add(image);
  add(meta(html, "og:image"));
  const normalizedImageHtml = html.replace(/\\\//g, "/");
  for (const match of normalizedImageHtml.matchAll(/(?:"(?:image|imageUrl|largeUrl|fullImageUrl)"|data-imgsrc)\s*[:=]\s*["'](https:\/\/[^"']+)["']/gi)) add(match[1]);
  return [...urls].slice(0, 30);
}

export function parseListingHtml(html: string): ParsedListing {
  const pageText = cleanHtml(html);
  const nodes = flatten(parseJsonLd(html));
  const product = nodes.find((object) => {
    const type = object["@type"];
    const types = Array.isArray(type) ? type.map(String) : [String(type ?? "")];
    return types.some((item) => ["Product", "Vehicle", "Motorcycle"].includes(item));
  });
  const offer = (product?.offers && typeof product.offers === "object"
    ? product.offers
    : nodes.find((object) => object["@type"] === "Offer")) as Record<string, unknown> | undefined;
  const address = nodes.find((object) => object["@type"] === "PostalAddress")
    ?? (product?.address as Record<string, unknown> | undefined);

  const title = cleanHtml(
    firstString(product, ["name", "headline"])
      || meta(html, "og:title")
      || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
      || "",
  );
  const description = cleanHtml(
    firstString(product, ["description"])
      || meta(html, "og:description")
      || meta(html, "description"),
  );
  const inferred = inferMotorcycleFromText(title, description);

  const priceCandidates: Array<string | number | undefined> = [
    firstString(offer, ["price", "lowPrice"]),
    meta(html, "product:price:amount"),
    html.match(/"ad_price"\s*:\s*"([\d.,]+)"/i)?.[1],
    html.match(/<meta[^>]+itemprop=["']price["'][^>]+content=["']([\d.,]+)["']/i)?.[1],
    html.match(/\badPrice\s*:\s*([\d.,]+)/i)?.[1],
    pageText.match(/(?:^|\n)\s*([\d.]+(?:,\d{2})?)\s*(?:€|EUR)(?:\s|$)/im)?.[1],
  ];
  const price = priceCandidates.map(parseListingPrice).find((value) => value > 0) ?? 0;

  return {
    title,
    brand: inferred.brand,
    model: inferred.model,
    year: extractVehicleYear(html, pageText, product),
    mileage: extractMileage(html, pageText, title, product),
    price,
    location: extractLocation(html, pageText, address),
    description,
    images: collectImageUrls(html, product),
  };
}
