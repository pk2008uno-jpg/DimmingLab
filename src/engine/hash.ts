/**
 * DimmingLab - Canonical Dataset Hashing
 * Computes deterministic SHA-256 hashes of light curve points for integrity checking,
 * project export verification, and provenance tracking.
 */

import { LightCurvePoint } from '../domain/types';

/**
 * Creates canonical string representation of light curve points:
 * Sorted by time ascending, formatted to fixed scientific precision.
 */
export function canonicalPointsRepresentation(points: readonly LightCurvePoint[]): string {
  // Sort points by time ascending, tie-breaking by originalIndex
  const sorted = [...points].sort((a, b) => {
    if (Math.abs(a.time - b.time) > 1e-9) {
      return a.time - b.time;
    }
    return a.originalIndex - b.originalIndex;
  });

  const lines: string[] = new Array(sorted.length);
  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i];
    const t = p.time.toFixed(6);
    const f = p.flux.toFixed(6);
    const e = p.fluxErr !== undefined && Number.isFinite(p.fluxErr) ? p.fluxErr.toFixed(6) : '';
    const q = p.quality !== undefined ? String(p.quality) : '';
    const s = p.segment !== undefined ? String(p.segment) : '';
    lines[i] = `${t},${f},${e},${q},${s}`;
  }

  return lines.join('\n');
}

/**
 * Lightweight synchronous SHA-256 implementation
 * Guarantees identical hashes in web worker, browser UI thread, and Vitest test runner.
 */
export function computeSha256(input: string): string {
  const words: number[] = [];
  const utf8 = unescape(encodeURIComponent(input));
  for (let i = 0; i < utf8.length; i++) {
    words[i >> 2] |= (utf8.charCodeAt(i) & 0xff) << (24 - (i % 4) * 8);
  }

  const bitLength = utf8.length * 8;
  words[bitLength >> 5] |= 0x80 << (24 - (bitLength % 32));
  words[(((bitLength + 64) >> 9) << 4) + 15] = bitLength;

  let H0 = 0x6a09e667;
  let H1 = 0xbb67ae85;
  let H2 = 0x3c6ef372;
  let H3 = 0xa54ff53a;
  let H4 = 0x510e527f;
  let H5 = 0x9b05688c;
  let H6 = 0x1f83d9ab;
  let H7 = 0x5be0cd19;

  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  const W = new Array(64);

  for (let i = 0; i < words.length; i += 16) {
    let a = H0;
    let b = H1;
    let c = H2;
    let d = H3;
    let e = H4;
    let f = H5;
    let g = H6;
    let h = H7;

    for (let t = 0; t < 64; t++) {
      if (t < 16) {
        W[t] = words[i + t] | 0;
      } else {
        const s0 = (rotr(W[t - 15], 7) ^ rotr(W[t - 15], 18) ^ (W[t - 15] >>> 3)) | 0;
        const s1 = (rotr(W[t - 2], 17) ^ rotr(W[t - 2], 19) ^ (W[t - 2] >>> 10)) | 0;
        W[t] = (W[t - 16] + s0 + W[t - 7] + s1) | 0;
      }

      const S1 = (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) | 0;
      const ch = ((e & f) ^ (~e & g)) | 0;
      const temp1 = (h + S1 + ch + K[t] + W[t]) | 0;
      const S0 = (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) | 0;
      const maj = ((a & b) ^ (a & c) ^ (b & c)) | 0;
      const temp2 = (S0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    H0 = (H0 + a) | 0;
    H1 = (H1 + b) | 0;
    H2 = (H2 + c) | 0;
    H3 = (H3 + d) | 0;
    H4 = (H4 + e) | 0;
    H5 = (H5 + f) | 0;
    H6 = (H6 + g) | 0;
    H7 = (H7 + h) | 0;
  }

  return [H0, H1, H2, H3, H4, H5, H6, H7]
    .map(val => (val >>> 0).toString(16).padStart(8, '0'))
    .join('');
}

function rotr(n: number, b: number): number {
  return (n >>> b) | (n << (32 - b));
}

export function hashLightCurvePoints(points: readonly LightCurvePoint[]): string {
  const canonical = canonicalPointsRepresentation(points);
  return computeSha256(canonical);
}
