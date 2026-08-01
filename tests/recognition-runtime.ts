import { findMotorcycleFromDatabase } from "../database/findMotorcycle";

function expectMatch(
  input: string,
  year: number | null,
  expected: { brand: string; model: string; code?: string | null; variant?: string | null },
) {
  const result = findMotorcycleFromDatabase(input, year);
  if (!result) throw new Error(`Kein Treffer für: ${input}`);
  if (result.motorcycle.brand !== expected.brand || result.motorcycle.model !== expected.model) {
    throw new Error(`${input}: erwartet ${expected.brand} ${expected.model}, erhalten ${result.motorcycle.brand} ${result.motorcycle.model}`);
  }
  if ("code" in expected && result.matchedSeries?.code !== expected.code) {
    throw new Error(`${input}: erwartet Code ${expected.code}, erhalten ${result.matchedSeries?.code ?? "kein Code"}`);
  }
  if ("variant" in expected && result.matchedSeries?.variant !== expected.variant) {
    throw new Error(`${input}: erwartet Variante ${expected.variant}, erhalten ${result.matchedSeries?.variant ?? "keine Variante"}`);
  }
  return result;
}

expectMatch(
  "Suzuki GSX-R 750 nur 37.752 KM TÜV 06/2028",
  1999,
  { brand: "Suzuki", model: "GSX-R750", code: "GR7DB", variant: "SRAD 1998-1999" },
);
expectMatch(
  "Honda CBR 1000 Fireblade SC57",
  2004,
  { brand: "Honda", model: "CBR1000RR Fireblade", code: "SC57", variant: "SC57 2004-2005" },
);
expectMatch(
  "Honda CBR 1000 Fireblade SC57",
  2006,
  { brand: "Honda", model: "CBR1000RR Fireblade", code: "SC57", variant: "SC57 Facelift 2006-2007" },
);
expectMatch(
  "Suzuki SV1000S",
  2004,
  { brand: "Suzuki", model: "SV1000", code: "WVBX", variant: "SV1000S" },
);
expectMatch(
  "Suzuki SV1000N",
  2004,
  { brand: "Suzuki", model: "SV1000", code: "WVBX", variant: "SV1000N" },
);

const ambiguous = findMotorcycleFromDatabase("Honda CBR 1000 Fireblade SC57", null);
if (!ambiguous || ambiguous.motorcycle.model !== "CBR1000RR Fireblade") {
  throw new Error("SC57-Familie ohne Jahr wurde nicht erkannt.");
}
if (ambiguous.matchedSeries !== null) {
  throw new Error(`SC57 ohne Jahr darf keine Generation raten: ${ambiguous.matchedSeries.variant}`);
}

console.log("RECOGNITION_RUNTIME_OK");
