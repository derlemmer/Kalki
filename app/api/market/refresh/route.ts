import { refreshEbayPrice } from "../../../../database/market";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    const body = await request.json() as { motorcycleId?: number; partTemplateId?: number; seriesId?: number | null;
      seriesCode?: string | null; seriesVariant?: string | null; modelYear?: number | null; force?: boolean };
    const motorcycleId = Number(body.motorcycleId), partTemplateId = Number(body.partTemplateId);
    if (!Number.isInteger(motorcycleId) || motorcycleId <= 0 || !Number.isInteger(partTemplateId) || partTemplateId <= 0) {
      return Response.json({ error: "Motorrad- oder Teile-ID ist ungültig." }, { status: 400 });
    }
    return Response.json(await refreshEbayPrice({ motorcycleId, partTemplateId,
      seriesId: Number(body.seriesId) || null, seriesCode: body.seriesCode || null,
      seriesVariant: body.seriesVariant || null, modelYear: Number(body.modelYear) || null,
      force: body.force !== false }));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Marktpreis konnte nicht aktualisiert werden." }, { status: 500 });
  }
}
