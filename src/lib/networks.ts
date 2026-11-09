export type Network = {
  id: string;
  name: string;
  isTestnet: boolean;
  symbol: string;
  nativeCurrency?: string;
  color: string;
  gradient: string;
  explorer: string;
  blockscoutApi: string;
  icon: string;
  logo?: string;
};

/**
 * Supported EVM networks with their public Blockscout API endpoints.
 * Using per-chain Blockscout instances avoids the need for a paid unified API key.
 */
export const NETWORKS: Network[] = [
  {
    id: "1",
    name: "Ethereum",
    isTestnet: false,
    symbol: "ETH",
    color: "#627eea",
    gradient: "from-[#627eea]/20 to-[#627eea]/5",
    explorer: "https://eth.blockscout.com",
    blockscoutApi: "https://eth.blockscout.com/api/v2",
    icon: "⟠",
  },
  {
    id: "8453",
    name: "Base",
    isTestnet: false,
    symbol: "ETH",
    color: "#2f6df6",
    gradient: "from-[#2f6df6]/20 to-[#2f6df6]/5",
    explorer: "https://base.blockscout.com",
    blockscoutApi: "https://base.blockscout.com/api/v2",
    icon: "🔵",
  },
  {
    id: "137",
    name: "Polygon",
    isTestnet: false,
    symbol: "POL",
    color: "#8247e5",
    gradient: "from-[#8247e5]/20 to-[#8247e5]/5",
    explorer: "https://polygon.blockscout.com",
    blockscoutApi: "https://polygon.blockscout.com/api/v2",
    icon: "⬡",
  },
  {
    id: "10",
    name: "Optimism",
    isTestnet: false,
    symbol: "ETH",
    color: "#ef4444",
    gradient: "from-[#ef4444]/20 to-[#ef4444]/5",
    explorer: "https://optimism.blockscout.com",
    blockscoutApi: "https://optimism.blockscout.com/api/v2",
    icon: "🔴",
  },
  {
    id: "42161",
    name: "Arbitrum One",
    isTestnet: false,
    symbol: "ETH",
    color: "#28a0f0",
    gradient: "from-[#28a0f0]/20 to-[#28a0f0]/5",
    explorer: "https://arbitrum.blockscout.com",
    blockscoutApi: "https://arbitrum.blockscout.com/api/v2",
    icon: "🔷",
  },
  {
    id: "11155111",
    name: "Ethereum Sepolia",
    isTestnet: true,
    symbol: "ETH",
    color: "#627eea",
    gradient: "from-[#627eea]/20 to-[#627eea]/5",
    explorer: "https://eth-sepolia.blockscout.com",
    blockscoutApi: "https://eth-sepolia.blockscout.com/api/v2",
    icon: "⟠",
  },
  {
    id: "84532",
    name: "Base Sepolia",
    isTestnet: true,
    symbol: "ETH",
    color: "#2f6df6",
    gradient: "from-[#2f6df6]/20 to-[#2f6df6]/5",
    explorer: "https://base-sepolia.blockscout.com",
    blockscoutApi: "https://base-sepolia.blockscout.com/api/v2",
    icon: "🔵",
  },
  {
    id: "11155420",
    name: "OP Sepolia",
    isTestnet: true,
    symbol: "ETH",
    color: "#ef4444",
    gradient: "from-[#ef4444]/20 to-[#ef4444]/5",
    explorer: "https://optimism-sepolia.blockscout.com",
    blockscoutApi: "https://optimism-sepolia.blockscout.com/api/v2",
    icon: "🔴",
  },
];

export const NETWORKS_MAP = new Map(NETWORKS.map((n) => [n.id, n]));

const CHAINS_DIRECTORY_URL =
  "https://raw.githubusercontent.com/blockscout/chainscout/main/data/chains.json";

type DirectoryChain = {
  name?: string;
  logo?: string;
  isTestnet?: boolean;
  native_currency?: string;
  explorers?: Array<{ url?: string; hostedBy?: string }>;
};

function directoryChainToNetwork(
  chainId: string,
  chain: DirectoryChain,
): Network | null {
  const explorer = chain.explorers?.find(
    (item) =>
      item.hostedBy === "blockscout" &&
      typeof item.url === "string" &&
      /^https?:\/\//.test(item.url),
  );

  if (!explorer?.url || !chain.name) return null;

  const explorerUrl = explorer.url.replace(/\/+$/, "");
  const color = "#8b9bb4";

  return {
    id: chainId,
    name: chain.name,
    isTestnet: Boolean(chain.isTestnet),
    symbol: chain.native_currency || "ETH",
    nativeCurrency: chain.native_currency || "ETH",
    color,
    gradient: "from-[#8b9bb4]/20 to-[#8b9bb4]/5",
    explorer: explorerUrl,
    blockscoutApi: `${explorerUrl}/api/v2`,
    icon: "◇",
    logo: chain.logo,
  };
}

export async function resolveNetwork(chainId: string): Promise<Network | null> {
  const knownNetwork = NETWORKS_MAP.get(chainId);
  if (knownNetwork) return knownNetwork;

  try {
    const response = await fetch(CHAINS_DIRECTORY_URL, {
      next: { revalidate: 3600 },
    });
    if (!response.ok) return null;

    const directory = (await response.json()) as Record<string, DirectoryChain>;
    const chain = directory[chainId];
    return chain ? directoryChainToNetwork(chainId, chain) : null;
  } catch {
    return null;
  }
}

export async function loadNetworkDirectory(): Promise<Network[]> {
  try {
    const response = await fetch(CHAINS_DIRECTORY_URL, {
      next: { revalidate: 3600 },
    });
    if (!response.ok) return NETWORKS;

    const directory = (await response.json()) as Record<string, DirectoryChain>;
    const dynamicNetworks = Object.entries(directory)
      .map(([chainId, chain]) => directoryChainToNetwork(chainId, chain))
      .filter((network): network is Network => network !== null);
    const merged = new Map(dynamicNetworks.map((network) => [network.id, network]));
    for (const knownNetwork of NETWORKS) {
      const directoryNetwork = merged.get(knownNetwork.id);
      merged.set(
        knownNetwork.id,
        directoryNetwork
          ? {
              ...directoryNetwork,
              ...knownNetwork,
              logo: directoryNetwork.logo || knownNetwork.logo,
            }
          : knownNetwork,
      );
    }

    return [...merged.values()].sort((a, b) => {
      if (a.isTestnet !== b.isTestnet) return a.isTestnet ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
  } catch {
    return NETWORKS;
  }
}
