export type Transaction = {
  hash: string;
  timestamp: string;
  from?: { hash?: string; name?: string; is_contract?: boolean };
  to?: { hash?: string; name?: string; is_contract?: boolean };
  value: string;
  fee?: { value: string };
  status: string;
  method?: string;
  block: number;
  tx_types?: string[];
  token_transfers?: TokenTransfer[];
};

export type TokenTransfer = {
  token: {
    name: string;
    symbol: string;
    type: string;
  };
  total: {
    value: string;
    decimals: string;
  };
};

export type TransactionResponse = {
  items?: Transaction[];
  next_page_params?: Record<string, string | number> | null;
};

export type AddressInfo = {
  hash: string;
  name?: string | null;
  is_contract?: boolean;
  coin_balance?: string | null;
  exchange_rate?: string | null;
  token?: {
    name: string;
    symbol: string;
  } | null;
  ens_domain_name?: string | null;
};

export type WalletSummary = {
  address?: AddressInfo | null;
  counters?: AddressCounters | null;
};

export type AddressCounters = {
  transactions_count: string;
  token_transfers_count: string;
  gas_usage_count: string;
  validations_count: string;
};

export type CoinBalanceHistoryItem = {
  date: string;
  value: string;
};
