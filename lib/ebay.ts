export type EbayListing = {
  id: string;
  title: string;
  url: string;
  price: number;
  shippingPrice: number;
  currency: string;
  imageUrl: string | null;
  condition: string;
  seller: string | null;
  itemEndDate: string | null;
};

type TokenResponse = {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

type BrowseResponse = {
  itemSummaries?: Array<{
    itemId?: string;
    title?: string;
    itemWebUrl?: string;
    price?: { value?: string; currency?: string };
    shippingOptions?: Array<{ shippingCost?: { value?: string; currency?: string } }>;
    image?: { imageUrl?: string };
    condition?: string;
    seller?: { username?: string };
    itemEndDate?: string;
  }>;
  errors?: Array<{ message?: string; longMessage?: string }>;
};

type TokenCache = { token: string; expiresAt: number };
const globalForEbay = globalThis as typeof globalThis & { __kalkiEbayToken?: TokenCache };

function ebayEnvironment() {
  return process.env.EBAY_ENVIRONMENT === "sandbox" ? "sandbox" : "production";
}

function baseUrl() {
  return ebayEnvironment() === "sandbox" ? "https://api.sandbox.ebay.com" : "https://api.ebay.com";
}

function requiredCredentials() {
  const clientId = process.env.EBAY_CLIENT_ID?.trim();
  const clientSecret = process.env.EBAY_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error("eBay ist noch nicht verbunden. EBAY_CLIENT_ID und EBAY_CLIENT_SECRET fehlen.");
  }
  return { clientId, clientSecret };
}

export function isEbayConfigured() {
  return Boolean(process.env.EBAY_CLIENT_ID?.trim() && process.env.EBAY_CLIENT_SECRET?.trim());
}

async function getApplicationToken(): Promise<string> {
  const cached = globalForEbay.__kalkiEbayToken;
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const { clientId, clientSecret } = requiredCredentials();
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    scope: "https://api.ebay.com/oauth/api_scope",
  });

  const response = await fetch(`${baseUrl()}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: {
      authorization: `Basic ${credentials}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });

  const data = (await response.json()) as TokenResponse;
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || `eBay-Token fehlgeschlagen (HTTP ${response.status}).`);
  }

  globalForEbay.__kalkiEbayToken = {
    token: data.access_token,
    expiresAt: Date.now() + Math.max(60, data.expires_in ?? 7200) * 1000,
  };
  return data.access_token;
}

export async function searchEbay(query: string, limit = 30): Promise<EbayListing[]> {
  const token = await getApplicationToken();
  const url = new URL(`${baseUrl()}/buy/browse/v1/item_summary/search`);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", String(Math.max(1, Math.min(50, limit))));
  url.searchParams.set("filter", "deliveryCountry:DE,buyingOptions:{FIXED_PRICE}");

  const response = await fetch(url, {
    headers: {
      authorization: `Bearer ${token}`,
      "x-ebay-c-marketplace-id": process.env.EBAY_MARKETPLACE_ID || "EBAY_DE",
      "accept-language": "de-DE",
      "x-ebay-c-enduserctx": "contextualLocation=country%3DDE%2Czip%3D57627",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });

  const data = (await response.json()) as BrowseResponse;
  if (!response.ok) {
    const message = data.errors?.map((error) => error.longMessage || error.message).filter(Boolean).join(" · ");
    throw new Error(message || `eBay-Suche fehlgeschlagen (HTTP ${response.status}).`);
  }

  return (data.itemSummaries ?? [])
    .map((item): EbayListing | null => {
      const price = Number(item.price?.value);
      if (!item.itemId || !item.title || !item.itemWebUrl || !Number.isFinite(price) || price <= 0) return null;
      const shippingPrice = Number(item.shippingOptions?.[0]?.shippingCost?.value || 0);
      return {
        id: item.itemId,
        title: item.title,
        url: item.itemWebUrl,
        price,
        shippingPrice: Number.isFinite(shippingPrice) ? shippingPrice : 0,
        currency: item.price?.currency || "EUR",
        imageUrl: item.image?.imageUrl || null,
        condition: item.condition || "unknown",
        seller: item.seller?.username || null,
        itemEndDate: item.itemEndDate || null,
      };
    })
    .filter((item): item is EbayListing => Boolean(item));
}
