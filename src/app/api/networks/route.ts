import { NextResponse } from "next/server";
import {
  filterNetworksByGatewayAccess,
  GatewayConfigurationError,
} from "@/lib/gateway-networks";
import { loadNetworkDirectory } from "@/lib/networks";

export async function GET() {
  const discoveredNetworks = await loadNetworkDirectory();

  let networks;
  try {
    networks = await filterNetworksByGatewayAccess(discoveredNetworks);
  } catch (error) {
    if (error instanceof GatewayConfigurationError) {
      return NextResponse.json(
        { error: error.message },
        {
          status: 502,
          headers: {
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
          },
        },
      );
    }

    throw error;
  }

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
