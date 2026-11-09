import type { Network } from "@/lib/networks";

const BLOCKSCOUT_GATEWAY_URL = "https://api.blockscout.com";
const NETWORK_PROBE_PATH = "/api/v2/transactions?items_count=1";
const NETWORK_CACHE_TTL_MS = 60 * 60 * 1000;
const PROBE_TIMEOUT_MS = 5_000;
const PROBE_BATCH_SIZE = 5;
const PROBE_BATCH_DELAY_MS = 1_000;

type GatewayNetworkStatus = "available" | "unavailable";

type CachedGatewayNetworkStatus = {
  expiresAt: number;
  status: GatewayNetworkStatus;
};

const gatewayNetworkStatusCache = new Map<
  string,
  CachedGatewayNetworkStatus
>();
let gatewayNetworkRefreshPromise: Promise<Network[]> | null = null;

export class GatewayConfigurationError extends Error {
  constructor() {
    super("The configured Blockscout API key is invalid or unavailable.");
    this.name = "GatewayConfigurationError";
  }
}

function getApiKey() {
  return process.env.BLOCKSCOUT_API_KEY?.trim() || null;
}

function getCachedStatus(chainId: string): GatewayNetworkStatus | null {
  const cached = gatewayNetworkStatusCache.get(chainId);
  if (!cached || cached.expiresAt <= Date.now()) {
    gatewayNetworkStatusCache.delete(chainId);
    return null;
  }

  return cached.status;
}

function setCachedStatus(
  chainId: string,
  status: GatewayNetworkStatus,
): GatewayNetworkStatus {
  gatewayNetworkStatusCache.set(chainId, {
    expiresAt: Date.now() + NETWORK_CACHE_TTL_MS,
    status,
  });
  return status;
}

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function isGatewayUnavailable(status: number, body: string) {
  if (status === 402 || status === 404) return true;

  return (
    status === 403 &&
    /featured chain|requires .*plan|plan .*required|upgrade|unsupported chain|unknown chain/i.test(
      body,
    )
  );
}

function isAuthenticationFailure(status: number, body: string) {
  return (
    status === 401 ||
    (status === 403 && /invalid api key|unauthorized|authentication/i.test(body))
  );
}

async function probeNetwork(
  network: Network,
  apiKey: string,
): Promise<GatewayNetworkStatus | null> {
  const cachedStatus = getCachedStatus(network.id);
  if (cachedStatus) return cachedStatus;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${BLOCKSCOUT_GATEWAY_URL}/${network.id}${NETWORK_PROBE_PATH}`,
      {
        headers: {
          Accept: "application/json",
          authorization: apiKey,
        },
        signal: controller.signal,
        next: { revalidate: 3600 },
      },
    );

    if (response.ok) {
      return setCachedStatus(network.id, "available");
    }

    const body = await response.text().catch(() => "");
    if (isGatewayUnavailable(response.status, body)) {
      return setCachedStatus(network.id, "unavailable");
    }

    if (isAuthenticationFailure(response.status, body)) {
      throw new GatewayConfigurationError();
    }

    return getCachedStatus(network.id);
  } catch (error) {
    if (error instanceof GatewayConfigurationError) throw error;
    return getCachedStatus(network.id);
  } finally {
    clearTimeout(timeout);
  }
}

export function getCachedGatewayNetworks(networks: Network[]) {
  if (!getApiKey()) return networks;

  if (!networks.every((network) => getCachedStatus(network.id))) {
    return null;
  }

  return networks.filter(
    (network) => getCachedStatus(network.id) !== "unavailable",
  );
}

export function refreshGatewayNetworks(networks: Network[]) {
  if (!getApiKey()) return Promise.resolve(networks);
  if (gatewayNetworkRefreshPromise) return gatewayNetworkRefreshPromise;

  gatewayNetworkRefreshPromise = filterNetworksByGatewayAccess(networks).finally(
    () => {
      gatewayNetworkRefreshPromise = null;
    },
  );

  return gatewayNetworkRefreshPromise;
}

export async function filterNetworksByGatewayAccess(networks: Network[]) {
  const apiKey = getApiKey();
  if (!apiKey) return networks;

  const statuses = new Map<string, GatewayNetworkStatus | null>();

  for (let index = 0; index < networks.length; index += PROBE_BATCH_SIZE) {
    const batch = networks.slice(index, index + PROBE_BATCH_SIZE);
    const batchStatuses = await Promise.all(
      batch.map((network) => probeNetwork(network, apiKey)),
    );

    batch.forEach((network, batchIndex) => {
      statuses.set(network.id, batchStatuses[batchIndex]);
    });

    if (index + PROBE_BATCH_SIZE < networks.length) {
      await wait(PROBE_BATCH_DELAY_MS);
    }
  }

  return networks.filter(
    (network) => statuses.get(network.id) !== "unavailable",
  );
}
