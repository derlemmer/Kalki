import fs from "node:fs";
import path from "node:path";
import { listingMatchesMotorcycle, type MotorcycleMarketIdentity } from "../lib/modelIsolation";

type CatalogMotorcycle = {
  brand: string;
  model: string;
  displayName?: string;
  aliases?: string[];
  series?: Array<{ code?: string | null }>;
};

const catalogPath = path.join(process.cwd(), "data", "motorcycle-catalog.json");
const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8")) as CatalogMotorcycle[];
const knownBrands = [...new Set(catalog.map((motorcycle) => motorcycle.brand))];

const honda: MotorcycleMarketIdentity = {
  motorcycleId: 1,
  brand: "Honda",
  model: "CBR600F",
  aliases: ["CBR 600F", "CBR-600F"],
  seriesCodes: ["PC31"],
  requiredSeriesCode: "PC31",
  knownSeriesCodes: ["PC19", "PC23", "PC25", "PC31", "PC35"],
  knownBrands,
};

const ktm: MotorcycleMarketIdentity = {
  motorcycleId: 2,
  brand: "KTM",
  model: "640 LC4",
  aliases: ["LC4 640"],
  seriesCodes: [],
  knownBrands,
};

const handPickedCases: Array<[MotorcycleMarketIdentity, string, boolean]> = [
  [honda, "Honda CBR600F PC31 Motor komplett", true],
  [honda, "Honda PC31 Tank Benzintank", true],
  [honda, "Honda CBR600F Tank ohne Typcode", false],
  [honda, "Honda CBR600F PC35 Tank", false],
  [honda, "Honda CBR600F PC31 PC35 Universal Tank", false],
  [honda, "Suzuki GSX-R 600 Motor komplett", false],
  [honda, "Kawasaki ZX-6R PC31 Motor", false],
  [honda, "Honda CBR1000RR Motor komplett", false],
  [honda, "Honda Yamaha CBR600F Universal Spiegel", false],
  [ktm, "KTM 640 LC4 Gabel komplett", true],
  [ktm, "Kawasaki KLR 650 Gabel komplett", false],
];

for (const [identity, title, expected] of handPickedCases) {
  const actual = listingMatchesMotorcycle(title, identity);
  if (actual !== expected) {
    throw new Error(`${title}: erwartet ${expected}, erhalten ${actual}`);
  }
}

let catalogCases = 0;
for (let index = 0; index < catalog.length; index += 1) {
  const motorcycle = catalog[index];
  const aliases = [...new Set([
    motorcycle.model,
    motorcycle.displayName,
    ...(motorcycle.aliases ?? []),
  ].filter((value): value is string => Boolean(value?.trim())))];
  const seriesCodes = [...new Set((motorcycle.series ?? [])
    .map((series) => series.code?.trim())
    .filter((value): value is string => Boolean(value)))];
  const identity: MotorcycleMarketIdentity = {
    motorcycleId: index + 1,
    brand: motorcycle.brand,
    model: motorcycle.model,
    aliases,
    seriesCodes,
    knownSeriesCodes: seriesCodes,
    knownBrands,
  };

  const ownTitle = `${motorcycle.brand} ${motorcycle.model} Motor komplett`;
  if (!listingMatchesMotorcycle(ownTitle, identity)) {
    throw new Error(`Eigenes Modell wurde nicht erkannt: ${ownTitle}`);
  }
  catalogCases += 1;

  const otherBrand = knownBrands.find((brand) => brand !== motorcycle.brand);
  if (otherBrand) {
    const wrongBrandTitle = `${otherBrand} ${motorcycle.model} Motor komplett`;
    if (listingMatchesMotorcycle(wrongBrandTitle, identity)) {
      throw new Error(`Fremdmarke wurde fälschlich angenommen: ${wrongBrandTitle} für ${motorcycle.brand}`);
    }
    catalogCases += 1;
  }

  if (otherBrand) {
    const universalTitle = `${motorcycle.brand} ${otherBrand} ${motorcycle.model} Universal Teil`;
    if (listingMatchesMotorcycle(universalTitle, identity)) {
      throw new Error(`Mehrmarken-Anzeige wurde fälschlich angenommen: ${universalTitle}`);
    }
    catalogCases += 1;
  }

  const firstSeriesCode = seriesCodes[0];
  if (firstSeriesCode) {
    const exactSeriesIdentity: MotorcycleMarketIdentity = {
      ...identity,
      seriesCodes: [firstSeriesCode],
      requiredSeriesCode: firstSeriesCode,
      aliases: aliases.filter((alias) => !seriesCodes.includes(alias) || alias === firstSeriesCode),
    };
    const exactTitle = `${motorcycle.brand} ${motorcycle.model} ${firstSeriesCode} Tank`;
    if (!listingMatchesMotorcycle(exactTitle, exactSeriesIdentity)) {
      throw new Error(`Exakter Typcode wurde nicht erkannt: ${exactTitle}`);
    }
    catalogCases += 1;

    const missingCodeTitle = `${motorcycle.brand} ${motorcycle.model} Tank`;
    if (listingMatchesMotorcycle(missingCodeTitle, exactSeriesIdentity)) {
      throw new Error(`Typcode-Pflicht wurde umgangen: ${missingCodeTitle} / ${firstSeriesCode}`);
    }
    catalogCases += 1;

    const otherSeriesCode = seriesCodes.find((code) => code !== firstSeriesCode);
    if (otherSeriesCode) {
      const wrongSeriesTitle = `${motorcycle.brand} ${motorcycle.model} ${otherSeriesCode} Tank`;
      if (listingMatchesMotorcycle(wrongSeriesTitle, exactSeriesIdentity)) {
        throw new Error(`Fremder Typcode wurde fälschlich angenommen: ${wrongSeriesTitle} statt ${firstSeriesCode}`);
      }
      catalogCases += 1;

      const multiSeriesTitle = `${motorcycle.brand} ${motorcycle.model} ${firstSeriesCode} ${otherSeriesCode} Universal Teil`;
      if (listingMatchesMotorcycle(multiSeriesTitle, exactSeriesIdentity)) {
        throw new Error(`Mehrfach-Typcode wurde fälschlich angenommen: ${multiSeriesTitle}`);
      }
      catalogCases += 1;
    }
  }
}

console.log(`Markentrennung geprüft: ${handPickedCases.length} Handfälle + ${catalogCases} Katalogfälle erfolgreich.`);
