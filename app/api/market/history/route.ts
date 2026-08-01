import db from "../../../../database/db";
import { getPriceStatistics } from "../../../../database/getPriceStatistics";
import { getMotorcycleMarketScopeKey, resolveMarketSeries } from "../../../../database/market";
import { getRemoteObservations } from "../../../../lib/remoteMarketStore";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const motorcycleId = Number(url.searchParams.get("motorcycleId"));
  const partTemplateId = Number(url.searchParams.get("partTemplateId"));
  if (!Number.isInteger(motorcycleId) || motorcycleId <= 0 || !Number.isInteger(partTemplateId) || partTemplateId <= 0) {
    return Response.json({ error: "Ungültige IDs." }, { status: 400 });
  }
  try {
    const input = { seriesId: Number(url.searchParams.get("seriesId")) || null,
      seriesCode: url.searchParams.get("seriesCode")?.trim() || null,
      seriesVariant: url.searchParams.get("seriesVariant")?.trim() || null,
      modelYear: Number(url.searchParams.get("modelYear")) || null };
    const series = resolveMarketSeries(motorcycleId, input);
    const scopeKey = getMotorcycleMarketScopeKey(motorcycleId, input);
    const localObservations = db.prepare(`
      SELECT price,shipping_price,source,title,url,observed_at,image_url
      FROM price_observations
      WHERE motorcycle_id=? AND part_template_id=? AND COALESCE(series_id,0)=COALESCE(?,0)
        AND market_scope_key=? AND COALESCE(is_active,1)=1
      ORDER BY observed_at ASC LIMIT 80
    `).all(motorcycleId, partTemplateId, series?.id ?? null, scopeKey) as Array<{
      price: number; shipping_price: number; source: string; title: string; url: string; observed_at: string; image_url: string | null;
    }>;
    const remoteObservations = await getRemoteObservations(scopeKey, partTemplateId).catch(() => []);
    const byUrl = new Map<string, (typeof localObservations)[number]>();
    for (const row of localObservations) byUrl.set(row.url, row);
    for (const row of remoteObservations) {
      const normalized = {
        price: Number(row.price), shipping_price: Number(row.shipping_price || 0), source: row.provider,
        title: row.title, url: row.url, observed_at: row.observed_at, image_url: row.image_url,
      };
      const current = byUrl.get(normalized.url);
      if (!current || Date.parse(normalized.observed_at) >= Date.parse(current.observed_at)) byUrl.set(normalized.url, normalized);
    }
    const observations = [...byUrl.values()]
      .sort((a, b) => Date.parse(a.observed_at) - Date.parse(b.observed_at))
      .slice(-80);
    return Response.json({ statistics: getPriceStatistics(partTemplateId, motorcycleId, series?.id ?? null, scopeKey), observations });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Marktdaten konnten nicht geladen werden." }, { status: 400 });
  }
}
