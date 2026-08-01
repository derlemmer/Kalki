import db from "../../../../database/db";
import { getMarketRefreshProgress, refreshMotorcyclePricesBatch } from "../../../../database/market";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (expected && supplied !== expected) return Response.json({ error: "Nicht autorisiert." }, { status: 401 });

  const candidates = db.prepare(`
    WITH scopes AS (
      SELECT motorcycle_id,series_id,series_code,market_scope_key FROM market_refresh_log
      WHERE market_scope_key<>''
      UNION
      SELECT motorcycle_id,series_id,'',market_scope_key FROM price_observations
      WHERE motorcycle_id IS NOT NULL AND market_scope_key<>''
    )
    SELECT s.motorcycle_id,s.series_id,COALESCE(s.series_code,'') series_code,s.market_scope_key
    FROM scopes s
    ORDER BY COALESCE((SELECT MAX(refreshed_at) FROM market_refresh_log l
      WHERE l.motorcycle_id=s.motorcycle_id AND l.market_scope_key=s.market_scope_key AND l.provider='ebay'),'1970-01-01') ASC
    LIMIT 12
  `).all() as Array<{ motorcycle_id: number; series_id: number | null; series_code: string; market_scope_key: string }>;

  const targets = candidates.map((candidate) => ({ ...candidate,
    progress: getMarketRefreshProgress(candidate.motorcycle_id, 7, { seriesId: candidate.series_id, seriesCode: candidate.series_code }) }))
    .filter((candidate) => candidate.progress.eligible > 0).slice(0, 2);
  const results: unknown[] = [];
  for (const target of targets) {
    try {
      results.push(await refreshMotorcyclePricesBatch({ motorcycleId: target.motorcycle_id,
        seriesId: target.series_id, seriesCode: target.series_code || null, maxAgeDays: 7, batchSize: 4 }));
    } catch (error) {
      results.push({ motorcycleId: target.motorcycle_id, seriesId: target.series_id,
        error: error instanceof Error ? error.message : "Fehler" });
    }
  }
  return Response.json({ motorcycles: targets.length, results });
}
