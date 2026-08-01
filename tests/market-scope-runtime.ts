import db from "../database/db";
import { getPartsForMotorcycle } from "../database/getParts";
import { listingMatchesMotorcycle } from "../lib/modelIsolation";
import {
  getMotorcycleMarketIdentity,
  getMotorcycleMarketScopeKey,
  resolveMarketSeries,
} from "../database/market";

function motorcycleId(brand: string, model: string) {
  const row = db.prepare("SELECT id FROM motorcycles WHERE brand=? AND model=?").get(brand, model) as { id: number } | undefined;
  if (!row) throw new Error(`${brand} ${model} fehlt.`);
  return row.id;
}

const gsxr = motorcycleId("Suzuki", "GSX-R750");
const gsxrInput = { seriesCode: "GR7DB", modelYear: 1999 };
const gsxrSeries = resolveMarketSeries(gsxr, gsxrInput);
if (!gsxrSeries || gsxrSeries.variant !== "SRAD 1998-1999") throw new Error("GSX-R750 1999 wurde nicht eindeutig aufgelöst.");
const gsxrIdentity = getMotorcycleMarketIdentity(gsxr, { ...gsxrInput, seriesId: gsxrSeries.id });
if (!gsxrIdentity.requireGenerationMarker || gsxrIdentity.requiredGenerationTerms?.length !== 0) {
  throw new Error("GR7DB 1998-1999 muss wegen gemeinsamem SRAD-Marker ein Jahr verlangen.");
}
if (getPartsForMotorcycle(gsxr, gsxrSeries.id, getMotorcycleMarketScopeKey(gsxr, { ...gsxrInput, seriesId: gsxrSeries.id })).length !== 108) {
  throw new Error("GSX-R750 erhielt nicht 108 Teile.");
}

const cbr600f = motorcycleId("Honda", "CBR600F");
const pc31 = resolveMarketSeries(cbr600f, { seriesCode: "PC31", modelYear: 1997 });
if (!pc31) throw new Error("CBR600F PC31 fehlt.");
const pc31Identity = getMotorcycleMarketIdentity(cbr600f, { seriesId: pc31.id, modelYear: 1997 });
if (!pc31Identity.competingModelTerms?.some((term) => term.replace(/[^a-z0-9]/gi, "").toLowerCase() === "cbr600rr")) {
  throw new Error("CBR600RR fehlt als konkurrierendes Honda-Modell.");
}
if (listingMatchesMotorcycle("Honda CBR600RR PC31 Tank", pc31Identity)) {
  throw new Error("CBR600RR wurde fälschlich als CBR600F PC31 akzeptiert.");
}
if (!listingMatchesMotorcycle("Honda CBR600F PC31 Tank", pc31Identity)) {
  throw new Error("CBR600F PC31 wurde nicht akzeptiert.");
}

const blade = motorcycleId("Honda", "CBR1000RR Fireblade");
const sc57Early = resolveMarketSeries(blade, { seriesCode: "SC57", modelYear: 2004 });
const sc57Late = resolveMarketSeries(blade, { seriesCode: "SC57", modelYear: 2006 });
if (!sc57Early || !sc57Late || sc57Early.id === sc57Late.id) throw new Error("SC57-Generationen wurden nicht getrennt.");
const earlyIdentity = getMotorcycleMarketIdentity(blade, { seriesId: sc57Early.id, modelYear: 2004 });
const lateIdentity = getMotorcycleMarketIdentity(blade, { seriesId: sc57Late.id, modelYear: 2006 });
if (earlyIdentity.requiredGenerationTerms?.length !== 0) throw new Error("Frühe SC57 darf keinen gemeinsamen SC57-Marker als Generation nutzen.");
if (!lateIdentity.requiredGenerationTerms?.includes("facelift")) throw new Error("SC57 Facelift-Marker fehlt.");
const earlyKey = getMotorcycleMarketScopeKey(blade, { seriesId: sc57Early.id, modelYear: 2004 });
const lateKey = getMotorcycleMarketScopeKey(blade, { seriesId: sc57Late.id, modelYear: 2006 });
if (earlyKey === lateKey) throw new Error("SC57-Scopes sind identisch.");
if (getPartsForMotorcycle(blade, sc57Early.id, earlyKey).length !== 108) throw new Error("Fireblade erhielt nicht 108 Teile.");

const sv = motorcycleId("Suzuki", "SV1000");
const svS = resolveMarketSeries(sv, { seriesCode: "WVBX", seriesVariant: "SV1000S", modelYear: 2004 });
const svN = resolveMarketSeries(sv, { seriesCode: "WVBX", seriesVariant: "SV1000N", modelYear: 2004 });
if (!svS || !svN || svS.id === svN.id) throw new Error("SV1000S/N wurden nicht getrennt.");
const svSIdentity = getMotorcycleMarketIdentity(sv, { seriesId: svS.id, modelYear: 2004 });
if (!svSIdentity.requiredGenerationTerms?.includes("sv1000s")) throw new Error("SV1000S-Marker fehlt.");
if (getMotorcycleMarketScopeKey(sv, { seriesId: svS.id }) === getMotorcycleMarketScopeKey(sv, { seriesId: svN.id })) {
  throw new Error("SV1000S/N-Scopes sind identisch.");
}
if (getPartsForMotorcycle(sv, svS.id, getMotorcycleMarketScopeKey(sv, { seriesId: svS.id })).length !== 108) {
  throw new Error("SV1000S erhielt nicht 108 Teile.");
}

console.log("MARKET_SCOPE_RUNTIME_OK");
