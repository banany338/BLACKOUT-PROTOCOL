import { z } from 'zod';

const id = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-zA-Z0-9_-]+$/);
const label = z.string().trim().min(1).max(100);
export const assetSchema = z.object({
  id,
  label,
  kind: z.enum(['account', 'device', 'artifact', 'person']),
  owner: z.string().max(100),
  available: z.boolean(),
  requiresAll: z.array(id).max(20),
  note: z.string().max(1000),
});
export const methodSchema = z.object({
  id,
  accountId: id,
  label: z.string().trim().min(1).max(150),
  requiresAll: z.array(id).min(1).max(20),
  evidence: z.enum(['user-reported', 'user-marked-tested', 'unknown']),
  note: z.string().max(1000),
  reviewedAt: z.string().max(10),
});
export const activitySchema = z.object({
  id,
  label,
  owner: z.string().max(100),
  requiresAll: z.array(id).min(1).max(20),
});
export const taskSchema = z.object({
  id,
  title: z.string().min(1).max(200),
  owner: z.string().max(100),
  status: z.enum(['proposed', 'implemented', 'tested']),
  note: z.string().max(1000),
  reviewDate: z.string().max(10),
});
export const planSchema = z
  .object({
    id,
    version: z.number().int().positive(),
    name: label,
    owner: z.string().max(100),
    updatedAt: z.string().datetime(),
    proposed: z.boolean().default(false),
    source: z.string().max(500),
    assets: z.array(assetSchema).min(1).max(100),
    methods: z.array(methodSchema).max(300),
    activities: z.array(activitySchema).min(1).max(100),
    tasks: z.array(taskSchema).max(30).default([]),
  })
  .superRefine((p, ctx) => {
    const ids = p.assets.map((a) => a.id);
    const all = new Set(ids);
    if (p.activities.some((a) => all.has(`activity-${a.id}`)))
      ctx.addIssue({
        code: 'custom',
        message: 'An activity identifier conflicts with a resource identifier.',
      });
    for (const key of ['assets', 'methods', 'activities', 'tasks'] as const) {
      if (new Set(p[key].map((x) => x.id)).size !== p[key].length)
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: 'Each item needs a unique identifier.',
        });
    }
    for (const item of [...p.assets, ...p.methods, ...p.activities]) {
      for (const ref of item.requiresAll)
        if (!all.has(ref))
          ctx.addIssue({ code: 'custom', message: `A dependency is missing: ${ref}` });
    }
    for (const method of p.methods)
      if (!p.assets.some((a) => a.id === method.accountId && a.kind === 'account'))
        ctx.addIssue({ code: 'custom', message: 'Recovery methods must belong to an account.' });
    if (p.assets.length + p.activities.length > 200)
      ctx.addIssue({
        code: 'custom',
        message: 'This workspace supports 200 accounts, resources and activities per plan.',
      });
  });
export type Plan = z.infer<typeof planSchema>;
export type Asset = z.infer<typeof assetSchema>;
export type Method = z.infer<typeof methodSchema>;
export const workspaceSchema = z
  .object({
    schema: z.literal('blackout-workspace-1'),
    plans: z.array(planSchema).max(50),
    activeId: z.string().max(80),
    history: z.array(planSchema).max(30).default([]),
  })
  .superRefine((w, ctx) => {
    if (new Set(w.plans.map((p) => p.id)).size !== w.plans.length)
      ctx.addIssue({ code: 'custom', message: 'Plan identifiers must be unique.' });
    if (w.plans.length ? !w.plans.some((p) => p.id === w.activeId) : w.activeId !== '')
      ctx.addIssue({ code: 'custom', message: 'Select an existing active plan.' });
  });
export type Workspace = z.infer<typeof workspaceSchema>;
export const emptyWorkspace = (): Workspace => ({
  schema: 'blackout-workspace-1',
  plans: [],
  activeId: '',
  history: [],
});
export const newId = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');

export function starterPlan(): Plan {
  return {
    id: newId(),
    version: 1,
    name: '',
    owner: '',
    updatedAt: new Date().toISOString(),
    proposed: false,
    source: 'Entered by the owner. Provider procedures have not been independently verified.',
    assets: [
      {
        id: 'primary',
        label: 'Main work account',
        kind: 'account',
        owner: '',
        available: true,
        requiresAll: [],
        note: '',
      },
    ],
    methods: [],
    activities: [
      { id: 'daily-work', label: 'Access essential work', owner: '', requiresAll: ['primary'] },
    ],
    tasks: [],
  };
}
