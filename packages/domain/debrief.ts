import { analyze, applyFailure, closure } from './engine';
import { failureById } from './fixture';
import type { Event, Session } from './session';

export type Debrief = {
  timingAvailable: boolean;
  containmentMs: number | null;
  recoveryRouteMs: number | null;
  trustedAccessMs: number | null;
  unsafeDecisions: number;
  sharedObservations: number;
};

/** Exercise elapsed time excludes pauses; it is not a provider recovery-time estimate. */
export function elapsedExerciseMs(start: string, end: string, events: Event[]): number {
  const endMs = Date.parse(end);
  let pausedAt: number | undefined,
    paused = 0;
  for (const event of events) {
    const at = Date.parse(event.at);
    if (at > endMs) break;
    if (event.type === 'pause' && pausedAt === undefined) pausedAt = at;
    if (event.type === 'resume' && pausedAt !== undefined) {
      paused += at - pausedAt;
      pausedAt = undefined;
    }
  }
  if (pausedAt !== undefined) paused += endMs - pausedAt;
  return Math.max(0, endMs - Date.parse(start) - paused);
}

export function summarizeExercise(s: Session): Debrief {
  const result: Debrief = {
    timingAvailable: !s.events.some((e) => e.type === 'act' && !e.target),
    containmentMs: null,
    recoveryRouteMs: null,
    trustedAccessMs: null,
    unsafeDecisions: s.paymentDecision === 'approved' ? 1 : 0,
    sharedObservations: s.shared.length,
  };
  if (s.mode) return { ...result, timingAvailable: false };
  if (!s.startedAt) return result;
  const failure = failureById('work-lockout');
  let facts = applyFailure(s.blueprint.initialFacts, failure);
  if (analyze(s.blueprint, failure, facts).reachable.includes('work.trusted'))
    result.recoveryRouteMs = 0;
  for (const event of s.events) {
    if (event.type !== 'act' || !event.target?.startsWith('rule:')) continue;
    const rule = s.blueprint.rules.find((r) => `rule:${r.id}` === event.target);
    if (!rule) continue;
    facts = [...new Set([...facts, ...rule.grants])];
    const elapsed = elapsedExerciseMs(s.startedAt, event.at, s.events);
    if (
      result.containmentMs === null &&
      rule.grants.some((f) => ['work.credentials-rotated', 'work.sessions-revoked'].includes(f))
    )
      result.containmentMs = elapsed;
    if (
      result.recoveryRouteMs === null &&
      analyze(s.blueprint, failure, facts).reachable.includes('work.trusted')
    )
      result.recoveryRouteMs = elapsed;
    if (
      result.trustedAccessMs === null &&
      closure(facts, s.blueprint.rules, false).facts.has('work.trusted')
    )
      result.trustedAccessMs = elapsed;
  }
  return result;
}

export function formatElapsed(value: number | null): string {
  if (value === null) return 'Not completed';
  const seconds = Math.floor(value / 1000);
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s`;
}
