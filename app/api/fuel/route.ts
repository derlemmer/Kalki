import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HACHENBURG = { lat: 50.659, lng: 7.822 };

export async function GET() {
  const apiKey = process.env.TANKERKOENIG_API_KEY;
  if (apiKey) {
    try {
      const url = new URL("https://creativecommons.tankerkoenig.de/json/list.php");
      url.searchParams.set("lat", String(HACHENBURG.lat));
      url.searchParams.set("lng", String(HACHENBURG.lng));
      url.searchParams.set("rad", "10");
      url.searchParams.set("sort", "price");
      url.searchParams.set("type", "diesel");
      url.searchParams.set("apikey", apiKey);
      const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10000) });
      const data = (await response.json()) as { ok?: boolean; stations?: Array<{ diesel?: number; isOpen?: boolean }> };
      const prices = (data.stations ?? []).map((station) => station.diesel).filter((value): value is number => typeof value === "number" && value > 0);
      if (data.ok && prices.length) {
        const cheapest = Math.min(...prices);
        return NextResponse.json({ price: cheapest, source: "Tankerkönig – günstigster Diesel im Umkreis 10 km um Hachenburg", updatedAt: new Date().toISOString(), live: true });
      }
    } catch {}
  }

  return NextResponse.json({
    price: 1.84,
    source: apiKey ? "Automatischer Abruf fehlgeschlagen – Ersatzwert" : "Ersatzwert – für Echtzeit TANKERKOENIG_API_KEY in Vercel hinterlegen",
    updatedAt: new Date().toISOString(),
    live: false,
  });
}
