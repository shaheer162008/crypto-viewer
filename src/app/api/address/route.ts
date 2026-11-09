import { NextRequest, NextResponse } from "next/server";
import { resolveNetwork } from "@/lib/networks";

const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

export async function GET(request: NextRequest) {
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

  const addressUrl = `${network.blockscoutApi}/addresses/${encodeURIComponent(address)}`;
  const countersUrl = `${addressUrl}/counters`;

  try {
    const [addressResponse, countersResponse] = await Promise.all([
      fetch(addressUrl, {
        headers: { Accept: "application/json" },
        next: { revalidate: 60 },
      }),
      fetch(countersUrl, {
        headers: { Accept: "application/json" },
        next: { revalidate: 60 },
      }),
    ]);

    if (!addressResponse.ok) {
      return NextResponse.json(
        { error: `Blockscout returned ${addressResponse.status}.` },
        { status: addressResponse.status >= 500 ? 502 : addressResponse.status },
      );
    }

    return NextResponse.json(
      {
        address: await addressResponse.json(),
        counters: countersResponse.ok ? await countersResponse.json() : null,
      },
      {
        headers: {
          "Cache-Control": "private, max-age=60",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  } catch {
    return NextResponse.json(
      { error: "Unable to reach Blockscout right now. Try again shortly." },
      { status: 502 },
    );
  }
}
