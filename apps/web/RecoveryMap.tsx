import { useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  type NodeProps,
  type Node,
  type Edge,
} from '@xyflow/react';
import {
  KeyRound,
  Mail,
  Smartphone,
  Users,
  Laptop,
  Archive,
  Files,
  CalendarDays,
  MessagesSquare,
  Globe,
  ShieldCheck,
  LockKeyhole,
  CircleHelp,
} from 'lucide-react';
import type { Blueprint, Analysis, ResourceState, Resource } from '../../packages/domain/model';
import '@xyflow/react/dist/style.css';

const icons: Record<string, typeof KeyRound> = {
  work: KeyRound,
  backup: Mail,
  phone: Smartphone,
  custodian: Users,
  device: Laptop,
  kit: Archive,
  files: Files,
  roster: CalendarDays,
  chat: MessagesSquare,
  website: Globe,
  operations: ShieldCheck,
};
const labels: Record<ResourceState, string> = {
  available: 'Available now',
  recoverable: 'Recovery route exists',
  blocked: 'No documented route',
  uncertain: 'Needs confirmation',
  compromised: 'Access compromised',
};
type ResourceNode = Node<
  { resource: Resource; state: ResourceState; canRecover: boolean; selected: boolean },
  'resource'
>;
function ResourceCard({ data }: NodeProps<ResourceNode>) {
  const Icon = icons[data.resource.id] ?? KeyRound;
  return (
    <div className={`resource-node ${data.state} ${data.selected ? 'is-selected' : ''}`}>
      <Handle type="target" position={Position.Left} />
      <div className="node-heading">
        <span className="node-icon">
          <Icon size={18} />
        </span>
        <span className="node-kind">{data.resource.kind}</span>
        {data.state === 'compromised' && <LockKeyhole size={14} />}
      </div>
      <strong>{data.resource.label}</strong>
      <span className="node-status">
        <i />
        {data.state === 'compromised' && data.canRecover
          ? 'Compromised · route exists'
          : labels[data.state]}
      </span>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
const nodeTypes = { resource: ResourceCard };

export function RecoveryMap({
  blueprint,
  analysis,
  selected,
  onSelect,
}: {
  blueprint: Blueprint;
  analysis: Analysis;
  selected: string;
  onSelect: (id: string) => void;
}) {
  const nodes = useMemo<ResourceNode[]>(
    () =>
      blueprint.resources.map((r) => {
        const status = analysis.resources.find((x) => x.id === r.id)!;
        return {
          id: r.id,
          type: 'resource',
          position: { x: r.column * 280, y: r.row * 130 },
          data: {
            resource: r,
            state: status.state,
            canRecover: status.canRecover,
            selected: selected === r.id,
          },
          ariaLabel: `${r.label}: ${labels[status.state]}`,
        };
      }),
    [blueprint, analysis, selected],
  );
  const edges = useMemo<Edge[]>(() => {
    // Collapse intermediate facts into resource relationships. The inspector retains exact AND requirements.
    function owners(fact: string, seen = new Set<string>()): string[] {
      if (seen.has(fact)) return [];
      const direct = blueprint.resources.find((r) => r.fact === fact || r.controlFact === fact);
      if (direct) return [direct.id];
      const visited = new Set([...seen, fact]);
      return blueprint.rules
        .filter((r) => r.enabled && r.grants.includes(fact))
        .flatMap((r) => r.requiresAll.flatMap((f) => owners(f, visited)));
    }
    const relationships = new Map<string, [string, string, string]>();
    for (const rule of blueprint.rules.filter((r) => r.enabled)) {
      const targets = blueprint.resources.filter(
        (r) =>
          rule.grants.includes(r.fact) || (r.controlFact && rule.grants.includes(r.controlFact)),
      );
      for (const target of targets)
        for (const fact of rule.requiresAll)
          for (const source of owners(fact)) {
            if (source !== target.id)
              relationships.set(`${source}-${target.id}`, [
                source,
                target.id,
                rule.kind === 'action' ? 'Recovery' : '',
              ]);
          }
    }
    return [...relationships.values()].map(([source, target, label]) => {
      const from = analysis.resources.find((x) => x.id === source),
        to = analysis.resources.find((x) => x.id === target);
      const bad = !from?.canRecover || !to?.canRecover;
      return {
        id: `${source}-${target}`,
        source,
        target,
        type: 'smoothstep',
        label: label === 'Reset' || label === 'Recovery' ? label : undefined,
        animated: false,
        style: {
          stroke: bad ? '#904d42' : '#576465',
          strokeWidth: selected === source || selected === target ? 2 : 1.2,
          strokeDasharray: bad ? '5 5' : undefined,
        },
        labelStyle: { fill: '#a9b2b3', fontSize: 12 },
        labelBgStyle: { fill: '#191d20' },
        zIndex: 0,
      };
    });
  }, [analysis, blueprint, selected]);
  return (
    <div className="graph-shell" aria-label="Recovery dependency map">
      <div className="graph-label">
        <span>DEPENDENCY MAP</span>
        <span>
          <CircleHelp size={13} /> Select a resource to inspect its recovery methods
        </span>
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={(_, n) => onSelect(n.id)}
        fitView
        fitViewOptions={{ padding: 0.14 }}
        minZoom={0.4}
        maxZoom={1.6}
        nodesDraggable={false}
        nodesConnectable={false}
        colorMode="dark"
        proOptions={{ hideAttribution: false }}
      >
        <Background color="#384044" gap={22} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
      <div className="graph-legend">
        <span>
          <i className="legend-available" />
          Available
        </span>
        <span>
          <i className="legend-blocked" />
          Blocked / compromised
        </span>
        <span>
          <i className="legend-recovery" />
          Recovery possible
        </span>
        <small>Methods may require several resources together.</small>
      </div>
    </div>
  );
}
