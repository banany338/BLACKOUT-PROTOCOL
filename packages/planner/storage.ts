import { VAULT_KEY } from './vault';

/** All browser writers share a Web Lock; expected ciphertext catches a stale editing tab. */
export async function saveEncryptedWorkspace(
  expected: string | null,
  next: string,
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage,
  locks: Pick<LockManager, 'request'> | undefined = navigator.locks,
): Promise<void> {
  if (!locks)
    throw new Error(
      'This browser cannot safely save shared workspace data. Open the app in a current browser on HTTPS or localhost.',
    );
  await locks.request('blackout-workspace-write', async () => {
    if (storage.getItem(VAULT_KEY) !== expected)
      throw new Error(
        'Another tab saved this workspace. Your changes have not overwritten it. Save a backup of this tab, then lock and unlock to load the latest version.',
      );
    storage.setItem(VAULT_KEY, next);
  });
}
