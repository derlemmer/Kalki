import { buildEbayQueries, decideEbayListing, selectListingsForStatistics } from "../lib/marketSearch";
import type { EbayListing } from "../lib/ebay";
import type { MotorcycleMarketIdentity } from "../lib/modelIsolation";

const knownBrands = ["Honda", "Suzuki", "Kawasaki", "Yamaha", "BMW", "KTM"];
const gsxr1999: MotorcycleMarketIdentity = {
  motorcycleId: 493,
  brand: "Suzuki",
  model: "GSX-R750",
  aliases: ["GSXR750", "GSX R 750", "GSX-R 750", "Suzuki GSX-R 750", "GSX-R 750 SRAD"],
  seriesCodes: ["GR7DB"],
  requiredSeriesCode: "GR7DB",
  requiredVariant: "SRAD 1998-1999",
  seriesFrom: 1998,
  seriesTo: 1999,
  modelYear: 1999,
  requireGenerationMarker: true,
  requiredGenerationTerms: [],
  competingModelTerms: ["GSX-R600", "GSX-R1000", "GSX750F"],
  knownSeriesCodes: ["GR7DB", "WVBD", "WVB3", "WVCF", "WVCW"],
  knownBrands,
};

function listing(title: string, price: number): EbayListing {
  return {
    id: title,
    title,
    url: "https://www.ebay.de/itm/test",
    price,
    shippingPrice: 0,
    currency: "EUR",
    imageUrl: null,
    condition: "Gebraucht",
    seller: null,
    itemEndDate: null,
  };
}

const queries = buildEbayQueries(gsxr1999, "Tank");
if (queries.length < 2 || !queries.some((query) => /SRAD/i.test(query)) || !queries.some((query) => /GR7DB/i.test(query))) {
  throw new Error(`Zu wenige modellgenaue Suchvarianten: ${queries.join(" || ")}`);
}

const cases: Array<[string, number, boolean]> = [
  ["Suzuki GSX-R 750 GR7DB Benzintank Kraftstofftank", 260, true],
  ["Suzuki GSX-R 750 SRAD Bj. 99 Benzintank Kraftstofftank", 240, true],
  ["Suzuki GSX-R 750 SRAD 98-99 Benzintank Kraftstofftank", 245, true],
  ["Suzuki GSX-R 750 Benzintank Kraftstofftank", 220, false],
  ["Suzuki GSX-R 750 GR7DB 96-97 Benzintank Kraftstofftank", 210, true],
  ["Suzuki GSX-R 750 GR7DB EZ:97 Tankhalter Tankbefestigung Benzintank B8302", 30, false],
  ["Suzuki GSXR 750 Srad GR7DB Kühlerausgleichsbehälter ohne Deckel Tank Cooler", 14, false],
  ["Suzuki GSX-R 750 SRAD GR7DB Motor Engine Bj.98-99", 650, false],
  ["Honda CBR1000RR SC57 Tank", 220, false],
  ["Suzuki GSX-R 750 WVB3 2004 Tank", 180, false],
];

for (const [title, price, expected] of cases) {
  const result = decideEbayListing(listing(title, price), gsxr1999, "Tank");
  if (result.accepted !== expected) {
    throw new Error(`${title}: erwartet ${expected}, erhalten ${result.accepted} (${result.reason})`);
  }
}


const realTitleCases: Array<[partName: string, title: string, expected: boolean, quality?: "exact" | "compatible"]> = [
  ["Bugspoiler", "Suzuki GSX-R 750 GR7DB EZ:97 Bugspoiler Verkleidung unten mitte B8360", true, "compatible"],
  ["Heckverkleidung", "Suzuki GSX-R 750 GR7DB EZ:97 Heckverkleidung hinten mitte B8311", true, "compatible"],
  ["Seitenverkleidung links", "Suzuki GSX-R 750 GR7DB EZ:97 Seitenverkleidung links Seitendeckel B8356", true, "compatible"],
  ["Innenverkleidung / Abdeckungen", "SUZUKI GSX-R 750 SRAD GR7DB Verkleidung innen vorne links #319", true, "compatible"],
  ["Scheinwerfer", "Suzuki GSX-R 750 GR7DB EZ:97 Geweih Halter Scheinwerfer Verkleidung vorne B8331", false],
  ["Getriebe", "Suzuki GSX-R 750 GR7DB EZ:97 Getriebe Motor Antrieb B8307", true, "compatible"],
  ["Motor komplett", "Suzuki GSX-R 750 GR7DB EZ:97 Getriebe Motor Antrieb B8307", false],
];

for (const [partName, title, expected, quality] of realTitleCases) {
  const result = decideEbayListing(listing(title, partName === "Getriebe" ? 179 : 69), gsxr1999, partName);
  if (result.accepted !== expected) {
    throw new Error(`Real-Titel ${partName}: erwartet ${expected}, erhalten ${result.accepted} (${result.reason})`);
  }
  if (quality && result.quality !== quality) {
    throw new Error(`Real-Titel ${partName}: erwartet Qualität ${quality}, erhalten ${result.quality}`);
  }
}

const exact = decideEbayListing(listing("Suzuki GSX-R 750 GR7DB 1999 Benzintank", 250), gsxr1999, "Tank");
const compatible = decideEbayListing(listing("Suzuki GSX-R 750 GR7DB EZ:97 Benzintank", 220), gsxr1999, "Tank");
if (exact.quality !== "exact") throw new Error(`1999-Treffer ist nicht exakt: ${exact.reason}`);
if (compatible.quality !== "compatible") throw new Error(`97er GR7DB ist nicht als kompatibler Fallback markiert: ${compatible.reason}`);


const exactSample = [
  { listing: listing("exact-1", 100), quality: "exact" as const },
  { listing: listing("exact-2", 110), quality: "exact" as const },
];
const compatibleSample = [
  { listing: listing("compatible-1", 90), quality: "compatible" as const },
  { listing: listing("compatible-2", 95), quality: "compatible" as const },
];
if (selectListingsForStatistics(exactSample, compatibleSample).some((item) => item.quality !== "exact")) {
  throw new Error("Kompatible Treffer wurden trotz zwei exakter Treffer verwendet.");
}
if (selectListingsForStatistics(exactSample.slice(0, 1), compatibleSample).length !== 3) {
  throw new Error("Kompatibler Fallback ergänzt eine einzelne exakte Beobachtung nicht.");
}

console.log(`MARKET_SEARCH_TESTS_OK (${cases.length + realTitleCases.length} Trefferfälle; ${queries.length} Suchvarianten)`);
