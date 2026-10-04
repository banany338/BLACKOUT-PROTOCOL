import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import {
  Play,
  Pause,
  Check,
  Copy,
  Radio,
  Eye,
  Users,
  Clock3,
  ShieldCheck,
  AlertTriangle,
  Download,
  RefreshCw,
  LockKeyhole,
  Share2,
  CheckCircle2,
} from 'lucide-react';
import type { Blueprint, Role } from '../../packages/domain/model';
import { withRecoveryKit } from '../../packages/domain/fixture';
import {
  exerciseRoleName,
  responsibilityNames,
  type Command,
  type SessionView,
} from '../../packages/domain/session';
import { TeamSetup } from './TeamSetup';
import { formatElapsed } from '../../packages/domain/debrief';
import {
  api,
  post,
  readStorage,
  saveStorage,
  download,
  downloadPlan,
  actionId,
  isRejected,
  ApiError,
} from './api';
import { OrganisationRoom } from './OrganisationRoom';

export type RoomCredential = {
  id: string;
  token: string;
  name: string;
  createdAt: string;
  mode?: 'organisation';
};
const chapterNames = [
  'Briefing',
  'The lockout',
  'Conflicting request',
  'Operational pressure',
  'Recovery',
];
export function Room({
  id,
  credential,
  onCreate,
  onBack,
  onError,
  onReturnToPlan,
}: {
  id: string;
  credential?: RoomCredential;
  onCreate: (b: Blueprint) => void;
  onBack: () => void;
  onError: (s: string) => void;
  onReturnToPlan: () => void;
}) {
  const [view, setView] = useState<SessionView>(),
    [connected, setConnected] = useState(false),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(''),
    [digest, setDigest] = useState('');
  const [removed, setRemoved] = useState(false);
  const request = useRef(0);
  const load = useCallback(async () => {
    if (!credential) return;
    const order = ++request.current;
    try {
      const result = await api<SessionView>(`/sessions/${id}/state`, {}, credential.token);
      if (order === request.current) setView(result);
    } catch (e) {
      if (e instanceof ApiError && (e.status === 404 || e.status === 401)) {
        setView(undefined);
        setRemoved(true);
        onError('');
        return;
      }
      onError((e as Error).message);
    }
  }, [id, credential?.token, onError]);
  useEffect(() => {
    if (!credential) return;
    void load();
    const socket = io({ auth: { sessionId: id, token: credential.token } });
    socket.on('connect', () => {
      setConnected(true);
      void load();
    });
    socket.on('changed', () => {
      void load();
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => setConnected(false));
    return () => {
      socket.disconnect();
    };
  }, [load, id, credential?.token]);

  const pendingKey = `blackout-pending-${id}`;
  const [pending, setPending] = useState<Command | null>(() => readStorage(pendingKey, null));
  function clearPending() {
    setPending(null);
    localStorage.removeItem(pendingKey);
  }
  async function submit(type: string, target?: string) {
    if (!view || !credential || busy || pending) return;
    const command = { id: actionId(), revision: view.revision, type, target };
    setPending(command);
    saveStorage(pendingKey, command);
    setBusy(true);
    setNotice('');
    onError('');
    try {
      await api(`/sessions/${id}/commands`, post(command), credential.token);
      clearPending();
      await load();
    } catch (e) {
      if (isRejected(e)) {
        clearPending();
      } else {
        try {
          const result = await api<{ accepted: boolean }>(
            `/sessions/${id}/actions/${command.id}`,
            {},
            credential.token,
          );
          if (result.accepted) clearPending();
        } catch {
          /* Retain the exact command until the server confirms its outcome. */
        }
      }
      onError((e as Error).message);
      await load();
    } finally {
      setBusy(false);
    }
  }
  async function reconcile() {
    if (!pending || !credential) return;
    setBusy(true);
    try {
      const result = await api<{ accepted: boolean }>(
        `/sessions/${id}/actions/${pending.id}`,
        {},
        credential.token,
      );
      if (!result.accepted) await api(`/sessions/${id}/commands`, post(pending), credential.token);
      clearPending();
      setNotice(
        result.accepted
          ? 'Your earlier action was already recorded.'
          : 'Your action is now recorded.',
      );
      await load();
    } catch (e) {
      onError((e as Error).message);
      if (isRejected(e)) clearPending();
    } finally {
      setBusy(false);
    }
  }
  async function assign(participantId: string, role: string) {
    try {
      onError('');
      await api(`/sessions/${id}/roles`, post({ participantId, role }), credential!.token);
      await load();
    } catch (e) {
      onError((e as Error).message);
    }
  }
  async function exportRecord() {
    try {
      const record = await api<{ content: string; sha256: string }>(
        `/sessions/${id}/export`,
        {},
        credential!.token,
      );
      download(record.content, 'blackout-exercise.json', 'application/json');
      setDigest(record.sha256);
    } catch (e) {
      onError((e as Error).message);
    }
  }
  if (!credential)
    return (
      <div className="empty-state">
        <LockKeyhole size={32} />
        <h2>Join this room</h2>
        <p>This browser has no saved membership for this room.</p>
        <a className="button primary" href={`/join/${id}`}>
          Enter the room
        </a>
      </div>
    );
  if (removed)
    return (
      <section className="empty-state">
        <h1>Room no longer available.</h1>
        <p>It was deleted or this browser’s membership is no longer valid.</p>
        <button className="button" onClick={onReturnToPlan}>
          Back to my plan
        </button>
      </section>
    );
  if (!view)
    return (
      <div className="empty-state">
        <Radio className="pulse" />
        <h2>Opening your exercise…</h2>
        <button className="button" onClick={() => void load()}>
          Retry connection
        </button>
      </div>
    );
  if (view.mode === 'organisation')
    return (
      <OrganisationRoom
        view={view}
        token={credential.token}
        connected={connected}
        busy={busy}
        pending={!!pending}
        submit={submit}
        reconcile={reconcile}
        assign={assign}
        load={load}
        onError={onError}
        onExit={onReturnToPlan}
      />
    );
  const facilitator = view.role === 'facilitator';
  const roleName = (role: SessionView['role']) => exerciseRoleName(view, role);
  const current = view.analysis.targets.filter((t) => t.current).length;
  const complete = view.phase === 'completed';
  return (
    <div className="room-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">EXERCISE / EPS1.0_LOCKOUT</div>
          <h1>
            {complete
              ? 'What happened. What changes.'
              : view.phase === 'lobby'
                ? 'Bring your team into the room.'
                : chapterNames[view.stage]}
          </h1>
          <p>
            {view.blueprint.name} ·{' '}
            {view.blueprint.improved ? 'Independent recovery kit model' : 'Baseline model'} ·
            Fictional scenario
          </p>
        </div>
        <span className={`connection-pill ${connected ? 'online' : ''}`}>
          <Radio size={14} />
          {connected ? 'Room connected' : 'Disconnected'}
        </span>
      </div>
      <div className="room-toolbar">
        <span className="role-label">
          <Users size={16} />
          {roleName(view.role)}
        </span>

        {facilitator && (
          <div className="toolbar-actions">
            <button
              className="button"
              disabled={busy || !!pending}
              onClick={() => onCreate(view.blueprint)}
            >
              <RefreshCw size={15} /> New run
            </button>
            {view.phase === 'lobby' ? (
              <button
                className="button primary"
                disabled={!connected || busy}
                onClick={() => void submit('start')}
              >
                <Play size={15} />
                Start practice
              </button>
            ) : (
              !complete && (
                <>
                  <button
                    className="button"
                    disabled={!connected || busy}
                    onClick={() => void submit(view.phase === 'paused' ? 'resume' : 'pause')}
                  >
                    {view.phase === 'paused' ? <Play size={15} /> : <Pause size={15} />}{' '}
                    {view.phase === 'paused' ? 'Resume' : 'Pause'}
                  </button>
                  {view.stage < 4 && (
                    <button
                      className="button primary"
                      disabled={!connected || busy || view.phase !== 'running'}
                      onClick={() => void submit('advance')}
                    >
                      {
                        [
                          '',
                          '',
                          'Continue: a suspicious request',
                          'Continue: compare clues',
                          'Continue: recovery review',
                        ][view.stage + 1]
                      }
                    </button>
                  )}
                  <button
                    className="button"
                    disabled={!connected || busy}
                    onClick={() => void submit('complete')}
                  >
                    <Check size={15} />
                    Finish and review
                  </button>
                </>
              )
            )}
          </div>
        )}
      </div>
      {pending && (
        <div className="notice-banner">
          <RefreshCw size={18} />
          <span>An action needs confirmation from the server.</span>
          <button
            className="text-button"
            disabled={!connected || busy}
            onClick={() => void reconcile()}
          >
            Check pending action
          </button>
        </div>
      )}
      {notice && (
        <div className="success-banner" role="status">
          {notice}
        </div>
      )}
      {view.phase === 'paused' && (
        <div className="notice-banner">
          <Pause size={18} />
          Exercise paused. Choices are on hold until the host resumes.
        </div>
      )}
      {!complete && view.phase !== 'lobby' && (
        <section className="next-instruction" aria-label="What to do next">
          <strong>
            {view.stage === 1
              ? 'Start with the locked account'
              : view.stage === 2
                ? 'Check the urgent payment request'
                : view.stage === 3
                  ? 'Compare what each person knows'
                  : 'Review the recovery'}
          </strong>
          <p>
            {view.stage === 1
              ? 'Read the account clues below. Whoever handles account recovery can choose a recovery action.'
              : view.stage === 2
                ? 'Someone handling payments has received an urgent message. Read it and discuss what would make you trust it.'
                : view.stage === 3
                  ? 'Someone handling team communication has a trusted contact. Share that clue so the payment can be checked.'
                  : 'Review the account clues and complete any remaining recovery steps. The host can finish to see the summary.'}
            {facilitator
              ? ' As host, you can see every responsibility and move to the next part when ready.'
              : ''}
          </p>
        </section>
      )}
      <div className="chapter-track">
        {chapterNames.slice(1).map((name, i) => (
          <div key={name} className={view.stage >= i + 1 ? 'reached' : ''}>
            <span>0{i + 1}</span>
            {name}
          </div>
        ))}
      </div>
      {(view.phase === 'lobby' || view.role === 'pending') && (
        <div className="room-lobby">
          <div className="panel">
            <span className="eyebrow">THE BRIEFING</span>
            <h2>What will you practise?</h2>
            <p>
              Your team’s work email is locked. Later, an urgent message asks for a payment. You
              need to find a way back into the account and check whether the payment request is
              genuine.
            </p>
            <p>
              Read your clues, share useful information, then choose an action. The app shows what
              happened after each choice. No real account or payment is changed.
            </p>
            {facilitator ? (
              <>
                <label>
                  Participant join link
                  <input
                    readOnly
                    value={`${location.origin}/join/${id}`}
                    onFocus={(e) => e.target.select()}
                  />
                </label>
                <button
                  className="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(`${location.origin}/join/${id}`);
                      setNotice('Join link copied.');
                    } catch {
                      setNotice('Select the join link above and copy it.');
                    }
                  }}
                >
                  <Copy size={15} />
                  Copy join link
                </button>
                <p className="small muted">
                  For phones, open the app using your laptop’s LAN address. A localhost link works
                  on this computer only.
                </p>
              </>
            ) : (
              <div className="notice-banner">
                <Clock3 size={18} />
                The host will give you a responsibility and start the practice.
              </div>
            )}
          </div>
          <TeamSetup
            view={view}
            onAssign={assign}
            onAddRole={async (name, responsibilities) => {
              await api(
                `/sessions/${id}/custom-roles`,
                post({ name, responsibilities }),
                credential.token,
              );
              await load();
            }}
          />
        </div>
      )}
      {view.phase !== 'lobby' && !complete && facilitator && (
        <details className="simple-details">
          <summary>People and roles</summary>
          <TeamSetup view={view} onAssign={assign} onAddRole={async () => {}} />
        </details>
      )}
      {view.phase !== 'lobby' && view.role !== 'pending' && (
        <>
          <details className="simple-details">
            <summary>Recovery progress and payment outcome</summary>
            <div className="metrics-row compact">
              <div>
                <span>Available now</span>
                <strong>
                  {current}
                  <small> / {view.analysis.targets.length}</small>
                </strong>
                <p>essential activities</p>
              </div>
              <div>
                <span>Recovery forecast</span>
                <strong>
                  {view.analysis.targets.filter((t) => t.reachable).length}
                  <small> / {view.analysis.targets.length}</small>
                </strong>
                <p>activities with a modelled route</p>
              </div>
              <div>
                <span>Payment request</span>
                <strong className="metric-word">
                  {view.paymentDecision === 'verified'
                    ? 'Verified'
                    : view.paymentDecision === 'approved'
                      ? 'Unsafe approval'
                      : 'Unresolved'}
                </strong>
                <p>
                  {view.paymentDecision === 'approved'
                    ? '4,800 PLN fictional loss'
                    : 'Check through an independent contact'}
                </p>
              </div>
            </div>
          </details>
          {complete && view.debrief && (
            <section className="panel debrief-measurements">
              <div className="section-heading">
                <h2>Measured in this exercise</h2>
                <span className="tag">Pauses excluded</span>
              </div>
              <dl>
                <div>
                  <dt>First containment action</dt>
                  <dd>
                    {view.debrief.timingAvailable
                      ? formatElapsed(view.debrief.containmentMs)
                      : 'Not recorded in this older run'}
                  </dd>
                </div>
                <div>
                  <dt>Documented recovery route</dt>
                  <dd>
                    {view.debrief.recoveryRouteMs === 0
                      ? 'Available at the start'
                      : view.debrief.recoveryRouteMs === null
                        ? 'No route found'
                        : formatElapsed(view.debrief.recoveryRouteMs)}
                  </dd>
                </div>
                <div>
                  <dt>Trusted work access restored</dt>
                  <dd>
                    {view.debrief.timingAvailable
                      ? formatElapsed(view.debrief.trustedAccessMs)
                      : 'Not recorded in this older run'}
                  </dd>
                </div>
                <div>
                  <dt>Unsafe decisions</dt>
                  <dd>{view.debrief.unsafeDecisions}</dd>
                </div>
              </dl>
              <p className="small muted">
                Times come from accepted simulation actions. Practice speed does not predict real
                recovery time. A route available at the start still needs to be carried out.
              </p>
              {view.paymentDecision === 'approved' && (
                <p className="error-banner">
                  The request was approved without the independent contact check. The scenario
                  records a fictional 4,800 PLN loss because the message was sent by an
                  impersonator.
                </p>
              )}
              {view.paymentDecision === 'verified' && (
                <p className="success-banner">
                  The coordinator shared an independent contact. Finance used it to reject the
                  impersonated payment request.
                </p>
              )}
            </section>
          )}
          {complete ? (
            <section className="debrief-summary">
              <div>
                <span className="eyebrow">DEBRIEF</span>
                <h2>
                  {view.blueprint.improved
                    ? 'A route back, with conditions.'
                    : 'The backup was part of the problem.'}
                </h2>
                <p>
                  {view.blueprint.improved
                    ? 'Review the recovery sequence and containment steps. The improved forecast depends on an independently stored kit, an available custodian, and a clean device.'
                    : 'The work identity and recovery mailbox depend on each other. With both inaccessible, neither supplies a trusted starting point. The public website remains available.'}
                </p>
                <div className="button-row">
                  <button
                    className="button primary"
                    onClick={() =>
                      onCreate(
                        view.blueprint.improved ? view.blueprint : withRecoveryKit(view.blueprint),
                      )
                    }
                  >
                    <ShieldCheck size={16} />
                    {view.blueprint.improved
                      ? 'Rehearse this plan again'
                      : 'Run with a recovery kit'}
                  </button>
                  <button
                    className="button"
                    onClick={() =>
                      void downloadPlan(view.blueprint, 'work-lockout').catch((e) =>
                        onError(e.message),
                      )
                    }
                  >
                    <Download size={16} />
                    Export plan
                  </button>
                  {facilitator && (
                    <button className="button" onClick={() => void exportRecord()}>
                      Export record
                    </button>
                  )}
                </div>
                {digest && (
                  <div className="digest">
                    <label>Save this SHA-256 digest separately</label>
                    <code>{digest}</code>
                    <button
                      className="text-button"
                      onClick={() => download(digest, 'blackout-exercise.sha256', 'text/plain')}
                    >
                      Download digest
                    </button>
                  </div>
                )}
              </div>
              <div className="debrief-note">
                <ShieldCheck size={28} />
                <h3>Make the next plan testable.</h3>
                <p>
                  Assign a custodian, confirm the provider’s procedure, and practise the recovery
                  steps. Modelled reachability depends on those arrangements.
                </p>
              </div>
            </section>
          ) : null}
          <div className="exercise-columns">
            <section>
              <div className="section-heading">
                <h2>{complete ? 'Clues from this practice' : '1. Read and share your clues'}</h2>
                <span className="tag">
                  <Eye size={12} />
                  {facilitator ? 'All roles' : roleName(view.role)}
                </span>
              </div>
              {view.observations.length ? (
                view.observations.map((o) => (
                  <article className={`observation ${o.shared ? 'shared' : ''}`} key={o.id}>
                    <div className="observation-meta">
                      <span>{responsibilityNames[o.audience]}</span>
                      <span>
                        {o.shared ? 'SHARED WITH TEAM' : 'ONLY YOUR RESPONSIBILITY CAN SEE THIS'}
                      </span>
                    </div>
                    <h3>{o.title}</h3>
                    <p>{o.body}</p>
                    <footer>
                      <small>{o.source}</small>
                      {!o.shared && !complete && view.responsibilities.includes(o.audience) && (
                        <button
                          className="text-button"
                          disabled={!connected || busy || !!pending || view.phase !== 'running'}
                          onClick={() => void submit('share', o.id)}
                        >
                          <Share2 size={14} />
                          Share with the team
                        </button>
                      )}
                      {o.shared && (
                        <span className="shared-label">
                          <CheckCircle2 size={14} />
                          Shared
                        </span>
                      )}
                    </footer>
                  </article>
                ))
              ) : (
                <div className="empty-card">
                  No observations have been shared with your role in this chapter.
                </div>
              )}
            </section>
            <section>
              <div className="section-heading">
                <h2>{complete ? 'What your team did' : '2. Choose what to do'}</h2>
                <span className="tag">
                  {complete ? `${view.events.length} events` : 'Simulation'}
                </span>
              </div>
              {!complete &&
                view.actions
                  .filter((a) => a.disabledReason !== 'Outcome already available')
                  .map((a) => (
                    <div className="action-card" key={a.id}>
                      <div>
                        <span className="eyebrow">{roleName(a.role)}</span>
                        <h3>{a.label}</h3>
                        {a.disabledReason && <p>{a.disabledReason}</p>}
                      </div>
                      <button
                        className={`button small-button ${a.id === 'approve-payment' ? 'danger-outline' : ''}`}
                        disabled={!!a.disabledReason || !connected || busy || !!pending}
                        onClick={() => void submit('act', a.id)}
                      >
                        {a.disabledReason === 'Outcome already available' ? (
                          <>
                            <Check size={16} />
                            <span className="sr-only">Outcome already available</span>
                          </>
                        ) : (
                          'Choose this action'
                        )}
                      </button>
                    </div>
                  ))}
              {!complete && view.actions.length === 0 && (
                <div className="empty-card">
                  This role observes the exercise. Share information with the team when available.
                </div>
              )}
              {complete && <Timeline events={view.events} />}
            </section>
          </div>
          {!complete && (
            <section className="panel timeline-panel">
              <div className="section-heading">
                <h2>Shared timeline</h2>
                <span className="muted small">Your decisions, in order</span>
              </div>
              <Timeline events={view.events} />
            </section>
          )}
        </>
      )}
      <div className="room-footer">
        <button className="text-button" onClick={onBack}>
          Back to practice setup
        </button>
        <span>Account operations are simulated. The room records your decisions.</span>
      </div>
    </div>
  );
}
function Timeline({ events }: { events: SessionView['events'] }) {
  return (
    <ol className="timeline">
      {events.map((e) => (
        <li key={e.id}>
          <span className="timeline-seq">{String(e.sequence).padStart(2, '0')}</span>
          <div>
            <strong>{e.label}</strong>
            <small>
              {e.actor} ·{' '}
              {new Date(e.at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </small>
          </div>
        </li>
      ))}
    </ol>
  );
}
