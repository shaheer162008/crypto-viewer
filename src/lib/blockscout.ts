import type { Network } from "@/lib/networks";

const BLOCKSCOUT_GATEWAY_URL = "https://api.blockscout.com";

export function getBlockscoutApiBase(
  chainId: string,
  network: Network,
): string {
  return process.env.BLOCKSCOUT_API_KEY?.trim()
    ? `${BLOCKSCOUT_GATEWAY_URL}/${chainId}/api/v2`
    : network.blockscoutApi;
}

export function getBlockscoutHeaders(): HeadersInit {
  const apiKey = process.env.BLOCKSCOUT_API_KEY?.trim();

  return {
    Accept: "application/json",
    ...(apiKey ? { authorization: apiKey } : {}),
  };
}
