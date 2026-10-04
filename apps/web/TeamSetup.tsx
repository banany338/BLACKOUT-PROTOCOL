import { useState } from 'react';
import { Plus, Users } from 'lucide-react';
import { roles, type Role } from '../../packages/domain/model';
import {
  exerciseRoleName,
  responsibilityNames,
  type SessionView,
} from '../../packages/domain/session';

export function TeamSetup({
  view,
  onAssign,
  onAddRole,
}: {
  view: SessionView;
  onAssign: (id: string, role: string) => Promise<void>;
  onAddRole: (name: string, responsibilities: Role[]) => Promise<void>;
}) {
  const [adding, setAdding] = useState(false),
    [name, setName] = useState(''),
    [responsibilities, setResponsibilities] = useState<Role[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const host = view.role === 'facilitator';
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await onAddRole(name.trim(), responsibilities);
      setName('');
      setResponsibilities([]);
      setAdding(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel team-setup">
      <span className="eyebrow">
        <Users size={15} />
        PEOPLE IN THIS PRACTICE
      </span>
      <h2>Who handles what?</h2>
      <p>
        A role decides which clues and actions a person sees. It can match any job title in your
        team. Several people can share a role.
      </p>
      <div className="responsibility-guide">
        <div>
          <strong>Account recovery</strong>
          <span>Regain access and secure the account.</span>
        </div>
        <div>
          <strong>Payment checks</strong>
          <span>Check whether an urgent payment request is genuine.</span>
        </div>
        <div>
          <strong>Team communication</strong>
          <span>Share trusted contacts and keep people informed.</span>
        </div>
      </div>
      {view.participants.map((p) => (
        <div className="participant" key={p.id}>
          <span className="avatar">{p.name[0].toUpperCase()}</span>
          <div>
            <strong>
              {p.name}
              {p.id === view.me.id ? ' (you)' : ''}
            </strong>
            <small>{exerciseRoleName(view, p.role)}</small>
          </div>
          {host && p.role !== 'facilitator' ? (
            <select
              aria-label={`Role for ${p.name}`}
              value={p.role}
              onChange={(e) => void onAssign(p.id, e.target.value)}
            >
              <option value="pending">Choose a role</option>
              <option value="administrator">Account lead</option>
              <option value="finance">Payments lead</option>
              <option value="coordinator">Team coordinator</option>
              {view.customRoles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
              <option value="observer">Observer · shared clues only</option>
            </select>
          ) : null}
        </div>
      ))}
      {host && view.phase === 'lobby' && (
        <>
          {!adding ? (
            <button className="button" onClick={() => setAdding(true)}>
              <Plus size={16} />
              Add your own role
            </button>
          ) : (
            <form className="custom-role-form" onSubmit={(e) => void submit(e)}>
              <label>
                Role name
                <input
                  required
                  maxLength={60}
                  placeholder="For example: Volunteer lead"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <fieldset>
                <legend>What does this role handle?</legend>
                {roles.map((role) => (
                  <label className="check-label" key={role}>
                    <input
                      type="checkbox"
                      checked={responsibilities.includes(role)}
                      onChange={(e) =>
                        setResponsibilities(
                          e.target.checked
                            ? [...responsibilities, role]
                            : responsibilities.filter((r) => r !== role),
                        )
                      }
                    />
                    {responsibilityNames[role]}
                  </label>
                ))}
              </fieldset>
              <p className="small muted">
                Choose one or more. This role will receive the matching clues and decisions in this
                story.
              </p>
              {error && <p role="alert">{error}</p>}
              <div className="button-row">
                <button
                  className="button primary"
                  disabled={busy || !name.trim() || !responsibilities.length}
                >
                  Save role
                </button>
                <button type="button" className="button" onClick={() => setAdding(false)}>
                  Cancel
                </button>
              </div>
            </form>
          )}
          {view.customRoles.length > 0 && (
            <ul className="custom-role-list">
              {view.customRoles.map((r) => (
                <li key={r.id}>
                  <strong>{r.name}</strong>
                  <span>{r.responsibilities.map((x) => responsibilityNames[x]).join(' · ')}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {host && (
        <p className="small muted">
          Practising alone? You already have every responsibility. Start when you are ready.
        </p>
      )}
    </section>
  );
}
