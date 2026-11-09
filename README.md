# CryptoView

CryptoView is a read-only EVM wallet explorer built with Next.js and Blockscout. It lets a user choose a supported network, enter a public wallet address, and view wallet information, native balance, transaction history, token transfer information, counters, and links back to the relevant Blockscout explorer.

This web application was built with the help of GitHub Copilot. GitHub Copilot was used during the implementation, debugging, API integration, UI refinement, and documentation work.

## What the application does

CryptoView provides:

- Wallet address validation for standard 42-character EVM addresses
- Native coin balance and an estimated fiat value when Blockscout provides an exchange rate
- Transaction history with cursor-based pagination
- Transaction status, method, value, fee, block, sender, recipient, and token transfer details
- Address counters, including transactions and token transfers
- Mainnet and testnet network selection
- Searchable network selection with chain names, symbols, chain IDs, and logos
- Dynamic discovery of Blockscout-hosted networks through the Chainscout directory
- Explorer links for transactions and addresses
- Read-only, non-custodial operation
- Server-side proxy routes so the browser does not call Blockscout directly
- Basic server-side request limiting and short response caching

CryptoView does not connect to a wallet, sign transactions, send funds, or store private keys.

## Technology

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- Lucide React
- Recharts
- Blockscout API v2
- pnpm

## Requirements

- Node.js LTS
- pnpm 12 or a compatible pnpm version
- Internet access for Blockscout requests and the Chainscout network directory

## Getting started

Install dependencies:

```bash
pnpm install
```

Start the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

Run the linter:

```bash
pnpm lint
```

Create a production build:

```bash
pnpm build
```

Start the production server after building:

```bash
pnpm start
```

## Configuration

The public per-chain Blockscout APIs are enough for local development and do not require an API key. CryptoView also supports an optional server-only Blockscout gateway key for more reliable authenticated access.

To enable the unified gateway, create or update a local `.env.local` file:

```env
BLOCKSCOUT_API_KEY=your_server_only_key
```

When this variable is present, the server routes use `https://api.blockscout.com/{chain-id}/api/v2` and send the key in the upstream authorization header. When it is absent, the routes use the public per-chain endpoint stored in the network directory. The browser never receives this key.

The address-details route has a narrow fallback for an upstream gateway issue currently observed on some address records. If the authenticated gateway returns a server error for address details, the server retries that single public per-chain address endpoint. Transactions and counters continue to use the authenticated gateway.

Environment files are ignored by Git. Never commit a real key, put it in a `NEXT_PUBLIC_*` variable, print it in logs, or include it in a browser URL.

## How the data flow works

The application has three internal server routes:

| Internal route | Purpose |
| --- | --- |
| `/api/networks` | Loads and returns the available Blockscout-hosted networks |
| `/api/address` | Fetches address details and address counters |
| `/api/transactions` | Fetches paginated address transactions |

The browser sends requests only to these internal routes:

1. The user selects a network and enters an EVM address.
2. The browser calls `/api/address` and `/api/transactions`.
3. The server validates the chain ID and wallet address.
4. The server resolves the selected chain to a Blockscout API host.
5. The server requests data from Blockscout.
6. The server returns the response to the browser.
7. The UI formats the response into balance, counters, transaction, and token transfer cards.

This proxy design keeps upstream requests, provider details, and optional credentials on the server side.

## Blockscout integration

### Current implementation: smart per-chain and gateway APIs

The network selector is driven by a reviewed, pinned Chainscout snapshot. Only chains with a valid Blockscout-hosted explorer are shown. The selected chain ID is then used in either the public per-chain API URL or the unified gateway URL, depending on whether `BLOCKSCOUT_API_KEY` is configured.

The current implementation uses public Blockscout v2 endpoints such as:

```text
https://eth.blockscout.com/api/v2
https://base.blockscout.com/api/v2
https://polygon.blockscout.com/api/v2
https://optimism.blockscout.com/api/v2
https://arbitrum.blockscout.com/api/v2
```

Testnet examples:

