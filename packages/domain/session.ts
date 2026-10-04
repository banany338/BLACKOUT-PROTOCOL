import type { Analysis, Blueprint, Failure, Role, ViewerRole } from './model';
import type { Plan } from '../planner/model';
import { analyze, applyFailure, closure, factLabel } from './engine';
import { failureById } from './fixture';
import { summarizeExercise, type Debrief } from './debrief';

export type Observation = {
  id: string;
  title: string;
  body: string;
  audience: Role;
  stage: number;
  source: string;
};
export type Event = {
  id: string;
  sequence: number;
  at: string;
  actor: string;
  role: ViewerRole;
  type: string;
  target?: string;
  label: string;
  visibility: 'public' | ViewerRole;
  actionId: string;
};
export type Session = {
  mode?: 'organisation';
  sharedPlan?: Plan;
  lostIds?: string[];
  failure?: Failure;
  id: string;
  blueprint: Blueprint;
  scenarioVersion: string;
  engineVersion: string;
  seed: string;
  phase: 'lobby' | 'running' | 'paused' | 'completed';
  stage: number;
  revision: number;
  facts: string[];
  shared: string[];
  events: Event[];
  startedAt?: string;
  endedAt?: string;
  paymentDecision?: 'verified' | 'approved';
  supportRequested: boolean;
  customRoles?: ExerciseRole[];
};
export type ExerciseRole = {
  id: `custom:${string}`;
  name: string;
  responsibilities: Role[];
  accountIds?: string[];
};
export const responsibilityNames: Record<Role, string> = {
  administrator: 'Account recovery',
  finance: 'Payment checks',
  coordinator: 'Team communication',
};
export function responsibilitiesFor(s: Pick<Session, 'customRoles'>, role: ViewerRole): Role[] {
  if (role === 'facilitator') return ['administrator', 'finance', 'coordinator'];
  if (role === 'administrator' || role === 'finance' || role === 'coordinator') return [role];
  return s.customRoles?.find((r) => r.id === role)?.responsibilities ?? [];
}
export function exerciseRoleName(s: Pick<Session, 'customRoles'>, role: ViewerRole): string {
  const names: Record<string, string> = {
    facilitator: 'Host · all responsibilities',
    administrator: 'Account lead',
    finance: 'Payments lead',
    coordinator: 'Team coordinator',
    observer: 'Observer',
    pending: 'Waiting for an assignment',
  };
  return names[role] ?? s.customRoles?.find((r) => r.id === role)?.name ?? 'Unassigned';
}
export type Participant = { id: string; name: string; role: ViewerRole };
export type Command = { id: string; revision: number; type: string; target?: string };
export type ActionView = {
  id: string;
  label: string;
  role: ViewerRole;
  disabledReason?: string;
  category: 'recovery' | 'decision' | 'coordination';
};
export type SessionView = {
  mode?: 'organisation';
  sharedPlan?: Plan;
  lostIds?: string[];
  id: string;
  blueprint: Blueprint;
  phase: Session['phase'];
  stage: number;
  revision: number;
  role: ViewerRole;
  me: Participant;
  participants: Participant[];
  observations: (Observation & { shared: boolean })[];
  events: Event[];
  actions: ActionView[];
  analysis: Analysis;
  startedAt?: string;
  endedAt?: string;
  paymentDecision?: Session['paymentDecision'];
  supportRequested: boolean;
  joinPath?: string;
  joinUrls?: string[];
  customRoles: ExerciseRole[];
  responsibilities: Role[];
  debrief: Debrief;
};

export class DomainError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export function newSession(
  id: string,
  blueprint: Blueprint,
  team?: { plan: Plan; lostIds: string[]; failure: Failure },
): Session {
  return {
    ...(team
      ? {
          mode: 'organisation' as const,
          sharedPlan: structuredClone(team.plan),
          lostIds: [...team.lostIds],
          failure: structuredClone(team.failure),
        }
      : {}),
    id,
    blueprint: structuredClone(blueprint),
    scenarioVersion: team ? 'organisation-check-1' : 'lockout-1',
    engineVersion: '1',
    seed: team ? 'owner-declared-map' : 'harbor-fixed-1',
    phase: 'lobby',
    stage: 0,
    revision: 0,
    facts: [...blueprint.initialFacts],
    shared: [],
    events: [],
    supportRequested: false,
  };
}

