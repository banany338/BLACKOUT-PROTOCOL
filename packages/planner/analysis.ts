import { analyze, factLabel, routeTo } from '../domain/engine';
import {
  blueprintSchema,
  type Analysis,
  type Blueprint,
  type Failure,
  type Resource,
} from '../domain/model';
import { type Plan } from './model';

export const capability = (id: string) => `asset-${id}.available`;
const normalRule = (id: string) => `available-${id}`;

export function toBlueprint(plan: Plan): Blueprint {
  const counters: Record<number, number> = { 0: 0, 1: 0, 2: 0 };
  const resources: Resource[] = plan.assets.map((asset) => {
    const column = asset.kind === 'account' ? 1 : 0;
    return {
      id: asset.id,
      label: asset.label,
      kind: asset.kind,
      fact: capability(asset.id),
      owner: asset.owner || plan.owner,
      description: asset.note || 'Availability and dependencies entered by the owner.',
      column,
      row: counters[column]++,
    };
  });
  const rules: Blueprint['rules'] = plan.assets
    .filter((a) => a.requiresAll.length)
    .map((a) => ({
      id: normalRule(a.id),
      label: `Access ${a.label}`,
      kind: 'derived',
      requiresAll: [`asset-${a.id}.present`, ...a.requiresAll.map(capability)],
      grants: [capability(a.id)],
      enabled: a.available,
      evidence: 'user-reported',
      sourceNote: a.note || 'Owner-reported access dependency.',
    }));
  for (const method of plan.methods)
    rules.push({
      id: `method-${method.id}`,
      label: method.label,
      kind: 'action',
      requiresAll: method.requiresAll.map(capability),
      grants: [capability(method.accountId)],
      enabled: true,
      evidence: method.evidence,
      sourceNote: method.note || 'Owner must confirm this recovery procedure with the provider.',
      lastReviewedAt: method.reviewedAt,
    });
  for (const activity of plan.activities) {
    resources.push({
      id: `activity-${activity.id}`,
      label: activity.label,
      kind: 'activity',
      fact: `activity-${activity.id}.available`,
      owner: activity.owner || plan.owner,
      description: 'Requires every selected account or resource.',
      column: 2,
      row: counters[2]++,
    });
    rules.push({
      id: `activity-${activity.id}`,
      label: `Continue: ${activity.label}`,
      kind: 'derived',
      requiresAll: activity.requiresAll.map(capability),
      grants: [`activity-${activity.id}.available`],
      enabled: true,
      evidence: 'user-reported',
      sourceNote: 'Activity dependencies entered by the owner.',
    });
  }
  // A declared capability remains known to schema validation even when its resource is unavailable.
  for (const asset of plan.assets.filter((a) => !a.requiresAll.length))
    rules.push({
      id: normalRule(asset.id),
      label: `Declared availability of ${asset.label}`,
      kind: 'derived',
      requiresAll: [],
      grants: [capability(asset.id)],
      enabled: false,
      evidence: 'user-reported',
      sourceNote: 'Availability is an input, not an executable recovery method.',
    });
  return blueprintSchema.parse({
    id: plan.id,
    version: plan.version,
    name: plan.name,
    description: plan.source,
    resources,
    rules,
    initialFacts: plan.assets
      .filter((a) => a.available || a.requiresAll.length)
      .map((a) => (a.requiresAll.length ? `asset-${a.id}.present` : capability(a.id))),
    targets: plan.activities.map((a) => ({
      id: a.id,
      label: a.label,
      fact: `activity-${a.id}.available`,
    })),
    assumptions: [
      'This analysis uses your declared arrangements. It has not signed in to or tested any provider.',
      'A recovery route establishes a modelled path to access. After suspected compromise, containment and trust must be checked separately.',
      'Each method requires all of its listed resources. Separate methods are alternatives.',
      ...(plan.proposed
        ? [
            'This is a proposed version. Its new arrangements still need implementation and testing.',
          ]
        : []),
    ],
    followUps: plan.tasks,
    improved: plan.proposed,
  });
}