```text
https://eth-sepolia.blockscout.com/api/v2
https://base-sepolia.blockscout.com/api/v2
https://optimism-sepolia.blockscout.com/api/v2
```

For a wallet address, the application uses endpoints with this structure:

```text
GET {blockscout-api}/addresses/{address}
GET {blockscout-api}/addresses/{address}/counters
GET {blockscout-api}/addresses/{address}/transactions
```

Example:

```text
https://eth.blockscout.com/api/v2/addresses/0x0000000000000000000000000000000000000000
https://eth.blockscout.com/api/v2/addresses/0x0000000000000000000000000000000000000000/counters
https://eth.blockscout.com/api/v2/addresses/0x0000000000000000000000000000000000000000/transactions
```

The transactions endpoint uses Blockscout's cursor-based pagination. The application forwards only the pagination fields it needs, including `block_number`, `index`, `items_count`, `fee`, `value`, and `inserted_at`.

### Network discovery

The application loads a reviewed snapshot of the Blockscout Chainscout directory from:

<https://raw.githubusercontent.com/blockscout/chainscout/b3bec7588bb343af8ea04afe2f9c2f2893539530/data/chains.json>

Only entries with a valid HTTPS Blockscout-hosted explorer URL are included. URLs with credentials or explicit ports are rejected. The directory is cached for one hour by the server. The curated network metadata in `src/lib/networks.ts` is used only to improve known entries that are also present in the directory. It cannot add a chain that the current directory does not provide.

The directory can contain networks whose explorers have different availability, rate limits, or infrastructure protection. When `BLOCKSCOUT_API_KEY` is configured, the server also performs a small authenticated read-only gateway check for each discovered chain. Chains rejected by the current Blockscout plan, including featured chains that require a higher plan, are removed from the selector before the response reaches the browser. The result is cached for one hour to avoid repeated probes. Temporary upstream failures do not permanently remove a chain from the selector.

If the directory cannot be reached, CryptoView does not show a fabricated fallback list. The network selector waits for the directory and reports that networks are temporarily unavailable. The server also refuses to resolve a chain that is not present in the current directory.

Without an API key, the selector represents chains listed by the reviewed Blockscout directory. With an API key, it represents the intersection of that directory and the chains accepted by the configured gateway plan. Testnets are included when the directory marks them as testnets and the gateway accepts them.

## Official Blockscout resources

These are the original resources for getting documentation, API access, network information, and plan details:

