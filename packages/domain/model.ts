import { z } from 'zod';

export const roles = ['administrator', 'finance', 'coordinator'] as const;
export type Role = (typeof roles)[number];
export type ViewerRole = Role | 'facilitator' | 'observer' | 'pending';
export const evidenceSchema = z.enum(['fixture', 'user-marked-tested', 'user-reported', 'unknown']);
export type Evidence = z.infer<typeof evidenceSchema>;
const id = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-zA-Z0-9._-]+$/);
export const resourceSchema = z.object({
  id,
  label: z.string().min(1).max(100),
  kind: z.enum(['account', 'service', 'device', 'person', 'artifact', 'activity']),
  fact: id,
  controlFact: id.optional(),
  owner: z.string().max(100),
  description: z.string().max(1000),
  column: z.number().int().min(0).max(3),
  row: z.number().int().min(0).max(15),
});
export const ruleSchema = z.object({
  id,
  label: z.string().min(1).max(150),
  kind: z.enum(['derived', 'action']),
  requiresAll: z.array(id).max(20),
  grants: z.array(id).min(1).max(10),
  enabled: z.boolean(),
  responsibleRole: z.enum(roles).optional(),
  evidence: evidenceSchema,
  sourceNote: z.string().max(1500),
  lastReviewedAt: z.string().max(50).optional(),
});
export const blueprintSchema = z
  .object({
    id,
    version: z.number().int().positive(),
    name: z.string().min(1).max(100),
    description: z.string().max(1000),
    resources: z.array(resourceSchema).min(1).max(60),
    rules: z.array(ruleSchema).min(1).max(200),
    initialFacts: z.array(id).max(250),
    targets: z
      .array(z.object({ id, label: z.string().min(1).max(100), fact: id }))
      .min(1)
      .max(30),
    assumptions: z.array(z.string().max(1000)).max(30),
    followUps: z
      .array(
        z.object({
          id,
          title: z.string().min(1).max(200),
          owner: z.string().max(100),
          status: z.enum(['proposed', 'implemented', 'tested']),
          note: z.string().max(1000),
          reviewDate: z.string().max(10),
        }),
      )
      .max(30)
      .default([]),
    improved: z.boolean().default(false),
  })
  .superRefine((b, ctx) => {
    for (const key of ['resources', 'rules', 'targets'] as const) {
      const ids = b[key].map((x) => x.id);
      if (new Set(ids).size !== ids.length)
        ctx.addIssue({ code: 'custom', path: [key], message: 'IDs must be unique' });
    }
    const known = new Set([...b.initialFacts, ...b.rules.flatMap((r) => r.grants)]);
    for (const [i, rule] of b.rules.entries())
      for (const fact of rule.requiresAll) {
        if (!known.has(fact))
          ctx.addIssue({
            code: 'custom',
            path: ['rules', i, 'requiresAll'],
            message: `Unknown capability: ${fact}`,
          });
      }
    for (const [i, target] of b.targets.entries())
      if (!known.has(target.fact))
        ctx.addIssue({
          code: 'custom',
          path: ['targets', i],
          message: `Unknown target: ${target.fact}`,
        });
  });
export type Blueprint = z.infer<typeof blueprintSchema>;
export type Resource = z.infer<typeof resourceSchema>;
export type Rule = z.infer<typeof ruleSchema>;
export type Failure = {
  id: string;
  label: string;
  description: string;
  removes: string[];
  adds: string[];
  disabledRules: string[];
  compromised: string[];
};
export type Witness = { ruleId: string; prerequisites: string[]; evidence: Evidence };
export type Closure = { facts: Set<string>; witness: Record<string, Witness> };
export type ResourceState = 'available' | 'recoverable' | 'blocked' | 'uncertain' | 'compromised';
export type Analysis = {
  failure: Failure;
  current: string[];
  reachable: string[];
  confirmed: string[];
  possible: string[];
  witness: Record<string, Witness>;
  cycles: string[][];
  resources: { id: string; state: ResourceState; canRecover: boolean }[];
  targets: {
    id: string;
    label: string;
    fact: string;
    current: boolean;
    reachable: boolean;
    confirmed: boolean;
    uncertain: boolean;
  }[];
};
