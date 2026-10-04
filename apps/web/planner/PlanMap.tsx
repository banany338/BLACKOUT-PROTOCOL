import { useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  type Node,
  type NodeProps,
  type Edge,
} from '@xyflow/react';
import {
  KeyRound,
  Smartphone,
  Users,
  Archive,
  BriefcaseBusiness,
  Settings2,
  X,
  RotateCcw,
} from 'lucide-react';
import type { Plan } from '../../../packages/planner/model';
import type { Analysis } from '../../../packages/domain/model';
import { checkPlan } from '../../../packages/planner/analysis';
import '@xyflow/react/dist/style.css';

const labels = {
  available: 'Available',
  recoverable: 'Recovery possible',
  blocked: 'No route',
  uncertain: 'Unconfirmed',
  compromised: 'Unavailable',
};
const icons = {
  account: KeyRound,
  device: Smartphone,
  person: Users,
  artifact: Archive,
  activity: BriefcaseBusiness,
};
type CardNode = Node<
  {
    label: string;
    kind: keyof typeof icons;
    state: keyof typeof labels;
    lost: boolean;
    selected: boolean;
    onSelect: () => void;
  },
  'service'
>;
function ServiceCard({ data }: NodeProps<CardNode>) {
  const Icon = icons[data.kind];
  return (
    <div
      className={`service-node ${data.state} ${data.lost ? 'is-lost' : ''} ${data.selected ? 'is-selected' : ''}`}
    >
      <Handle type="target" position={Position.Left} />
      <button
        className="nodrag"
        onClick={data.onSelect}
        aria-label={`Inspect ${data.label}`}
        aria-pressed={data.selected}
      >
        <Icon size={18} />
        <strong>{data.label}</strong>
        <span key={`${data.state}-${data.lost}`}>
          <i />
          {data.lost ? 'Selected loss' : labels[data.state]}
        </span>
      </button>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
const nodeTypes = { service: ServiceCard };

export function PlanMap({
  plan,
  lost = [],
  onToggle,
  onEdit,
  analysis: providedAnalysis,
}: {
  plan: Plan;
  lost?: string[];
  onToggle?: (id: string) => void;
  onEdit?: (id: string) => void;
  analysis?: Analysis;
}) {
  const [selected, setSelected] = useState(
    plan.assets.find((a) => a.kind === 'account')?.id ?? plan.assets[0]?.id ?? '',
  );
  const analysis = useMemo(
    () => providedAnalysis ?? checkPlan(plan, lost).analysis,
    [providedAnalysis, plan, lost],
  );
  const asset = plan.assets.find((a) => a.id === selected);
  const activity = plan.activities.find((a) => `activity-${a.id}` === selected);
  const methods = plan.methods.filter((m) => m.accountId === selected);
  const status = analysis.resources.find((r) => r.id === selected);
  const nodes = useMemo<CardNode[]>(() => {
    const rows = [0, 0, 0];
    return [
      ...plan.assets,
      ...plan.activities.map((a) => ({ ...a, id: `activity-${a.id}`, kind: 'activity' as const })),
    ].map((a) => {
      const column = a.kind === 'activity' ? 2 : a.kind === 'account' ? 1 : 0;
      return {
        id: a.id,
        type: 'service',
        position: { x: column * 270, y: rows[column]++ * 118 },
        focusable: false,
        data: {
          label: a.label,
          kind: a.kind,
          state: analysis.resources.find((r) => r.id === a.id)!.state,
          lost:
            lost.includes(a.id) &&
            !(
              providedAnalysis &&
              analysis.resources.find((r) => r.id === a.id)?.state === 'available'
            ),
          selected: selected === a.id,
          onSelect: () => setSelected(a.id),
        },
      };
    });
  }, [plan, analysis, lost, selected, providedAnalysis]);
  const edges = useMemo<Edge[]>(() => {
    const links: Edge[] = [];
    function link(
      source: string,
      target: string,
      id: string,
      recovery = false,
      unknown = false,
      required: string[] = [source],
      enabled = true,
    ) {
      const working =
        enabled &&
        required.every(
          (id) => analysis.resources.find((r) => r.id === id)?.state === 'available',
        ) &&
        (recovery || !lost.includes(target)) &&
        analysis.resources.find((r) => r.id === target)?.state === 'available';
      const routeExists =
        enabled &&
        (recovery || !lost.includes(target)) &&
        required.every((id) => analysis.resources.find((r) => r.id === id)?.canRecover) &&
        analysis.resources.find((r) => r.id === target)?.canRecover;
      links.push({
        id,
        source,
        target,
        type: 'smoothstep',
        label: recovery ? 'Recovery' : undefined,
        style: {
          stroke: unknown ? '#9c9c97' : working ? '#4c7167' : routeExists ? '#a17b23' : '#c34c38',
          strokeWidth: selected === source || selected === target ? 2 : 1.3,
          strokeDasharray: recovery ? '5 4' : undefined,
        },
        labelStyle: { fill: '#53655e', fontSize: 10 },
        labelBgStyle: { fill: '#f6f7f2' },
      });
    }
    // Keep the original relationships visible when access fails, so the consequences can be traced.
    for (const a of plan.assets)
      for (const id of a.requiresAll)
        link(id, a.id, `access-${id}-${a.id}`, false, false, a.requiresAll, a.available);
    for (const m of plan.methods)
      for (const id of m.requiresAll)
        link(
          id,
          m.accountId,
          `recovery-${m.id}-${id}`,
          true,
          m.evidence === 'unknown',
          m.requiresAll,
        );
    for (const a of plan.activities)
      for (const id of a.requiresAll)
        link(id, `activity-${a.id}`, `work-${a.id}-${id}`, false, false, a.requiresAll);
    return links;
  }, [plan, analysis, lost, selected]);
  const named = (ids: string[]) =>
    ids.map((id) => plan.assets.find((a) => a.id === id)?.label ?? id).join(' + ');
  return (
    <div className="plan-map-layout">
      <section className="plan-canvas" aria-label="Your dependency map">
        <div className="map-columns">
          <span>People & backups</span>
          <span>Accounts</span>
          <span>Essential work</span>
        </div>
        <ReactFlow
          key={`${plan.assets.length}-${plan.activities.length}`}
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.16 }}
          minZoom={0.15}
          maxZoom={1.5}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          colorMode="light"
        >
          <Background color="#cbd3cb" gap={24} size={1} />
          <Controls showInteractive={false} />
        </ReactFlow>
        <div className="plan-map-legend">
          <span>
            <i />
            Available
          </span>
          <span>
            <i />
            Recovery possible
          </span>
          <span>
            <i />
            No route
          </span>
          <small>Dashed lines: recovery methods</small>
        </div>
      </section>
      <aside className="map-inspector panel" aria-label="Selected service">
        <label className="map-mobile-picker">
          Inspect a service
          <select value={selected} onChange={(e) => setSelected(e.target.value)}>
            {plan.assets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
            {plan.activities.map((a) => (
              <option key={a.id} value={`activity-${a.id}`}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
        <span className="eyebrow">{activity ? 'ESSENTIAL WORK' : 'SELECTED RESOURCE'}</span>
        <h2>{asset?.label ?? activity?.label ?? 'Select a service'}</h2>
        {status && <span className={`state-tag ${status.state}`}>{labels[status.state]}</span>}
        <dl>
          <dt>Responsible</dt>
          <dd>{asset?.owner || activity?.owner || plan.owner || 'Not assigned'}</dd>
          <dt>Needs access to</dt>
          <dd>
            {named(asset?.requiresAll ?? activity?.requiresAll ?? []) || 'No dependency recorded'}
          </dd>
        </dl>
        {asset?.kind === 'account' && (
          <div className="inspector-methods">
            <h3>Ways back in</h3>
            {methods.length ? (
              methods.map((m) => (
                <details key={m.id}>
                  <summary>
                    {m.label}
                    <small>
                      {m.evidence === 'unknown'
                        ? 'Unconfirmed'
                        : m.evidence === 'user-marked-tested'
                          ? 'Marked as tried'
                          : 'Recorded'}
                    </small>
                  </summary>
                  <p>Needs: {named(m.requiresAll) || 'No prerequisite recorded'}</p>
                  {m.note && <p>{m.note}</p>}
                </details>
              ))
            ) : (
              <p>No recovery method recorded.</p>
            )}
          </div>
        )}
        {asset && onToggle && (
          <button
            className={`button ${lost.includes(asset.id) ? '' : 'primary'}`}
            onClick={() => onToggle(asset.id)}
          >
            {lost.includes(asset.id) ? <RotateCcw size={16} /> : <X size={16} />}
            {lost.includes(asset.id) ? 'Restore in sandbox' : 'Simulate losing this'}
          </button>
        )}
        {onEdit && (
          <button className="text-button" onClick={() => onEdit(selected)}>
            <Settings2 size={15} />
            Edit this service
          </button>
        )}
        {(asset?.note || plan.source) && (
          <details className="inspector-note">
            <summary>Notes</summary>
            <p>{asset?.note || plan.source}</p>
          </details>
        )}
      </aside>
    </div>
  );
}
