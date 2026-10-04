import { useState } from 'react';
import { Copy, Play, Check, Download, Plus, Trash2, Users } from 'lucide-react';
import type { SessionView } from '../../packages/domain/session';
import { PlanMap } from './planner/PlanMap';
import { improvements } from '../../packages/planner/analysis';
import { unconfirmedRecovery } from '../../packages/planner/team';
import { teamReport } from '../../packages/planner/team-report';
import { api, post, readStorage, saveStorage } from './api';
import { ExportDialog, type ExportFile } from './planner/ExportDialog';
import type { RoomCredential } from './Room';

export function OrganisationRoom({
  view,
  token,
  connected,
  busy,
  pending,
  submit,
  reconcile,
  assign,
  load,
  onError,
  onExit,
}: {
  view: SessionView;
  token: string;
  connected: boolean;
  busy: boolean;
  pending: boolean;
  submit: (type: string, target?: string) => Promise<void>;
  reconcile: () => Promise<void>;
  assign: (id: string, role: string) => Promise<void>;
  load: () => Promise<void>;
  onError: (message: string) => void;
  onExit: () => void;
}) {
  const [exportFile, setExportFile] = useState<ExportFile>();
  const [inviteChoice, setInviteChoice] = useState('');
  const [ownerName, setOwnerName] = useState(''),
    [accounts, setAccounts] = useState<string[]>([]),
    [adding, setAdding] = useState(false),
    [copied, setCopied] = useState(false);
  const host = view.role === 'facilitator',
    plan = view.sharedPlan;
  if (view.role === 'pending' || !plan)
    return (
      <section className="panel waiting-team">
        <Users size={30} />
        <h1>Waiting for the host.</h1>
        <p>The host will assign the accounts you look after.</p>
        <button className="button" onClick={() => void load()}>
          Check assignment
        </button>
      </section>
    );
  const roles = view.customRoles,
    roleName = host
      ? 'Host'
      : view.role === 'administrator'
        ? 'All accounts'
        : view.role === 'observer'
          ? 'Observer'
          : (roles.find((r) => r.id === view.role)?.name ?? 'Owner');
  const localInvite = `${location.origin}/join/${view.id}`;
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  const inviteOptions =
    loopback && view.joinUrls?.length ? [...view.joinUrls, localInvite] : [localInvite];
  const invite = inviteOptions.includes(inviteChoice) ? inviteChoice : inviteOptions[0];
  const lost = view.phase === 'lobby' ? [] : (view.lostIds ?? []);
  const actions = view.actions.filter((a) => a.disabledReason !== 'Outcome already available');
  const candidates = view.phase === 'completed' ? improvements(plan, view.lostIds ?? []) : [];
  const confirmations = view.phase === 'completed' ? unconfirmedRecovery(plan, view.analysis) : [];
  async function addOwner(e: React.FormEvent) {
    e.preventDefault();
    if (adding) return;
    setAdding(true);
    onError('');
    try {
      await api(
        `/sessions/${view.id}/custom-roles`,
        post({ name: ownerName, responsibilities: ['administrator'], accountIds: accounts }),
        token,
      );
      setOwnerName('');
      setAccounts([]);
      await load();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setAdding(false);
    }
  }
  async function remove() {
    if (
      !confirm(
        'Delete this shared room and its server record? Download the summary first if you need it.',
      )
    )
      return;
    try {
      await api(`/sessions/${view.id}`, { method: 'DELETE' }, token);
      saveStorage(
        'blackout-rooms',
        readStorage<RoomCredential[]>('blackout-rooms', []).filter((r) => r.id !== view.id),
      );
      onExit();
    } catch (e) {
      onError((e as Error).message);
    }
  }
  const people = (
    <section className="panel organisation-people">
      <div className="section-heading">
        <h2>People and accounts</h2>
        <span className="tag">{view.participants.length} members</span>
      </div>
      {host && (
        <>
          {inviteOptions.length > 1 && (
            <label className="invite-address">
              Invite address
              <select
                value={invite}
                onChange={(e) => {
                  setInviteChoice(e.target.value);
                  setCopied(false);
                }}
              >
                {inviteOptions.map((url) => (
                  <option key={url} value={url}>
                    {url === localInvite
                      ? 'This computer only'
                      : `Local network · ${new URL(url).hostname}`}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="team-invite">
            <label>
              Invite link
              <input readOnly value={invite} onFocus={(e) => e.target.select()} />
            </label>
            <button
              className="button"
              onClick={() => {
                void navigator.clipboard
                  .writeText(invite)
                  .then(() => setCopied(true))
                  .catch(() => onError('Copy the invite link from the field.'));
              }}
            >
              <Copy size={15} />
              {copied ? 'Copied' : 'Copy link'}
            </button>
          </div>
          <p className="small muted">
            {invite === localInvite && loopback
              ? 'This link works on this computer only.'
              : 'Same local network · keep this laptop running.'}
          </p>
        </>
      )}
      <div className="owner-assignment-list">
        {view.participants.map((p) => (
          <div key={p.id}>
            <strong>{p.name}</strong>
            {host && p.role !== 'facilitator' ? (
              <label className="owner-assignment">
                Accounts for {p.name}
                <select
                  disabled={busy || pending || view.phase === 'completed'}
                  value={p.role}
                  onChange={(e) => void assign(p.id, e.target.value)}
                >
                  <option value="pending">Waiting for assignment</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                  <option value="administrator">All accounts</option>
                  <option value="observer">Observer</option>
                </select>
              </label>
            ) : (
              <span>
                {p.role === 'facilitator'
                  ? 'Host'
                  : p.role === 'pending'
                    ? 'Waiting'
                    : p.role === 'observer'
                      ? 'Observer'
                      : p.role === 'administrator'
                        ? 'All accounts'
                        : roles.find((r) => r.id === p.role)?.name}
              </span>
            )}
          </div>
        ))}
      </div>
      {host && view.phase === 'lobby' && (
        <details className="simple-details">
          <summary>Add a person or responsibility</summary>
          <form onSubmit={(e) => void addOwner(e)}>
            <label>
              Person or responsibility name
              <input
                required
                maxLength={60}
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
              />
            </label>
            <fieldset className="dependency-picker">
              <legend>Accounts they can handle in this check</legend>
              {plan.assets
                .filter((a) => a.kind === 'account')
                .map((a) => (
                  <label className="check-label" key={a.id}>
                    <input
                      type="checkbox"
                      checked={accounts.includes(a.id)}
                      onChange={(e) =>
                        setAccounts(
                          e.target.checked
                            ? [...accounts, a.id]
                            : accounts.filter((id) => id !== a.id),
                        )
                      }
                    />
                    {a.label}
                  </label>
                ))}
            </fieldset>
            <button className="button" disabled={adding || !accounts.length}>
              <Plus size={15} />
              Add responsibility
            </button>
          </form>
        </details>
      )}
    </section>
  );
  return (
    <div className="organisation-room">
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            {view.phase === 'completed' ? 'TEAM CHECK / SUMMARY' : 'YOUR MAP / TEAM CHECK'}
          </span>
          <h1>{plan.name}</h1>
          <p>
            {roleName} · {connected ? 'Live updates connected' : 'Updates disconnected'}
          </p>
        </div>
        <div className="button-row">
          {host && view.phase === 'lobby' && (
            <button
              className="button primary"
              disabled={busy || pending}
              onClick={() => void submit('start')}
            >
              <Play size={16} />
              Start team check
            </button>
          )}
          {host && ['running', 'paused'].includes(view.phase) && (
            <button
              className="button primary"
              disabled={busy || pending}
              onClick={() => void submit('complete')}
            >
              <Check size={16} />
              Finish team check
            </button>
          )}
          {view.phase === 'completed' && (
            <button
              className="button"
              onClick={() =>
                setExportFile({
                  content: teamReport(view),
                  name: 'blackout-team-summary.html',
                  type: 'text/html',
                  readable: true,
                  title: 'Your team check summary',
                })
              }
            >
              <Download size={16} />
              Save check summary
            </button>
          )}
        </div>
      </div>
      <div className="team-room-note">
        Recovery actions here are simulated.{' '}
        <strong>
          {view.phase === 'lobby' ? 'Planned loss: ' : 'Selected loss: '}
          {plan.assets
            .filter((a) => view.lostIds?.includes(a.id))
            .map((a) => a.label)
            .join(' + ')}
        </strong>
        {plan.proposed && <span>Proposed setup — changes still need implementation.</span>}
      </div>
      {view.phase === 'paused' && (
        <div className="notice-banner">Check paused. The host can resume it in Room controls.</div>
      )}
      {pending && (
        <div className="notice-banner">
          An earlier action needs checking.
          <button className="text-button" disabled={busy} onClick={() => void reconcile()}>
            Check its outcome
          </button>
        </div>
      )}
      {view.phase === 'lobby' ? (
        people
      ) : (
        <details className="simple-details">
          <summary>People and assignments</summary>
          {people}
        </details>
      )}
      <div className="sandbox-counts" aria-label="Shared work status">
        <span>
          <i />
          {view.analysis.targets.filter((t) => t.current).length} available now
        </span>
        <span>
          <i />
          {view.analysis.targets.filter((t) => !t.current && t.reachable).length} with recovery
          steps
        </span>
        <span>
          <i />
          {view.analysis.targets.filter((t) => !t.reachable).length} without a route
        </span>
      </div>
      <PlanMap plan={plan} lost={lost} analysis={view.analysis} />
      {view.phase === 'running' && (
        <section className="team-recovery-actions">
          <h2>Recovery steps for {roleName}</h2>
          {actions.length ? (
            actions.map((a) => (
              <article className="panel" key={a.id}>
                <div>
                  <h3>{a.label}</h3>
                  {a.disabledReason && <p className="small">{a.disabledReason}</p>}
                </div>
                <button
                  className="button"
                  disabled={busy || pending || !!a.disabledReason}
                  onClick={() => void submit('act', a.id)}
                >
                  Record simulated recovery
                </button>
              </article>
            ))
          ) : (
            <p className="small muted">
              No remaining recovery steps for your assignment. Review the gaps with your team.
            </p>
          )}
        </section>
      )}
      {view.phase === 'completed' && (
        <section className="team-followups">
          <h2>What to prepare next</h2>
          {confirmations.map((method) => {
            const account = plan.assets.find((a) => a.id === method.accountId)!;
            return (
              <article className="panel" key={method.id}>
                <h3>Confirm recovery for {account.label}</h3>
                <p className="small">
                  {account.owner || plan.owner || 'Account owner'} · {method.label}
                </p>
                <p className="small">
                  Confirm the procedure with the owner and provider, then record the actual outcome
                  in your private plan.
                </p>
              </article>
            );
          })}
          {!!candidates.length && (
            <details open={!confirmations.length}>
              <summary>Other possible preparations</summary>
              {candidates.map((c) => (
                <article className="panel" key={c.id}>
                  <h3>{c.title}</h3>
                  <p className="small">+{c.gain} activities could become recoverable.</p>
                  <details>
                    <summary>Requirements to confirm</summary>
                    <ul>
                      {c.addedAssumptions.map((a) => (
                        <li key={a}>{a}</li>
                      ))}
                    </ul>
                  </details>
                </article>
              ))}
            </details>
          )}
          {!candidates.length && !confirmations.length && (
            <p>
              Confirm the recorded methods with their owners and record the real test outcomes in
              your private plan.
            </p>
          )}
        </section>
      )}
      <details className="simple-details">
        <summary>Recorded timeline ({view.events.length})</summary>
        <ol className="team-timeline">
          {view.events.map((e) => (
            <li key={e.id}>
              <strong>{e.actor}</strong>
              <span>{e.label}</span>
            </li>
          ))}
        </ol>
      </details>
      {host && (
        <details className="simple-details">
          <summary>Room controls</summary>
          {view.phase === 'running' && (
            <button
              className="button"
              disabled={busy || pending}
              onClick={() => void submit('pause')}
            >
              Pause check
            </button>
          )}
          {view.phase === 'paused' && (
            <button
              className="button"
              disabled={busy || pending}
              onClick={() => void submit('resume')}
            >
              Resume check
            </button>
          )}
          <button
            className="text-button delete-room"
            disabled={busy || pending}
            onClick={() => void remove()}
          >
            <Trash2 size={15} />
            Delete shared room
          </button>
        </details>
      )}
      {exportFile && <ExportDialog file={exportFile} onClose={() => setExportFile(undefined)} />}
    </div>
  );
}