export function availableActions(s: Session, p: Participant): ActionView[] {
  if (s.phase !== 'running' || ['pending', 'observer'].includes(p.role)) return [];
  const activeRules = s.blueprint.rules.filter((r) => !s.failure?.disabledRules.includes(r.id));
  const current = closure(s.facts, activeRules, false).facts;
  const can = (role: Role) => responsibilitiesFor(s, p.role).includes(role);
  const owns = (grants: string[]) => {
    if (!s.mode || p.role === 'facilitator' || p.role === 'administrator') return true;
    const accounts =
      s.sharedPlan?.assets.filter(
        (a) => a.kind === 'account' && grants.includes(`asset-${a.id}.available`),
      ) ?? [];
    const scope = s.customRoles?.find((r) => r.id === p.role)?.accountIds ?? [];
    return !!accounts.length && accounts.every((a) => scope.includes(a.id));
  };
  const result: ActionView[] = s.blueprint.rules
    .filter(
      (r) =>
        r.kind === 'action' &&
        r.enabled &&
        can(r.responsibleRole ?? 'administrator') &&
        owns(r.grants),
    )
    .map((r) => ({
      id: `rule:${r.id}`,
      label: r.label,
      role: r.responsibleRole ?? 'administrator',
      category: 'recovery',
      disabledReason: r.grants.every((f) => current.has(f))
        ? 'Outcome already available'
        : r.evidence === 'unknown'
          ? 'Recovery method needs confirmation'
          : r.requiresAll.some((f) => !current.has(f))
            ? `Requires: ${r.requiresAll
                .filter((f) => !current.has(f))
                .map((f) => factLabel(f, s.blueprint))
                .join(', ')}`
            : undefined,
    }));
  if (!s.mode && s.stage >= 2 && can('finance')) {
    result.push({
      id: 'verify-payment',
      label: 'Verify through the known contact',
      role: 'finance',
      category: 'decision',
      disabledReason: s.paymentDecision
        ? 'Decision already recorded'
        : !s.shared.includes('known-contact')
          ? 'Ask someone handling team communication to share the trusted-contact clue'
          : undefined,
    });
    result.push({
      id: 'approve-payment',
      label: 'Approve the urgent request',
      role: 'finance',
      category: 'decision',
      disabledReason: s.paymentDecision ? 'Decision already recorded' : undefined,
    });
  }
  if (!s.mode && can('administrator'))
    result.push({
      id: 'support',
      label: 'Escalate to provider support',
      role: 'administrator',
      category: 'coordination',
      disabledReason: s.supportRequested
        ? 'Awaiting external support; completion time unknown'
        : undefined,
    });
  return result;
}

export function reduceCommand(
  s: Session,
  p: Participant,
  command: Command,
  observations: Observation[],
  now = new Date().toISOString(),
): Session {
  if (command.revision !== s.revision)
    throw new DomainError('The exercise changed. Review the latest state and try again.', 409);
  const next = structuredClone(s);
  let label = '',
    visibility: Event['visibility'] = 'public';
  const facilitator = () => {
    if (p.role !== 'facilitator') throw new DomainError('Only the facilitator can do this.', 403);
  };
  if (command.type === 'start') {
    facilitator();
    if (s.phase !== 'lobby') throw new DomainError('This exercise has already started.');
    next.phase = 'running';
    next.stage = 1;
    next.startedAt = now;
    next.facts = applyFailure(s.blueprint.initialFacts, s.failure ?? failureById('work-lockout'));
    label = s.mode
      ? `Simulated loss: ${s.failure!.label}`
      : 'Work identity lost: credentials changed and work sessions revoked.';
  } else if (command.type === 'advance') {
    facilitator();
    if (s.mode) throw new DomainError('This team check has no story chapters.');
    if (s.phase !== 'running' || s.stage >= 4)
      throw new DomainError('No next chapter is available.');
    next.stage++;
    label = `Chapter ${next.stage} opened.`;
  } else if (command.type === 'pause') {
    facilitator();
    if (s.phase !== 'running') throw new DomainError('The exercise is not running.');
    next.phase = 'paused';
    label = 'Exercise paused.';
  } else if (command.type === 'resume') {
    facilitator();
    if (s.phase !== 'paused') throw new DomainError('The exercise is not paused.');
    next.phase = 'running';
    label = 'Exercise resumed.';
  } else if (command.type === 'complete') {
    facilitator();
    if (!['running', 'paused'].includes(s.phase))
      throw new DomainError('Start the exercise before completing it.');
    next.phase = 'completed';
    next.endedAt = now;
    label = 'Exercise completed. Debrief ready.';
  } else if (command.type === 'share') {
    if (s.mode) throw new DomainError('This team check uses shared map information.');
    if (s.phase !== 'running')
      throw new DomainError('Observations can be shared during the exercise.');
    const observation = observations.find((o) => o.id === command.target && o.stage <= s.stage);
    if (!observation || !responsibilitiesFor(s, p.role).includes(observation.audience))
      throw new DomainError('This observation is not available to your role.', 403);
    if (s.shared.includes(observation.id))
      throw new DomainError('This observation is already shared.');
    next.shared.push(observation.id);
    label = `Shared observation: ${resolveObservation(observation, s).title}`;
  } else if (command.type === 'act') {
    const action = availableActions(s, p).find((a) => a.id === command.target);
    if (!action) throw new DomainError('This action is not available to your role.', 403);
    if (action.disabledReason) throw new DomainError(action.disabledReason);
    if (action.id.startsWith('rule:')) {
      const rule = s.blueprint.rules.find((r) => `rule:${r.id}` === action.id)!;
      next.facts = [...new Set([...s.facts, ...rule.grants])];
      label = `${action.label} completed in the simulation.`;
    } else if (action.id === 'verify-payment') {
      next.paymentDecision = 'verified';
      label = 'Independent verification rejected the impersonated payment request.';
    } else if (action.id === 'approve-payment') {
      next.paymentDecision = 'approved';
      label = 'Unverified request approved: fictional loss of 4,800 PLN recorded.';
    } else {
      next.supportRequested = true;
      label = 'Provider support contacted. Recovery outcome and waiting time remain unknown.';
    }
  } else throw new DomainError('Unknown command.');
  next.revision++;
  next.events.push({
    id: `${s.id}:${next.revision}`,
    sequence: next.revision,
    at: now,
    actor: p.name,
    role: p.role,
    type: command.type,
    target: command.target,
    label,
    visibility,
    actionId: command.id,
  });
  return next;
}