- [Blockscout API documentation](https://docs.blockscout.com/devs/apis)
- [Blockscout REST API documentation](https://docs.blockscout.com/devs/apis/rest)
- [Blockscout API gateway](https://api.blockscout.com)
- [Blockscout developer dashboard and plans](https://dev.blockscout.com/dashboard/plans)
- [Blockscout Chainscout repository](https://github.com/blockscout/chainscout)
- [Chainscout network data](https://github.com/blockscout/chainscout/blob/main/data/chains.json)
- [Blockscout website](https://www.blockscout.com/)

The unified gateway URL pattern mentioned in the Blockscout API material is:

```text
https://api.blockscout.com/{chain-id}/api/v2/addresses/{address}/transactions?apikey={api-key}
```

Check the official documentation and dashboard for the current plan rules, credit limits, authentication requirements, supported endpoints, and rate limits. Those details can change independently of this application.

At the time of writing, Blockscout documents the free gateway plan as 100,000 API credits per day with a 5 requests-per-second limit and support for all chains available through the gateway. The limit is based on credits and request rate, not simply on a fixed number of chains. Public per-chain explorer hosts can also be protected by bot mitigation, so the authenticated gateway is the more reliable option for high-volume server-side usage.

## API modes and deployment

### Does adding a paid API require code changes?

The integration is ready for both modes. If `BLOCKSCOUT_API_KEY` is present on the server, CryptoView automatically switches from public per-chain endpoints to the authenticated unified gateway. If the variable is absent, it uses the public per-chain endpoints. The UI and internal browser routes remain unchanged.

For local development, public API mode is enough. For a live deployment, use the private environment variable configuration offered by the hosting provider.

### Live deployment checklist

1. Use a server-capable Next.js host such as Vercel or another Node.js deployment platform.
2. Add `BLOCKSCOUT_API_KEY` in the host's server-side environment variable settings, not in client-exposed settings.
3. Use the same variable for the production environment only if the deployment needs authenticated gateway access.
4. Never paste the key into a public URL, frontend variable, screenshot, issue, commit, or log.
5. Run `pnpm lint` and `pnpm build` before deployment.
6. Test address details, counters, transactions, pagination, testnets, invalid addresses, unavailable chains, rate limits, and expired-key responses after deployment.
7. Rotate the key immediately if it has been shared in chat, source control, screenshots, browser history, or public logs.

Depending on the chosen Blockscout plan, authentication may be sent as the documented query parameter or header. Follow the current Blockscout documentation instead of assuming that the authentication format will remain unchanged.

### Two available API approaches

#### Public per-chain mode

Leave `BLOCKSCOUT_API_KEY` empty. This uses the public `blockscoutApi` URL associated with each dynamically discovered network.

#### Authenticated unified gateway mode

Set `BLOCKSCOUT_API_KEY` on the server. The server constructs URLs using the selected chain ID and address:

```text
https://api.blockscout.com/{chain-id}/api/v2/addresses/{address}
https://api.blockscout.com/{chain-id}/api/v2/addresses/{address}/counters
https://api.blockscout.com/{chain-id}/api/v2/addresses/{address}/transactions
```

The browser-facing routes remain `/api/address` and `/api/transactions`, so the UI does not need to know whether the data came from a public per-chain host or the authenticated gateway.

## Security model

- The application is read-only and does not handle private keys.
- Wallet addresses are validated on the server before an upstream request is made.
- Chain IDs are validated and resolved against known or discovered Blockscout networks.
- The browser calls same-origin application routes instead of receiving direct upstream credentials.
- The transactions route forwards only an allowlist of pagination parameters.
- The transactions route has a basic in-memory limit of 30 requests per minute per forwarded client address.
- Responses use short cache lifetimes to reduce repeated upstream requests.
- JSON responses include `X-Content-Type-Options: nosniff`.

The current rate limiter is process-local. For a multi-instance production deployment, replace it with a shared store or an edge platform rate limiter.

## Important limitations

- This application currently supports EVM-compatible networks only.
- It depends on public Blockscout infrastructure and the pinned Chainscout snapshot.
- Some networks can be temporarily unavailable, rate-limited, protected by Cloudflare, or configured differently.
- Network metadata and logos come from the Chainscout directory when available.
- Native balance and fiat estimates depend on the fields returned by the selected Blockscout instance.
- API credit limits and rate limits are controlled by Blockscout, not by CryptoView.
- The application does not provide a guarantee that every network listed by Chainscout will support every endpoint identically.
- Gateway chain entitlement checks are cached for one hour. A plan change can therefore take up to one hour to appear in the selector.
- The in-memory rate limiter resets when the server restarts and is not shared between deployment instances.

## Project structure

```text
src/
  app/
    api/
      address/route.ts       Address details and counters proxy
      networks/route.ts      Dynamic network catalog route
      transactions/route.ts  Transaction history proxy
    globals.css              Global styling and theme
    layout.tsx               Metadata and application layout
    page.tsx                 Main CryptoView interface
  lib/
    blockscout.ts            Server-only gateway and header selection
    networks.ts              Curated networks and Chainscout discovery
    types.ts                 Shared Blockscout response types
```

## Contributing

Before opening a change:

```bash
pnpm lint
pnpm build
```

Keep API credentials server-only, avoid unrelated UI changes, and update this README when the data source, authentication model, supported network behavior, or deployment process changes.

## Credits

CryptoView was created with the assistance of GitHub Copilot. Credit is also due to the Blockscout team for providing the explorer infrastructure, APIs, and Chainscout network directory.
