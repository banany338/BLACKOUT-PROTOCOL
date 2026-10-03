import type { Analysis, Blueprint, Role, ViewerRole } from './model';
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
};
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

export function newSession(id: string, blueprint: Blueprint): Session {
  return {
    id,
    blueprint: structuredClone(blueprint),
    scenarioVersion: 'lockout-1',
    engineVersion: '1',
    seed: 'harbor-fixed-1',
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
  const current = closure(s.facts, s.blueprint.rules, false).facts;
  const can = (role: Role) => p.role === 'facilitator' || p.role === role;
  const result: ActionView[] = s.blueprint.rules
    .filter((r) => r.kind === 'action' && r.enabled && can(r.responsibleRole ?? 'administrator'))
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
  if (s.stage >= 2 && can('finance')) {
    result.push({
      id: 'verify-payment',
      label: 'Verify through the known contact',
      role: 'finance',
      category: 'decision',
      disabledReason: s.paymentDecision
        ? 'Decision already recorded'
        : !s.shared.includes('known-contact')
          ? 'Ask the coordinator to share the independent contact observation'
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
  if (can('administrator'))
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
    next.facts = applyFailure(s.blueprint.initialFacts, failureById('work-lockout'));
    label = 'Work identity lost: credentials changed and work sessions revoked.';
  } else if (command.type === 'advance') {
    facilitator();
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
    if (s.phase !== 'running')
      throw new DomainError('Observations can be shared during the exercise.');
    const observation = observations.find((o) => o.id === command.target && o.stage <= s.stage);
    if (!observation || (p.role !== 'facilitator' && p.role !== observation.audience))
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
  const all =
    p.role === 'facilitator' ||
    (s.phase === 'completed' && !['pending', 'observer'].includes(p.role));
  const visible = observations.filter(
    (o) => o.stage <= s.stage && (all || o.audience === p.role || s.shared.includes(o.id)),
  );
  return {
    id: s.id,
    blueprint: s.blueprint,
    phase: s.phase,
    stage: s.stage,
    revision: s.revision,
    role: p.role,
    me: p,
    participants,
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
      failureById(s.phase === 'lobby' ? 'none' : 'work-lockout'),
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