export function projectSession(
  s: Session,
  p: Participant,
  participants: Participant[],
  observations: Observation[],
): SessionView {
  if (s.mode && p.role === 'pending') {
    // Joining alone does not authorise access to the organisation snapshot.
    const blueprint: Blueprint = {
      id: s.id,
      version: 1,
      name: 'Team check',
      description: '',
      resources: [
        {
          id: 'pending',
          label: 'Waiting for an assignment',
          kind: 'account',
          fact: 'pending.available',
          owner: '',
          description: '',
          column: 0,
          row: 0,
        },
      ],
      rules: [
        {
          id: 'pending',
          label: 'Awaiting assignment',
          kind: 'derived',
          requiresAll: [],
          grants: ['pending.available'],
          enabled: false,
          evidence: 'unknown',
          sourceNote: '',
        },
      ],
      initialFacts: [],
      targets: [{ id: 'pending', label: 'Waiting', fact: 'pending.available' }],
      assumptions: [],
      followUps: [],
      improved: false,
    };
    const failure = failureById('none');
    return {
      id: s.id,
      mode: s.mode,
      blueprint,
      phase: s.phase,
      stage: s.stage,
      revision: s.revision,
      role: p.role,
      me: p,
      participants: [p],
      observations: [],
      events: [],
      actions: [],
      analysis: analyze(blueprint, failure),
      supportRequested: false,
      customRoles: [],
      responsibilities: [],
      debrief: {
        timingAvailable: false,
        containmentMs: null,
        recoveryRouteMs: null,
        trustedAccessMs: null,
        unsafeDecisions: 0,
        sharedObservations: 0,
      },
    };
  }
  const all =
    p.role === 'facilitator' ||
    (s.phase === 'completed' && !['pending', 'observer'].includes(p.role));
  const visible = (s.mode ? [] : observations).filter(
    (o) =>
      o.stage <= s.stage &&
      (all || responsibilitiesFor(s, p.role).includes(o.audience) || s.shared.includes(o.id)),
  );
  return {
    ...(s.mode ? { mode: s.mode, sharedPlan: s.sharedPlan, lostIds: s.lostIds } : {}),
    id: s.id,
    blueprint: s.blueprint,
    phase: s.phase,
    stage: s.stage,
    revision: s.revision,
    role: p.role,
    me: p,
    participants,
    customRoles: s.customRoles ?? [],
    responsibilities: responsibilitiesFor(s, p.role),
    observations: visible.map((o) => ({
      ...resolveObservation(o, s),
      shared: s.shared.includes(o.id),
    })),
    events: s.events.filter(
      (e) => e.visibility === 'public' || e.visibility === p.role || p.role === 'facilitator',
    ),
    actions: availableActions(s, p),
    analysis: analyze(
      s.blueprint,
      s.phase === 'lobby' ? failureById('none') : (s.failure ?? failureById('work-lockout')),
      s.facts,
    ),
    startedAt: s.startedAt,
    endedAt: s.endedAt,
    paymentDecision: s.paymentDecision,
    supportRequested: s.supportRequested,
    debrief: summarizeExercise(s),
    ...(p.role === 'facilitator' ? { joinPath: `/join/${s.id}` } : {}),
  };
}

function resolveObservation(observation: Observation, session: Session): Observation {
  const current = closure(session.facts, session.blueprint.rules, false).facts;
  if (observation.id === 'roster-impact' && current.has('roster.available'))
    return {
      ...observation,
      title: 'The shift roster is available again',
      body: 'The team has restored trusted access to the roster. Volunteer coordination still depends on both that roster and a usable communication route. Keep the recovery instructions available independently of the work account.',
    };
  if (observation.id === 'recovery-dead-end' && session.blueprint.improved)
    return {
      ...observation,
      title: 'An independent recovery route is documented',
      body: 'The improved model includes a recovery kit outside the work account. The route also requires an available custodian and clean device. Regaining control is followed by credential rotation, session revocation, and review of recovery settings.',
    };
  return observation;
}
