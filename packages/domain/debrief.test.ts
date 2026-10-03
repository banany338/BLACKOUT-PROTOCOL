import { describe, expect, it } from 'vitest';
import { harborAid, withRecoveryKit } from './fixture';
import { newSession, reduceCommand, type Command, type Participant } from './session';
import { summarizeExercise } from './debrief';
import { observations } from '../../apps/server/scenario';

const host: Participant = { id: 'host', name: 'Host', role: 'facilitator' };
describe('exercise measurements', () => {
  it('measures actual containment and trust, excluding facilitator pauses', () => {
    let s = newSession('timed', withRecoveryKit(harborAid));
    const step = (seconds: number, type: Command['type'], target?: string) => {
      s = reduceCommand(
        s,
        host,
        { id: `event-${seconds}`, revision: s.revision, type, target },
        observations,
        new Date(Date.UTC(2026, 9, 3, 0, 0, seconds)).toISOString(),
      );
    };
    step(0, 'start');
    expect(summarizeExercise(s)).toMatchObject({
      recoveryRouteMs: 0,
      containmentMs: null,
      trustedAccessMs: null,
    });
    step(10, 'act', 'rule:recover-work-kit');
    step(20, 'pause');
    expect(() =>
      reduceCommand(
        s,
        host,
        { id: 'paused', revision: s.revision, type: 'act', target: 'rule:rotate' },
        observations,
      ),
    ).toThrow();
    step(80, 'resume');
    step(90, 'act', 'rule:rotate');
    step(100, 'act', 'rule:revoke');
    step(110, 'act', 'rule:review');
    step(120, 'act', 'rule:restore-trust');
    expect(summarizeExercise(s)).toMatchObject({ containmentMs: 30_000, trustedAccessMs: 60_000 });
    expect(s.events.map((e) => e.sequence)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
  it('records no baseline route and the unsafe decision without inventing completion', () => {
    let s = newSession('blocked', harborAid);
    for (const [type, target] of [
      ['start', undefined],
      ['advance', undefined],
      ['act', 'approve-payment'],
    ] as const) {
      s = reduceCommand(
        s,
        host,
        { id: `event-${s.revision}`, revision: s.revision, type, target },
        observations,
      );
    }
    expect(summarizeExercise(s)).toMatchObject({
      recoveryRouteMs: null,
      containmentMs: null,
      trustedAccessMs: null,
      unsafeDecisions: 1,
    });
  });
});
