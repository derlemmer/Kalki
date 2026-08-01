import { getMarketStatus } from "../../../../database/market";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = Number(url.searchParams.get("motorcycleId"));
  if (!Number.isInteger(id) || id <= 0) return Response.json({ error: "Ungültige Motorrad-ID." }, { status: 400 });
  try {
    return Response.json(getMarketStatus(id, { seriesId: Number(url.searchParams.get("seriesId")) || null,
      seriesCode: url.searchParams.get("seriesCode")?.trim() || null,
      seriesVariant: url.searchParams.get("seriesVariant")?.trim() || null,
      modelYear: Number(url.searchParams.get("modelYear")) || null }));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Status konnte nicht geladen werden." }, { status: 400 });
  }
}
