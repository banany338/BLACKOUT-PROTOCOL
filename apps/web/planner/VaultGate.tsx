import { saveEncryptedWorkspace } from '../../../packages/planner/storage';
import { useState } from 'react';
import { ArrowRight, KeyRound, FileUp } from 'lucide-react';
import {
  createVault,
  seal,
  unlock,
  VAULT_KEY,
  type VaultAccess,
} from '../../../packages/planner/vault';
import { emptyWorkspace, type Workspace } from '../../../packages/planner/model';

export function VaultGate({
  onOpen,
}: {
  onOpen: (workspace: Workspace, access: VaultAccess, snapshot: string) => void;
}) {
  const [existing] = useState(() => localStorage.getItem(VAULT_KEY));
  const [passphrase, setPassphrase] = useState(''),
    [confirmation, setConfirmation] = useState(''),
    [restore, setRestore] = useState<string>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const encrypted = restore ?? existing;
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (encrypted) {
        const result = await unlock(encrypted, passphrase);
        if (restore && !existing) await saveEncryptedWorkspace(null, restore);
        if (localStorage.getItem(VAULT_KEY) !== encrypted)
          throw new Error(
            'Another tab changed the saved workspace. Reload this page and try again.',
          );
        onOpen(result.workspace, result.access, encrypted);
      } else {
        if (passphrase !== confirmation) throw new Error('The passphrases do not match.');
        const access = await createVault(passphrase),
          workspace = emptyWorkspace();
        const snapshot = await seal(workspace, access);
        await saveEncryptedWorkspace(null, snapshot);
        onOpen(workspace, access, snapshot);
      }
      setPassphrase('');
      setConfirmation('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="workspace-gate">
      <div className="gate-story">
        <h1>
          Keep working.
          <br />
          Even if email is locked.
        </h1>
      </div>
      <section className="panel gate-form">
        <div className="gate-key">
          <KeyRound size={25} strokeWidth={1.5} />
        </div>
        <h2>{encrypted ? 'Unlock your recovery plans.' : 'Your private workspace.'}</h2>
        <form onSubmit={(e) => void submit(e)}>
          <label>
            Workspace passphrase
            <input
              type="password"
              autoComplete={encrypted ? 'current-password' : 'new-password'}
              value={passphrase}
              minLength={encrypted ? 1 : 12}
              maxLength={1024}
              required
              placeholder={encrypted ? 'Enter your key' : 'At least 12 characters'}
              onChange={(e) => setPassphrase(e.target.value)}
            />
          </label>
          {!encrypted && (
            <label>
              Confirm passphrase
              <input
                type="password"
                autoComplete="new-password"
                value={confirmation}
                minLength={12}
                maxLength={1024}
                required
                onChange={(e) => setConfirmation(e.target.value)}
              />
            </label>
          )}
          {error && (
            <div className="error-banner" role="alert">
              {error}
            </div>
          )}
          <button className="button primary" disabled={busy}>
            {busy
              ? 'Opening workspace…'
              : encrypted
                ? 'Unlock workspace'
                : 'Create my private workspace'}
            <ArrowRight size={16} />
          </button>
        </form>
        <p className="gate-key-note">Keep this key safe. It cannot be reset.</p>
        {!existing && (
          <label className="file-control">
            <FileUp size={16} />
            {restore ? 'Backup selected — enter its passphrase above' : 'Restore a backup'}
            <input
              type="file"
              accept=".blackout,application/json"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 8_100_000) {
                  setError('Choose a backup smaller than 8 MB.');
                  return;
                }
                setRestore(await file.text());
                setError('');
              }}
            />
          </label>
        )}
      </section>
    </div>
  );
}
