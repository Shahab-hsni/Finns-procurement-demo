/**
 * Finn's — shared formatting helpers.
 *
 * IDR is primary. USD only on imports (wine, AUS beef, etc.) — render USD
 * as a secondary line, never as the primary number.
 *
 * Usage:
 *   import { fmtIdr, fmtIdrShort } from '../lib/format';
 *
 *   fmtIdr(14_200_000)     -> "Rp 14.200.000"   (Indonesian thousands separator)
 *   fmtIdrShort(14_200_000) -> "Rp 14.2jt"      (juta)
 *   fmtIdrShort(420_000_000) -> "Rp 420.0jt"
 *   fmtIdrShort(2_100_000_000) -> "Rp 2.1M"     (milyar)
 *   fmtIdrShort(85_000)     -> "Rp 85rb"        (ribu)
 *
 *   fmtUsd(1_840)          -> "USD 1,840"        (used on import POs)
 */

export const fmtIdr = (n: number): string => `Rp ${n.toLocaleString('id-ID')}`;

export const fmtIdrShort = (n: number): string => {
  if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1)}M`;
  if (n >= 1_000_000)     return `Rp ${(n / 1_000_000).toFixed(1)}jt`;
  if (n >= 1_000)         return `Rp ${(n / 1_000).toFixed(0)}rb`;
  return `Rp ${n}`;
};

export const fmtUsd = (n: number): string => `USD ${n.toLocaleString('en-US')}`;
