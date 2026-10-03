import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';

// Works on LAN HTTP, where Web Crypto's subtle API is unavailable. Bytes stay in this browser.
export function recordDigest(bytes: Uint8Array): string {
  return bytesToHex(sha256(bytes));
}
