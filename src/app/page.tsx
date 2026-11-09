"use client";

import {
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import {
  Search,
  Copy,
  Check,
  ExternalLink,
  ArrowRight,
  RefreshCw,
  Activity,
  Wallet,
  Zap,
  Shield,
  Hash,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  Loader2,
  AlertCircle,
  Sparkles,
  Globe,
  TrendingUp,
} from "lucide-react";
import { NETWORKS, type Network } from "@/lib/networks";
import {
  type Transaction,
  type TransactionResponse,
  type AddressCounters,
  type AddressInfo,
} from "@/lib/types";
import {
  isValidAddress,
  shortHash,
  formatValue,
  relativeTime,
  formatNumber,
} from "@/lib/utils";

const EXAMPLE_ADDRESSES = [
  {
    label: "Vitalik.eth",
    address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
  },
  {
    label: "Uniswap V3",
    address: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
  },
];

export default function Home() {
  const [networkId, setNetworkId] = useState("1");
  const [availableNetworks, setAvailableNetworks] = useState(NETWORKS);
  const [input, setInput] = useState("");
  const [address, setAddress] = useState("");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [nextPage, setNextPage] = useState<Record<
    string,
    string | number
  > | null>(null);
  const [counters, setCounters] = useState<AddressCounters | null>(null);
  const [wallet, setWallet] = useState<AddressInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [networkOpen, setNetworkOpen] = useState(false);
  const [networkQuery, setNetworkQuery] = useState("");
  const [networkMode, setNetworkMode] = useState<"hover" | "click" | null>(
    null,
  );
  const networkOpenTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const networkCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const network =
    availableNetworks.find((item) => item.id === networkId) ??
    availableNetworks[0];

  useEffect(() => {
    let active = true;
    void fetch("/api/networks")
      .then((response) => response.json())
      .then((data: { networks?: typeof NETWORKS }) => {
        if (active && data.networks?.length) setAvailableNetworks(data.networks);
      })
      .catch(() => {
        // Keep the curated fallback list when the directory is unavailable.
      });

    return () => {
      active = false;
      if (networkOpenTimer.current) clearTimeout(networkOpenTimer.current);
      if (networkCloseTimer.current) clearTimeout(networkCloseTimer.current);
    };
  }, []);

  const filteredNetworks = availableNetworks.filter((item) =>
    `${item.name} ${item.symbol} ${item.id}`
      .toLowerCase()
      .includes(networkQuery.toLowerCase()),
  );
  const filteredMainnets = filteredNetworks.filter((item) => !item.isTestnet);
  const filteredTestnets = filteredNetworks.filter((item) => item.isTestnet);

  const cancelNetworkTimers = () => {
    if (networkOpenTimer.current) {
      clearTimeout(networkOpenTimer.current);
      networkOpenTimer.current = null;
    }
    if (networkCloseTimer.current) {
      clearTimeout(networkCloseTimer.current);
      networkCloseTimer.current = null;
    }
  };

  const scheduleHoverOpen = () => {
    if (networkMode === "click" || networkOpen) return;
    cancelNetworkTimers();
    networkOpenTimer.current = setTimeout(() => {
      setNetworkOpen(true);
      setNetworkMode("hover");
      networkOpenTimer.current = null;
    }, 1000);
  };

  const scheduleNetworkClose = () => {
    if (networkMode === "click") return;
    cancelNetworkTimers();
    networkCloseTimer.current = setTimeout(() => {
      setNetworkOpen(false);
      setNetworkMode(null);
      setNetworkQuery("");
      networkCloseTimer.current = null;
    }, 2500);
  };

  // ─── Fetch address info ────────────────────────────────
  const loadAddressInfo = useCallback(
    async (targetAddress: string, targetNetworkId: string) => {
      try {
        const params = new URLSearchParams({
          chainId: targetNetworkId,
          address: targetAddress,
        });
        const res = await fetch(`/api/address?${params}`);
        if (res.ok) {
          const data = (await res.json()) as {
            address?: AddressInfo;
            counters?: AddressCounters;
          };
          setWallet(data.address ?? null);
          setCounters(data.counters ?? null);
        }
      } catch {
        // Non-critical — silently ignore
      }
    },
    [],
  );

  // ─── Fetch transactions ────────────────────────────────
  const loadTransactions = useCallback(
    async (
      targetAddress: string,
      pageToken?: Record<string, string | number> | null,
      targetNetworkId = networkId,
    ) => {
      const isPaginating = !!pageToken;
      if (isPaginating) setLoadingMore(true);
      else setLoading(true);
      setError("");

      try {
        const params = new URLSearchParams({
          chainId: targetNetworkId,
          address: targetAddress,
          pageSize: "15",
        });
        if (pageToken) {
          Object.entries(pageToken).forEach(([key, value]) =>
            params.set(key, String(value)),
          );
        }

        const response = await fetch(`/api/transactions?${params}`);
        const data = (await response.json()) as TransactionResponse & {
          error?: string;
        };

        if (!response.ok)
          throw new Error(data.error || "Could not load transactions.");

        setTransactions((current) =>
          isPaginating
            ? [...current, ...(data.items ?? [])]
            : (data.items ?? []),
        );
        setNextPage(data.next_page_params ?? null);
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Something went wrong.",
        );
        if (!isPaginating) setTransactions([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [networkId],
  );

  // ─── Handle search submit ─────────────────────────────
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const target = input.trim();
    if (!isValidAddress(target)) {
      setError("Enter a valid 42-character EVM address (0x…).");
      return;
    }
    setAddress(target);
    setWallet(null);
    setCounters(null);
    void loadTransactions(target);
    void loadAddressInfo(target, networkId);
  };

  // ─── Handle network change ────────────────────────────
  const handleNetworkChange = (newNetworkId: string) => {
    cancelNetworkTimers();
    setNetworkId(newNetworkId);
    setNetworkOpen(false);
    setNetworkMode(null);
    setNetworkQuery("");
    if (address) {
      setWallet(null);
      setCounters(null);
      void loadTransactions(address, null, newNetworkId);
      void loadAddressInfo(address, newNetworkId);
    }
  };

  const handleExampleSelect = (exampleAddress: string) => {
    setInput(exampleAddress);
    setError("");
  };

  // ─── Copy to clipboard ────────────────────────────────
  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(value);
    window.setTimeout(() => setCopied(""), 2000);
  };

  const explorerUrl = address
    ? `${network.explorer}/address/${address}`
    : network.explorer;
  const successful = transactions.filter((t) => t.status === "ok").length;
  const balance = wallet?.coin_balance
    ? formatValue(wallet.coin_balance)
    : "—";
  const balanceUsd =
    wallet?.coin_balance && wallet.exchange_rate
      ? (Number(wallet.coin_balance) / 1e18) * Number(wallet.exchange_rate)
      : null;

  return (
    <main className="min-h-screen bg-[#060a13] text-white">
      {/* ─── Ambient Background ─────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-[#627eea]/[0.04] blur-[120px]" />
        <div className="absolute top-1/2 -left-40 w-[500px] h-[500px] rounded-full bg-[#e2a04b]/[0.03] blur-[120px]" />
        <div className="absolute -bottom-40 right-1/3 w-[400px] h-[400px] rounded-full bg-[#8247e5]/[0.03] blur-[120px]" />
      </div>

      {/* ─── Header ─────────────────────────────────────── */}
      <header className="relative z-10 border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight">
              Crypto<span className="text-amber-400">View</span>
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs text-zinc-500">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px] shadow-emerald-400/50" />
              <span className="hidden sm:inline">API Online</span>
            </span>
            <span className="hidden sm:inline text-zinc-700">|</span>
            <span className="hidden sm:inline px-2 py-0.5 rounded border border-amber-500/30 text-amber-500/80 text-[10px] font-semibold tracking-wider uppercase">
              Free Tier
            </span>
          </div>
        </div>
      </header>

      {/* ─── Hero Section ───────────────────────────────── */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-24 pb-12">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8 mb-10">
          <div className="max-w-xl">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-6 h-px bg-amber-500" />
              <span className="text-[11px] font-bold tracking-[0.2em] text-amber-500 uppercase">
                On-Chain Intelligence
              </span>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.05]">
              Read the{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-orange-400">
                chain.
              </span>
              <br />
              <span className="text-zinc-400">Understand the flow.</span>
            </h1>
            <p className="mt-4 text-zinc-500 text-base sm:text-lg max-w-md leading-relaxed">
              A focused, beautiful lens into wallet activity across the
              networks that move the world.
            </p>
          </div>

          <HeroVisual network={network} />
        </div>

        {/* ─── Search Panel ───────────────────────────────── */}
        <form
          onSubmit={handleSearch}
          className="relative bg-[#0d1320]/80 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-5 sm:p-6 shadow-2xl shadow-black/30"
        >
          <label
            htmlFor="address"
            className="block text-[11px] font-bold tracking-[0.12em] text-zinc-400 uppercase mb-3"
          >
            Wallet Address
          </label>

          <div className="flex flex-col sm:flex-row gap-3">
            {/* Address input */}
            <div className="flex-1 flex items-center gap-3 bg-[#0a0f1a] border border-white/[0.08] rounded-xl px-4 h-[52px] focus-within:border-amber-500/50 focus-within:shadow-[0_0_0_3px_rgba(226,160,75,0.08)] transition-all">
              <Search className="w-4 h-4 text-zinc-600 shrink-0" />
              <input
                id="address"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="0x… paste an address to begin"
                spellCheck={false}
                autoComplete="off"
                className="flex-1 bg-transparent border-0 outline-none text-sm text-white placeholder:text-zinc-600"
              />
              <div className="hidden sm:flex items-center gap-1.5">
                <span className="mr-1 text-[9px] uppercase tracking-[0.12em] text-zinc-700">
                  Examples
                </span>
                {EXAMPLE_ADDRESSES.map((ex) => (
                  <button
                    key={ex.address}
                    type="button"
                    onClick={() => handleExampleSelect(ex.address)}
                    title={`Use ${ex.label} example wallet`}
                    className="text-[10px] text-amber-500/70 hover:text-amber-300 whitespace-nowrap transition-colors px-2 py-1 rounded-md border border-transparent hover:border-amber-500/20 hover:bg-amber-500/10"
                  >
                    {ex.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Searchable selector stays inside its own stacking context. */}
            <div
              className="relative z-30 w-full sm:w-56"
              onMouseEnter={scheduleHoverOpen}
              onMouseLeave={scheduleNetworkClose}
            >
              <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={networkOpen}
                onClick={() => {
                  cancelNetworkTimers();
                  if (networkOpen && networkMode === "click") {
                    setNetworkOpen(false);
                    setNetworkMode(null);
                    setNetworkQuery("");
                    return;
                  }
                  setNetworkOpen(true);
                  setNetworkMode("click");
                }}
                className="w-full h-[52px] flex items-center justify-between gap-2 rounded-xl border border-white/[0.08] bg-[#0a0f1a] px-3.5 text-sm outline-none transition-colors hover:border-amber-500/30 focus:border-amber-500/50"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <ChainLogo network={network} size="sm" />
                  <span className="truncate text-sm text-white">{network.name}</span>
                  {network.isTestnet && (
                    <span className="rounded border border-amber-500/20 bg-amber-500/[0.08] px-1 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-amber-400">
                      test
                    </span>
                  )}
                </span>
                <span className={`text-xs text-zinc-500 transition-transform ${networkOpen ? "rotate-180" : ""}`}>⌄</span>
              </button>
            </div>

            {/* Search button */}
            <button
              type="submit"
              disabled={loading}
              className="h-[52px] px-8 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-bold text-sm rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 disabled:opacity-60"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  Explore <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>

          {networkOpen && (
            <div
              className="relative z-40 mt-3 w-full overflow-hidden rounded-xl border border-white/[0.12] bg-[#0c121e] shadow-xl shadow-black/30"
              role="listbox"
              aria-label="Search networks"
              onMouseEnter={cancelNetworkTimers}
              onMouseLeave={scheduleNetworkClose}
            >
              <div className="border-b border-white/[0.07] p-2.5">
                <div className="flex h-10 items-center gap-2 rounded-lg border border-white/[0.08] bg-[#070c15] px-3">
                  <Search className="h-4 w-4 shrink-0 text-zinc-500" />
                  <input
                    autoFocus
                    type="search"
                    value={networkQuery}
                    onChange={(event) => setNetworkQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        cancelNetworkTimers();
                        setNetworkOpen(false);
                        setNetworkMode(null);
                        setNetworkQuery("");
                      }
                    }}
                    placeholder="Search chain or chain ID..."
                    className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-zinc-600"
                  />
                  <span className="whitespace-nowrap text-[10px] text-zinc-600">
                    {filteredNetworks.length} found
                  </span>
                </div>
              </div>
              <div className="max-h-[330px] overflow-y-auto p-1.5">
                <NetworkGroup
                  label="Mainnets"
                  networks={filteredMainnets}
                  selectedId={networkId}
                  onSelect={handleNetworkChange}
                />
                <NetworkGroup
                  label="Testnets"
                  networks={filteredTestnets}
                  selectedId={networkId}
                  onSelect={handleNetworkChange}
                />
                {!filteredNetworks.length && (
                  <p className="px-3 py-8 text-center text-xs text-zinc-600">
                    No chain matches your search
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mt-3.5 gap-2">
            <span className="flex items-center gap-2 text-[11px] text-zinc-600">
              <Shield className="w-3 h-3 text-emerald-500/60" />
              Read-only &amp; non-custodial
            </span>
            <span className="flex items-center gap-2 text-[11px] text-zinc-600">
              <Globe className="w-3 h-3" />
              Examples fill a public wallet address — they do not change the chain
            </span>
          </div>
        </form>
      </section>

      {/* ─── Content Area ───────────────────────────────── */}
      <section
        className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20"
        aria-live="polite"
      >
        {/* Empty state */}
        {!address && !loading && (
          <div className="text-center py-20">
            <div className="w-16 h-16 mx-auto mb-5 rounded-2xl border border-zinc-800/60 flex items-center justify-center bg-zinc-900/50">
              <Wallet className="w-7 h-7 text-amber-500/60" />
            </div>
            <h2 className="text-xl font-semibold text-zinc-200 mb-2">
              Your on-chain story starts here.
            </h2>
            <p className="text-sm text-zinc-500 max-w-sm mx-auto leading-relaxed">
              Paste a wallet address above to see its latest transactions,
              activity, and network footprint.
            </p>
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="mx-auto max-w-2xl mb-6 flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/[0.08] border border-red-500/20 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="flex-1">{error}</span>
            <button
              onClick={() => address && void loadTransactions(address)}
              className="text-amber-400 hover:text-amber-300 text-xs font-medium transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Results */}
        {(address || loading) && (
          <div className="space-y-5">
            {/* Results header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-5 h-px bg-amber-500" />
                  <span className="text-[10px] font-bold tracking-[0.2em] text-amber-500 uppercase">
                    Wallet Overview
                  </span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
                  {address ? shortHash(address, 10) : "Loading wallet…"}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <IconButton
                  title={copied === address ? "Copied!" : "Copy address"}
                  onClick={() => address && void copy(address)}
                >
                  {copied === address ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </IconButton>
                <a
                  href={explorerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="h-9 px-3.5 flex items-center gap-2 text-xs text-zinc-400 border border-white/[0.08] rounded-lg hover:border-amber-500/40 hover:text-amber-400 transition-all"
                >
                  Open explorer{" "}
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <IconButton
                  title="Refresh"
                  onClick={() => {
                    if (address) {
                      void loadTransactions(address);
                      void loadAddressInfo(address, networkId);
                    }
                  }}
                >
                  <RefreshCw
                    className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
                  />
                </IconButton>
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <StatCard
                icon={<Wallet className="w-4 h-4" />}
                iconColor="orange"
                label={`${network.symbol} Balance`}
                value={balance}
                sub={
                  balanceUsd !== null
                    ? `$${balanceUsd.toLocaleString("en-US", {
                        maximumFractionDigits: 2,
                      })}`
                    : "Native wallet balance"
                }
              />
              <StatCard
                icon={<Activity className="w-4 h-4" />}
                iconColor="blue"
                label="Transactions"
                value={
                  counters
                    ? formatNumber(counters.transactions_count)
                    : loading && transactions.length === 0
                      ? "—"
                      : String(transactions.length)
                }
                sub={
                  counters ? "Total on-chain" : "Loaded in view"
                }
              />
              <StatCard
                icon={<Zap className="w-4 h-4" />}
                iconColor="green"
                label="Success Rate"
                value={
                  transactions.length
                    ? `${Math.round((successful / transactions.length) * 100)}%`
                    : "—"
                }
                sub={`${successful} of ${transactions.length} successful`}
              />
              <StatCard
                icon={<TrendingUp className="w-4 h-4" />}
                iconColor="purple"
                label="Token Transfers"
                value={
                  counters
                    ? formatNumber(counters.token_transfers_count)
                    : "—"
                }
                sub="ERC-20 / ERC-721 / ERC-1155"
              />
              <StatCard
                icon={<ChainLogo network={network} size="sm" />}
                iconColor="orange"
                label="Network"
                value={network.name}
                sub={`${network.symbol} ecosystem`}
              />
            </div>

            {/* Transaction table */}
            <div className="bg-[#0d1320]/60 backdrop-blur border border-white/[0.06] rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-200">
                    Recent Transactions
                  </h3>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    Latest activity on {network.name}
                  </p>
                </div>
                <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/[0.06] text-[11px] text-zinc-400">
                  <ChainLogo network={network} size="xs" />
                  {network.name}
                  {network.isTestnet && (
                    <span className="text-[9px] uppercase tracking-wide text-amber-400">
                      testnet
                    </span>
                  )}
                </span>
              </div>

              {loading && transactions.length === 0 ? (
                <div className="divide-y divide-white/[0.04]">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="px-5 py-4">
                      <div className="flex items-center gap-4">
                        <div className="w-9 h-9 rounded-full bg-white/[0.03] animate-pulse" />
                        <div className="flex-1 space-y-2">
                          <div className="h-3.5 w-40 bg-white/[0.04] rounded animate-pulse" />
                          <div className="h-2.5 w-60 bg-white/[0.03] rounded animate-pulse" />
                        </div>
                        <div className="h-3.5 w-24 bg-white/[0.04] rounded animate-pulse" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : transactions.length === 0 ? (
                <div className="py-16 text-center text-sm text-zinc-500">
                  No transactions found for this address on {network.name}.
                </div>
              ) : (
                <div className="divide-y divide-white/[0.04]">
                  {transactions.map((tx) => (
                    <TransactionRow
                      key={tx.hash}
                      tx={tx}
                      network={network}
                      address={address}
                      onCopy={copy}
                      copied={copied}
                    />
                  ))}
                </div>
              )}

              {nextPage && (
                <button
                  className="w-full py-3.5 flex items-center justify-center gap-2 text-sm text-amber-500/80 hover:text-amber-400 border-t border-white/[0.06] transition-colors disabled:opacity-50"
                  onClick={() =>
                    address && void loadTransactions(address, nextPage)
                  }
                  disabled={loadingMore}
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Loading…
                    </>
                  ) : (
                    <>
                      Load more activity{" "}
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      {/* ─── Footer ─────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-zinc-600">
          <div className="flex items-center gap-2.5">
            <div className="w-5 h-5 rounded bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
              <Sparkles className="w-2.5 h-2.5 text-white" />
            </div>
            <span className="font-bold text-zinc-400">CryptoView</span>
          </div>
          <p>
            Built for curious minds. Data indexed by{" "}
            <a
              href="https://www.blockscout.com/"
              target="_blank"
              rel="noreferrer"
              className="text-amber-500 hover:text-amber-400 transition-colors"
            >
              Blockscout
            </a>
            .
          </p>
          <span className="flex items-center gap-1.5 text-[10px]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_4px] shadow-emerald-400/40" />
            Public API · No key required
          </span>
        </div>
      </footer>
    </main>
  );
}

/* ─── Sub-components ──────────────────────────────────── */

function NetworkGroup({
  label,
  networks,
  selectedId,
  onSelect,
}: {
  label: string;
  networks: Network[];
  selectedId: string;
  onSelect: (networkId: string) => void;
}) {
  if (!networks.length) return null;

  return (
    <div>
      <p className="px-3 pb-1 pt-2 text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-600">
        {label}
      </p>
      {networks.map((item) => (
        <button
          key={item.id}
          type="button"
          role="option"
          aria-selected={item.id === selectedId}
          onClick={() => onSelect(item.id)}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs transition-colors ${
            item.id === selectedId
              ? "bg-amber-500/[0.12] text-white"
              : "text-zinc-400 hover:bg-white/[0.06] hover:text-white"
          }`}
        >
          <ChainLogo network={item} size="sm" />
          <span className="min-w-0 flex-1 truncate">{item.name}</span>
          {item.isTestnet && (
            <span className="rounded border border-amber-500/20 bg-amber-500/[0.08] px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-amber-400">
              test
            </span>
          )}
          <span className="text-[10px] text-zinc-600">{item.id}</span>
        </button>
      ))}
    </div>
  );
}

function HeroVisual({ network }: { network: Network }) {
  return (
    <div className="relative mx-auto h-[250px] w-full max-w-[390px] lg:mx-0" aria-label="Abstract crypto network illustration">
      <div className="absolute inset-x-7 top-8 h-40 rounded-full border border-amber-500/20 rotate-[-18deg] scale-x-[1.4]" />
      <div className="absolute inset-x-14 top-2 h-48 rounded-full border border-sky-400/15 rotate-[32deg] scale-x-[0.8]" />
      <div className="absolute inset-x-1 top-16 h-28 rounded-full border border-white/[0.08] rotate-[12deg] scale-x-[1.5]" />
      <div className="absolute left-1/2 top-1/2 flex h-28 w-28 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-amber-300/30 bg-[#101927]/90 shadow-[0_0_70px_rgba(226,160,75,0.2)]">
        <svg viewBox="0 0 100 100" className="h-16 w-16" aria-hidden="true">
          <defs>
            <linearGradient id="coinGradient" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0" stopColor="#ffe0a2" />
              <stop offset="1" stopColor="#d98224" />
            </linearGradient>
          </defs>
          <circle cx="50" cy="50" r="36" fill="url(#coinGradient)" opacity=".15" />
          <path d="M50 12 70 48 50 60 30 48 50 12Z" fill="none" stroke="url(#coinGradient)" strokeWidth="4" />
          <path d="m50 65 20-12-20 35-20-35 20 12Z" fill="none" stroke="#f6b95d" strokeWidth="4" opacity=".8" />
          <path d="M50 12v48M30 48l20 12 20-12" fill="none" stroke="#ffe0a2" strokeWidth="2" opacity=".7" />
        </svg>
      </div>
      <div className="absolute left-5 top-6 flex h-11 w-11 items-center justify-center rounded-xl border border-sky-300/20 bg-sky-400/10 shadow-lg shadow-sky-500/10">
        <ChainLogo network={network} size="md" />
      </div>
      <div className="absolute bottom-8 right-3 rounded-lg border border-white/[0.1] bg-[#121c2c]/90 px-3 py-2 backdrop-blur">
        <p className="text-[9px] uppercase tracking-[0.16em] text-zinc-600">Live network</p>
        <p className="mt-1 max-w-[120px] truncate text-xs font-medium text-zinc-200">{network.name}</p>
      </div>
      <span className="absolute right-16 top-9 h-2 w-2 rounded-full bg-amber-300 shadow-[0_0_14px_#f4b65d]" />
      <span className="absolute bottom-12 left-20 h-1.5 w-1.5 rounded-full bg-sky-300 shadow-[0_0_12px_#7dd3fc]" />
    </div>
  );
}

function ChainLogo({
  network,
  size = "sm",
}: {
  network: Network;
  size?: "xs" | "sm" | "md";
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const sizeClass = {
    xs: "w-4 h-4 rounded-[4px]",
    sm: "w-6 h-6 rounded-md",
    md: "w-10 h-10 rounded-xl",
  }[size];
  const iconClass = {
    xs: "w-2.5 h-2.5",
    sm: "w-3.5 h-3.5",
    md: "w-5 h-5",
  }[size];

  return (
    <span
      className={`${sizeClass} shrink-0 inline-flex items-center justify-center overflow-hidden border border-white/[0.1]`}
      style={{ backgroundColor: `${network.color}22` }}
    >
      {network.logo && !imageFailed ? (
        // Chain logos come from the dynamic Blockscout directory and use many hosts.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={network.logo}
          alt=""
          className="w-full h-full object-contain"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <ChainMark network={network} className={iconClass} />
      )}
    </span>
  );
}

function ChainMark({
  network,
  className,
}: {
  network: Network;
  className: string;
}) {
  const id = network.id;
  if (id === "1" || id === "11155111") {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        <path fill={network.color} d="m12 2.5 6.3 9.1-6.3 3.7-6.3-3.7L12 2.5Z" />
        <path fill={network.color} opacity=".65" d="m12 16.8 6.3-3.7-6.3 8.4-6.3-8.4 6.3 3.7Z" />
      </svg>
    );
  }
  if (id === "8453" || id === "84532") {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        <circle cx="12" cy="12" r="10" fill={network.color} />
        <path fill="white" d="M7.1 12.2c0-2.7 2.1-4.9 4.8-4.9 1.8 0 3.4 1 4.2 2.5h-2.4a2.4 2.4 0 1 0 0 4.8h2.4a4.8 4.8 0 0 1-9-2.4Z" />
      </svg>
    );
  }
  if (id === "137") {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        <path fill={network.color} d="m7.1 7.7 2.7-1.6 2.2 1.3-2.7 1.6-2.2-1.3Zm5.1-.3 2.7-1.6 2.2 1.3-2.7 1.6-2.2-1.3Zm-5.1 4.9 2.7-1.6 2.2 1.3-2.7 1.6-2.2-1.3Zm5.1-.3 2.7-1.6 2.2 1.3-2.7 1.6-2.2-1.3Z" />
        <path fill={network.color} d="m6 11.6 2.2-1.3v3.4L6 15v-3.4Zm5.1 2.9 2.2-1.3v3.4l-2.2 1.3v-3.4Z" />
      </svg>
    );
  }
  if (id === "10" || id === "11155420") {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        <rect width="20" height="20" x="2" y="2" rx="6" fill={network.color} />
        <path fill="white" d="M12 6.7a5.3 5.3 0 1 0 0 10.6 5.3 5.3 0 0 0 0-10.6Zm0 2.3a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z" />
      </svg>
    );
  }
  if (id === "42161") {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        <path fill={network.color} d="m12 3 3.5 6.7-3.5 2-3.5-2L12 3Zm0 9.8 3.5 2-3.5 6.2-3.5-6.2 3.5-2Z" />
        <path fill="#8bd3ff" d="m12 3 1.5 7.5-1.5 1.2-1.5-1.2L12 3Zm0 9.8 1.5 2-1.5 4.2-1.5-4.2 1.5-2Z" />
      </svg>
    );
  }
  return (
    <span className={`${className} flex items-center justify-center font-bold`} style={{ color: network.color }}>
      {network.name.slice(0, 1).toUpperCase()}
    </span>
  );
}

function IconButton({
  children,
  title,
  onClick,
}: {
  children: ReactNode;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className="w-9 h-9 flex items-center justify-center rounded-lg border border-white/[0.08] text-zinc-400 hover:border-amber-500/40 hover:text-amber-400 transition-all"
    >
      {children}
    </button>
  );
}

function StatCard({
  icon,
  iconColor,
  label,
  value,
  sub,
}: {
  icon: ReactNode;
  iconColor: "blue" | "green" | "purple" | "orange";
  label: string;
  value: string;
  sub: string;
}) {
  const bgMap = {
    blue: "bg-blue-500/10 text-blue-400",
    green: "bg-emerald-500/10 text-emerald-400",
    purple: "bg-purple-500/10 text-purple-400",
    orange: "bg-amber-500/10 text-amber-400",
  };

  return (
    <div className="bg-[#0d1320]/60 backdrop-blur border border-white/[0.06] rounded-xl p-4 group hover:border-white/[0.12] transition-colors">
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center ${bgMap[iconColor]} mb-3`}
      >
        {icon}
      </div>
      <span className="text-[11px] text-zinc-500 block">{label}</span>
      <strong className="text-xl font-bold block mt-0.5 tracking-tight">
        {value}
      </strong>
      <span className="text-[10px] text-zinc-600 block mt-1">{sub}</span>
    </div>
  );
}

function TransactionRow({
  tx,
  network,
  address,
  onCopy,
  copied,
}: {
  tx: Transaction;
  network: Network;
  address: string;
  onCopy: (v: string) => void;
  copied: string;
}) {
  const isOutgoing =
    tx.from?.hash?.toLowerCase() === address.toLowerCase();
  const isSuccess = tx.status === "ok";

  return (
    <div className="group px-5 py-3.5 flex items-center gap-3 hover:bg-white/[0.02] transition-colors">
      {/* Status + Direction indicator */}
      <div className="relative shrink-0">
        <div
          className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold ${
            isSuccess
              ? "bg-emerald-500/10 text-emerald-400"
              : "bg-red-500/10 text-red-400"
          }`}
        >
          {isOutgoing ? (
            <ArrowUpRight className="w-4 h-4" />
          ) : (
            <ArrowDownLeft className="w-4 h-4" />
          )}
        </div>
      </div>

      {/* TX details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <a
            href={`${network.explorer}/tx/${tx.hash}`}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-xs text-sky-400/80 hover:text-amber-400 transition-colors"
          >
            {shortHash(tx.hash)}
          </a>
          <button
            onClick={() => tx.hash && void onCopy(tx.hash)}
            className="opacity-0 group-hover:opacity-100 transition-opacity"
            title="Copy hash"
          >
            {copied === tx.hash ? (
              <Check className="w-3 h-3 text-emerald-400" />
            ) : (
              <Copy className="w-3 h-3 text-zinc-600 hover:text-zinc-400" />
            )}
          </button>
        </div>
        <div className="flex items-center gap-2 mt-1 text-[11px] text-zinc-500">
          <span className="px-1.5 py-0.5 rounded bg-white/[0.04] text-[10px]">
            {tx.method || "transfer"}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-2.5 h-2.5" />
            {relativeTime(tx.timestamp)}
          </span>
        </div>
      </div>

      {/* Route: from → to */}
      <div className="hidden md:flex items-center gap-2 text-[11px] text-zinc-500">
        <span
          className={`font-mono ${isOutgoing ? "text-amber-500/70" : ""}`}
          title={tx.from?.hash}
        >
          {shortHash(tx.from?.hash, 4)}
        </span>
        <ArrowRight className="w-3 h-3 text-zinc-700" />
        <span
          className={`font-mono ${!isOutgoing ? "text-amber-500/70" : ""}`}
          title={tx.to?.hash}
        >
          {shortHash(tx.to?.hash, 4)}
        </span>
      </div>

      {/* Value */}
      <div className="text-right min-w-[100px]">
        <div className="text-xs font-semibold">
          {formatValue(tx.value)} {network.symbol}
        </div>
        <div className="text-[10px] text-zinc-600 mt-0.5 flex items-center justify-end gap-1">
          <Hash className="w-2.5 h-2.5" />
          {tx.block?.toLocaleString() || "—"}
        </div>
      </div>

      {/* External link */}
      <a
        href={`${network.explorer}/tx/${tx.hash}`}
        target="_blank"
        rel="noreferrer"
        className="text-zinc-700 hover:text-amber-400 transition-colors ml-1 shrink-0"
        aria-label="View transaction"
      >
        <ExternalLink className="w-3.5 h-3.5" />
      </a>
    </div>
  );
}
