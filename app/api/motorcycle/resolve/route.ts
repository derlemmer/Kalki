import { findMotorcycleFromDatabase } from "../../../../database/findMotorcycle";
import { getMotorcycleMarketScopeKey } from "../../../../database/market";

export const runtime = "nodejs";

function parsePreferredYear(value: unknown) {
  const year = Number(value);
  const maximum = new Date().getFullYear() + 1;
  return Number.isInteger(year) && year >= 1900 && year <= maximum ? year : null;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { input?: unknown; year?: unknown };
    if (typeof body.input !== "string" || !body.input.trim()) {
      return Response.json({ error: "Kein Suchtext übergeben." }, { status: 400 });
    }

    const preferredYear = parsePreferredYear(body.year);
    const result = findMotorcycleFromDatabase(body.input, preferredYear);
    if (!result) return Response.json({ result: null });

    const year = preferredYear !== null
      && preferredYear >= result.motorcycle.production.from
      && preferredYear <= result.motorcycle.production.to
      ? preferredYear
      : null;

    const series = result.matchedSeries;
    const marketScopeKey = getMotorcycleMarketScopeKey(result.motorcycle.id, {
      seriesId: series?.id ?? null,
      seriesCode: series?.code ?? null,
      seriesVariant: series?.variant ?? null,
      modelYear: year,
    });

    return Response.json({
      result: {
        motorcycle: result.motorcycle,
        seriesId: series?.id ?? null,
        seriesCode: series?.code ?? null,
        seriesVariant: series?.variant ?? null,
        seriesFrom: series?.from ?? null,
        seriesTo: series?.to ?? null,
        marketScopeKey,
        year,
        score: result.score,
        alternatives: result.alternatives ?? [],
      },
    });
  } catch (error) {
    console.error("Motorraderkennung fehlgeschlagen:", error);
    return Response.json({ error: "Motorraderkennung fehlgeschlagen." }, { status: 500 });
  }
}
