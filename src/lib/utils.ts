/**
 * Shared utilities for formatting and validation.
 * All functions are pure — no side effects.
 */

const EVM_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

/** Validate an EVM address (42-char hex with 0x prefix). */
export function isValidAddress(value: string): boolean {
  return EVM_ADDRESS_REGEX.test(value);
}

/** Truncate a hex string for display: 0x1234…abcd */
export function shortHash(value?: string, chars = 6): string {
  if (!value) return "—";
  if (value.length <= chars * 2 + 4) return value;
  return `${value.slice(0, chars + 2)}…${value.slice(-chars)}`;
}

/** Convert raw wei string to human-readable ETH value. */
export function formatValue(value: string, decimals = 18): string {
  const parsed = Number(value) / Math.pow(10, decimals);
  if (!Number.isFinite(parsed)) return "0";
  if (parsed === 0) return "0";
  if (parsed < 0.0001) return parsed.toExponential(2);
  return parsed.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

/** Friendly relative time: "5m ago", "2h ago", etc. */
export function relativeTime(timestamp: string): string {
  const seconds = Math.max(
    0,
    Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000),
  );
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

/** Format a large number: 1,234,567 */
export function formatNumber(n: number | string): string {
  return Number(n).toLocaleString("en-US");
}

