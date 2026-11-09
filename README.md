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

## Environment variables

The current application does not require an API key.

The local environment file contains an intentionally empty, commented setting:

```env
# BLOCKSCOUT_API_KEY=
```

The current code uses public per-chain Blockscout instances instead of the unified `api.blockscout.com` gateway. Therefore, adding a value to `BLOCKSCOUT_API_KEY` by itself will not change the application's behavior.

If you use environment variables locally, put them in `.env.local`. Environment files are ignored by Git. Never commit a real API key and never use a `NEXT_PUBLIC_` prefix for a private key.

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

This proxy design keeps upstream configuration and future credentials on the server side.

## Blockscout integration

### Current implementation: public per-chain APIs

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

The application loads the Blockscout Chainscout directory from:

<https://raw.githubusercontent.com/blockscout/chainscout/main/data/chains.json>

Only entries with a valid Blockscout-hosted explorer URL are included. The directory is cached for one hour by the server. The curated networks in `src/lib/networks.ts` remain available as a fallback if the directory cannot be reached.

The directory can contain networks whose explorers have different availability, rate limits, or infrastructure protection. A network appearing in the directory does not guarantee that every endpoint will always respond successfully.

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

## How to add a paid or authenticated API later

### Does adding a paid API require code changes?

Yes, if you want CryptoView to switch from the current public per-chain endpoints to an authenticated or paid API gateway. Adding `BLOCKSCOUT_API_KEY` to an environment file is not enough because the current routes do not read that variable.

The UI should not need to change. The change belongs in the server-side API layer.

### Recommended migration steps

1. Create or obtain the key through the [Blockscout developer dashboard](https://dev.blockscout.com/dashboard/plans).
2. Add the key only to the deployment environment or local `.env.local` file:

   ```env
   BLOCKSCOUT_API_KEY=replace_with_your_real_key
   ```

3. Add a small server-only Blockscout client, for example `src/lib/blockscout.ts`.
4. Read `process.env.BLOCKSCOUT_API_KEY` only from server code.
5. Update `src/app/api/address/route.ts` and `src/app/api/transactions/route.ts` to use the authenticated client.
6. Keep the key out of client components, browser requests, logs, JSON responses, and `NEXT_PUBLIC_*` variables.
7. Preserve the existing address validation, chain resolution, pagination allowlist, caching, and error handling.
8. Run `pnpm lint` and `pnpm build`.
9. Test both successful requests and invalid, unavailable, rate-limited, and expired-key responses.

Depending on the chosen Blockscout plan, authentication may be sent as the documented query parameter or header. Follow the current Blockscout documentation instead of assuming that the authentication format will remain unchanged.

### Two possible paid API approaches

#### Keep per-chain endpoints and authenticate upstream

If the selected per-chain Blockscout instances continue to work without authentication, no migration is necessary. If they later require authentication, update only the server-side fetch helper and keep the existing network URLs.

#### Switch to the unified gateway

If the unified gateway is preferred, the server needs to construct URLs using both the chain ID and address:

```text
https://api.blockscout.com/{chain-id}/api/v2/addresses/{address}
https://api.blockscout.com/{chain-id}/api/v2/addresses/{address}/counters
https://api.blockscout.com/{chain-id}/api/v2/addresses/{address}/transactions
```

In that setup, `src/lib/networks.ts` can continue to provide chain metadata, but the request helper should use the selected `chainId` to build the unified gateway URL. The browser-facing routes can remain `/api/address` and `/api/transactions`, so the UI does not need to know whether the data came from a public per-chain host or the paid gateway.

## Security model

- The application is read-only and does not handle private keys.
- Wallet addresses are validated on the server before an upstream request is made.
- Chain IDs are validated and resolved against known or discovered Blockscout networks.
- The browser calls same-origin application routes instead of receiving direct upstream credentials.
- `BLOCKSCOUT_API_KEY` is not currently used or exposed.
- The transactions route forwards only an allowlist of pagination parameters.
- The transactions route has a basic in-memory limit of 30 requests per minute per forwarded client address.
- Responses use short cache lifetimes to reduce repeated upstream requests.
- JSON responses include `X-Content-Type-Options: nosniff`.

The current rate limiter is process-local. For a multi-instance production deployment, replace it with a shared store or an edge platform rate limiter.

## Important limitations

- This application currently supports EVM-compatible networks only.
- It depends on public Blockscout infrastructure and the remote Chainscout directory.
- Some networks can be temporarily unavailable, rate-limited, protected by Cloudflare, or configured differently.
- Network metadata and logos come from the Chainscout directory when available.
- Native balance and fiat estimates depend on the fields returned by the selected Blockscout instance.
- API credit limits and rate limits are controlled by Blockscout, not by CryptoView.
- The application does not provide a guarantee that every network listed by Chainscout will support every endpoint identically.
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
    networks.ts              Curated networks and Chainscout discovery
    types.ts                 Shared Blockscout response types
.env                         Local Blockscout configuration notes
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
