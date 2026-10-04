import { useMemo } from 'react';
import { ArrowRight, Download, Plus, X, AlertTriangle, Users } from 'lucide-react';
import type { Plan } from '../../../packages/planner/model';
import {
  capability,
  checkPlan,
  explainRoute,
  failureSweep,
  improvements,
  type Improvement,
} from '../../../packages/planner/analysis';
import { PlanMap } from './PlanMap';
export function BlackoutCheck({
  plan,
  lost,
  onLost,
  onEdit,
  onExport,
  onTeam,
  onProposal,
  onActions,
  busy,
}: {
  plan: Plan;
  lost: string[];
  onLost: (ids: string[]) => void;
  onEdit: (id: string) => void;
  onExport: () => void;
  onTeam?: () => void;
  onProposal: (candidate: Improvement) => void;
  onActions: () => void;
  busy: boolean;
}) {
  const result = useMemo(() => checkPlan(plan, lost), [plan, lost]);
  const suggestions = useMemo(() => (lost.length ? improvements(plan, lost) : []), [plan, lost]);
  const [works, recovery, blocked] = [
    result.analysis.targets.filter((t) => t.current).length,
    result.analysis.targets.filter((t) => t.reachable && !t.current).length,
    result.analysis.targets.filter((t) => !t.reachable).length,
  ];
  function toggle(id: string) {
    onLost(lost.includes(id) ? lost.filter((x) => x !== id) : [...lost, id]);
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">BLACKOUT SANDBOX</span>
          <h1>What if you lose access?</h1>
          <p>Select a loss. Your real accounts stay unchanged.</p>
        </div>
        <div className="button-row">
          {onTeam && (
            <button className="button primary" disabled={busy || !lost.length} onClick={onTeam}>
              <Users size={16} />
              Check with team
            </button>
          )}
          <button className="button" onClick={onExport}>
            <Download size={16} />
            Save a readable plan
          </button>
        </div>
      </div>
      <section className="sandbox-controls" aria-label="Simulated losses">
        <div className="loss-options">
          {plan.assets.map((a) => (
            <button
              key={a.id}
              aria-pressed={lost.includes(a.id)}
              className={lost.includes(a.id) ? 'selected' : ''}
              onClick={() => toggle(a.id)}
            >
              {lost.includes(a.id) ? <X size={14} /> : <Plus size={14} />}
              <span>{a.label}</span>
              <small>{a.kind === 'artifact' ? 'backup' : a.kind}</small>
            </button>
          ))}
        </div>
        <button className="text-button" onClick={() => onLost([])}>
          Reset
        </button>
      </section>
      <div className="sandbox-counts" aria-label="Impact on essential work">
        <span>
          <i />
          {works} still working
        </span>
        <span>
          <i />
          {recovery} recoverable
        </span>
        <span>
          <i />
          {blocked} without a confirmed route
        </span>
      </div>
      <PlanMap key={plan.id} plan={plan} lost={lost} onToggle={toggle} onEdit={onEdit} />
      {result.analysis.cycles.length > 0 && (
        <div className="incident-strip compact-cycle">
          <AlertTriangle size={18} />
          <div>
            <strong>These accounts need each other to recover.</strong>
            <span>
              {result.analysis.cycles
                .map((group) =>
                  plan.assets
                    .filter((a) => group.includes(capability(a.id)))
                    .map((a) => a.label)
                    .join(' ↔ '),
                )
                .filter(Boolean)
                .join('; ')}
            </span>
          </div>
        </div>
      )}
      <section className="sandbox-outcomes" aria-label="Consequences for your work">
        {result.analysis.targets.map((t) => {
          const routes = explainRoute(t.fact, result.analysis, result.blueprint);
          const missing = plan.activities
            .find((a) => a.id === t.id)
            ?.requiresAll.filter((id) => !result.analysis.reachable.includes(capability(id)))
            .map((id) => plan.assets.find((a) => a.id === id)?.label);
          return (
            <article
              className={`panel sandbox-outcome ${t.current ? 'working' : t.reachable ? 'recoverable' : 'blocked'}`}
              key={t.id}
            >
              <h3>{t.label}</h3>
              <span
                className={`state-tag ${t.current ? 'available' : t.reachable ? 'recoverable' : t.uncertain ? 'uncertain' : 'blocked'}`}
              >
                {t.current
                  ? 'Still works'
                  : t.reachable
                    ? 'Recovery steps available'
                    : t.uncertain
                      ? 'Needs confirmation'
                      : 'Needs a backup plan'}
              </span>
              {!t.reachable && (
                <p>
                  {t.uncertain
                    ? 'Ask the owner to confirm the recovery method.'
                    : `Missing access: ${missing?.join(' + ') || 'review the dependencies'}.`}
                </p>
              )}
              {!!routes.length && (
                <details>
                  <summary>Show recovery steps</summary>
                  <ol>
                    {routes.map((r, i) => (
                      <li key={i}>
                        <strong>{r.label}</strong>
                        <span>Needs: {r.requires.join(' + ')}</span>
                        {r.note && <small>{r.note}</small>}
                      </li>
                    ))}
                  </ol>
                </details>
              )}
            </article>
          );
        })}
      </section>
      <section className="sandbox-fixes" aria-label="Possible improvements">
        <div className="section-heading">
          <h2>{suggestions.length ? 'Give your team a way back.' : 'Your next step'}</h2>
          <button className="text-button" onClick={onActions}>
            Assign actions
            <ArrowRight size={15} />
          </button>
        </div>
        {suggestions.length ? (
          suggestions.map((c) => (
            <article className="panel sandbox-fix" key={c.id}>
              <div>
                <span className="eyebrow">
                  PROPOSED ONLY · +{c.gain} RECOVERABLE {c.gain === 1 ? 'ACTIVITY' : 'ACTIVITIES'}
                </span>
                <h3>{c.title}</h3>
                <details>
                  <summary>What needs to be set up?</summary>
                  <ul>
                    {c.addedAssumptions.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                </details>
              </div>
              <button className="button" disabled={busy} onClick={() => onProposal(c)}>
                Keep this as a separate proposal
                <ArrowRight size={15} />
              </button>
            </article>
          ))
        ) : (
          <p className="small muted">
            {!lost.length
              ? 'Select a loss to see its impact.'
              : blocked
                ? 'Review the missing dependencies and add a recovery method.'
                : 'The recorded methods provide a route. Confirm them with the account owners.'}
          </p>
        )}
      </section>
      <details className="simple-details">
        <summary>More checks</summary>
        <button
          className="button"
          onClick={() => onLost(plan.assets.filter((a) => a.kind === 'account').map((a) => a.id))}
        >
          Check with all accounts signed out
        </button>
        <LossSweep
          plan={plan}
          onSelect={(id) => {
            onLost([id]);
            window.scrollTo(0, 0);
          }}
        />
      </details>
    </>
  );
}
function LossSweep({ plan, onSelect }: { plan: Plan; onSelect: (id: string) => void }) {
  const sweep = useMemo(() => failureSweep(plan), [plan]);
  return (
    <section className="failure-sweep">
      {sweep.map((s) => (
        <button key={s.asset.id} onClick={() => onSelect(s.asset.id)}>
          <span>{s.asset.label}</span>
          <span>
            {s.analysis.targets.filter((t) => t.reachable).length} / {s.analysis.targets.length}{' '}
            routes
          </span>
          <ArrowRight size={14} />
        </button>
      ))}
    </section>
  );
}
