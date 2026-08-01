import db from "../database/db";
import { getMotorcycleMarketIdentity } from "../database/market";
import { listingMatchesMotorcycle } from "../lib/modelIsolation";

type MotorcycleRow = { id: number; brand: string; model: string };
type SeriesRow = { id: number; motorcycle_id: number; code: string | null; variant: string | null; from_year: number; to_year: number };

const motorcycles = db.prepare("SELECT id,brand,model FROM motorcycles ORDER BY id").all() as MotorcycleRow[];
const series = db.prepare("SELECT id,motorcycle_id,code,variant,from_year,to_year FROM series ORDER BY id").all() as SeriesRow[];
let cases = 0;

for (const motorcycle of motorcycles) {
  const identity = getMotorcycleMarketIdentity(motorcycle.id);
  const ownTitle = `${motorcycle.brand} ${motorcycle.model} Motor komplett`;
  if (!listingMatchesMotorcycle(ownTitle, identity)) {
    throw new Error(`Eigenes Familienmodell wurde abgelehnt: ${ownTitle}`);
  }
  cases += 1;

  const competitor = identity.competingModelTerms?.[0];
  if (competitor) {
    const competitorTitle = `${motorcycle.brand} ${competitor} Motor komplett`;
    if (listingMatchesMotorcycle(competitorTitle, identity)) {
      throw new Error(`Konkurrierendes Modell wurde angenommen: ${competitorTitle} für ${motorcycle.model}`);
    }
    cases += 1;
  }
}

for (const row of series) {
  const motorcycle = motorcycles.find((item) => item.id === row.motorcycle_id);
  if (!motorcycle) throw new Error(`Motorrad für Serie ${row.id} fehlt.`);
  const identity = getMotorcycleMarketIdentity(motorcycle.id, {
    seriesId: row.id,
    seriesCode: row.code,
    seriesVariant: row.variant,
    modelYear: row.from_year,
  });
  const markers = [motorcycle.brand, motorcycle.model, row.code, row.variant, row.from_year, "Tank"]
    .filter(Boolean)
    .join(" ");
  if (!listingMatchesMotorcycle(markers, identity)) {
    throw new Error(`Eigene Serie wurde abgelehnt: ${markers}`);
  }
  cases += 1;
}

console.log(`CATALOG_RUNTIME_OK ${cases}`);
