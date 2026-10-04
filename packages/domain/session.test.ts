import { describe, it, expect } from 'vitest';
import { harborAid, withRecoveryKit } from './fixture';
import { newSession, projectSession, reduceCommand, type Participant } from './session';
import { observations } from '../../apps/server/scenario';

const host: Participant = { id: 'host', name: 'Host', role: 'facilitator' };
const finance: Participant = { id: 'finance', name: 'Finance', role: 'finance' };
describe('exercise state', () => {
  it('filters private observations and enforces role authority', () => {
    let s = newSession('room', harborAid);
    expect(() =>
      reduceCommand(s, finance, { id: 'bad', revision: 0, type: 'start' }, observations),
    ).toThrow('facilitator');
    s = reduceCommand(s, host, { id: 'start', revision: 0, type: 'start' }, observations);
    s = reduceCommand(s, host, { id: 'next', revision: 1, type: 'advance' }, observations);
    const view = projectSession(s, finance, [finance, host], observations);
    expect(view.observations.map((o) => o.id)).toEqual(['urgent-payment']);
    expect(JSON.stringify(view)).not.toContain('printed volunteer folder');
    expect(() =>
      reduceCommand(
        s,
        finance,
        { id: 'share', revision: 2, type: 'share', target: 'lockout' },
        observations,
      ),
    ).toThrow('role');
  });
  it('requires shared independent evidence for verification and records the unsafe branch', () => {
    let s = newSession('room', harborAid);
    s = reduceCommand(s, host, { id: 's', revision: 0, type: 'start' }, observations);
    s = reduceCommand(s, host, { id: 'a', revision: 1, type: 'advance' }, observations);
    expect(() =>
      reduceCommand(
        s,
        finance,
        { id: 'v', revision: 2, type: 'act', target: 'verify-payment' },
        observations,
      ),
    ).toThrow('team communication');
    const unsafe = reduceCommand(
      s,
      finance,
      { id: 'unsafe', revision: 2, type: 'act', target: 'approve-payment' },
      observations,
    );
    expect(unsafe.paymentDecision).toBe('approved');
    s = reduceCommand(s, host, { id: 'b', revision: 2, type: 'advance' }, observations);
    s = reduceCommand(
      s,
      host,
      { id: 'share', revision: 3, type: 'share', target: 'known-contact' },
      observations,
    );
    s = reduceCommand(
      s,
      finance,
      { id: 'verify', revision: 4, type: 'act', target: 'verify-payment' },
      observations,
    );
    expect(s.paymentDecision).toBe('verified');
  });
  it('requires containment after regaining control and rejects stale actions', () => {
    let s = newSession('room', withRecoveryKit(harborAid));
    s = reduceCommand(s, host, { id: 's', revision: 0, type: 'start' }, observations);
    expect(() =>
      reduceCommand(s, host, { id: 'stale', revision: 0, type: 'advance' }, observations),
    ).toThrow('changed');
    for (const target of ['recover-work-kit', 'rotate', 'revoke', 'review', 'restore-trust']) {
      s = reduceCommand(
        s,
        host,
        { id: target, revision: s.revision, type: 'act', target: `rule:${target}` },
        observations,
      );
      if (target === 'recover-work-kit') expect(s.facts).not.toContain('work.trusted');
    }
    expect(s.facts).toContain('work.trusted');
    s = reduceCommand(
      s,
      host,
      { id: 'chapter-2', revision: s.revision, type: 'advance' },
      observations,
    );
    s = reduceCommand(
      s,
      host,
      { id: 'chapter-3', revision: s.revision, type: 'advance' },
      observations,
    );
    const view = projectSession(s, host, [host], observations);
    expect(view.observations.find((o) => o.id === 'roster-impact')!.title).toBe(
      'The shift roster is available again',
    );
    expect(s.events.find((e) => e.target === 'rule:revoke')).toBeDefined();
  });
});
