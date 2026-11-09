import { NextResponse } from "next/server";
import { loadNetworkDirectory } from "@/lib/networks";

export async function GET() {
  const networks = await loadNetworkDirectory();

  return NextResponse.json(
    {
      networks: networks.map(
        ({ id, name, isTestnet, symbol, color, gradient, explorer, logo }) => ({
          id,
          name,
          isTestnet,
          symbol,
          color,
          gradient,
          explorer,
          logo,
        }),
      ),
    },
    {
      headers: {
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
