import db from "../../../../database/db";
import { isEbayConfigured } from "../../../../lib/ebay";
import { isRemoteMarketStoreConfigured } from "../../../../lib/remoteMarketStore";
import { MARKET_MATCHER_VERSION } from "../../../../database/market";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const catalog = db.prepare(`
    SELECT COUNT(*) AS motorcycles, COUNT(DISTINCT brand) AS brands
    FROM motorcycles
  `).get() as { motorcycles: number; brands: number };
  const parts = db.prepare(`SELECT COUNT(*) AS count FROM part_templates`).get() as { count: number };
  const observations = db.prepare(`
    SELECT COUNT(*) AS count, MAX(observed_at) AS newest
    FROM price_observations
    WHERE COALESCE(is_active,1)=1 AND COALESCE(TRIM(market_scope_key),'')<>''
  `).get() as { count: number; newest: string | null };

  return Response.json({
    version: "1.5.0",
    catalog: { ...catalog, partTemplates: parts.count },
    market: {
      ebayConfigured: isEbayConfigured(),
      persistentCacheConfigured: isRemoteMarketStoreConfigured(),
      observations: observations.count,
      newestObservation: observations.newest,
      matcherVersion: MARKET_MATCHER_VERSION,
    },
  });
}
