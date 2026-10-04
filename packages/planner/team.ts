import { planSchema, type Plan } from './model';
import type { Analysis } from '../domain/model';
import { capability } from './analysis';

export function unconfirmedRecovery(plan: Plan, analysis: Analysis) {
  return plan.methods.filter(
    (method) =>
      method.evidence === 'unknown' &&
      !analysis.current.includes(capability(method.accountId)) &&
      method.requiresAll.every((id) => analysis.possible.includes(capability(id))),
  );
}

/** Only the reviewed map metadata enters a team room. Private notes and tasks stay in the vault. */
export function shareablePlan(plan: Plan): Plan {
  return planSchema.parse({
    id: plan.id,
    version: plan.version,
    name: plan.name,
    owner: plan.owner,
    updatedAt: plan.updatedAt,
    proposed: plan.proposed,
    source: 'Shared map snapshot. Recovery actions in this room are simulated.',
    assets: plan.assets.map((a) => ({
      id: a.id,
      label: a.label,
      kind: a.kind,
      owner: a.owner,
      available: a.available,
      requiresAll: [...a.requiresAll],
      note: '',
    })),
    methods: plan.methods.map((m) => ({
      id: m.id,
      accountId: m.accountId,
      label: m.label,
      requiresAll: [...m.requiresAll],
      evidence: m.evidence,
      note: '',
      reviewedAt: m.reviewedAt,
    })),
    activities: plan.activities.map((a) => ({
      id: a.id,
      label: a.label,
      owner: a.owner,
      requiresAll: [...a.requiresAll],
    })),
    tasks: [],
  });
}
