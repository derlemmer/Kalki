import { refreshMotorcyclePricesBatch } from "../../../../database/market";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    const body = await request.json() as { motorcycleId?: number; seriesId?: number | null; seriesCode?: string | null;
      seriesVariant?: string | null; modelYear?: number | null; maxAgeDays?: number; batchSize?: number;
      clientFreshPartIds?: unknown; clientPricedPartIds?: unknown };
    const motorcycleId = Number(body.motorcycleId);
    if (!Number.isInteger(motorcycleId) || motorcycleId <= 0) return Response.json({ error: "Motorrad-ID ist ungültig." }, { status: 400 });
    return Response.json(await refreshMotorcyclePricesBatch({ motorcycleId,
      seriesId: Number(body.seriesId) || null, seriesCode: body.seriesCode || null,
      seriesVariant: body.seriesVariant || null, modelYear: Number(body.modelYear) || null,
      maxAgeDays: Math.max(1, Math.min(30, Number(body.maxAgeDays) || 7)),
      batchSize: Math.max(1, Math.min(6, Number(body.batchSize) || 4)),
      clientFreshPartIds: Array.isArray(body.clientFreshPartIds)
        ? body.clientFreshPartIds.map(Number).filter((id) => Number.isInteger(id) && id > 0).slice(0, 500)
        : [],
      clientPricedPartIds: Array.isArray(body.clientPricedPartIds)
        ? body.clientPricedPartIds.map(Number).filter((id) => Number.isInteger(id) && id > 0).slice(0, 500)
        : [],
    }));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Preisaktualisierung konnte nicht gestartet werden." }, { status: 500 });
  }
}
