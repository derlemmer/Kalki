function fail(message: string): never { throw new Error(message); }
function equal(actual: unknown, expected: unknown, message = "values differ") {
  if (actual !== expected) fail(`${message}: expected ${String(expected)}, got ${String(actual)}`);
}
function deepEqual(actual: unknown, expected: unknown, message = "objects differ") {
  const left = JSON.stringify(actual);
  const right = JSON.stringify(expected);
  if (left !== right) fail(`${message}: expected ${right}, got ${left}`);
}
function throws(fn: () => unknown, message = "expected function to throw") {
  try { fn(); } catch { return; }
  fail(message);
}
import { parseListingHtml, inferMotorcycleFromText } from "../lib/listingParser";
import { listingMatchesMotorcycle, type MotorcycleMarketIdentity } from "../lib/modelIsolation";
import { summarizeRoute } from "../lib/routeMath";

function fixtureHtml(options: {
  title: string;
  price: number;
  year: string;
  mileage: number;
  postal: string;
  city: string;
  description?: string;
}) {
  const { title, price, year, mileage, postal, city, description = "" } = options;
  return `<!doctype html><html><head>
    <meta property="og:title" content="${title}">
    <script type="application/ld+json">${JSON.stringify({
      "@type": "Vehicle",
      name: title,
      description,
      dateVehicleFirstRegistered: year,
      mileageFromOdometer: { "@type": "QuantitativeValue", value: mileage, unitCode: "KMT" },
      offers: { "@type": "Offer", price: String(price), priceCurrency: "EUR" },
      address: { "@type": "PostalAddress", postalCode: postal, addressLocality: city },
    })}</script>
  </head><body>
    <div>Erstzulassung ${year}</div>
    <div>Kilometerstand ${mileage.toLocaleString("de-DE")} km</div>
    <div>${postal} Baden-Württemberg - ${city}</div>
    <div>${price} €</div>
  </body></html>`;
}

const gsxr = parseListingHtml(fixtureHtml({
  title: "Suzuki GSX-R 750 | nur 37.752 KM | TÜV 06/2028",
  price: 3200,
  year: "03/1999",
  mileage: 37752,
  postal: "73249",
  city: "Wernau",
}));
deepEqual(
  { brand: gsxr.brand, model: gsxr.model, year: gsxr.year, mileage: gsxr.mileage, price: gsxr.price, location: gsxr.location },
  { brand: "Suzuki", model: "GSX-R750", year: "1999", mileage: "37752", price: 3200, location: "73249 Wernau" },
);

const sc57 = parseListingHtml(fixtureHtml({
  title: "Honda CBR 1000 Fireblade SC57",
  price: 4500,
  year: "05/2006",
  mileage: 29123,
  postal: "50667",
  city: "Köln",
}));
deepEqual(
  { brand: sc57.brand, model: sc57.model, year: sc57.year, mileage: sc57.mileage, price: sc57.price },
  { brand: "Honda", model: "CBR1000RR Fireblade", year: "2006", mileage: "29123", price: 4500 },
);

const sv = parseListingHtml(fixtureHtml({
  title: "Suzuki SV1000S",
  price: 2600,
  year: "04/2004",
  mileage: 48500,
  postal: "56068",
  city: "Koblenz",
}));
deepEqual(
  { brand: sv.brand, model: sv.model, year: sv.year, mileage: sv.mileage, price: sv.price },
  { brand: "Suzuki", model: "SV1000", year: "2004", mileage: "48500", price: 2600 },
);


const compactFallback = parseListingHtml(`<!doctype html><html><head>
  <meta property="og:title" content="Suzuki GSX-R 750 nur 37.752 km">
</head><body>
  <div>EZ 03/99</div><div>3.200 €</div><div>73249 Baden-Württemberg - Wernau</div>
</body></html>`);
deepEqual(
  { brand: compactFallback.brand, model: compactFallback.model, year: compactFallback.year, mileage: compactFallback.mileage, price: compactFallback.price, location: compactFallback.location },
  { brand: "Suzuki", model: "GSX-R750", year: "1999", mileage: "37752", price: 3200, location: "73249 Wernau" },
);

const photoListing = parseListingHtml(`<!doctype html><html><head>
  <meta property="og:title" content="Suzuki GSX-R 750 GR7DB">
  <meta property="og:image" content="https://img.example.test/preview.jpg">
  <script type="application/ld+json">${JSON.stringify({
    "@type": "Vehicle",
    name: "Suzuki GSX-R 750 GR7DB",
    image: ["https://img.example.test/one.webp", { url: "https://img.example.test/api/v1/prod-ads/images/no-extension" }, { url: "https://img.example.test/two.png" }],
  })}</script>
</head><body></body></html>`);
deepEqual(photoListing.images, [
  "https://img.example.test/one.webp",
  "https://img.example.test/api/v1/prod-ads/images/no-extension",
  "https://img.example.test/two.png",
  "https://img.example.test/preview.jpg",
], "Inseratfotos wurden nicht vollständig übernommen");

deepEqual(inferMotorcycleFromText("Suzuki GSXR 750 SRAD"), { brand: "Suzuki", model: "GSX-R750" });
deepEqual(inferMotorcycleFromText("Honda CBR 1000 RR Fireblade SC57"), { brand: "Honda", model: "CBR1000RR Fireblade" });
deepEqual(inferMotorcycleFromText("Suzuki SV 1000 S"), { brand: "Suzuki", model: "SV1000" });

