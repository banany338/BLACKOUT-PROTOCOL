import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Plus, Trash2, X } from 'lucide-react';
import { newId, planSchema, type Plan } from '../../../packages/planner/model';

export function Dependencies({
  plan,
  selected,
  onChange,
  exclude,
  label,
}: {
  plan: Plan;
  selected: string[];
  onChange: (ids: string[]) => void;
  exclude?: string;
  label: string;
}) {
  return (
    <fieldset className="dependency-picker">
      <legend>{label}</legend>
      <div>
        {plan.assets
          .filter((a) => a.id !== exclude)
          .map((a) => (
            <label className="check-label" key={a.id}>
              <input
                type="checkbox"
                checked={selected.includes(a.id)}
                onChange={(e) =>
                  onChange(
                    e.target.checked ? [...selected, a.id] : selected.filter((id) => id !== a.id),
                  )
                }
              />
              {a.label || 'Unnamed resource'}
              <small>
                {a.kind === 'artifact'
                  ? 'backup'
                  : a.kind === 'device'
                    ? 'device'
                    : a.kind === 'person'
                      ? 'person'
                      : 'account'}
              </small>
            </label>
          ))}
      </div>
    </fieldset>
  );
}
export function PlanEditor({
  value,
  onSave,
  onClose,
  busy,
}: {
  value: Plan;
  onSave: (plan: Plan) => Promise<void>;
  onClose: () => void;
  busy: boolean;
}) {
  const [draft, setDraft] = useState(() => structuredClone(value)),
    [step, setStep] = useState(0),
    [error, setError] = useState('');
  const dialog = useRef<HTMLElement>(null);
  const returnFocus = useRef(document.activeElement as HTMLElement | null);
  const update = (fn: (p: Plan) => void) =>
    setDraft((prev) => {
      const next = structuredClone(prev);
      fn(next);
      return next;
    });
  useEffect(() => {
    const previous = returnFocus.current;
    dialog.current?.focus();
    return () => previous?.focus();
  }, []);
  function trap(e: React.KeyboardEvent) {
    if (e.key === 'Escape' && !busy) onClose();
    if (e.key !== 'Tab') return;
    const controls = Array.from(
      dialog.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled),input:not(:disabled),select,textarea,[tabindex="0"]',
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
  function removeAsset(id: string) {
    update((p) => {
      p.assets = p.assets.filter((a) => a.id !== id);
      p.assets.forEach((a) => (a.requiresAll = a.requiresAll.filter((x) => x !== id)));
      p.methods = p.methods
        .filter((m) => m.accountId !== id)
        .map((m) => ({ ...m, requiresAll: m.requiresAll.filter((x) => x !== id) }));
      p.activities.forEach((a) => (a.requiresAll = a.requiresAll.filter((x) => x !== id)));
    });
  }
  async function save() {
    const result = planSchema.safeParse({ ...draft, updatedAt: new Date().toISOString() });
    if (!result.success) {
      setError(result.error.issues.map((i) => `${i.path.join(' → ')}: ${i.message}`).join('\n'));
      return;
    }
    try {
      await onSave(result.data);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <div className="modal-backdrop" onKeyDown={trap}>
      <section
        className="setup-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="setup-title"
        tabIndex={-1}
        ref={dialog}
      >
        <header>
          <div>
            <span className="eyebrow">WRITE YOUR PLAN</span>
            <h2 id="setup-title">{value.name ? 'Edit your plan' : 'Create your plan'}</h2>
          </div>
          <button
            className="icon-button"
            aria-label="Close setup"
            onClick={onClose}
            disabled={busy}
          >
            <X />
          </button>
        </header>
        <nav aria-label="Setup steps" className="setup-steps">
          {['Organisation', 'Accounts & backups', 'Ways to get back in', 'Important work'].map(
            (name, i) => (
              <button key={name} className={step === i ? 'active' : ''} onClick={() => setStep(i)}>
                <span>0{i + 1}</span>
                {name}
              </button>
            ),
          )}
        </nav>
        <div className="setup-content">
          {step === 0 && (
            <>
              <p>Use names or aliases. Keep passwords and recovery codes out.</p>
              <label>
                Organisation name
                <input
                  autoFocus
                  maxLength={100}
                  value={draft.name}
                  placeholder="Your organisation"
                  onChange={(e) =>
                    update((p) => {
                      p.name = e.target.value;
                    })
                  }
                />
              </label>
              <label>
                Plan owner
                <input
                  maxLength={100}
                  value={draft.owner}
                  placeholder="Person or team responsible for reviewing this plan"
                  onChange={(e) =>
                    update((p) => {
                      p.owner = e.target.value;
                    })
                  }
                />
              </label>
              <label>
                Plan describes
                <select
                  value={draft.proposed ? 'proposed' : 'current'}
                  onChange={(e) =>
                    update((p) => {
                      p.proposed = e.target.value === 'proposed';
                    })
                  }
                >
                  <option value="current">Current arrangements, as reported by us</option>
                  <option value="proposed">Proposed changes still to implement</option>
                </select>
              </label>
            </>
          )}
          {step === 1 && (
            <>
              <h3>Which accounts and backups do you use?</h3>
              <p>Include the people, devices and backups they depend on.</p>
              {draft.assets.map((a, i) => (
                <article className="setup-item" key={a.id}>
                  <div className="setup-item-heading">
                    <span className="eyebrow">ACCOUNT / BACKUP {i + 1}</span>
                    <button
                      className="icon-button"
                      aria-label={`Remove ${a.label}`}
                      disabled={draft.assets.length === 1}
                      onClick={() => removeAsset(a.id)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <div className="form-grid">
                    <label>
                      Name or alias
                      <input
                        maxLength={100}
                        value={a.label}
                        onChange={(e) =>
                          update((p) => {
                            p.assets[i].label = e.target.value;
                          })
                        }
                      />
                    </label>
                    <label>
                      Type
                      <select
                        value={a.kind}
                        onChange={(e) =>
                          update((p) => {
                            p.assets[i].kind = e.target.value as typeof a.kind;
                          })
                        }
                      >
                        <option value="account">Account</option>
                        <option value="device">Phone or computer</option>
                        <option value="artifact">Recovery codes or instructions</option>
                        <option value="person">Person who can help</option>
                      </select>
                    </label>
                    <label>
                      Owner
                      <input
                        value={a.owner}
                        maxLength={100}
                        placeholder={draft.owner || 'Assign someone'}
                        onChange={(e) =>
                          update((p) => {
                            p.assets[i].owner = e.target.value;
                          })
                        }
                      />
                    </label>
                    <label>
                      Location / access note
                      <input
                        maxLength={1000}
                        value={a.note}
                        placeholder="Where authorised people can find it; no secrets"
                        onChange={(e) =>
                          update((p) => {
                            p.assets[i].note = e.target.value;
                          })
                        }
                      />
                    </label>
                  </div>
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={a.available}
                      onChange={(e) =>
                        update((p) => {
                          p.assets[i].available = e.target.checked;
                        })
                      }
                    />
                    I can access this now
                  </label>
                  <details>
                    <summary>What do you need to access it? ({a.requiresAll.length})</summary>
                    <Dependencies
                      plan={draft}
                      selected={a.requiresAll}
                      exclude={a.id}
                      label="I need all of these to access it"
                      onChange={(ids) =>
                        update((p) => {
                          p.assets[i].requiresAll = ids;
                        })
                      }
                    />
                  </details>
                </article>
              ))}
              <button
                className="button"
                disabled={draft.assets.length >= 100}
                onClick={() =>
                  update((p) => {
                    p.assets.push({
                      id: newId(),
                      label: '',
                      kind: 'account',
                      owner: p.owner,
                      available: false,
                      requiresAll: [],
                      note: '',
                    });
                  })
                }
              >
                <Plus size={16} />
                Add an account or backup
              </button>
            </>
          )}
          {step === 2 && (
            <>
              <h3>How would you regain access?</h3>
              <p>Record the recovery methods you have set up.</p>
              {draft.methods.length === 0 && (
                <div className="empty-card">No recovery methods yet.</div>
              )}
              {draft.methods.map((m, i) => (
                <article className="setup-item" key={m.id}>
                  <div className="setup-item-heading">
                    <span className="eyebrow">METHOD {i + 1}</span>
                    <button
                      className="icon-button"
                      aria-label={`Remove method ${i + 1}`}
                      onClick={() =>
                        update((p) => {
                          p.methods.splice(i, 1);
                        })
                      }
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <div className="form-grid">
                    <label>
                      Which account is this for?
                      <select
                        value={m.accountId}
                        onChange={(e) =>
                          update((p) => {
                            p.methods[i].accountId = e.target.value;
                          })
                        }
                      >
                        {draft.assets
                          .filter((a) => a.kind === 'account')
                          .map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.label}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label>
                      Name this recovery method
                      <input
                        maxLength={150}
                        value={m.label}
                        placeholder="Provider recovery through the backup email"
                        onChange={(e) =>
                          update((p) => {
                            p.methods[i].label = e.target.value;
                          })
                        }
                      />
                    </label>
                    <label>
                      How sure are you?
                      <select
                        value={m.evidence}
                        onChange={(e) =>
                          update((p) => {
                            p.methods[i].evidence = e.target.value as typeof m.evidence;
                          })
                        }
                      >
                        <option value="unknown">Not sure yet</option>
                        <option value="user-reported">I have set this up</option>
                        <option value="user-marked-tested">I have tried this successfully</option>
                      </select>
                    </label>
                    <label>
                      When did you last check?
                      <input
                        type="date"
                        value={m.reviewedAt}
                        onChange={(e) =>
                          update((p) => {
                            p.methods[i].reviewedAt = e.target.value;
                          })
                        }
                      />
                    </label>
                  </div>
                  <Dependencies
                    plan={draft}
                    selected={m.requiresAll}
                    label="To use this method, I need all of these"
                    onChange={(ids) =>
                      update((p) => {
                        p.methods[i].requiresAll = ids;
                      })
                    }
                  />
                  <label>
                    How to do it / what you tried
                    <textarea
                      maxLength={1000}
                      rows={2}
                      value={m.note}
                      placeholder="Provider procedure, what was tested, and any unresolved condition"
                      onChange={(e) =>
                        update((p) => {
                          p.methods[i].note = e.target.value;
                        })
                      }
                    />
                  </label>
                </article>
              ))}
              <button
                className="button"
                disabled={
                  !draft.assets.some((a) => a.kind === 'account') || draft.methods.length >= 300
                }
                onClick={() =>
                  update((p) => {
                    p.methods.push({
                      id: newId(),
                      accountId: p.assets.find((a) => a.kind === 'account')!.id,
                      label: '',
                      requiresAll: [],
                      evidence: 'unknown',
                      note: '',
                      reviewedAt: '',
                    });
                  })
                }
              >
                <Plus size={16} />
                Add recovery method
              </button>
            </>
          )}
          {step === 3 && (
            <>
              <h3>What work must continue?</h3>
              <p>Choose the accounts each activity needs.</p>
              {draft.activities.map((a, i) => (
                <article className="setup-item" key={a.id}>
                  <div className="setup-item-heading">
                    <span className="eyebrow">IMPORTANT WORK {i + 1}</span>
                    <button
                      className="icon-button"
                      aria-label={`Remove activity ${i + 1}`}
                      disabled={draft.activities.length === 1}
                      onClick={() =>
                        update((p) => {
                          p.activities.splice(i, 1);
                        })
                      }
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <div className="form-grid">
                    <label>
                      Name of the work
                      <input
                        maxLength={100}
                        value={a.label}
                        onChange={(e) =>
                          update((p) => {
                            p.activities[i].label = e.target.value;
                          })
                        }
                      />
                    </label>
                    <label>
                      Owner
                      <input
                        maxLength={100}
                        value={a.owner}
                        placeholder={draft.owner}
                        onChange={(e) =>
                          update((p) => {
                            p.activities[i].owner = e.target.value;
                          })
                        }
                      />
                    </label>
                  </div>
                  <Dependencies
                    plan={draft}
                    selected={a.requiresAll}
                    label="To do this work, I need all of these"
                    onChange={(ids) =>
                      update((p) => {
                        p.activities[i].requiresAll = ids;
                      })
                    }
                  />
                </article>
              ))}
              <button
                className="button"
                disabled={draft.activities.length >= 100}
                onClick={() =>
                  update((p) => {
                    p.activities.push({ id: newId(), label: '', owner: p.owner, requiresAll: [] });
                  })
                }
              >
                <Plus size={16} />
                Add activity
              </button>
            </>
          )}
          {error && (
            <div className="error-banner" role="alert" style={{ whiteSpace: 'pre-wrap' }}>
              {error}
            </div>
          )}
        </div>
        <footer>
          <button className="button" disabled={step === 0} onClick={() => setStep(step - 1)}>
            <ArrowLeft size={15} />
            Back
          </button>
          <span>
            {draft.assets.length} resources · {draft.methods.length} methods ·{' '}
            {draft.activities.length} activities
          </span>
          {step < 3 ? (
            <button className="button primary" onClick={() => setStep(step + 1)}>
              Continue
              <ArrowRight size={15} />
            </button>
          ) : (
            <button className="button primary" disabled={busy} onClick={() => void save()}>
              <Check size={16} />
              {busy ? 'Encrypting…' : 'Save and check a problem'}
            </button>
          )}
        </footer>
      </section>
    </div>
  );
}
