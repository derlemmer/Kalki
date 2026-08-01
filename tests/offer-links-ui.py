from pathlib import Path

root = Path(__file__).resolve().parents[1]
page = (root / "app/page.tsx").read_text(encoding="utf-8")
market = (root / "database/market.ts").read_text(encoding="utf-8")
history = (root / "app/api/market/history/route.ts").read_text(encoding="utf-8")
remote = (root / "lib/remoteMarketStore.ts").read_text(encoding="utf-8")
ebay = (root / "lib/ebay.ts").read_text(encoding="utf-8")
css = (root / "app/globals.css").read_text(encoding="utf-8")
status = (root / "app/api/system/status/route.ts").read_text(encoding="utf-8")
parser = (root / "lib/listingParser.ts").read_text(encoding="utf-8")

checks = {
    "version 1.5.0": 'version: "1.5.0"' in status,
    "category missing count": "missingPriceCount" in page and "OHNE PREIS" in page,
    "missing rows marked": "noPriceRow" in page and ".noPriceRow" in css,
    "manual price guidance": "händisch eintragen" in page and 'source: "manual" as PartSource' in page,
    "price order validation": "validPriceOrder" in page and "MIN ≤ REAL ≤ MAX" in page,
    "inline detail panel": "InlineMarketDetails" in page and "inlineMarketDetails" in css,
    "exact offer links": 'href={offer.url}' in page and "item.itemWebUrl" in ebay,
    "accept and reject offers": "ALS RICHTWERT ÜBERNEHMEN" in page and "UNPASSEND ✕" in page,
    "rejected offers stored": "rejectedOffers" in page and "restoreRejectedOffers" in page,
    "browser caches offer URLs": "offers?: MarketObservation[]" in page and "result.offers" in page,
    "refresh returns accepted offers": "offers: accepted.map" in market,
    "old current offers deactivated": "UPDATE price_observations SET is_active=0" in market,
    "remote observations readable": "getRemoteObservations" in remote and "getRemoteObservations" in history,
    "remote stale offers deactivated": "deactivateRemoteObservations" in remote and "deactivateRemoteObservations" in market,
    "mobile card layout": "@media(max-width:720px)" in css and ".partsTable tbody>tr:not(.inlineMarketRow)" in css,
    "mobile sticky values": "mobileValueBar" in page and ".mobileValueBar" in css,
    "inspection mode": "INSPECTION_ITEMS" in page and "BESICHTIGUNGSMODUS" in page and "inspectionImpact" in css,
    "inspection live values": "VOR BESICHTIGUNG" in page and "MAX. EINKAUF" in page,
    "photos and gallery": "photoGallery" in page and "compressProjectImage" in page and "collectImageUrls" in parser,
    "autosave and undo": "AUTOMATISCH GESPEICHERT" in page and "undoLast" in page and "RÜCKGÄNGIG" in page,
    "filters": "PriceFilter" in page and "MARKTDATEN" in page and "MANUELL" in page,
    "inactive states": '"Fehlt" | "Nicht relevant"' in page and "isInactivePart" in page,
}

failed = [name for name, ok in checks.items() if not ok]
if failed:
    raise SystemExit("KALKI_UI_FAILED: " + ", ".join(failed))
print("KALKI_UI_OK (" + str(len(checks)) + " checks)")
