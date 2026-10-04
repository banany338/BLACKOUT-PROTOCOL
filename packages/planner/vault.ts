import { z } from 'zod';
import { workspaceSchema, type Workspace } from './model';

export const VAULT_KEY = 'blackout-encrypted-workspace-v1';
const encoded = z.string().regex(/^[A-Za-z0-9+/]*={0,2}$/);
const envelopeSchema = z
  .object({
    format: z.literal('blackout-vault-1'),
    iterations: z.literal(600_000),
    salt: encoded.length(24),
    iv: encoded.length(16),
    ciphertext: encoded.min(24).max(8_000_000),
  })
  .strict();
export type Envelope = z.infer<typeof envelopeSchema>;
export type VaultAccess = { key: CryptoKey; salt: string };
const encode = (value: Uint8Array) => {
  let result = '';
  for (let i = 0; i < value.length; i += 8192)
    result += String.fromCharCode(...value.subarray(i, i + 8192));
  return btoa(result);
};
const decode = (value: string) => Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
const text = new TextEncoder();
function cryptoApi() {
  if (!globalThis.crypto?.subtle)
    throw new Error(
      'Encrypted storage needs HTTPS, localhost, or the portable file in a supported browser. Open one of those to use your organisation workspace.',
    );
  return globalThis.crypto.subtle;
}
async function derive(passphrase: string, salt: string): Promise<VaultAccess> {
  if (passphrase.length > 1024) throw new Error('Passphrase is too long.');
  const api = cryptoApi();
  const material = await api.importKey('raw', text.encode(passphrase), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return {
    salt,
    key: await api.deriveKey(
      { name: 'PBKDF2', hash: 'SHA-256', iterations: 600_000, salt: decode(salt) },
      material,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    ),
  };
}
export async function createVault(passphrase: string): Promise<VaultAccess> {
  if (passphrase.length < 12) throw new Error('Use a passphrase of at least 12 characters.');
  return derive(passphrase, encode(crypto.getRandomValues(new Uint8Array(16))));
}
const aad = (salt: string) => text.encode(`blackout-vault-1|600000|${salt}`);
export async function seal(workspace: Workspace, access: VaultAccess): Promise<string> {
  const data = workspaceSchema.parse(workspace);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await cryptoApi().encrypt(
    { name: 'AES-GCM', iv, additionalData: aad(access.salt) },
    access.key,
    text.encode(JSON.stringify(data)),
  );
  const envelope: Envelope = {
    format: 'blackout-vault-1',
    iterations: 600_000,
    salt: access.salt,
    iv: encode(iv),
    ciphertext: encode(new Uint8Array(ciphertext)),
  };
  if (!envelopeSchema.safeParse(envelope).success)
    throw new Error(
      'This workspace exceeds the 8 MB encrypted storage limit. Export a backup and use fewer plans.',
    );
  return JSON.stringify(envelope);
}
export async function unlock(
  serialized: string,
  passphrase: string,
): Promise<{ workspace: Workspace; access: VaultAccess }> {
  if (serialized.length > 8_100_000)
    throw new Error('This backup is larger than the supported 8 MB.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new Error('This is not a supported encrypted BLACKOUT workspace.');
  }
  const envelope = envelopeSchema.safeParse(parsed);
  if (!envelope.success) throw new Error('This is not a supported encrypted BLACKOUT workspace.');
  const access = await derive(passphrase, envelope.data.salt);
  try {
    const plaintext = await cryptoApi().decrypt(
      { name: 'AES-GCM', iv: decode(envelope.data.iv), additionalData: aad(envelope.data.salt) },
      access.key,
      decode(envelope.data.ciphertext),
    );
    return {
      access,
      workspace: workspaceSchema.parse(JSON.parse(new TextDecoder().decode(plaintext))),
    };
  } catch {
    throw new Error('The passphrase is incorrect or this backup has been changed or damaged.');
  }
}
