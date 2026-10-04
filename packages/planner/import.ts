import { z } from 'zod';
import { newId, planSchema, type Plan } from './model';

const user = z.object({
  primaryEmail: z.string().email().max(100),
  recoveryEmail: z.union([z.string().email().max(100), z.literal('')]).optional(),
  recoveryPhone: z.string().max(40).optional(),
});
export function importGoogleDirectory(contents: string, now = new Date().toISOString()): Plan {
  if (contents.length > 2_000_000) throw new Error('Use a Directory export smaller than 2 MB.');
  let input: unknown;
  try {
    input = JSON.parse(contents);
  } catch {
    throw new Error('Choose a JSON response from Google Directory users.list.');
  }
  const parsed = z.object({ users: z.array(user).min(1).max(50) }).safeParse(input);
  if (!parsed.success)
    throw new Error(
      'Expected a users array with 1–50 primaryEmail entries and optional recoveryEmail / recoveryPhone fields.',
    );
  const users = parsed.data.users;
  const ids = new Map(users.map((u, i) => [u.primaryEmail.toLowerCase(), `account-${i + 1}`]));
  if (ids.size !== users.length) throw new Error('Duplicate primary email addresses found.');
  const plan: Plan = {
    id: newId(),
    version: 1,
    name: 'Imported organisation',
    owner: '',
    updatedAt: now,
    proposed: false,
    source: `Google Directory users.list JSON imported ${now}. Contact fields only; access and provider procedures need owner confirmation.`,
    assets: [],
    methods: [],
    activities: [],
    tasks: [],
  };
  for (const u of users) {
    const id = ids.get(u.primaryEmail.toLowerCase())!;
    plan.assets.push({
      id,
      label: u.primaryEmail,
      kind: 'account',
      owner: '',
      available: false,
      requiresAll: [],
      note: 'Imported identity. Confirm whether an owner currently has access.',
    });
    plan.activities.push({
      id: `use-${id}`,
      label: `Use ${u.primaryEmail}`.slice(0, 100),
      owner: '',
      requiresAll: [id],
    });
  }
  const external = new Map<string, string>();
  for (const u of users) {
    const id = ids.get(u.primaryEmail.toLowerCase())!;
    for (const [field, kind] of [
      ['recoveryEmail', 'account'],
      ['recoveryPhone', 'device'],
    ] as const) {
      const value = u[field];
      if (!value) continue;
      const key = `${kind}:${value.toLowerCase()}`;
      let target = field === 'recoveryEmail' ? ids.get(value.toLowerCase()) : undefined;
      target ??= external.get(key);
      if (!target) {
        target = `external-${external.size + 1}`;
        external.set(key, target);
        plan.assets.push({
          id: target,
          label: value,
          kind,
          owner: '',
          available: false,
          requiresAll: [],
          note: `Imported ${field}. Accessibility and any dependencies have not been confirmed.`,
        });
      }
      plan.methods.push({
        id: `${id}-${field}`,
        accountId: id,
        label: `Recovery through ${field === 'recoveryEmail' ? 'email' : 'phone'}`,
        requiresAll: [target],
        evidence: 'unknown',
        note: `Source: Google Directory ${field} field. The presence of this contact is not proof that recovery will succeed.`,
        reviewedAt: '',
      });
    }
  }
  if (plan.assets.length > 100)
    throw new Error(
      'This export creates more than 100 distinct accounts and resources. Import a smaller selection.',
    );
  return planSchema.parse(plan);
}
