import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Network,
  Radio,
  GitCompareArrows,
  Fingerprint,
  Shield,
  ShieldCheck,
  Plus,
  Play,
  Settings2,
  Download,
  CircleHelp,
  AlertTriangle,
  Check,
  CheckCircle2,
  X,
  Archive,
  FileCheck2,
  List,
  Map,
  KeyRound,
  ChevronRight,
} from 'lucide-react';
import { harborAid, failures, failureById, withRecoveryKit } from '../../packages/domain/fixture';
import { analyze, blockersFor, factLabel, routeTo } from '../../packages/domain/engine';
import { blueprintSchema, type Blueprint } from '../../packages/domain/model';
import { RecoveryMap } from './RecoveryMap';
import { BlueprintEditor } from './BlueprintEditor';
import { Room, type RoomCredential } from './Room';
import { FollowUpActions } from './FollowUpActions';
import { recordDigest } from './integrity';
import { api, post, readStorage, saveStorage, downloadPlan } from './api';

type Page = 'map' | 'exercise' | 'compare' | 'evidence';
const nav = [
  { id: 'map', label: 'Recovery map', icon: Network },
  { id: 'exercise', label: 'Exercise room', icon: Radio },
  { id: 'compare', label: 'Compare plans', icon: GitCompareArrows },
  { id: 'evidence', label: 'Evidence locker', icon: Fingerprint },
] as const;
function initialBlueprint() {
  const parsed = blueprintSchema.safeParse(readStorage('blackout-blueprint', harborAid));
  return parsed.success ? parsed.data : harborAid;
}
export function App() {
  const [baseline, setBaseline] = useState<Blueprint>(initialBlueprint),
    [variant, setVariant] = useState(false),
    [failure, setFailure] = useState('work-lockout'),
    [selected, setSelected] = useState('work');
  const [page, setPage] = useState<Page>('map'),
    [path, setPath] = useState(location.pathname),
    [editor, setEditor] = useState(false),
    [list, setList] = useState(() => window.matchMedia('(max-width: 680px)').matches);
  const [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [connected, setConnected] = useState(false),
    [creating, setCreating] = useState(false);
  const [credentials, setCredentials] = useState<RoomCredential[]>(() =>
    readStorage('blackout-rooms', []),
  );
  const blueprint = useMemo(
    () => (variant ? withRecoveryKit(baseline) : baseline),
    [baseline, variant],
  );
  const analysis = useMemo(() => analyze(blueprint, failureById(failure)), [blueprint, failure]);
  const baselineAnalysis = useMemo(
    () => analyze(baseline, failureById(failure)),
    [baseline, failure],
  );
  const improvedAnalysis = useMemo(
    () => analyze(withRecoveryKit(baseline), failureById(failure)),
    [baseline, failure],
  );
  const selectedResource =
    blueprint.resources.find((r) => r.id === selected) ?? blueprint.resources[0];
  const blockers = [
      ...blockersFor(selectedResource.fact, analysis, blueprint),
      ...(selectedResource.controlFact
        ? blockersFor(selectedResource.controlFact, analysis, blueprint)
        : []),
    ],
    route = routeTo(selectedResource.fact, analysis, blueprint);
  const roomId = path.startsWith('/room/') ? path.split('/')[2] : undefined,
    joinId = path.startsWith('/join/') ? path.split('/')[2] : undefined;
  const showError = useCallback((message: string) => setError(message), []);
  useEffect(() => {
    const fn = () => setPath(location.pathname);
    addEventListener('popstate', fn);
    return () => removeEventListener('popstate', fn);
  }, []);
  useEffect(() => {
    void api('/health')
      .then(() => setConnected(true))
      .catch(() => setConnected(false));
  }, []);
  useEffect(() => {
    saveStorage('blackout-blueprint', baseline);
  }, [baseline]);
  function navigate(url: string) {
    history.pushState({}, '', url);
    setPath(url);
    setError('');
    setNotice('');
    window.scrollTo(0, 0);
  }
  function go(page: Page) {
    setPage(page);
    navigate('/');
  }
  function saveRoom(id: string, token: string, name: string) {
    const next = [
      { id, token, name, createdAt: new Date().toISOString() },
      ...credentials.filter((c) => c.id !== id),
    ].slice(0, 20);
    setCredentials(next);
    saveStorage('blackout-rooms', next);
    navigate(`/room/${id}`);
  }
  async function createRoom(b: Blueprint) {
    if (creating) return;
    setCreating(true);
    setError('');
    try {
      const result = await api<{ id: string; token: string }>(
        '/sessions',
        post({ blueprint: b, name: 'Facilitator' }),
      );
      saveRoom(
        result.id,
        result.token,
        b.improved ? 'Recovery kit rehearsal' : 'Baseline rehearsal',
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  }
  async function exportPlan() {
    try {
      await downloadPlan(blueprint, failure);
      setNotice('Offline recovery plan downloaded. It opens without the application.');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function saveBlueprint(b: Blueprint) {
    setBaseline(b);
    setVariant(false);
    setEditor(false);
    setNotice(`Blueprint version ${b.version} saved on this device.`);
    void api('/blueprints', post(b)).catch((e) =>
      setError(`Saved locally; server save failed: ${e.message}`),
    );
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          href="/"
          className="brand"
          onClick={(e) => {
            e.preventDefault();
            go('map');
          }}
        >
          <span className="brand-symbol">
            b<span>_</span>
          </span>
          <span>
            BLACKOUT
            <br />
            <b>PROTOCOL</b>
          </span>
        </a>
        <div className="workspace-label">READINESS WORKSPACE</div>
        <nav aria-label="Main navigation">
          {nav.map(({ id, label, icon: Icon }, i) => (
            <button
              key={id}
              onClick={() => go(id)}
              className={(roomId || joinId ? id === 'exercise' : page === id) ? 'active' : ''}
            >
              <Icon size={18} />
              <span>{label}</span>
              <small>0{i + 1}</small>
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="crosshair">+</span>
          <p>
            A way back starts
            <br />
            before the blackout.
          </p>
        </div>
        <div className="workspace-card">
          <span className="organisation-avatar">H</span>
          <div>
            <strong>{baseline.name}</strong>
            <small>Fictional organisation</small>
          </div>
          <span className="version">v{baseline.version}</span>
        </div>
        <div className="sidebar-footer">
          <Shield size={13} />
          <span>LOCAL REHEARSAL</span>
          <small>01.00</small>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div>
            <span>{baseline.name}</span>
            <ChevronRight size={13} />
            <strong>
              {roomId
                ? 'Live exercise'
                : joinId
                  ? 'Join exercise'
                  : nav.find((n) => n.id === page)?.label}
            </strong>
          </div>
          <span className={`server-status ${connected ? 'online' : ''}`}>
            <i />
            {connected ? 'Local server connected' : 'Local server unavailable'}
          </span>
        </header>
        <main>
          {error && (
            <div className="error-banner" role="alert">
              <AlertTriangle size={18} />
              <span>{error}</span>
              <button
                className="icon-button"
                aria-label="Dismiss error"
                onClick={() => setError('')}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {notice && (
            <div className="success-banner" role="status">
              <CheckCircle2 size={18} />
              <span>{notice}</span>
              <button
                className="icon-button"
                aria-label="Dismiss notice"
                onClick={() => setNotice('')}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {joinId ? (
            <JoinRoom
              id={joinId}
              onJoin={saveRoom}
              onError={showError}
              existing={credentials.find((c) => c.id === joinId)}
              navigate={navigate}
            />
          ) : roomId ? (
            <Room
              key={roomId}
              id={roomId}
              credential={credentials.find((c) => c.id === roomId)}
              onCreate={(b) => void createRoom(b)}
              onBack={() => go('map')}
              onError={showError}
            />
          ) : (
            <>
              {page === 'map' && (
                <>
                  <div className="page-heading">
                    <div>
                      <div className="eyebrow">01 / PREPARE BEFORE THE INCIDENT</div>
                      <h1>Know your way back.</h1>
                      <p>Find the dependencies that stand between your team and recovery.</p>
                    </div>
                    <div className="button-row">
                      <button className="button" onClick={() => setEditor(true)}>
                        <Settings2 size={16} />
                        Edit blueprint
                      </button>
                      <button
                        className="button primary"
                        disabled={creating}
                        onClick={() => void createRoom(blueprint)}
                      >
                        <Play size={15} />
                        Start rehearsal
                      </button>
                    </div>
                  </div>
                  <div className="planner-controls">
                    <div className="segmented">
                      <button
                        className={!variant ? 'active' : ''}
                        onClick={() => setVariant(false)}
                      >
                        Baseline plan
                      </button>
                      <button className={variant ? 'active' : ''} onClick={() => setVariant(true)}>
                        <Plus size={14} />
                        Recovery kit
                      </button>
                    </div>
                    <label className="failure-select">
                      <span>SIMULATE</span>
                      <select
                        aria-label="Failure scenario"
                        value={failure}
                        onChange={(e) => setFailure(e.target.value)}
                      >
                        {failures.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="view-switch">
                      <button
                        title="Map view"
                        aria-label="Map view"
                        className={!list ? 'active' : ''}
                        onClick={() => setList(false)}
                      >
                        <Map size={16} />
                      </button>
                      <button
                        title="List view"
                        aria-label="List view"
                        className={list ? 'active' : ''}
                        onClick={() => setList(true)}
                      >
                        <List size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="metrics-row">
                    <div>
                      <span>AVAILABLE NOW</span>
                      <strong>
                        {analysis.targets.filter((t) => t.current).length}
                        <small> / {analysis.targets.length}</small>
                      </strong>
                      <p>essential activities</p>
                    </div>
                    <div>
                      <span>RECOVERY FORECAST</span>
                      <strong>
                        {analysis.targets.filter((t) => t.reachable).length}
                        <small> / {analysis.targets.length}</small>
                      </strong>
                      <p>activities with a documented route</p>
                    </div>
                    <div>
                      <span>RECOVERY DEAD ENDS</span>
                      <strong className={analysis.cycles.length ? 'text-red' : ''}>
                        {analysis.cycles.length.toString().padStart(2, '0')}
                      </strong>
                      <p>
                        {analysis.cycles.length
                          ? 'circular dependency without an entry point'
                          : 'no blocked circular dependency found'}
                      </p>
                    </div>
                    <div className="metric-action">
                      <Archive size={23} />
                      <span>Take the plan with you.</span>
                      <button className="text-button" onClick={() => void exportPlan()}>
                        Export offline plan <Download size={14} />
                      </button>
                    </div>
                  </div>
                  {failure !== 'none' && (
                    <div className={`incident-strip ${variant ? 'improved' : ''}`}>
                      <span className="incident-number">
                        {variant ? <Shield size={19} /> : <AlertTriangle size={19} />}
                      </span>
                      <div>
                        <strong>
                          {variant
                            ? analysis.reachable.includes('work.trusted')
                              ? 'A recovery route exists. Its prerequisites still matter.'
                              : 'The kit is proposed. A recovery prerequisite is still missing.'
                            : analysis.cycles.length
                              ? 'Your backup depends on the account you just lost.'
                              : failureById(failure).label}
                        </strong>
                        <span>
                          {variant
                            ? 'The forecast assumes an independently stored kit, an available custodian, and a clean device.'
                            : failureById(failure).description}
                        </span>
                      </div>
                      <span className="tag">SIMULATION</span>
                    </div>
                  )}
                  {list ? (
                    <div className="resource-list panel">
                      {blueprint.resources.map((r) => {
                        const state = analysis.resources.find((x) => x.id === r.id)!;
                        return (
                          <button
                            key={r.id}
                            onClick={() => setSelected(r.id)}
                            className={selected === r.id ? 'active' : ''}
                          >
                            <span>
                              <strong>{r.label}</strong>
                              <small>
                                {r.owner} · {r.kind}
                              </small>
                            </span>
                            <span className={`state-tag ${state.state}`}>{state.state}</span>
                            <ChevronRight size={16} />
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <RecoveryMap
                      blueprint={blueprint}
                      analysis={analysis}
                      selected={selected}
                      onSelect={setSelected}
                    />
                  )}
                  <div className="evidence-summary">
                    <span>
                      <strong>
                        {analysis.targets.filter((t) => t.reachable && !t.confirmed).length}
                      </strong>{' '}
                      / {analysis.targets.length} activities depend on untested reports
                    </span>
                    <span>
                      <strong>{analysis.targets.filter((t) => t.uncertain).length}</strong> /{' '}
                      {analysis.targets.length} need more information
                    </span>
                  </div>
                  <section className="inspector">
                    <div className="inspector-intro">
                      <span className="eyebrow">RESOURCE INSPECTOR</span>
                      <h2>{selectedResource.label}</h2>
                      <p>{selectedResource.description}</p>
                      <span className="owner-label">
                        OWNER <strong>{selectedResource.owner}</strong>
                      </span>
                    </div>
                    <div className="inspector-methods">
                      <div className="section-heading">
                        <h3>
                          {analysis.current.includes(selectedResource.fact)
                            ? 'Available in the current model'
                            : route.length
                              ? 'A possible route back'
                              : 'Why access is blocked'}
                        </h3>
                        <span className="tag">
                          {analysis.current.includes(selectedResource.fact)
                            ? 'Current state'
                            : 'Model forecast'}
                        </span>
                      </div>
                      {route.length > 0 && (
                        <ol className="route-steps">
                          {route
                            .filter((r) => r.kind === 'action')
                            .map((r) => (
                              <li key={r.id}>
                                <KeyRound size={14} />
                                <span>{r.label}</span>
                                <small>{r.evidence.replaceAll('-', ' ')}</small>
                              </li>
                            ))}
                        </ol>
                      )}
                      {blockers.length ? (
                        blockers.map(({ rule, missing }) => (
                          <div
                            className={`method-row ${!rule.enabled ? 'disabled-method' : ''}`}
                            key={rule.id}
                          >
                            <div>
                              <strong>{rule.label}</strong>
                              <small>
                                {!rule.enabled
                                  ? 'Not configured in this plan'
                                  : 'Requires every item below'}
                              </small>
                            </div>
                            <div className="prerequisites">
                              {rule.requiresAll.map((f) => (
                                <span key={f} className={missing.includes(f) ? 'missing' : 'met'}>
                                  {missing.includes(f) ? <X size={12} /> : <Check size={12} />}{' '}
                                  {factLabel(f, blueprint)}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="muted">
                          {analysis.current.includes(selectedResource.fact)
                            ? 'This is an available starting resource in the supplied model.'
                            : 'No recovery method has been documented for this resource.'}
                        </p>
                      )}
                    </div>
                  </section>
                  <div className="page-footnote">
                    <CircleHelp size={14} />
                    <span>
                      Forecasts reflect the documented model. Real provider procedures and untested
                      assumptions need confirmation.
                    </span>
                    <button className="text-button" onClick={() => go('compare')}>
                      Compare both plans
                    </button>
                  </div>
                </>
              )}
              {page === 'compare' && (
                <>
                  <div className="page-heading">
                    <div>
                      <div className="eyebrow">03 / CHANGE ONE THING. TEST AGAIN.</div>
                      <h1>A better route back.</h1>
                      <p>
                        The same failure, the same essential activities. One independent recovery
                        method.
                      </p>
                    </div>
                    <button
                      className="button primary"
                      disabled={creating}
                      onClick={() => void createRoom(withRecoveryKit(baseline))}
                    >
                      <Play size={15} />
                      Rehearse improved plan
                    </button>
                  </div>
                  <label className="comparison-scenario">
                    Failure scenario
                    <select value={failure} onChange={(e) => setFailure(e.target.value)}>
                      {failures.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="comparison-grid">
                    {[
                      {
                        title: 'Baseline plan',
                        sub: 'The documented starting point',
                        data: baselineAnalysis,
                        improved: false,
                      },
                      {
                        title: 'With a recovery kit',
                        sub: 'Proposed independent fallback',
                        data: improvedAnalysis,
                        improved: true,
                      },
                    ].map((card) => (
                      <section
                        className={`comparison-card ${card.improved ? 'improved' : ''}`}
                        key={card.title}
                      >
                        <div className="section-heading">
                          <span className="eyebrow">
                            {card.improved ? 'PROPOSED CHANGE' : 'ORIGINAL MODEL'}
                          </span>
                          {card.improved ? <ShieldCheck /> : <Network />}
                        </div>
                        <h2>{card.title}</h2>
                        <p>{card.sub}</p>
                        <div className="comparison-number">
                          {card.data.targets.filter((t) => t.reachable).length}
                          <span> / {card.data.targets.length}</span>
                        </div>
                        <p>essential activities with a modelled recovery route</p>
                        <ul className="target-list">
                          {card.data.targets.map((t) => (
                            <li key={t.id}>
                              {t.reachable ? <CheckCircle2 size={18} /> : <X size={18} />}
                              <span>
                                {t.label}
                                <small>
                                  {t.current
                                    ? 'Available now'
                                    : t.reachable
                                      ? t.confirmed
                                        ? 'Recoverable in the documented model'
                                        : 'Depends on untested assumptions'
                                      : t.uncertain
                                        ? 'Needs confirmation'
                                        : 'No route found'}
                                </small>
                              </span>
                            </li>
                          ))}
                        </ul>
                      </section>
                    ))}
                  </div>
                  <section className="panel improvement-panel">
                    <div>
                      <span className="eyebrow">WHAT CHANGED</span>
                      <h2>An independent starting point.</h2>
                      <p>
                        The proposed kit adds an independent method. Recovery still requires the
                        custodian and clean device, followed by credential rotation, session
                        revocation, and review of recovery settings.
                      </p>
                      <p className="muted">
                        This is a proposed model change. An owner must implement and test the
                        corresponding arrangement with the actual provider.
                      </p>
                      <button
                        className="button"
                        onClick={() => {
                          setVariant(true);
                          go('map');
                        }}
                      >
                        Inspect the improved map
                      </button>
                    </div>
                    <ol className="numbered-list">
                      <li>
                        <span>01</span>Prepare the independent method
                      </li>
                      <li>
                        <span>02</span>Assign a custodian and confirm access
                      </li>
                      <li>
                        <span>03</span>Practise recovery and containment
                      </li>
                      <li>
                        <span>04</span>Record the outcome and review date
                      </li>
                    </ol>
                  </section>
                  <section className="panel assumption-panel">
                    <h3>Assumptions added to the proposed plan</h3>
                    <ul>
                      {withRecoveryKit(baseline)
                        .assumptions.filter((a) => !baseline.assumptions.includes(a))
                        .map((a) => (
                          <li key={a}>{a}</li>
                        ))}
                    </ul>
                    <p className="small muted">
                      Baseline v{baseline.version} and proposed v{withRecoveryKit(baseline).version}{' '}
                      share the same failure and critical targets. Changing the failure or blueprint
                      recomputes both results.
                    </p>
                  </section>
                  <FollowUpActions
                    key={baseline.version}
                    blueprint={baseline}
                    onSave={saveBlueprint}
                  />
                  <div className="page-footnote">
                    <CircleHelp size={14} />
                    <span>
                      Comparison uses engine v1 and the same target set. Exercise speed can improve
                      through practice; it does not predict real incident duration.
                    </span>
                  </div>
                </>
              )}
              {page === 'exercise' && (
                <>
                  <div className="page-heading">
                    <div>
                      <div className="eyebrow">02 / LEARN TOGETHER UNDER PRESSURE</div>
                      <h1>Hello, friend.</h1>
                      <p>Your team has different pieces of the story. Put them together.</p>
                    </div>
                    <span className="tag">EPS1.0_LOCKOUT</span>
                  </div>
                  <div className="exercise-intro">
                    <div>
                      <span className="eyebrow">THE SCENARIO</span>
                      <h2>
                        The account that held
                        <br />
                        everything together.
                      </h2>
                      <p>
                        Harbor Aid is minutes away from a volunteer event when its work identity is
                        compromised. A payment request appears. The roster is unavailable. The
                        backup mailbox points straight back to the locked account.
                      </p>
                      <div className="button-row">
                        <button
                          className="button primary"
                          disabled={creating}
                          onClick={() => void createRoom(baseline)}
                        >
                          <Play size={16} />
                          Start baseline exercise
                        </button>
                        <button
                          className="button"
                          disabled={creating}
                          onClick={() => void createRoom(withRecoveryKit(baseline))}
                        >
                          Use improved plan
                        </button>
                      </div>
                      <p className="small muted">
                        Three participant roles, or a solo walkthrough with the facilitator.
                      </p>
                    </div>
                    <div className="role-stack">
                      {[
                        {
                          n: '01',
                          title: 'Administrator',
                          text: 'Investigate access. Find a recovery route.',
                        },
                        {
                          n: '02',
                          title: 'Finance',
                          text: 'Question the urgent request. Verify its source.',
                        },
                        {
                          n: '03',
                          title: 'Coordinator',
                          text: 'Share the missing context. Keep people connected.',
                        },
                      ].map((r) => (
                        <div key={r.n}>
                          <span>{r.n}</span>
                          <div>
                            <h3>{r.title}</h3>
                            <p>{r.text}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {credentials.length > 0 && (
                    <section className="panel">
                      <div className="section-heading">
                        <h2>Saved rooms on this device</h2>
                        <span className="tag">{credentials.length}</span>
                      </div>
                      {credentials.map((c) => (
                        <button
                          key={c.id}
                          className="saved-room"
                          onClick={() => navigate(`/room/${c.id}`)}
                        >
                          <Radio size={19} />
                          <div>
                            <strong>{c.name}</strong>
                            <small>{new Date(c.createdAt).toLocaleString()}</small>
                          </div>
                          <span>Open room</span>
                          <ChevronRight size={16} />
                        </button>
                      ))}
                    </section>
                  )}
                </>
              )}
              {page === 'evidence' && (
                <EvidenceLocker credentials={credentials} navigate={navigate} onError={showError} />
              )}
            </>
          )}
        </main>
        <footer className="app-footer">
          <span>
            BLACKOUT PROTOCOL <span className="footer-slash">/</span> PREPARE. REHEARSE. RECOVER.
          </span>
          <span>Fictional data · Account actions are simulated</span>
        </footer>
      </div>
      {editor && (
        <BlueprintEditor value={baseline} onSave={saveBlueprint} onClose={() => setEditor(false)} />
      )}
    </div>
  );
}

function JoinRoom({
  id,
  onJoin,
  existing,
  navigate,
  onError,
}: {
  id: string;
  onJoin: (id: string, token: string, name: string) => void;
  existing?: RoomCredential;
  navigate: (p: string) => void;
  onError: (m: string) => void;
}) {
  const [name, setName] = useState(''),
    [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api<{ token: string }>(`/sessions/${id}/join`, post({ name }));
      onJoin(id, r.token, name);
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="join-card">
      <span className="eyebrow">BLACKOUT PROTOCOL / TEAM EXERCISE</span>
      <Radio size={32} />
      <h1>
        A different piece
        <br />
        of the story.
      </h1>
      <p>Join your team’s rehearsal. Your facilitator will assign a role and start the incident.</p>
      {existing ? (
        <button className="button primary" onClick={() => navigate(`/room/${id}`)}>
          Return to your room
        </button>
      ) : (
        <form onSubmit={(e) => void submit(e)}>
          <label>
            Your name
            <input
              autoComplete="given-name"
              required
              maxLength={60}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <button className="button primary" disabled={busy || !name.trim()}>
            Join exercise
          </button>
        </form>
      )}
      <small>All account actions take place in a fictional simulation.</small>
    </section>
  );
}
function EvidenceLocker({
  credentials,
  navigate,
  onError,
}: {
  credentials: RoomCredential[];
  navigate: (s: string) => void;
  onError: (s: string) => void;
}) {
  const [file, setFile] = useState<File>(),
    [expected, setExpected] = useState(''),
    [result, setResult] = useState<boolean | null>(null);
  async function verify() {
    if (!file) return;
    try {
      if (file.size > 10_000_000) throw new Error('Choose an exercise record smaller than 10 MB.');
      const actual = recordDigest(new Uint8Array(await file.arrayBuffer()));
      setResult(actual === expected.trim().toLowerCase());
    } catch (e) {
      onError((e as Error).message);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">04 / KEEP A RECORD YOU CAN CHECK</div>
          <h1>The incident, in order.</h1>
          <p>Review saved exercises and check whether an exported record has changed.</p>
        </div>
        <Fingerprint size={35} />
      </div>
      <div className="evidence-grid">
        <section className="panel">
          <span className="eyebrow">SAVED EXERCISES</span>
          <h2>Decision history</h2>
          {credentials.length ? (
            credentials.map((c) => (
              <button className="saved-room" key={c.id} onClick={() => navigate(`/room/${c.id}`)}>
                <FileCheck2 size={20} />
                <div>
                  <strong>{c.name}</strong>
                  <small>{new Date(c.createdAt).toLocaleString()}</small>
                </div>
                <ChevronRight size={16} />
              </button>
            ))
          ) : (
            <div className="empty-card">
              Complete an exercise to create a decision timeline. The facilitator can export the
              record and its digest from the debrief.
            </div>
          )}
        </section>
        <section className="panel">
          <span className="eyebrow">FILE INTEGRITY</span>
          <h2>Verify an exercise record</h2>
          <p>
            Choose an exported JSON file and enter the SHA-256 digest saved separately when it was
            exported. Verification happens on this device; the file is not uploaded.
          </p>
          <label>
            Exercise record
            <input
              type="file"
              accept=".json,application/json"
              onChange={(e) => {
                setFile(e.target.files?.[0]);
                setResult(null);
              }}
            />
          </label>
          <label>
            Original SHA-256 digest
            <input
              value={expected}
              maxLength={64}
              placeholder="64-character digest"
              onChange={(e) => {
                setExpected(e.target.value);
                setResult(null);
              }}
            />
          </label>
          <button
            className="button primary"
            disabled={!file || !/^[a-fA-F0-9]{64}$/.test(expected)}
            onClick={() => void verify()}
          >
            <Shield size={16} />
            Verify file
          </button>
          {result !== null && (
            <div className={result ? 'success-banner' : 'error-banner'} role="status">
              {result
                ? 'Digest matches. The file is unchanged against this saved digest.'
                : 'Digest does not match. The file or reference digest has changed.'}
            </div>
          )}
          <p className="muted small">
            A digest checks consistency with your saved reference. It does not prove real-world
            events or prevent replacement of both the file and digest.
          </p>
        </section>
      </div>
    </>
  );
}
