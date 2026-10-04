import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, X, Users } from 'lucide-react';
import type { Plan } from '../../../packages/planner/model';
import { shareablePlan } from '../../../packages/planner/team';
import { api, post, readStorage, saveStorage } from '../api';
import type { RoomCredential } from '../Room';

export function ShareTeamDialog({
  plan,
  lost,
  onClose,
  onCreated,
}: {
  plan: Plan;
  lost: string[];
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const snapshot = useMemo(() => shareablePlan(plan), [plan]);
  const [name, setName] = useState(plan.owner.slice(0, 60)),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const dialog = useRef<HTMLElement>(null),
    previous = useRef(document.activeElement as HTMLElement | null);
  useEffect(() => {
    dialog.current?.focus();
    return () => previous.current?.focus();
  }, []);
  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await api<{ id: string; token: string }>(
        '/plan-sessions',
        post({ plan: snapshot, lostIds: lost, name }),
      );
      const rooms = readStorage<RoomCredential[]>('blackout-rooms', []);
      try {
        saveStorage(
          'blackout-rooms',
          [
            {
              id: result.id,
              token: result.token,
              name: `${plan.name} — team check`,
              createdAt: new Date().toISOString(),
              mode: 'organisation',
            },
            ...rooms,
          ].slice(0, 20),
        );
      } catch (e) {
        await api(`/sessions/${result.id}`, { method: 'DELETE' }, result.token);
        throw e;
      }
      onCreated(result.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function trap(e: React.KeyboardEvent) {
    if (e.key === 'Escape' && !busy) onClose();
    if (e.key !== 'Tab') return;
    const controls = Array.from(
      dialog.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled),input:not(:disabled),summary',
      ) ?? [],
    ).filter((el) => el.getClientRects().length);
    if (
      e.shiftKey &&
      (document.activeElement === controls[0] || document.activeElement === dialog.current)
    ) {
      e.preventDefault();
      controls.at(-1)?.focus();
    } else if (!e.shiftKey && document.activeElement === controls.at(-1)) {
      e.preventDefault();
      controls[0]?.focus();
    }
  }
  return (
    <div className="modal-backdrop" onKeyDown={trap}>
      <section
        className="setup-modal service-editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-team-title"
        ref={dialog}
        tabIndex={-1}
      >
        <header>
          <div>
            <span className="eyebrow">CHECK YOUR MAP TOGETHER</span>
            <h2 id="share-team-title">Create a team room</h2>
          </div>
          <button
            className="icon-button"
            aria-label="Close team preview"
            disabled={busy}
            onClick={onClose}
          >
            <X />
          </button>
        </header>
        <form onSubmit={(e) => void create(e)}>
          <fieldset className="service-fields" disabled={busy}>
            <p className="small">
              Share service names, owners, dependencies and recovery status with your team. Private
              notes and tasks stay in your workspace.
            </p>
            <div className="team-preview-loss">
              <strong>Simulated loss</strong>
              <span>
                {plan.assets
                  .filter((a) => lost.includes(a.id))
                  .map((a) => a.label)
                  .join(' + ')}
              </span>
            </div>
            <ul className="team-preview-list">
              {plan.assets
                .filter((a) => a.kind === 'account')
                .map((a) => (
                  <li key={a.id}>
                    <strong>{a.label}</strong>
                    <span>{a.owner || plan.owner || 'Owner not assigned'}</span>
                  </li>
                ))}
            </ul>
            <label>
              Your name as host
              <input
                required
                maxLength={60}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <p className="small muted">
              This room stores the shared snapshot on this server. Invite trusted people and delete
              the room when finished.
            </p>
            <details>
              <summary>View everything that will be shared</summary>
              <pre className="shared-preview">{JSON.stringify(snapshot, null, 2)}</pre>
            </details>
            {error && (
              <div role="alert" className="error-banner">
                {error}
              </div>
            )}
          </fieldset>
          <footer>
            <button className="button" type="button" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button className="button primary" disabled={busy || !lost.length}>
              <Users size={16} />
              {busy ? 'Creating…' : 'Create team room'}
              <ArrowRight size={15} />
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
