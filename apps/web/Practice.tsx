import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Play, Users, History, AlertTriangle, X } from 'lucide-react';
import { Room, type RoomCredential } from './Room';
import { harborAid, withRecoveryKit } from '../../packages/domain/fixture';
import type { Blueprint } from '../../packages/domain/model';
import { api, post, readStorage, saveStorage } from './api';

export function Practice({ onExit }: { onExit: () => void }) {
  const [path, setPath] = useState(location.pathname),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const [credentials, setCredentials] = useState<RoomCredential[]>(() =>
    readStorage('blackout-rooms', []),
  );
  const [name, setName] = useState(''),
    [kit, setKit] = useState(true);
  useEffect(() => {
    const changed = () => setPath(location.pathname);
    addEventListener('popstate', changed);
    return () => removeEventListener('popstate', changed);
  }, []);
  const roomId = /^\/room\/([^/]+)/.exec(path)?.[1],
    joinId = /^\/join\/([^/]+)/.exec(path)?.[1];
  const [joinInfo, setJoinInfo] = useState<{ mode: string; phase: string }>();
  useEffect(() => {
    setJoinInfo(undefined);
    if (!joinId) return;
    let active = true;
    void api<{ mode: string; phase: string }>(`/sessions/${joinId}/info`)
      .then((info) => {
        if (active) setJoinInfo(info);
      })
      .catch((e) => {
        if (active) setError((e as Error).message);
      });
    return () => {
      active = false;
    };
  }, [joinId]);
  function navigate(url: string) {
    history.pushState({}, '', url);
    setPath(url);
    setError('');
    window.scrollTo(0, 0);
  }
  function remember(id: string, token: string, label: string) {
    const next = [
      {
        id,
        token,
        name: label,
        createdAt: new Date().toISOString(),
        ...(joinInfo?.mode === 'organisation' ? { mode: 'organisation' as const } : {}),
      },
      ...credentials.filter((c) => c.id !== id),
    ].slice(0, 20);
    saveStorage('blackout-rooms', next);
    setCredentials(next);
    navigate(`/room/${id}`);
  }
  async function create(b: Blueprint) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await api<{ id: string; token: string }>(
        '/sessions',
        post({ blueprint: b, name: 'Host' }),
      );
      remember(
        result.id,
        result.token,
        b.improved ? 'Email recovery practice' : 'Practice with no backup route',
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function join(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const result = await api<{ token: string }>(`/sessions/${joinId}/join`, post({ name }));
      remember(joinId!, result.token, name);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="simple-practice">
      <header className="simple-practice-header">
        <button className="text-button" onClick={onExit}>
          <ArrowLeft size={16} />
          Back to my plan
        </button>
        <span>BLACKOUT / TEAM ROOM</span>
      </header>
      <main>
        {error && (
          <div className="error-banner" role="alert">
            <AlertTriangle size={18} />
            <span>{error}</span>
            <button className="icon-button" aria-label="Dismiss error" onClick={() => setError('')}>
              <X size={16} />
            </button>
          </div>
        )}
        {roomId ? (
          <Room
            key={roomId}
            id={roomId}
            credential={credentials.find((c) => c.id === roomId)}
            onCreate={(b) => void create(b)}
            onBack={() => navigate('/practice')}
            onError={setError}
            onReturnToPlan={onExit}
          />
        ) : joinId ? (
          <section className="join-card">
            <span className="eyebrow">YOU HAVE BEEN INVITED</span>
            <h1>
              {joinInfo?.mode === 'organisation'
                ? 'Join your team’s check.'
                : 'Join your team’s practice.'}
            </h1>
            <p>
              {joinInfo?.mode === 'organisation'
                ? 'The host assigns your accounts. Review the shared map and discuss how to recover. All account actions are simulated.'
                : 'You will read clues and choose what to do. The host assigns a responsibility. No real account or payment will be changed.'}
            </p>
            {credentials.some((c) => c.id === joinId) ? (
              <button className="button primary" onClick={() => navigate(`/room/${joinId}`)}>
                Return to your room
              </button>
            ) : (
              <form onSubmit={(e) => void join(e)}>
                <label>
                  Your name
                  <input
                    required
                    maxLength={60}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <button
                  className="button primary"
                  disabled={busy || !name.trim() || !joinInfo || joinInfo.phase === 'completed'}
                >
                  {joinInfo?.phase === 'completed'
                    ? 'This check has ended'
                    : joinInfo?.mode === 'organisation'
                      ? 'Join team check'
                      : 'Join practice'}
                </button>
              </form>
            )}
          </section>
        ) : (
          <>
            <section className="practice-intro">
              <span className="eyebrow">OPTIONAL · ABOUT 10 MINUTES</span>
              <h1>Practise an account emergency.</h1>
              <p>
                Your organisation’s email is locked. Then an urgent payment request arrives. Work
                out how to regain access and whether the request can be trusted.
              </p>
              <div className="plain-note">
                This is a guided story with fictional accounts. The recovery plan you wrote for your
                organisation stays separate.
              </div>
            </section>
            <ol className="how-it-works">
              <li>
                <span>1</span>
                <div>
                  <strong>Read what happened</strong>
                  <p>Each responsibility receives useful information.</p>
                </div>
              </li>
              <li>
                <span>2</span>
                <div>
                  <strong>Share and decide</strong>
                  <p>Compare clues, then choose a recovery or payment action.</p>
                </div>
              </li>
              <li>
                <span>3</span>
                <div>
                  <strong>Review the outcome</strong>
                  <p>See what helped and what you should prepare in real life.</p>
                </div>
              </li>
            </ol>
            <div className="practice-start-grid">
              <section className="panel">
                <Play size={26} />
                <h2>Try it on your own</h2>
                <p>You see every clue and make every decision. Start here to learn how it works.</p>
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={() => void create(kit ? withRecoveryKit(harborAid) : harborAid)}
                >
                  Start solo practice
                  <ArrowRight size={16} />
                </button>
              </section>
              <section className="panel">
                <Users size={26} />
                <h2>Practise with your team</h2>
                <p>
                  Invite people and assign responsibilities. You can add your own roles or give one
                  person several responsibilities.
                </p>
                <button
                  className="button"
                  disabled={busy}
                  onClick={() => void create(kit ? withRecoveryKit(harborAid) : harborAid)}
                >
                  Set up team practice
                  <ArrowRight size={16} />
                </button>
              </section>
            </div>
            <details className="simple-details">
              <summary>Choose a harder starting situation</summary>
              <label className="check-label">
                <input type="checkbox" checked={kit} onChange={(e) => setKit(e.target.checked)} />
                An independent recovery kit is already prepared
              </label>
              <p className="small muted">
                Leave this on for your first practice. Without the kit, the team must recognise that
                its recovery accounts depend on each other and request outside help.
              </p>
            </details>
            {credentials.length > 0 && (
              <details className="simple-details">
                <summary>Previous practice sessions ({credentials.length})</summary>
                {credentials.map((c) => (
                  <button
                    key={c.id}
                    className="saved-room"
                    onClick={() => navigate(`/room/${c.id}`)}
                  >
                    <History size={17} />
                    <div>
                      <strong>{c.name}</strong>
                      <small>{new Date(c.createdAt).toLocaleString()}</small>
                    </div>
                    <ArrowRight size={15} />
                  </button>
                ))}
              </details>
            )}
          </>
        )}
      </main>
    </div>
  );
}
