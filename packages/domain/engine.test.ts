import { describe, it, expect } from 'vitest';
import { analyze, closure, routeTo } from './engine';
import { failureById, harborAid, withRecoveryKit } from './fixture';
import { blueprintSchema } from './model';

describe('recovery analysis', () => {
  it('validates the fixture and keeps unrelated public services available', () => {
    expect(blueprintSchema.safeParse(harborAid).success).toBe(true);
    const a = analyze(harborAid, failureById('work-lockout'));
    expect(a.reachable).not.toContain('work.control');
    expect(a.reachable).toContain('website.available');
    expect(a.cycles.length).toBeGreaterThan(0);
    expect(a.targets.filter((t) => t.reachable)).toHaveLength(1);
  });
  it('a trusted entry point breaks a recovery cycle', () => {
    const a = analyze(harborAid, failureById('none'));
    expect(a.reachable).toContain('backup.trusted');
    expect(a.cycles).toHaveLength(0);
  });
  it('models an independent route, preserves baseline, and explains containment', () => {
    const original = JSON.stringify(harborAid);
    const improved = withRecoveryKit(harborAid);
    const a = analyze(improved, failureById('work-lockout'));
    expect(a.targets.every((t) => t.reachable)).toBe(true);
    expect(a.current).not.toContain('work.control');
    const ids = routeTo('work.trusted', a, improved).map((r) => r.id);
    expect(ids).toEqual(
      expect.arrayContaining(['recover-work-kit', 'rotate', 'revoke', 'review', 'restore-trust']),
    );
    expect(JSON.stringify(harborAid)).toBe(original);
  });
  it('requires every AND prerequisite and permits an alternative route', () => {
    const improved = withRecoveryKit(harborAid);
    improved.initialFacts = improved.initialFacts.filter((f) => f !== 'custodian.available');
    expect(analyze(improved, failureById('work-lockout')).reachable).not.toContain('work.control');
    improved.initialFacts.push('backup.trusted');
    expect(analyze(improved, failureById('work-lockout')).reachable).toContain('work.control');
  });
  it('control alone does not restore trust in the current state', () => {
    const a = analyze(harborAid, failureById('work-lockout'), ['work.control', 'device.clean']);
    expect(a.current).not.toContain('work.trusted');
    expect(a.reachable).toContain('work.trusted');
  });
  it('unknown methods are uncertainty, not a working route', () => {
    const b = withRecoveryKit(harborAid);
    b.rules.find((r) => r.id === 'recover-work-kit')!.evidence = 'unknown';
    const a = analyze(b, failureById('work-lockout'));
    expect(a.reachable).not.toContain('work.trusted');
    expect(a.possible).toContain('work.trusted');
    expect(a.targets.find((t) => t.id === 'shifts')!.uncertain).toBe(true);
  });
  it('propagates user assumptions and separates tested inputs', () => {
    const b = withRecoveryKit(harborAid);
    b.rules.find((r) => r.id === 'recover-work-kit')!.evidence = 'user-reported';
    const a = analyze(b, failureById('work-lockout'));
    expect(a.reachable).toContain('roster.available');
    expect(a.confirmed).not.toContain('roster.available');
    expect(a.witness['roster.available'].evidence).toBe('user-reported');
  });
  it('is deterministic and does not execute forecast actions', () => {
    const b = withRecoveryKit(harborAid),
      f = failureById('phone-lost');
    expect(analyze(b, f)).toEqual(analyze(b, f));
    expect(b.initialFacts).not.toContain('work.sessions-revoked');
    expect(closure(['work.control'], b.rules, false).facts.has('work.trusted')).toBe(false);
  });
  it('rejects duplicate rule identifiers and unknown prerequisites', () => {
    const b = structuredClone(harborAid);
    b.rules.push(b.rules[0]);
    expect(blueprintSchema.safeParse(b).success).toBe(false);
    b.rules.pop();
    b.rules[0].requiresAll.push('made-up');
    expect(blueprintSchema.safeParse(b).success).toBe(false);
  });
});
