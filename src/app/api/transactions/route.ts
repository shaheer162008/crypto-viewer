import { NextRequest, NextResponse } from "next/server";
import { resolveNetwork } from "@/lib/networks";

/**
 * This proxy intentionally uses public per-chain Blockscout endpoints.
 * The unified api.blockscout.com gateway is not used, so no API key is
 * needed or forwarded to the browser or upstream services.
 */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 30;
const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;
const ALLOWED_PAGINATION_KEYS = new Set([
  "block_number",
  "index",
  "items_count",
  "fee",
  "value",
  "inserted_at",
]);

function getClientKey(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous";
}

function isRateLimited(key: string) {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  entry.count += 1;
  return entry.count > RATE_LIMIT_MAX_REQUESTS;
}

export async function GET(request: NextRequest) {
  if (isRateLimited(getClientKey(request))) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment and try again." },
      { status: 429, headers: { "Retry-After": "60", "Cache-Control": "no-store" } },
    );
  }

  const chainId = request.nextUrl.searchParams.get("chainId")?.trim();
  const address = request.nextUrl.searchParams.get("address")?.trim();

  if (!chainId || !/^\d{1,12}$/.test(chainId)) {
    return NextResponse.json({ error: "A valid numeric chain ID is required." }, { status: 400 });
  }

  if (!address || !ADDRESS_PATTERN.test(address)) {
    return NextResponse.json({ error: "Enter a valid 42-character EVM address." }, { status: 400 });
  }

  const network = await resolveNetwork(chainId);
  if (!network) {
    return NextResponse.json(
      { error: `Network with chain ID ${chainId} is not supported.` },
      { status: 400 },
    );
  }

  const query = new URLSearchParams();
  for (const [key, value] of request.nextUrl.searchParams.entries()) {
    if (ALLOWED_PAGINATION_KEYS.has(key) && /^[\w.-]+$/.test(value)) {
      query.set(key, value);
    }
  }

  const endpoint = `${network.blockscoutApi}/addresses/${encodeURIComponent(address)}/transactions`;
  const url = query.size ? `${endpoint}?${query.toString()}` : endpoint;

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 30 },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      let errorMessage = `Blockscout returned ${response.status}.`;

      try {
        const parsed = JSON.parse(text);
        errorMessage =
          parsed?.message ||
          parsed?.error ||
          parsed?.errors?.[0]?.detail ||
          errorMessage;
      } catch {
        // Keep the status-based message for non-JSON upstream responses.
      }

      return NextResponse.json(
        { error: errorMessage },
        { status: response.status >= 500 ? 502 : response.status },
      );
    }

    return NextResponse.json(await response.json(), {
      headers: {
        "Cache-Control": "private, max-age=30",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to reach Blockscout right now. Try again shortly." },
      { status: 502 },
    );
  }
}
