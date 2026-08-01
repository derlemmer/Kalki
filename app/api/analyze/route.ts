import { NextRequest, NextResponse } from "next/server";
import { parseListingHtml } from "../../../lib/listingParser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const allowedHosts = new Set([
  "www.kleinanzeigen.de", "kleinanzeigen.de", "www.ebay.de", "ebay.de",
]);
const MAX_REDIRECTS = 3;
const MAX_HTML_BYTES = 4_000_000;

function validateTarget(value: string | URL) {
  const target = value instanceof URL ? value : new URL(value);
  if (target.protocol !== "https:" || !allowedHosts.has(target.hostname)) {
    throw new Error("Aktuell werden nur direkte Kleinanzeigen- und eBay-Links unterstützt.");
  }
  target.hash = "";
  return target;
}

async function fetchListingPage(initial: URL) {
  let target = initial;
  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const response = await fetch(target.toString(), {
      cache: "no-store",
      redirect: "manual",
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
        "accept-language": "de-DE,de;q=0.9,en;q=0.7",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("Inserat-Weiterleitung ohne Ziel erhalten.");
      target = validateTarget(new URL(location, target));
      continue;
    }
    if (!response.ok) {
      throw new Error(`Inserat konnte nicht geladen werden (${response.status}). Daten bitte notfalls manuell ergänzen.`);
    }
    const contentType = response.headers.get("content-type") || "";
    if (contentType && !contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
      throw new Error("Der Link liefert keine HTML-Inseratseite.");
    }
    const declaredLength = Number(response.headers.get("content-length") || 0);
    if (declaredLength > MAX_HTML_BYTES) throw new Error("Die Inseratseite ist ungewöhnlich groß.");
    const html = await response.text();
    if (html.length > MAX_HTML_BYTES) throw new Error("Die Inseratseite ist ungewöhnlich groß.");
    return html;
  }
  throw new Error("Zu viele Weiterleitungen beim Laden des Inserats.");
}

export async function POST(request: NextRequest) {
  try {
    const { url } = (await request.json()) as { url?: unknown };
    if (typeof url !== "string" || !url.trim()) {
      return NextResponse.json({ error: "Bitte einen Inserat-Link einfügen." }, { status: 400 });
    }

    let target: URL;
    try {
      target = validateTarget(url.trim());
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Der Inserat-Link ist ungültig." }, { status: 400 });
    }

    const listing = parseListingHtml(await fetchListingPage(target));
    if (!listing.title && !listing.description) {
      return NextResponse.json({ error: "Die Inseratseite enthielt keine auswertbaren Fahrzeugdaten." }, { status: 422 });
    }

    return NextResponse.json({
      listing,
      warning: "Inseratseiten ändern sich gelegentlich. Bitte die automatisch erkannten Daten kurz kontrollieren.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    return NextResponse.json({ error: `Analyse fehlgeschlagen: ${message}` }, { status: 502 });
  }
}