export function lossScenario(plan: Plan, lostIds: string[]): Failure {
  const lost = plan.assets.filter((a) => lostIds.includes(a.id));
  return {
    id: 'declared-loss',
    label: lost.length
      ? `Unavailable: ${lost.map((a) => a.label).join(', ')}`
      : 'Current declared access',
    description: lost.length
      ? 'Selected resources and their normal access are removed. Recovery methods remain available only if their prerequisites can be satisfied.'
      : 'Resources marked available and their recorded dependencies define the starting point.',
    removes: lost.flatMap((a) => [capability(a.id), `asset-${a.id}.present`]),
    adds: [],
    disabledRules: lost.map((a) => normalRule(a.id)),
    compromised: [],
  };
}
export function checkPlan(plan: Plan, lostIds: string[]) {
  const blueprint = toBlueprint(plan),
    failure = lossScenario(plan, lostIds);
  return { blueprint, analysis: analyze(blueprint, failure) };
}
export function failureSweep(plan: Plan) {
  return plan.assets
    .map((asset) => ({ asset, ...checkPlan(plan, [asset.id]) }))
    .sort(
      (a, b) =>
        a.analysis.targets.filter((t) => t.reachable).length -
          b.analysis.targets.filter((t) => t.reachable).length ||
        a.asset.label.localeCompare(b.asset.label),
    );
}
export type Improvement = {
  id: string;
  title: string;
  explanation: string;
  plan: Plan;
  analysis: Analysis;
  gain: number;
  addedAssumptions: string[];
};
export function improvements(plan: Plan, lostIds: string[]): Improvement[] {
  const baseline = checkPlan(plan, lostIds).analysis;
  const candidates: Omit<Improvement, 'analysis' | 'gain'>[] = [];
  for (const material of plan.assets.filter(
    (a) => a.kind === 'artifact' && a.available && a.requiresAll.length,
  )) {
    const next = structuredClone(plan);
    next.assets.find((a) => a.id === material.id)!.requiresAll = [];
    next.proposed = true;
    next.version++;
    candidates.push({
      id: `independent-${material.id}`,
      title: `Keep ${material.label} independently accessible`,
      explanation: 'Remove the account or device dependency from retrieving this material.',
      plan: next,
      addedAssumptions: [
        `An authorised owner can retrieve ${material.label} without ${material.requiresAll.map((id) => plan.assets.find((a) => a.id === id)!.label).join(' or ')}.`,
      ],
    });
  }
  for (const account of plan.assets.filter(
    (a) => a.kind === 'account' && !baseline.reachable.includes(capability(a.id)),
  )) {
    const next = structuredClone(plan),
      resourceId = `independent-${account.id}`.slice(0, 78);
    if (
      next.assets.some((a) => a.id === resourceId) ||
      next.methods.some((m) => m.id === resourceId) ||
      next.assets.length >= 100 ||
      next.methods.length >= 300
    )
      continue;
    next.assets.push({
      id: resourceId,
      label: `Independent method: ${account.label}`.slice(0, 100),
      kind: 'artifact',
      owner: account.owner || plan.owner,
      available: true,
      requiresAll: [],
      note: 'Proposed only. Confirm a supported independent method and where the owner can retrieve it.',
    });
    next.methods.push({
      id: resourceId,
      accountId: account.id,
      label: `Recover ${account.label} independently`.slice(0, 150),
      requiresAll: [resourceId],
      evidence: 'user-reported',
      note: 'Hypothesis: the provider supports this method, the owner has configured it, and its recovery material is independently accessible.',
      reviewedAt: '',
    });
    next.proposed = true;
    next.version++;
    candidates.push({
      id: resourceId,
      title: `Add an independent method for ${account.label}`,
      explanation:
        'Evaluate one additional recovery method while keeping the same failure and activities.',
      plan: next,
      addedAssumptions: [
        'The provider supports a method independent of the lost resources.',
        'An authorised owner configures it and can retrieve its material when needed.',
      ],
    });
  }
  return candidates
    .map((candidate) => {
      const analysis = checkPlan(candidate.plan, lostIds).analysis;
      return {
        ...candidate,
        analysis,
        gain:
          analysis.targets.filter((t) => t.reachable).length -
          baseline.targets.filter((t) => t.reachable).length,
      };
    })
    .filter((c) => c.gain > 0)
    .sort((a, b) => b.gain - a.gain || a.id.localeCompare(b.id))
    .slice(0, 3);
}
export function explainRoute(fact: string, analysis: Analysis, blueprint: Blueprint) {
  return routeTo(fact, analysis, blueprint)
    .filter((r) => r.kind === 'action')
    .map((r) => ({
      label: r.label,
      requires: r.requiresAll.map((f) => factLabel(f, blueprint)),
      evidence: r.evidence,
      note: r.sourceNote,
    }));
}
