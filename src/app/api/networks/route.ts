import { after, connection } from "next/server";
import {
  getCachedGatewayNetworks,
  GatewayConfigurationError,
  refreshGatewayNetworks,
} from "@/lib/gateway-networks";
import { loadNetworkDirectory } from "@/lib/networks";

export async function GET() {
  await connection();
  const discoveredNetworks = await loadNetworkDirectory();
  const cachedNetworks = getCachedGatewayNetworks(discoveredNetworks);

  if (cachedNetworks) {
    return Response.json(
      { networks: serializeNetworks(cachedNetworks), filtering: false },
      {
        headers: {
          "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  }

  after(async () => {
    try {
      await refreshGatewayNetworks(discoveredNetworks);
    } catch (error) {
      if (error instanceof GatewayConfigurationError) {
        console.error("Blockscout gateway configuration failed.", error);
        return;
      }

      console.error("Blockscout network entitlement refresh failed.", error);
    }
  });

  return Response.json(
    { networks: serializeNetworks(discoveredNetworks), filtering: true },
    {
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}

function serializeNetworks(
  networks: Awaited<ReturnType<typeof loadNetworkDirectory>>,
) {
  return networks.map(
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
  );
}
