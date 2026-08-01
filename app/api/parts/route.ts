import { NextRequest, NextResponse } from "next/server";
import { getPartsForMotorcycle } from "../../../database/getParts";
import { getRemoteCache } from "../../../lib/remoteMarketStore";
import { getMotorcycleMarketScopeKey, resolveMarketSeries } from "../../../database/market";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const motorcycleId = Number(request.nextUrl.searchParams.get("motorcycleId"));
    if (!Number.isInteger(motorcycleId) || motorcycleId <= 0) {
      return NextResponse.json({ error: "motorcycleId muss eine positive Ganzzahl sein." }, { status: 400 });
    }
    const input = {
      seriesId: Number(request.nextUrl.searchParams.get("seriesId")) || null,
      seriesCode: request.nextUrl.searchParams.get("seriesCode")?.trim() || null,
      seriesVariant: request.nextUrl.searchParams.get("seriesVariant")?.trim() || null,
      modelYear: Number(request.nextUrl.searchParams.get("modelYear")) || null,
    };
    const series = resolveMarketSeries(motorcycleId, input);
    const scopeKey = getMotorcycleMarketScopeKey(motorcycleId, input);
    const parts = getPartsForMotorcycle(motorcycleId, series?.id ?? null, scopeKey);
    const remote = await getRemoteCache(scopeKey).catch(() => []);
    const remoteByPart = new Map<number, (typeof remote)[number]>(
      remote.map((row) => [row.part_template_id, row] as const),
    );
    const merged = parts.map((part) => {
      const cached = remoteByPart.get(part.id);
      if (!cached || cached.observation_count < 1 || cached.observation_count < part.observation_count) return part;
      return { ...part, min_price: cached.min_price, realistic_price: cached.realistic_price,
        max_price: cached.max_price, observation_count: cached.observation_count,
        confidence: cached.confidence, market_updated_at: cached.updated_at, source: "market" as const };
    });
    return NextResponse.json({ motorcycleId, seriesId: series?.id ?? null, marketScopeKey: scopeKey, count: merged.length, parts: merged });
  } catch (error) {
    console.error("Fehler beim Laden der Teile:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Die Teile konnten nicht geladen werden." }, { status: 500 });
  }
}
