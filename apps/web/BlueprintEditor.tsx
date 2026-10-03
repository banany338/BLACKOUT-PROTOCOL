import { useEffect, useRef, useState } from 'react';
import { X, Check, SlidersHorizontal } from 'lucide-react';
import { blueprintSchema, type Blueprint } from '../../packages/domain/model';
import { factLabel } from '../../packages/domain/engine';

export function BlueprintEditor({
  value,
  onSave,
  onClose,
}: {
  value: Blueprint;
  onSave: (b: Blueprint) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(() => structuredClone(value));
  const [tab, setTab] = useState<'resources' | 'methods'>('resources');
  const [active, setActive] = useState(0),
    [error, setError] = useState('');
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>('.editor-modal');
    dialog?.querySelector<HTMLElement>('input, button')?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !dialog) return;
      const controls = [
        ...dialog.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input, select, textarea, [tabindex="0"]',
        ),
      ].filter((el) => el.getClientRects().length);
      const first = controls[0],
        last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', trap);
    return () => {
      document.removeEventListener('keydown', trap);
      previous?.focus();
    };
  }, []);
  const update = (fn: (b: Blueprint) => void) =>
    setDraft((prev) => {
      const next = structuredClone(prev);
      fn(next);
      return next;
    });
  const resource = draft.resources[active] ?? draft.resources[0],
    rule = draft.rules[active] ?? draft.rules[0];
  const allFacts = [
    ...new Set([...draft.initialFacts, ...draft.rules.flatMap((r) => r.grants)]),
  ].sort();
  function save() {
    const result = blueprintSchema.safeParse({ ...draft, version: value.version + 1 });
    if (!result.success) {
      setError(result.error.issues.map((i) => i.message).join('; '));
      return;
    }
    onSave(result.data);
  }
  return (
    <div
      className="modal-backdrop"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <section
        className="editor-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="editor-title"
      >
        <header>
          <div>
            <span className="eyebrow">
              <SlidersHorizontal size={14} /> ORGANISATION MODEL
            </span>
            <h2 id="editor-title">Edit your blueprint</h2>
          </div>
          <button className="icon-button" aria-label="Close editor" onClick={onClose}>
            <X />
          </button>
        </header>
        <div className="editor-intro">
          <label>
            Organisation name
            <input
              value={draft.name}
              maxLength={100}
              onChange={(e) =>
                update((b) => {
                  b.name = e.target.value;
                })
              }
            />
          </label>
          <p>
            Record arrangements and ownership. Keep passwords and recovery codes out of this model.
          </p>
        </div>
        <div className="segmented">
          <button
            className={tab === 'resources' ? 'active' : ''}
            onClick={() => {
              setTab('resources');
              setActive(0);
            }}
          >
            Resources
          </button>
          <button
            className={tab === 'methods' ? 'active' : ''}
            onClick={() => {
              setTab('methods');
              setActive(0);
            }}
          >
            Recovery methods
          </button>
        </div>
        <div className="editor-body">
          <nav aria-label="Blueprint items">
            {(tab === 'resources' ? draft.resources : draft.rules).map((x, i) => (
              <button
                key={x.id}
                className={i === active ? 'active' : ''}
                onClick={() => setActive(i)}
              >
                {x.label}
              </button>
            ))}
          </nav>
          <div className="editor-form">
            {tab === 'resources' ? (
              <>
                <label>
                  Resource name
                  <input
                    value={resource.label}
                    onChange={(e) =>
                      update((b) => {
                        b.resources[active].label = e.target.value;
                      })
                    }
                  />
                </label>
                <label>
                  Owner
                  <input
                    value={resource.owner}
                    onChange={(e) =>
                      update((b) => {
                        b.resources[active].owner = e.target.value;
                      })
                    }
                  />
                </label>
                <label>
                  Notes
                  <textarea
                    rows={4}
                    value={resource.description}
                    onChange={(e) =>
                      update((b) => {
                        b.resources[active].description = e.target.value;
                      })
                    }
                  />
                </label>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={draft.initialFacts.includes(resource.fact)}
                    onChange={(e) =>
                      update((b) => {
                        b.initialFacts = e.target.checked
                          ? [...new Set([...b.initialFacts, resource.fact])]
                          : b.initialFacts.filter((f) => f !== resource.fact);
                      })
                    }
                  />
                  Available before the incident
                </label>
                <p className="muted">
                  A method may also make this resource available through its prerequisites.
                </p>
              </>
            ) : (
              <>
                <label>
                  Method name
                  <input
                    value={rule.label}
                    onChange={(e) =>
                      update((b) => {
                        b.rules[active].label = e.target.value;
                      })
                    }
                  />
                </label>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    onChange={(e) =>
                      update((b) => {
                        b.rules[active].enabled = e.target.checked;
                      })
                    }
                  />
                  Included in this model
                </label>
                <label>
                  Evidence
                  <select
                    value={rule.evidence}
                    onChange={(e) =>
                      update((b) => {
                        b.rules[active].evidence = e.target.value as typeof rule.evidence;
                      })
                    }
                  >
                    <option value="fixture">Fictional fixture</option>
                    <option value="user-marked-tested">Marked tested by owner</option>
                    <option value="user-reported">Reported, not tested</option>
                    <option value="unknown">Needs confirmation</option>
                  </select>
                </label>
                <label>
                  Source and assumptions
                  <textarea
                    value={rule.sourceNote}
                    rows={3}
                    onChange={(e) =>
                      update((b) => {
                        b.rules[active].sourceNote = e.target.value;
                      })
                    }
                  />
                </label>
                <fieldset>
                  <legend>Requires all selected capabilities</legend>
                  <div className="fact-checks">
                    {allFacts
                      .filter((f) => !rule.grants.includes(f))
                      .map((f) => (
                        <label className="check-label" key={f}>
                          <input
                            type="checkbox"
                            checked={rule.requiresAll.includes(f)}
                            onChange={(e) =>
                              update((b) => {
                                b.rules[active].requiresAll = e.target.checked
                                  ? [...rule.requiresAll, f]
                                  : rule.requiresAll.filter((x) => x !== f);
                              })
                            }
                          />
                          {factLabel(f, draft)}
                        </label>
                      ))}
                  </div>
                </fieldset>
              </>
            )}
          </div>
        </div>
        {error && (
          <p className="error-banner" role="alert">
            {error}
          </p>
        )}
        <footer>
          <span>Saving creates model version {value.version + 1}.</span>
          <button className="button primary" onClick={save}>
            <Check size={16} />
            Save blueprint
          </button>
        </footer>
      </section>
    </div>
  );
}
