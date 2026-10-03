import { expect, it } from 'vitest';
import { analyze } from './engine';
import { blueprintSchema } from './model';
import { failureById } from './fixture';

it('analyses a 30-resource, 100-rule model within the 500 ms demo target', () => {
  const b = blueprintSchema.parse({
    id: 'load',
    version: 1,
    name: 'Synthetic performance model',
    description: '',
    assumptions: [],
    resources: Array.from({ length: 30 }, (_, i) => ({
      id: `resource-${i}`,
      fact: `fact-${i}`,
      label: `Resource ${i}`,
      kind: 'service',
      owner: 'Fixture',
      description: '',
      column: i % 4,
      row: Math.floor(i / 4),
    })),
    initialFacts: ['fact-0'],
    targets: [{ id: 'last', label: 'Final resource', fact: 'fact-29' }],
    rules: Array.from({ length: 100 }, (_, i) => ({
      id: `rule-${i}`,
      label: `Method ${i}`,
      kind: 'action',
      requiresAll: [`fact-${i % 29}`],
      grants: [`fact-${(i % 29) + 1}`],
      enabled: true,
      evidence: 'fixture',
      sourceNote: 'Synthetic fixture',
    })),
  });
  const times = Array.from({ length: 20 }, () => {
    const start = performance.now();
    const a = analyze(b, failureById('none'));
    expect(a.targets[0].reachable).toBe(true);
    return performance.now() - start;
  });
  const maximum = Math.max(...times);
  console.info(`30 resources / 100 rules: max ${maximum.toFixed(1)} ms across 20 runs`);
  expect(maximum).toBeLessThan(500);
});