const brands = [
  "Aprilia", "BMW", "Benelli", "Ducati", "Harley-Davidson", "Honda", "Husqvarna", "Kawasaki",
  "KTM", "Moto Guzzi", "MV Agusta", "Royal Enfield", "Suzuki", "Triumph", "Yamaha",
];
const sc57Identity: MotorcycleMarketIdentity = {
  motorcycleId: 1,
  brand: "Honda",
  model: "CBR1000RR Fireblade",
  aliases: ["CBR1000RR", "CBR 1000 Fireblade", "Fireblade SC57"],
  seriesCodes: ["SC57"],
  requiredSeriesCode: "SC57",
  requiredVariant: "SC57 Facelift 2006-2007",
  seriesFrom: 2006,
  seriesTo: 2007,
  modelYear: 2006,
  requireGenerationMarker: true,
  requiredGenerationTerms: ["facelift"],
  competingModelTerms: ["CBR600RR", "CBR 600 RR", "CBR600F"],
  knownSeriesCodes: ["SC57", "SC59"],
  knownBrands: brands,
};
equal(listingMatchesMotorcycle("Honda CBR 1000 RR SC57 2006 Tank original", sc57Identity), true);
equal(listingMatchesMotorcycle("Honda CBR 1000 RR SC59 2009 Tank original", sc57Identity), false);
equal(listingMatchesMotorcycle("Suzuki GSX-R 750 Tank passend auch Honda CBR1000RR SC57", sc57Identity), false);
equal(listingMatchesMotorcycle("Honda CBR1000RR SC57 Tank", sc57Identity), false);
equal(listingMatchesMotorcycle("Honda CBR1000RR SC57 Facelift Tank", sc57Identity), true);
equal(listingMatchesMotorcycle("Honda CBR600RR SC57 2006 Tank", sc57Identity), false);

const sc57Early: MotorcycleMarketIdentity = {
  ...sc57Identity,
  requiredVariant: "SC57 2004-2005",
  seriesFrom: 2004,
  seriesTo: 2005,
  modelYear: 2004,
  requiredGenerationTerms: [],
};
equal(listingMatchesMotorcycle("Honda CBR1000RR SC57 Tank", sc57Early), false);
equal(listingMatchesMotorcycle("Honda CBR1000RR SC57 2004 Tank", sc57Early), true);

const gsxr1999: MotorcycleMarketIdentity = {
  motorcycleId: 3,
  brand: "Suzuki",
  model: "GSX-R750",
  aliases: ["GSXR750", "GSX R 750", "GSX-R 750"],
  seriesCodes: ["GR7DB"],
  requiredSeriesCode: "GR7DB",
  requiredVariant: "SRAD 1998-1999",
  seriesFrom: 1998,
  seriesTo: 1999,
  modelYear: 1999,
  requireGenerationMarker: true,
  requiredGenerationTerms: [],
  knownSeriesCodes: ["GR7DB", "WVBD", "WVB3", "WVCF", "WVCW"],
  knownBrands: brands,
};
equal(listingMatchesMotorcycle("Suzuki GSXR750 GR7DB SRAD Tank", gsxr1999), false);
equal(listingMatchesMotorcycle("Suzuki GSXR750 GR7DB SRAD 1999 Tank", gsxr1999), true);
equal(listingMatchesMotorcycle("Suzuki GSXR750 WVB3 2004 Tank", gsxr1999), false);

const gsxrK5: MotorcycleMarketIdentity = {
  ...gsxr1999,
  motorcycleId: 4,
  model: "GSX-R1000",
  aliases: ["GSXR1000", "GSX R 1000"],
  seriesCodes: [],
  requiredSeriesCode: null,
  requiredVariant: "K5/K6",
  seriesFrom: 2005,
  seriesTo: 2006,
  modelYear: 2005,
  requiredGenerationTerms: ["k5", "k6"],
  knownSeriesCodes: [],
};
equal(listingMatchesMotorcycle("Suzuki GSXR1000 K5 Tank", gsxrK5), true);
equal(listingMatchesMotorcycle("Suzuki GSXR1000 K3 Tank", gsxrK5), false);

const svS: MotorcycleMarketIdentity = {
  motorcycleId: 2,
  brand: "Suzuki",
  model: "SV1000",
  aliases: ["SV1000", "SV 1000", "SV1000S"],
  seriesCodes: ["WVBX"],
  requiredSeriesCode: "WVBX",
  requiredVariant: "SV1000S",
  seriesFrom: 2003,
  seriesTo: 2007,
  modelYear: 2004,
  requireGenerationMarker: true,
  requiredGenerationTerms: ["sv1000s"],
  knownSeriesCodes: ["WVBX"],
  knownBrands: brands,
};
equal(listingMatchesMotorcycle("Suzuki SV1000S WVBX 2004 Tank", svS), true);
equal(listingMatchesMotorcycle("Suzuki SV1000N WVBX 2004 Tank", svS), false);
equal(listingMatchesMotorcycle("Kawasaki SV1000S WVBX Tank", svS), false);

deepEqual(summarizeRoute(123456, 7200), {
  oneWayKm: 123,
  roundTripKm: 247,
  oneWayMinutes: 120,
  roundTripMinutes: 240,
});
throws(() => summarizeRoute(-1, 10));

console.log("PURE_TESTS_OK");
