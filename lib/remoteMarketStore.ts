export type RemoteObservation = {
  provider: string;
  external_id: string;
  motorcycle_key: string;
  part_template_id: number;
  title: string;
  url: string;
  price: number;
  shipping_price: number;
  currency: string;
  condition: string;
  image_url: string | null;
  query: string;
  observed_at: string;
  is_active: boolean;
};


export type RemoteMarketCheck = {
  motorcycle_key: string;
  part_template_id: number;
  provider: string;
  status: string;
  result_count: number;
  query: string | null;
  error_message: string | null;
  checked_at: string;
};

export type RemoteCacheRow = {
  motorcycle_key: string;
  part_template_id: number;
  min_price: number;
  realistic_price: number;
  max_price: number;
  observation_count: number;
  confidence: number;
  updated_at: string;
};

function config() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key =
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return url && key ? { url, key } : null;
}

export function isRemoteMarketStoreConfigured() {
  return Boolean(config());
}

async function supabaseFetch(path: string, init: RequestInit = {}) {
  const current = config();
  if (!current) throw new Error("Supabase-Marktspeicher ist nicht konfiguriert.");
  return fetch(`${current.url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: current.key,
      ...(current.key.startsWith("sb_secret_")
        ? {}
        : { authorization: `Bearer ${current.key}` }),
      "content-type": "application/json",
      ...(init.headers || {}),
    },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
}

export async function upsertRemoteObservations(rows: RemoteObservation[]) {
  if (!rows.length || !config()) return;
  const response = await supabaseFetch("kalki_price_observations?on_conflict=provider,external_id,motorcycle_key,part_template_id", {
    method: "POST",
    headers: { prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(rows),
  });
  if (!response.ok) throw new Error(`Supabase-Beobachtungen fehlgeschlagen (HTTP ${response.status}).`);
}

export async function upsertRemoteCache(row: RemoteCacheRow) {
  if (!config()) return;
  const response = await supabaseFetch("kalki_price_cache?on_conflict=motorcycle_key,part_template_id", {
    method: "POST",
    headers: { prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(row),
  });
  if (!response.ok) throw new Error(`Supabase-Preis-Cache fehlgeschlagen (HTTP ${response.status}).`);
}

export async function getRemoteCache(motorcycleKey: string): Promise<RemoteCacheRow[]> {
  if (!config()) return [];
  const query = new URLSearchParams({
    motorcycle_key: `eq.${motorcycleKey}`,
    select: "motorcycle_key,part_template_id,min_price,realistic_price,max_price,observation_count,confidence,updated_at",
  });
  const response = await supabaseFetch(`kalki_price_cache?${query.toString()}`);
  if (!response.ok) return [];
  return (await response.json()) as RemoteCacheRow[];
}


export async function upsertRemoteMarketCheck(row: RemoteMarketCheck) {
  if (!config()) return;
  const response = await supabaseFetch("kalki_market_checks?on_conflict=motorcycle_key,part_template_id,provider", {
    method: "POST",
    headers: { prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(row),
  });
  if (!response.ok) throw new Error(`Supabase-Prüfstatus fehlgeschlagen (HTTP ${response.status}).`);
}

export async function getRemoteMarketChecks(motorcycleKey: string): Promise<RemoteMarketCheck[]> {
  if (!config()) return [];
  const query = new URLSearchParams({
    motorcycle_key: `eq.${motorcycleKey}`,
    select: "motorcycle_key,part_template_id,provider,status,result_count,query,error_message,checked_at",
  });
  const response = await supabaseFetch(`kalki_market_checks?${query.toString()}`);
  if (!response.ok) return [];
  return (await response.json()) as RemoteMarketCheck[];
}

export async function getRemoteObservations(
  motorcycleKey: string,
  partTemplateId: number,
): Promise<RemoteObservation[]> {
  if (!config()) return [];
  const query = new URLSearchParams({
    motorcycle_key: `eq.${motorcycleKey}`,
    part_template_id: `eq.${partTemplateId}`,
    is_active: "eq.true",
    select: "provider,external_id,motorcycle_key,part_template_id,title,url,price,shipping_price,currency,condition,image_url,query,observed_at,is_active",
    order: "observed_at.asc",
    limit: "80",
  });
  const response = await supabaseFetch(`kalki_price_observations?${query.toString()}`);
  if (!response.ok) return [];
  return (await response.json()) as RemoteObservation[];
}

export async function deactivateRemoteObservations(
  motorcycleKey: string,
  partTemplateId: number,
) {
  if (!config()) return;
  const query = new URLSearchParams({
    motorcycle_key: `eq.${motorcycleKey}`,
    part_template_id: `eq.${partTemplateId}`,
    provider: "eq.ebay",
  });
  const response = await supabaseFetch(`kalki_price_observations?${query.toString()}`, {
    method: "PATCH",
    headers: { prefer: "return=minimal" },
    body: JSON.stringify({ is_active: false }),
  });
  if (!response.ok) throw new Error(`Supabase-Angebote konnten nicht deaktiviert werden (HTTP ${response.status}).`);
}
