import { listMotorcycleBrands, searchMotorcycles } from "../../../database/findMotorcycle";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const brand = url.searchParams.get("brand")?.trim() || undefined;
  const query = url.searchParams.get("q")?.trim() || undefined;
  const limit = Number(url.searchParams.get("limit") || 100);

  return Response.json({
    brands: listMotorcycleBrands(),
    motorcycles: searchMotorcycles({ brand, query, limit }),
  });
}
