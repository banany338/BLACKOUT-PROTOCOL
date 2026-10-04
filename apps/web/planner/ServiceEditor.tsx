import { useEffect, useRef, useState } from 'react';
import { Plus, Trash2, X, Check } from 'lucide-react';
import {
  newId,
  starterPlan,
  planSchema,
  type Plan,
  type Asset,
} from '../../../packages/planner/model';
import { Dependencies } from './PlanEditor';

export function ServiceEditor({
  plan,
  resourceId,
  busy,
  onSave,
  onClose,
}: {
  plan?: Plan;
  resourceId?: string;
  busy: boolean;
  onSave: (next: Plan) => Promise<void>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(() =>
    plan ? structuredClone(plan) : { ...starterPlan(), assets: [], activities: [] },
  );
  const activityId = resourceId?.startsWith('activity-') ? resourceId.slice(9) : undefined;
  const existing = plan?.assets.find((a) => a.id === resourceId);
  const [asset, setAsset] = useState<Asset>(() =>
    existing
      ? structuredClone(existing)
      : {
          id: newId(),
          label: '',
          owner: plan?.owner ?? '',
          kind: 'account',
          available: true,
          requiresAll: [],
          note: '',
        },
  );
  const [activity, setActivity] = useState(() =>
    structuredClone(plan?.activities.find((a) => a.id === activityId)),
  );
  const [include, setInclude] = useState(!plan || plan.activities.length < 100);
  const [backupName, setBackupName] = useState('');
  const [backupKind, setBackupKind] = useState<Asset['kind']>('artifact');
  const [backupAvailable, setBackupAvailable] = useState(false);
  const [backupDependencies, setBackupDependencies] = useState<string[]>([]);
  const [addingBackup, setAddingBackup] = useState<string>();
  const [error, setError] = useState('');
  const dialog = useRef<HTMLElement>(null),
    returnFocus = useRef(document.activeElement as HTMLElement | null);
  useEffect(() => {
    dialog.current?.focus();
    return () => returnFocus.current?.focus();
  }, []);
  const resources = activity
    ? draft
    : {
        ...draft,
        assets: existing
          ? draft.assets.map((a) => (a.id === asset.id ? asset : a))
          : [...draft.assets, asset],
      };
  const methods = draft.methods.filter((m) => m.accountId === asset.id);
  function update(fn: (p: Plan) => void) {
    setDraft((p) => {
      const next = structuredClone(p);
      fn(next);
      return next;
    });
  }
  function trap(e: React.KeyboardEvent) {
    if (e.key === 'Escape' && !busy) onClose();
    if (e.key !== 'Tab') return;
    const controls = Array.from(
      dialog.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea,[tabindex="0"]',
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
  function addBackup() {
    if (!backupName.trim()) {
      setError('Give the backup a name.');
      return;
    }
    if (draft.assets.length + (existing ? 0 : 1) >= 100) {
      setError('This plan already has 100 resources.');
      return;
    }
    const id = newId();
    update((p) => {
      p.assets.push({
        id,
        label: backupName.trim(),
        kind: backupKind,
        owner: asset.owner,
        available: backupAvailable,
        requiresAll: backupDependencies,
        note: '',
      });
      const method = p.methods.find((m) => m.id === addingBackup);
      if (method) method.requiresAll = [...method.requiresAll, id];
    });
    setAddingBackup(undefined);
    setBackupName('');
    setBackupAvailable(false);
    setBackupDependencies([]);
    setError('');
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (addingBackup) {
      setError('Add or cancel the new backup before saving.');
      return;
    }
    const next = structuredClone(draft);
    if (activity && activityId) {
      if (!activity.label.trim() || !activity.requiresAll.length) {
        setError('Name the work and select what it needs.');
        return;
      }
      next.activities = next.activities.map((a) => (a.id === activityId ? activity : a));
    } else {
      if (!asset.label.trim()) {
        setError('Give the service a name.');
        return;
      }
      if (!next.name.trim()) {
        setError('Give your team a name.');
        return;
      }
      if (methods.some((m) => !m.label.trim() || !m.requiresAll.length)) {
        setError('Each recovery option needs a name and at least one resource.');
        return;
      }
      next.assets = existing
        ? next.assets.map((a) => (a.id === asset.id ? asset : a))
        : [...next.assets, asset];
      if (!plan) next.owner = asset.owner;
      const linkedId = `use-${asset.id}`;
      if (!existing && (include || !next.activities.length))
        next.activities.push({
          id: linkedId,
          label: `Use ${asset.label}`.slice(0, 100),
          owner: asset.owner,
          requiresAll: [asset.id],
        });
      if (existing)
        next.activities = next.activities.map((a) =>
          a.id === linkedId && a.label === `Use ${existing.label}`.slice(0, 100)
            ? { ...a, label: `Use ${asset.label}`.slice(0, 100), owner: asset.owner }
            : a,
        );
    }
    next.updatedAt = new Date().toISOString();
    const parsed = planSchema.safeParse(next);
    if (!parsed.success) {
      setError(parsed.error.issues.map((i) => i.message).join(' '));
      return;
    }
    try {
      await onSave(parsed.data);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <div className="modal-backdrop" onKeyDown={trap}>
      <section
        className="setup-modal service-editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby="service-title"
        tabIndex={-1}
        ref={dialog}
      >
        <header>
          <div>
            <span className="eyebrow">YOUR MAP</span>
            <h2 id="service-title">
              {activity ? 'Edit essential work' : existing ? 'Edit this service' : 'Add a service'}
            </h2>
          </div>
          <button
            className="icon-button"
            aria-label="Close service editor"
            onClick={onClose}
            disabled={busy}
          >
            <X />
          </button>
        </header>
        <form onSubmit={(e) => void save(e)}>
          <fieldset disabled={busy} className="service-fields">
            {activity ? (
              <>
                <label>
                  Name of the work
                  <input
                    required
                    maxLength={100}
                    value={activity.label}
                    onChange={(e) => setActivity({ ...activity, label: e.target.value })}
                  />
                </label>
                <label>
                  Responsible person
                  <input
                    maxLength={100}
                    value={activity.owner}
                    onChange={(e) => setActivity({ ...activity, owner: e.target.value })}
                  />
                </label>
                <Dependencies
                  plan={resources}
                  selected={activity.requiresAll}
                  label="This work needs all of these"
                  onChange={(ids) => setActivity({ ...activity, requiresAll: ids })}
                />
              </>
            ) : (
              <>
                {!plan && (
                  <label>
                    Organisation name
                    <input
                      required
                      maxLength={100}
                      value={draft.name}
                      placeholder="Your team or club"
                      onChange={(e) =>
                        update((p) => {
                          p.name = e.target.value;
                        })
                      }
                    />
                  </label>
                )}
                <label>
                  Service name
                  <input
                    required
                    maxLength={100}
                    value={asset.label}
                    placeholder="Club email, website, shared files…"
                    onChange={(e) => setAsset({ ...asset, label: e.target.value })}
                  />
                </label>
                <label>
                  Responsible person
                  <input
                    maxLength={100}
                    value={asset.owner}
                    placeholder="Person or team"
                    onChange={(e) => setAsset({ ...asset, owner: e.target.value })}
                  />
                </label>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={asset.available}
                    onChange={(e) => setAsset({ ...asset, available: e.target.checked })}
                  />
                  We can access this now
                </label>
                {asset.kind === 'account' && (
                  <section className="service-recovery">
                    <div className="section-heading">
                      <h3>Ways back in</h3>
                      <button
                        className="text-button"
                        type="button"
                        disabled={draft.methods.length >= 300}
                        onClick={() =>
                          update((p) => {
                            p.methods.push({
                              id: newId(),
                              accountId: asset.id,
                              label: '',
                              requiresAll: [],
                              evidence: 'unknown',
                              note: '',
                              reviewedAt: '',
                            });
                          })
                        }
                      >
                        <Plus size={14} />
                        Add recovery option
                      </button>
                    </div>
                    {!methods.length && (
                      <p className="small muted">No recovery option recorded yet.</p>
                    )}
                    {methods.map((m) => (
                      <div className="quick-method" key={m.id}>
                        <div className="section-heading">
                          <label>
                            Recovery option
                            <input
                              required
                              maxLength={150}
                              value={m.label}
                              placeholder="Reset through backup email"
                              onChange={(e) =>
                                update((p) => {
                                  p.methods.find((x) => x.id === m.id)!.label = e.target.value;
                                })
                              }
                            />
                          </label>
                          <button
                            type="button"
                            className="icon-button"
                            aria-label={`Remove recovery option ${m.label || 'unnamed'}`}
                            onClick={() => {
                              if (addingBackup === m.id) {
                                setAddingBackup(undefined);
                                setBackupName('');
                                setBackupAvailable(false);
                              }
                              update((p) => {
                                p.methods = p.methods.filter((x) => x.id !== m.id);
                              });
                            }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <Dependencies
                          plan={resources}
                          selected={m.requiresAll}
                          label="Recovery needs all of these"
                          onChange={(ids) =>
                            update((p) => {
                              p.methods.find((x) => x.id === m.id)!.requiresAll = ids;
                            })
                          }
                        />
                        <button
                          type="button"
                          className="text-button"
                          disabled={
                            draft.assets.length + (existing ? 0 : 1) >= 100 || !!addingBackup
                          }
                          onClick={() => setAddingBackup(m.id)}
                        >
                          <Plus size={14} />
                          Add a phone or backup
                        </button>
                        {addingBackup === m.id && (
                          <div className="inline-backup">
                            <label>
                              Backup name
                              <input
                                maxLength={100}
                                value={backupName}
                                placeholder="Independent backup email"
                                onChange={(e) => setBackupName(e.target.value)}
                              />
                            </label>
                            <label>
                              Backup type
                              <select
                                value={backupKind}
                                onChange={(e) => setBackupKind(e.target.value as Asset['kind'])}
                              >
                                <option value="artifact">Recovery material</option>
                                <option value="account">Backup account</option>
                                <option value="device">Phone or device</option>
                                <option value="person">Trusted person</option>
                              </select>
                            </label>
                            <label className="check-label">
                              <input
                                type="checkbox"
                                checked={backupAvailable}
                                onChange={(e) => setBackupAvailable(e.target.checked)}
                              />
                              We can access this backup now
                            </label>
                            <details>
                              <summary>Does this backup need another account?</summary>
                              <Dependencies
                                plan={resources}
                                selected={backupDependencies}
                                label="Retrieving this backup needs all of these"
                                onChange={setBackupDependencies}
                              />
                            </details>
                            <div className="button-row">
                              <button type="button" className="button" onClick={addBackup}>
                                Add backup
                              </button>
                              <button
                                type="button"
                                className="text-button"
                                onClick={() => {
                                  setAddingBackup(undefined);
                                  setBackupName('');
                                  setBackupAvailable(false);
                                  setBackupDependencies([]);
                                }}
                              >
                                Cancel backup
                              </button>
                            </div>
                          </div>
                        )}
                        <label>
                          Have you checked it?
                          <select
                            value={m.evidence}
                            onChange={(e) =>
                              update((p) => {
                                p.methods.find((x) => x.id === m.id)!.evidence = e.target
                                  .value as typeof m.evidence;
                              })
                            }
                          >
                            <option value="unknown">Not sure yet</option>
                            <option value="user-reported">We have set it up</option>
                            <option value="user-marked-tested">
                              We have tried it successfully
                            </option>
                          </select>
                        </label>
                        <details>
                          <summary>Procedure and last check</summary>
                          <label>
                            Recovery instructions
                            <textarea
                              maxLength={1000}
                              rows={2}
                              value={m.note}
                              onChange={(e) =>
                                update((p) => {
                                  p.methods.find((x) => x.id === m.id)!.note = e.target.value;
                                })
                              }
                            />
                          </label>
                          <label>
                            Last checked
                            <input
                              type="date"
                              value={m.reviewedAt}
                              onChange={(e) =>
                                update((p) => {
                                  p.methods.find((x) => x.id === m.id)!.reviewedAt = e.target.value;
                                })
                              }
                            />
                          </label>
                        </details>
                      </div>
                    ))}
                  </section>
                )}
                <details className="service-more">
                  <summary>More details</summary>
                  <label>
                    Service type
                    <select
                      value={asset.kind}
                      disabled={!!methods.length}
                      onChange={(e) =>
                        setAsset({ ...asset, kind: e.target.value as Asset['kind'] })
                      }
                    >
                      <option value="account">Account or service</option>
                      <option value="artifact">Recovery material</option>
                      <option value="device">Phone or device</option>
                      <option value="person">Trusted person</option>
                    </select>
                  </label>
                  <Dependencies
                    plan={resources}
                    selected={asset.requiresAll}
                    exclude={asset.id}
                    label="Normal access needs all of these"
                    onChange={(ids) => setAsset({ ...asset, requiresAll: ids })}
                  />
                  <label>
                    Notes
                    <input
                      maxLength={1000}
                      value={asset.note}
                      placeholder="Location or procedure; no passwords or recovery codes"
                      onChange={(e) => setAsset({ ...asset, note: e.target.value })}
                    />
                  </label>
                  {!existing && (
                    <label className="check-label">
                      <input
                        type="checkbox"
                        checked={include}
                        disabled={!plan || draft.activities.length >= 100}
                        onChange={(e) => setInclude(e.target.checked)}
                      />
                      Include this service in blackout results
                    </label>
                  )}
                </details>
              </>
            )}
            {error && (
              <div className="error-banner" role="alert">
                {error}
              </div>
            )}
          </fieldset>
          <footer>
            <button type="button" className="button" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button className="button primary" disabled={busy}>
              <Check size={16} />
              {busy ? 'Saving…' : 'Save to map'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
