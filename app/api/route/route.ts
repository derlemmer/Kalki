import { NextRequest, NextResponse } from "next/server";
import { summarizeRoute } from "../../../lib/routeMath";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORIGIN = "57627 Hachenburg, Deutschland";
const geocodeCache = new Map<string, { lat: number; lon: number; label: string; expiresAt: number }>();
const CACHE_MS = 24 * 60 * 60 * 1000;

function normalizeDestination(value: string) {
  return value.replace(/\s+/g, " ").replace(/,\s*Deutschland\s*$/i, "").trim();
}

async function geocode(query: string) {
  const key = query.toLocaleLowerCase("de-DE").trim();
  const cached = geocodeCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return { lat: cached.lat, lon: cached.lon, label: cached.label };
  }

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "de");
  url.searchParams.set("addressdetails", "1");
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      "user-agent": "KALKI/1.2 (personal motorcycle route calculator)",
      accept: "application/json",
      "accept-language": "de-DE,de;q=0.9",
    },
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error("Ortssuche ist vorübergehend nicht erreichbar.");
  const data = (await response.json()) as Array<{ lat: string; lon: string; display_name: string }>;
  if (!data[0]) throw new Error(`Ort nicht gefunden: ${query}`);
  const result = { lat: Number(data[0].lat), lon: Number(data[0].lon), label: data[0].display_name };
  if (!Number.isFinite(result.lat) || !Number.isFinite(result.lon)) throw new Error(`Ungültige Koordinaten für: ${query}`);
  geocodeCache.set(key, { ...result, expiresAt: Date.now() + CACHE_MS });
  return result;
}

export async function POST(request: NextRequest) {
  try {
    const { destination } = (await request.json()) as { destination?: unknown };
    if (typeof destination !== "string" || !destination.trim()) {
      return NextResponse.json({ error: "Standort fehlt." }, { status: 400 });
    }
    const normalized = normalizeDestination(destination);
    if (normalized.length > 120) {
      return NextResponse.json({ error: "Der Standort ist zu lang." }, { status: 400 });
    }

    const [from, to] = await Promise.all([
      geocode(ORIGIN),
      geocode(`${normalized}, Deutschland`),
    ]);
    const routeUrl = new URL(`https://router.project-osrm.org/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}`);
    routeUrl.searchParams.set("overview", "false");
    routeUrl.searchParams.set("alternatives", "false");
    routeUrl.searchParams.set("steps", "false");
    const response = await fetch(routeUrl, { cache: "no-store", signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error("Route konnte nicht berechnet werden.");
    const data = (await response.json()) as { code?: string; routes?: Array<{ distance: number; duration: number }> };
    const route = data.routes?.[0];
    if (data.code !== "Ok" || !route) throw new Error("Keine fahrbare Route gefunden.");

    return NextResponse.json({
      origin: ORIGIN,
      destination: to.label,
      ...summarizeRoute(route.distance, route.duration),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
