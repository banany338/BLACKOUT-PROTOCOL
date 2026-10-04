import { it, expect } from 'vitest';
import { saveEncryptedWorkspace } from './storage';
import { VAULT_KEY } from './vault';

it('serializes competing tabs and refuses to overwrite the winning save', async () => {
  let saved: string | null = 'original',
    queue = Promise.resolve();
  const storage = {
    getItem: (key: string) => (key === VAULT_KEY ? saved : null),
    setItem: (_key: string, value: string) => {
      saved = value;
    },
  };
  const locks = {
    request: (_name: string, callback: () => Promise<void>) => {
      const result = queue.then(callback);
      queue = result.catch(() => {});
      return result;
    },
  } as unknown as Pick<LockManager, 'request'>;
  const outcomes = await Promise.allSettled([
    saveEncryptedWorkspace('original', 'tab-a', storage, locks),
    saveEncryptedWorkspace('original', 'tab-b', storage, locks),
  ]);
  expect(outcomes.map((r) => r.status)).toEqual(['fulfilled', 'rejected']);
  expect(saved).toBe('tab-a');
  await expect(saveEncryptedWorkspace(null, 'replacement', storage, locks)).rejects.toThrow(
    'Another tab',
  );
  expect(saved).toBe('tab-a');
  await saveEncryptedWorkspace('tab-a', 'latest', storage, locks);
  expect(saved).toBe('latest');
});

it('does not write when safe cross-tab locking is unavailable', async () => {
  let saved = 'original';
  const storage = {
    getItem: () => saved,
    setItem: (_key: string, value: string) => {
      saved = value;
    },
  };
  await expect(
    saveEncryptedWorkspace('original', 'new', storage, null as unknown as undefined),
  ).rejects.toThrow('cannot safely save');
  expect(saved).toBe('original');
});
