import { describe, it, expect } from 'vitest';
import { checkPlan, improvements, toBlueprint, explainRoute, capability } from './analysis';
import { starterPlan, planSchema, emptyWorkspace, workspaceSchema, type Plan } from './model';
import { importGoogleDirectory } from './import';
import { createVault, seal, unlock } from './vault';
import { recoveryReport } from './report';

function organisation(): Plan {
  const plan = starterPlan();
  plan.name = 'Library cooperative';
  plan.owner = 'Operations';
  plan.assets = [
    {
      id: 'work',
      label: 'Work account',
      kind: 'account',
      owner: 'Operations',
      available: true,
      requiresAll: [],
      note: '',
    },
    {
      id: 'backup',
      label: 'Backup email',
      kind: 'account',
      owner: 'Operations',
      available: true,
      requiresAll: [],
      note: '',
    },
    {
      id: 'phone',
      label: 'Duty phone',
      kind: 'device',
      owner: 'Operations',
      available: true,
      requiresAll: [],
      note: '',
    },
    {
      id: 'codes',
      label: 'Recovery material',
      kind: 'artifact',
      owner: 'Operations',
      available: true,
      requiresAll: ['work'],
      note: 'Stored in work account',
    },
  ];
  plan.methods = [
    {
      id: 'work-from-backup',
      accountId: 'work',
      label: 'Recover work with backup',
      requiresAll: ['backup', 'phone'],
      evidence: 'user-reported',
      note: 'Owner procedure',
      reviewedAt: '',
    },
    {
      id: 'backup-from-work',
      accountId: 'backup',
      label: 'Recover backup with work',
      requiresAll: ['work'],
      evidence: 'user-reported',
      note: 'Owner procedure',
      reviewedAt: '',
    },
    {
      id: 'work-from-codes',
      accountId: 'work',
      label: 'Recover using material',
      requiresAll: ['codes'],
      evidence: 'user-reported',
      note: 'Owner procedure',
      reviewedAt: '',
    },
  ];
  plan.activities = [
    {
      id: 'service',
      label: 'Run the library',
      owner: 'Operations',
      requiresAll: ['work', 'phone'],
    },
  ];
  return planSchema.parse(plan);
}
describe('organisation recovery analysis', () => {
  it('uses all prerequisites and explains an ordered recovery route', () => {
    const plan = organisation();
    const result = checkPlan(plan, ['work']);
    expect(result.analysis.targets[0]).toMatchObject({ current: false, reachable: true });
    expect(
      explainRoute(result.blueprint.targets[0].fact, result.analysis, result.blueprint).map(
        (r) => r.label,
      ),
    ).toEqual(['Recover work with backup']);
    expect(checkPlan(plan, ['work', 'phone']).analysis.targets[0].reachable).toBe(false);
  });
  it('finds circular recovery and material stored behind the lost account', () => {
    const result = checkPlan(organisation(), ['work', 'backup']);
    expect(result.analysis.targets[0].reachable).toBe(false);
    expect(result.analysis.reachable).not.toContain(capability('codes'));
    expect(result.analysis.cycles.flat()).toContain(capability('work'));
  });
  it('does not recreate a selected lost resource through its normal dependency', () => {
    const plan = organisation();
    expect(checkPlan(plan, ['codes']).analysis.reachable).not.toContain(capability('codes'));
    plan.assets.find((a) => a.id === 'codes')!.available = false;
    expect(checkPlan(plan, []).analysis.reachable).not.toContain(capability('codes'));
  });
  it('keeps unknown recovery methods out of the working forecast', () => {
    const plan = organisation();
    plan.methods[0].evidence = 'unknown';
    const result = checkPlan(plan, ['work']);
    expect(result.analysis.targets[0]).toMatchObject({
      current: false,
      reachable: false,
      uncertain: true,
    });
  });
  it('evaluates independent material without changing the source or activity set', () => {
    const plan = organisation(),
      original = structuredClone(plan);
    const proposals = improvements(plan, ['work', 'backup']);
    expect(proposals.length).toBeGreaterThan(0);
    const material = proposals.find((p) => p.id === 'independent-codes')!;
    expect(material.gain).toBe(1);
    expect(material.plan.proposed).toBe(true);
    expect(material.plan.activities).toEqual(plan.activities);
    expect(material.addedAssumptions[0]).toContain('without Work account');
    expect(plan).toEqual(original);
  });
  it('does not claim an account-only improvement solves an independently lost device', () => {
    expect(improvements(organisation(), ['work', 'backup', 'phone'])).toEqual([]);
  });
  it('validates imported workspaces and rejects ambiguous identifiers', () => {
    const plan = organisation();
    plan.assets[0].id = 'activity-service';
    expect(planSchema.safeParse(plan).success).toBe(false);
    const valid = organisation();
    expect(
      workspaceSchema.safeParse({ ...emptyWorkspace(), plans: [valid, valid], activeId: valid.id })
        .success,
    ).toBe(false);
  });
  it('can analyze a larger organisation without fixture-specific IDs', () => {
    const plan = organisation();
    plan.assets = Array.from({ length: 100 }, (_, i) => ({
      id: `account${i}`,
      label: `Account ${i}`,
      kind: 'account' as const,
      available: true,
      owner: 'Owner',
      requiresAll: [],
      note: '',
    }));
    plan.methods = [];
    plan.activities = plan.assets.map((a, i) => ({
      id: `outcome${i}`,
      label: `Outcome ${i}`,
      owner: 'Owner',
      requiresAll: [a.id],
    }));
    expect(toBlueprint(plan).resources).toHaveLength(200);
    const result = checkPlan(
      plan,
      plan.assets.map((a) => a.id),
    );
    expect(result.analysis.targets.filter((t) => t.reachable)).toHaveLength(0);
  });
});
describe('Directory contact import', () => {
  it('imports real export fields, joins internal contacts, and discards other data', () => {
    const plan = importGoogleDirectory(
      JSON.stringify({
        users: [
          {
            primaryEmail: 'a@example.org',
            recoveryEmail: 'b@example.org',
            password: 'SECRET',
            notes: 'IGNORE',
          },
          {
            primaryEmail: 'b@example.org',
            recoveryEmail: 'a@example.org',
            recoveryPhone: '+1234',
            customSchemas: { secret: 'SECRET' },
          },
        ],
      }),
    );
    expect(plan.methods.every((m) => m.evidence === 'unknown')).toBe(true);
    expect(plan.assets.every((a) => !a.available)).toBe(true);
    expect(plan.methods[0].requiresAll).toEqual(['account-2']);
    expect(JSON.stringify(plan)).not.toContain('SECRET');
    expect(checkPlan(plan, []).analysis.targets.every((t) => !t.reachable)).toBe(true);
  });
  it('rejects invalid and duplicate identities and permits absent contact fields', () => {
    expect(() => importGoogleDirectory('{"users":[]}')).toThrow();
    expect(() =>
      importGoogleDirectory(
        '{"users":[{"primaryEmail":"a@example.org"},{"primaryEmail":"A@example.org"}]}',
      ),
    ).toThrow('Duplicate');
    expect(
      importGoogleDirectory('{"users":[{"primaryEmail":"a@example.org","recoveryEmail":""}]}')
        .methods,
    ).toEqual([]);
  });
});
describe('encrypted local workspace', () => {
  it('roundtrips plans/history and authenticates ciphertext with an in-memory key', async () => {
    const plan = organisation(),
      workspace = { ...emptyWorkspace(), plans: [plan], activeId: plan.id, history: [plan] };
    const key = await createVault('test-only twelve words');
    expect(key.key.extractable).toBe(false);
    const first = await seal(workspace, key),
      second = await seal(workspace, key);
    expect(first).not.toContain('Library cooperative');
    expect(JSON.parse(first).iv).not.toEqual(JSON.parse(second).iv);
    expect((await unlock(first, 'test-only twelve words')).workspace).toEqual(workspace);
    await expect(unlock(first, 'incorrect passphrase')).rejects.toThrow('incorrect');
    const corrupted = JSON.parse(first);
    corrupted.ciphertext =
      (corrupted.ciphertext[0] === 'A' ? 'B' : 'A') + corrupted.ciphertext.slice(1);
    await expect(unlock(JSON.stringify(corrupted), 'test-only twelve words')).rejects.toThrow(
      'changed or damaged',
    );
  });
  it('changes keys without changing plans and preserves the old backup password', async () => {
    const original = await createVault('first long passphrase'),
      replacement = await createVault('second long passphrase');
    const old = await seal(emptyWorkspace(), original),
      next = await seal(emptyWorkspace(), replacement);
    await expect(unlock(next, 'first long passphrase')).rejects.toThrow();
    expect((await unlock(old, 'first long passphrase')).workspace).toEqual(emptyWorkspace());
    expect((await unlock(next, 'second long passphrase')).workspace).toEqual(emptyWorkspace());
    await expect(createVault('short')).rejects.toThrow('12');
    await expect(unlock('broken', 'first long passphrase')).rejects.toThrow('not a supported');
  });
});
describe('offline readable plan', () => {
  it('includes owner routes and evidence and escapes user-supplied markup', () => {
    const plan = organisation();
    plan.name = '<script>alert("owner")</script>';
    plan.methods[0].note = '<img src=x onerror=alert(1)>';
    const html = recoveryReport(plan, ['work']);
    expect(html).toContain('Requires all: Backup email, Duty phone');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain("default-src 'none'");
    expect(html).not.toContain('src="http');
    expect(html).toContain('Operations');
  });
});
