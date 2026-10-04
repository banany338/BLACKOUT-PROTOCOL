import { saveEncryptedWorkspace } from '../../../packages/planner/storage';
import { ExportDialog, type ExportFile } from './ExportDialog';
import { useEffect, useRef, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Check,
  CheckCircle2,
  Download,
  FileUp,
  Fingerprint,
  FolderOpen,
  History,
  LockKeyhole,
  Network,
  Plus,
  Settings2,
  ShieldCheck,
  X,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import {
  planSchema,
  newId,
  starterPlan,
  workspaceSchema,
  type Plan,
  type Workspace as WorkspaceData,
} from '../../../packages/planner/model';
import { type Improvement } from '../../../packages/planner/analysis';
import {
  createVault,
  seal,
  unlock,
  VAULT_KEY,
  type VaultAccess,
} from '../../../packages/planner/vault';
import { recoveryReport } from '../../../packages/planner/report';
import { importGoogleDirectory } from '../../../packages/planner/import';
import { download, readStorage } from '../api';
import type { RoomCredential } from '../Room';
import { PlanEditor } from './PlanEditor';
import { ServiceEditor } from './ServiceEditor';
import { PlanOverview } from './PlanOverview';
import { BlackoutCheck } from './BlackoutCheck';
import { VaultGate } from './VaultGate';
import { ShareTeamDialog } from './ShareTeamDialog';

type Screen = 'plan' | 'check' | 'actions' | 'backup';
const sections = [
  { id: 'plan', label: 'My plan', icon: FolderOpen },
  { id: 'check', label: 'Check a problem', icon: Activity },
  { id: 'actions', label: 'Next steps', icon: ShieldCheck },
] as const;
export function Workspace({
  onPractice,
  onTeamRoom,
}: {
  onPractice: () => void;
  onTeamRoom: (id: string) => void;
}) {
  const [exportFile, setExportFile] = useState<ExportFile>();
  const [shareTeam, setShareTeam] = useState(false);
  const savedSnapshot = useRef<string | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceData>(),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const [serviceEditor, setServiceEditor] = useState<{ plan?: Plan; resourceId?: string }>();
  const [screen, setScreen] = useState<Screen>('plan'),
    [editor, setEditor] = useState<Plan>(),
    [lost, setLost] = useState<string[]>([]);
  const [offlineReady, setOfflineReady] = useState(false),
    [backupPass, setBackupPass] = useState(''),
    [backupFile, setBackupFile] = useState<File>(),
    [newPass, setNewPass] = useState(''),
    [newPassAgain, setNewPassAgain] = useState('');
  const access = useRef<VaultAccess | undefined>(undefined),
    data = useRef<WorkspaceData | undefined>(undefined),
    savingRef = useRef(false);
  const plan = workspace?.plans.find((p) => p.id === workspace.activeId) ?? workspace?.plans[0];
  useEffect(() => {
    if ('serviceWorker' in navigator && location.protocol !== 'file:' && import.meta.env.PROD) {
      void navigator.serviceWorker
        .register('/sw.js')
        .then(() => navigator.serviceWorker.ready)
        .then(() => setOfflineReady(true))
        .catch(() => setOfflineReady(false));
    }
  }, []);
  function opened(next: WorkspaceData, key: VaultAccess, snapshot: string) {
    savedSnapshot.current = snapshot;
    access.current = key;
    data.current = next;
    setWorkspace(next);
    setLost([]);
    setScreen('plan');
    setError('');
  }
  function lock() {
    if (savingRef.current) return;
    access.current = undefined;
    data.current = undefined;
    setWorkspace(undefined);
    setExportFile(undefined);
    setEditor(undefined);
    setServiceEditor(undefined);
    setShareTeam(false);
    setBackupPass('');
    setNewPass('');
    setNewPassAgain('');
    setNotice('');
    setError('');
  }
  async function commit(update: (current: WorkspaceData) => WorkspaceData) {
    if (!access.current || !data.current) throw new Error('Unlock the workspace first.');
    if (savingRef.current) throw new Error('Wait for the current save to finish.');
    savingRef.current = true;
    setSaving(true);
    try {
      const next = workspaceSchema.parse(update(structuredClone(data.current)));
      const encrypted = await seal(next, access.current);
      await saveEncryptedWorkspace(savedSnapshot.current, encrypted);
      savedSnapshot.current = encrypted;
      data.current = next;
      setWorkspace(next);
      return next;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }
  async function savePlan(value: Plan, destination: Screen = 'check') {
    await commit((current) => {
      const previous = current.plans.find((p) => p.id === value.id);
      const next = planSchema.parse({
        ...value,
        version: previous ? previous.version + 1 : 1,
        updatedAt: new Date().toISOString(),
      });
      if (previous) current.history = [previous, ...current.history].slice(0, 30);
      current.plans = [next, ...current.plans.filter((p) => p.id !== next.id)];
      current.activeId = next.id;
      return current;
    });
    setEditor(undefined);
    setScreen(destination);
    setLost(
      lost.length
        ? lost.filter((id) => value.assets.some((a) => a.id === id))
        : value.assets
            .filter((a) => a.kind === 'account')
            .slice(0, 1)
            .map((a) => a.id),
    );
    setNotice('Plan encrypted and saved on this device.');
  }
  async function choosePlan(id: string) {
    try {
      await commit((w) => ({ ...w, activeId: id }));
      setLost([]);
      setNotice('');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function exportReport() {
    if (!plan) return;
    setExportFile({
      content: recoveryReport(plan, lost),
      name: 'blackout-recovery-plan.html',
      type: 'text/html',
      readable: true,
    });
    setNotice(
      'Readable plan prepared. Save it with authorised people; it includes the account names and recovery routes you entered.',
    );
  }
  async function backup() {
    try {
      if (!workspace || !access.current) return;
      setExportFile({
        content: await seal(workspace, access.current),
        name: 'blackout-workspace.blackout',
        type: 'application/json',
      });
      setNotice('Encrypted workspace backup prepared. Keep its passphrase separately.');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function importDirectory(file: File) {
    try {
      if (file.size > 2_000_000)
        throw new Error('Choose a Directory JSON export smaller than 2 MB.');
      const imported = importGoogleDirectory(await file.text());
      setEditor(imported);
      setNotice(
        'Review imported contacts. Availability and recovery methods need your confirmation.',
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function importBackup() {
    if (!backupFile) return;
    try {
      if (backupFile.size > 8_100_000) throw new Error('Choose a backup smaller than 8 MB.');
      const restored = await unlock(await backupFile.text(), backupPass);
      await commit((w) => {
        const imported = restored.workspace.plans.map((p) => ({
          ...p,
          id: newId(),
          name: `${p.name} (restored)`.slice(0, 100),
        }));
        return { ...w, plans: [...w.plans, ...imported], activeId: imported[0]?.id ?? w.activeId };
      });
      setBackupPass('');
      setBackupFile(undefined);
      setNotice('Backup plans added. Your existing plans were preserved.');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function changePassphrase(e: React.FormEvent) {
    e.preventDefault();
    if (!workspace || savingRef.current) return;
    setSaving(true);
    savingRef.current = true;
    try {
      if (newPass !== newPassAgain) throw new Error('The passphrases do not match.');
      const nextAccess = await createVault(newPass);
      const encrypted = await seal(workspace, nextAccess);
      await saveEncryptedWorkspace(savedSnapshot.current, encrypted);
      savedSnapshot.current = encrypted;
      access.current = nextAccess;
      setNewPass('');
      setNewPassAgain('');
      setNotice('Workspace passphrase changed. Older backups still use their original passphrase.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
      savingRef.current = false;
    }
  }
  async function acceptProposal(candidate: Improvement) {
    try {
      const proposed = {
        ...candidate.plan,
        id: newId(),
        name: `${plan!.name} — proposed`.slice(0, 100),
        source:
          `Proposal based on ${plan!.name} v${plan!.version}. ${candidate.addedAssumptions.join(' ')}`.slice(
            0,
            500,
          ),
        tasks: [
          ...plan!.tasks,
          {
            id: newId(),
            title: candidate.title.slice(0, 200),
            owner: plan!.owner,
            status: 'proposed' as const,
            note: candidate.addedAssumptions.join(' ').slice(0, 1000),
            reviewDate: '',
          },
        ].slice(0, 30),
      };
      await savePlan(proposed);
      setNotice('Proposed plan saved separately. The original plan is unchanged.');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  if (!workspace)
    return (
      <div className="product-entry">
        <header className="entry-header">
          <Brand />
        </header>
        <VaultGate onOpen={opened} />
      </div>
    );
  return (
    <div className="app-shell product-shell">
      <aside className="sidebar">
        <Brand />

        <nav aria-label="Workspace navigation">
          {sections.map(({ id, label, icon: Icon }, i) => (
            <button
              key={id}
              className={screen === id ? 'active' : ''}
              onClick={() => {
                setScreen(id);
                if (
                  id === 'check' &&
                  !lost.length &&
                  plan?.assets.some((a) => a.kind === 'account')
                )
                  setLost([plan.assets.find((a) => a.kind === 'account')!.id]);
                setError('');
                setNotice('');
                window.scrollTo(0, 0);
              }}
            >
              <Icon size={18} />
              <span>{label}</span>
              <small>0{i + 1}</small>
            </button>
          ))}
        </nav>
        <div className="workspace-card">
          <span className="organisation-avatar">{plan?.name.charAt(0).toUpperCase() || 'B'}</span>
          <div>
            <strong>{plan?.name || 'Your workspace'}</strong>
            <small>{plan?.proposed ? 'Proposed plan' : 'Current plan'}</small>
          </div>
        </div>
        <button className="lock-workspace" disabled={saving} onClick={lock}>
          <LockKeyhole size={15} />
          <span>Lock workspace</span>
        </button>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <span>{saving ? 'Saving…' : 'Your plans stay on this device'}</span>
          <button className="text-button" onClick={() => setScreen('backup')}>
            Save & restore
          </button>
          <button className="mobile-lock text-button" disabled={saving} onClick={lock}>
            <LockKeyhole size={15} />
            Lock
          </button>
          <span className="server-status online">
            <i />
            {location.protocol === 'file:'
              ? 'Portable workspace'
              : offlineReady
                ? 'Available offline'
                : 'Local analysis'}
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
          {plan && (
            <details className="plan-switcher">
              <summary>
                {plan
                  ? `${plan.name} · ${plan.proposed ? 'proposed plan' : 'current plan'}`
                  : 'Manage plans'}
              </summary>
              <div className="workspace-selector">
                <label>
                  Active plan
                  <select
                    disabled={saving || !plan}
                    value={plan?.id ?? ''}
                    onChange={(e) => void choosePlan(e.target.value)}
                  >
                    {workspace.plans.map((p) => (
                      <option value={p.id} key={p.id}>
                        {p.name} · v{p.version}
                        {p.proposed ? ' · proposed' : ''}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="button" disabled={saving} onClick={() => setServiceEditor({})}>
                  <Plus size={16} />
                  New plan
                </button>
                {plan && (
                  <button className="button" disabled={saving} onClick={() => setEditor(plan)}>
                    <Settings2 size={16} />
                    Advanced editor
                  </button>
                )}
              </div>
            </details>
          )}
          {plan?.proposed && (
            <div className="notice-banner">
              <strong>Proposed arrangements.</strong> Set up and confirm these changes before
              relying on them.
            </div>
          )}
          {!plan ? (
            <section className="workspace-empty">
              <div className="empty-map-icon">
                <Network size={36} strokeWidth={1.4} />
              </div>
              <h1>Start with your team's accounts.</h1>
              <p>Add the services you rely on and how you get back in.</p>
              <div className="button-row">
                <button className="button primary" onClick={() => setServiceEditor({})}>
                  Add first service
                  <ArrowRight size={16} />
                </button>
                <details className="simple-details">
                  <summary>Already have a Google administrator export?</summary>
                  <label className="button file-control">
                    <FileUp size={16} />
                    Import Google contacts
                    <input
                      type="file"
                      accept=".json,application/json"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void importDirectory(f);
                        e.target.value = '';
                      }}
                    />
                  </label>
                </details>
              </div>
            </section>
          ) : (
            <>
              {screen === 'plan' && (
                <PlanOverview
                  plan={plan}
                  onEdit={(resourceId) => setServiceEditor({ plan, resourceId })}
                  onAdd={() => setServiceEditor({ plan })}
                  onCheck={() => {
                    setLost(
                      plan.assets
                        .filter((a) => a.kind === 'account')
                        .slice(0, 1)
                        .map((a) => a.id),
                    );
                    setScreen('check');
                  }}
                />
              )}
              {screen === 'check' && (
                <BlackoutCheck
                  plan={plan}
                  lost={lost}
                  onLost={setLost}
                  onEdit={(resourceId) => setServiceEditor({ plan, resourceId })}
                  onExport={exportReport}
                  onTeam={location.protocol === 'file:' ? undefined : () => setShareTeam(true)}
                  onProposal={(candidate) => void acceptProposal(candidate)}
                  onActions={() => setScreen('actions')}
                  busy={saving}
                />
              )}
              {screen === 'actions' && (
                <ActionPlan
                  key={`${plan.id}-${plan.version}`}
                  plan={plan}
                  busy={saving}
                  onSave={(p) => savePlan(p, 'actions')}
                  onExport={exportReport}
                />
              )}
              {screen === 'backup' && (
                <>
                  <div className="page-heading">
                    <div>
                      <span className="eyebrow">SAVE YOUR WORK</span>
                      <h1>Save a copy. Restore a copy.</h1>
                      <p>
                        Organisation plans stay encrypted in this browser. Export a backup before
                        clearing browser data or moving devices.
                      </p>
                    </div>
                  </div>
                  {location.protocol !== 'file:' && (
                    <details className="simple-details">
                      <summary>Previous team rooms</summary>
                      {readStorage<RoomCredential[]>('blackout-rooms', [])
                        .filter((r) => r.mode === 'organisation')
                        .map((r) => (
                          <button
                            className="saved-room"
                            key={r.id}
                            disabled={saving}
                            onClick={() => {
                              lock();
                              onTeamRoom(r.id);
                            }}
                          >
                            <History size={17} />
                            <div>
                              <strong>{r.name}</strong>
                              <small>{new Date(r.createdAt).toLocaleString()}</small>
                            </div>
                            <ArrowRight size={15} />
                          </button>
                        ))}
                      <p className="small muted">
                        Saved membership applies to this browser. Deleted rooms are no longer
                        available.
                      </p>
                    </details>
                  )}
                  {location.protocol !== 'file:' && (
                    <details className="simple-details">
                      <summary>Optional team practice</summary>
                      <p className="small muted">A separate fictional exercise.</p>
                      <button
                        className="button"
                        disabled={saving}
                        onClick={() => {
                          lock();
                          onPractice();
                        }}
                      >
                        Open practice
                      </button>
                    </details>
                  )}
                  <div className="evidence-grid">
                    <section className="panel">
                      <Download size={28} />
                      <h2>Encrypted backup</h2>
                      <p>
                        Includes your plans and version history. Restore it with the workspace
                        passphrase.
                      </p>
                      <button className="button primary" onClick={() => void backup()}>
                        Download encrypted backup
                      </button>
                      <h3>Import recovery contacts</h3>
                      <p className="small muted">
                        Use a Google Directory users.list JSON response. Only identity and
                        recovery-contact fields are retained, and all imported methods start
                        unconfirmed.
                      </p>
                      <label className="button file-control">
                        <FileUp size={16} />
                        Choose Directory JSON
                        <input
                          type="file"
                          accept=".json,application/json"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void importDirectory(f);
                            e.target.value = '';
                          }}
                        />
                      </label>
                    </section>
                    <section className="panel">
                      <FolderOpen size={28} />
                      <h2>Restore another backup</h2>
                      <p>
                        Restored plans are added as copies. Existing plans stay in your workspace.
                      </p>
                      <label>
                        Encrypted backup
                        <input
                          type="file"
                          accept=".blackout,application/json"
                          onChange={(e) => setBackupFile(e.target.files?.[0])}
                        />
                      </label>
                      <label>
                        Backup passphrase
                        <input
                          type="password"
                          autoComplete="off"
                          value={backupPass}
                          onChange={(e) => setBackupPass(e.target.value)}
                        />
                      </label>
                      <button
                        className="button"
                        disabled={saving || !backupFile || !backupPass}
                        onClick={() => void importBackup()}
                      >
                        Restore as additional plans
                      </button>
                    </section>
                    <section className="panel">
                      <LockKeyhole size={28} />
                      <h2>Change workspace passphrase</h2>
                      <form onSubmit={(e) => void changePassphrase(e)}>
                        <label>
                          New passphrase
                          <input
                            type="password"
                            autoComplete="new-password"
                            minLength={12}
                            maxLength={1024}
                            required
                            value={newPass}
                            onChange={(e) => setNewPass(e.target.value)}
                          />
                        </label>
                        <label>
                          Confirm new passphrase
                          <input
                            type="password"
                            autoComplete="new-password"
                            minLength={12}
                            maxLength={1024}
                            required
                            value={newPassAgain}
                            onChange={(e) => setNewPassAgain(e.target.value)}
                          />
                        </label>
                        <button className="button" disabled={saving}>
                          Update passphrase
                        </button>
                      </form>
                      <p className="small muted">
                        Existing backups keep their original passphrase.
                      </p>
                    </section>
                    <section className="panel">
                      <History size={28} />
                      <h2>Earlier versions</h2>
                      <p className="small muted">
                        The most recent 30 versions are retained. Restore a version as a separate
                        plan.
                      </p>
                      {workspace.history.length ? (
                        workspace.history.map((p, i) => (
                          <button
                            className="saved-room"
                            key={`${p.id}-${p.version}-${i}`}
                            disabled={saving}
                            onClick={() =>
                              void savePlan({
                                ...p,
                                id: newId(),
                                name: `${p.name} — restored v${p.version}`.slice(0, 100),
                              }).catch((e) => setError(e.message))
                            }
                          >
                            <div>
                              <strong>
                                {p.name} · v{p.version}
                              </strong>
                              <small>{new Date(p.updatedAt).toLocaleString()}</small>
                            </div>
                            <RefreshCw size={15} />
                          </button>
                        ))
                      ) : (
                        <p className="muted">Saved edits will appear here.</p>
                      )}
                    </section>
                  </div>
                  <section className="panel workspace-boundaries">
                    <h3>What this protects</h3>
                    <p>
                      Saved workspace data and backups use authenticated encryption. The unlocked
                      page can read your plans, so lock the workspace on shared devices. Readable
                      HTML exports are unencrypted. No application can protect your data from a
                      compromised device or malicious browser extension.
                    </p>
                    {location.protocol !== 'file:' && (
                      <button
                        className="text-button"
                        disabled={saving}
                        onClick={() => {
                          lock();
                          onPractice();
                        }}
                      >
                        Open optional team practice
                      </button>
                    )}
                  </section>
                </>
              )}
            </>
          )}
        </main>
        <footer className="app-footer">
          <span>BLACKOUT PROTOCOL / PREPARE. UNDERSTAND. RECOVER.</span>
          <span>Plans are analysed on this device.</span>
        </footer>
      </div>
      {exportFile && <ExportDialog file={exportFile} onClose={() => setExportFile(undefined)} />}
      {shareTeam && plan && (
        <ShareTeamDialog
          plan={plan}
          lost={lost}
          onClose={() => setShareTeam(false)}
          onCreated={(id) => {
            lock();
            onTeamRoom(id);
          }}
        />
      )}
      {serviceEditor && (
        <ServiceEditor
          plan={serviceEditor.plan}
          resourceId={serviceEditor.resourceId}
          busy={saving}
          onClose={() => setServiceEditor(undefined)}
          onSave={async (p) => {
            await savePlan(p, screen === 'check' ? 'check' : 'plan');
            setServiceEditor(undefined);
          }}
        />
      )}
      {editor && (
        <PlanEditor
          value={editor}
          onSave={savePlan}
          onClose={() => setEditor(undefined)}
          busy={saving}
        />
      )}
    </div>
  );
}
function Brand() {
  return (
    <div className="brand">
      <span className="brand-symbol">
        b<span>_</span>
      </span>
      <span>
        BLACKOUT
        <br />
        <b>PROTOCOL</b>
      </span>
    </div>
  );
}
function ActionPlan({
  plan,
  busy,
  onSave,
  onExport,
}: {
  plan: Plan;
  busy: boolean;
  onSave: (p: Plan) => Promise<void>;
  onExport: () => void;
}) {
  const [tasks, setTasks] = useState(() => structuredClone(plan.tasks)),
    [error, setError] = useState('');
  const update = (index: number, key: string, value: string) =>
    setTasks((prev) => prev.map((t, i) => (i === index ? { ...t, [key]: value } : t)));
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">STEP 3 OF 3 · NEXT STEPS</span>
          <h1>What will you prepare?</h1>
          <p>
            Write a task, choose who will do it, and record when it has been tried. Completing a
            task does not automatically change the recovery check.
          </p>
        </div>
        <button className="button" onClick={onExport}>
          <Download size={16} />
          Save a readable plan
        </button>
      </div>
      <section className="panel follow-up-panel">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void onSave({ ...plan, tasks }).catch((e) => setError(e.message));
          }}
        >
          {tasks.length === 0 && (
            <div className="empty-card">
              Add an action for a missing method, an independent copy, or a provider procedure that
              needs confirmation.
            </div>
          )}
          <div className="follow-up-list">
            {tasks.map((t, i) => (
              <fieldset key={t.id}>
                <legend>Action {i + 1}</legend>
                <label>
                  Action
                  <input
                    required
                    maxLength={200}
                    value={t.title}
                    onChange={(e) => update(i, 'title', e.target.value)}
                  />
                </label>
                <div className="follow-up-fields">
                  <label>
                    Owner
                    <input
                      maxLength={100}
                      value={t.owner}
                      onChange={(e) => update(i, 'owner', e.target.value)}
                    />
                  </label>
                  <label>
                    Status
                    <select value={t.status} onChange={(e) => update(i, 'status', e.target.value)}>
                      <option value="proposed">Proposed</option>
                      <option value="implemented">Owner marks implemented</option>
                      <option value="tested">Owner marks tested</option>
                    </select>
                  </label>
                  <label>
                    Review date
                    <input
                      type="date"
                      value={t.reviewDate}
                      onChange={(e) => update(i, 'reviewDate', e.target.value)}
                    />
                  </label>
                </div>
                <label>
                  Evidence or outcome
                  <textarea
                    rows={2}
                    maxLength={1000}
                    value={t.note}
                    onChange={(e) => update(i, 'note', e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setTasks(tasks.filter((x) => x.id !== t.id))}
                >
                  Remove action
                </button>
              </fieldset>
            ))}
          </div>
          {error && (
            <p role="alert" className="error-banner">
              {error}
            </p>
          )}
          <div className="button-row">
            <button
              type="button"
              className="button"
              disabled={tasks.length >= 30}
              onClick={() =>
                setTasks([
                  ...tasks,
                  {
                    id: newId(),
                    title: '',
                    owner: plan.owner,
                    status: 'proposed',
                    note: '',
                    reviewDate: '',
                  },
                ])
              }
            >
              <Plus size={16} />
              Add action
            </button>
            <button className="button primary" disabled={busy}>
              <Check size={16} />
              Save actions
            </button>
          </div>
        </form>
      </section>
    </>
  );
}
