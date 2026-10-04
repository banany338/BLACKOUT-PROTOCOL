import { afterEach, expect, it } from 'vitest';
import { createApp } from '../../apps/server/app';
import { starterPlan, planSchema } from '../../packages/planner/model';
import { shareablePlan } from '../../packages/planner/team';
import { teamReport } from '../../packages/planner/team-report';
import type { SessionView } from '../../packages/domain/session';

const apps: Awaited<ReturnType<typeof createApp>>[] = [];
afterEach(async () => {
  for (const { app } of apps.splice(0)) await app.close();
});
function teamPlan() {
  const p = starterPlan();
  p.name = 'Community team';
  p.owner = 'Host';
  p.source = 'PRIVATE-SOURCE';
  p.assets = [
    {
      id: 'drive',
      label: 'Google Drive',
      owner: 'Antonio',
      kind: 'account',
      available: true,
      requiresAll: [],
      note: 'PRIVATE-ASSET',
    },
    {
      id: 'instagram',
      label: 'Instagram',
      owner: 'Richard',
      kind: 'account',
      available: true,
      requiresAll: [],
      note: '',
    },
    {
      id: 'youtube',
      label: 'YouTube',
      owner: 'Mary',
      kind: 'account',
      available: true,
      requiresAll: ['drive'],
      note: '',
    },
    {
      id: 'backup',
      label: 'Independent backup',
      owner: 'Antonio',
      kind: 'artifact',
      available: true,
      requiresAll: [],
      note: '',
    },
  ];
  p.methods = [
    {
      id: 'drive',
      accountId: 'drive',
      label: 'Recover Drive using backup',
      requiresAll: ['backup'],
      evidence: 'user-reported',
      note: 'PRIVATE-PROCEDURE',
      reviewedAt: '',
    },
    {
      id: 'instagram',
      accountId: 'instagram',
      label: 'Recover Instagram through Drive',
      requiresAll: ['drive'],
      evidence: 'user-reported',
      note: '',
      reviewedAt: '',
    },
    {
      id: 'youtube',
      accountId: 'youtube',
      label: 'Unconfirmed YouTube method',
      requiresAll: ['backup'],
      evidence: 'unknown',
      note: '',
      reviewedAt: '',
    },
  ];
  p.activities = ['drive', 'instagram', 'youtube'].map((id) => ({
    id: `use-${id}`,
    label: `Use ${id}`,
    owner: '',
    requiresAll: [id],
  }));
  p.tasks = [
    {
      id: 'private-task',
      title: 'PRIVATE-TASK',
      owner: 'Host',
      status: 'proposed',
      note: '',
      reviewDate: '',
    },
  ];
  return planSchema.parse(p);
}
const auth = (token: string) => ({ authorization: `Bearer ${token}` });

it('uses the organisation graph, hides pending access, scopes actions and keeps private fields out', async () => {
  const instance = await createApp(':memory:');
  apps.push(instance);
  const { app, store } = instance;
  const plan = teamPlan();
  const created = await app.inject({
    method: 'POST',
    url: '/api/plan-sessions',
    payload: { plan, lostIds: ['drive', 'instagram', 'youtube'], name: 'Host' },
  });
  expect(created.statusCode).toBe(200);
  const room = created.json();
  const state = async (token: string): Promise<SessionView> =>
    (await app.inject({ url: `/api/sessions/${room.id}/state`, headers: auth(token) })).json();
  const command = async (
    token: string,
    type: string,
    target?: string,
    revision = store.getSession(room.id).revision,
  ) =>
    app.inject({
      method: 'POST',
      url: `/api/sessions/${room.id}/commands`,
      headers: auth(token),
      payload: { id: crypto.randomUUID(), revision, type, target },
    });
  const shared = JSON.stringify(store.getSession(room.id));
  expect(shared).not.toContain('PRIVATE-');
  expect(plan.assets[0].note).toBe('PRIVATE-ASSET');
  expect(shareablePlan(plan).tasks).toEqual([]);
  expect((await app.inject({ url: `/api/sessions/${room.id}/info` })).json()).toEqual({
    mode: 'organisation',
    phase: 'lobby',
  });
  const initial = await state(room.token);
  expect(initial.analysis.targets.filter((t) => t.current)).toHaveLength(3);
  expect(initial.customRoles.map((r) => r.name)).toEqual(['Antonio', 'Richard', 'Mary']);
  const players: Record<string, { token: string; participant: { id: string } }> = {};
  for (const role of initial.customRoles) {
    const guest = (
      await app.inject({
        method: 'POST',
        url: `/api/sessions/${room.id}/join`,
        payload: { name: role.name },
      })
    ).json();
    players[role.name] = guest;
    const pending = await state(guest.token);
    expect(pending.sharedPlan).toBeUndefined();
    expect(pending.joinUrls).toBeUndefined();
    expect(pending.actions).toEqual([]);
    expect(pending.customRoles).toEqual([]);
    expect(JSON.stringify(pending)).not.toContain('Google Drive');
    expect(JSON.stringify(pending)).not.toContain('Community team');
    expect((await command(guest.token, 'start')).statusCode).toBe(403);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/api/sessions/${room.id}/roles`,
          headers: auth(room.token),
          payload: { participantId: guest.participant.id, role: role.id },
        })
      ).statusCode,
    ).toBe(200);
  }
  expect((await command(room.token, 'start')).statusCode).toBe(200);
  const antonio = await state(players.Antonio.token);
  expect(antonio.actions.map((a) => a.id)).toEqual(['rule:method-drive']);
  expect(antonio.analysis.targets.filter((t) => t.current)).toHaveLength(0);
  expect((await command(players.Antonio.token, 'act', 'rule:method-instagram')).statusCode).toBe(
    403,
  );
  expect((await command(players.Richard.token, 'act', 'rule:method-instagram')).statusCode).toBe(
    400,
  );
  expect((await command(players.Mary.token, 'act', 'rule:method-youtube')).statusCode).toBe(400);
  expect((await command(room.token, 'advance')).statusCode).toBe(400);
  expect((await command(players.Antonio.token, 'act', 'rule:method-drive')).statusCode).toBe(200);
  const afterDrive = await state(players.Richard.token);
  expect(afterDrive.analysis.targets.filter((t) => t.current)).toHaveLength(1);
  // Restoring a normal prerequisite cannot restore a separately selected loss by itself.
  expect(afterDrive.analysis.resources.find((r) => r.id === 'youtube')?.state).toBe('uncertain');
  expect(afterDrive.actions[0].disabledReason).toBeUndefined();
  expect((await command(players.Richard.token, 'act', 'rule:method-instagram', 1)).statusCode).toBe(
    409,
  );
  expect((await command(room.token, 'pause')).statusCode).toBe(200);
  expect((await command(players.Richard.token, 'act', 'rule:method-instagram')).statusCode).toBe(
    403,
  );
  expect((await command(room.token, 'resume')).statusCode).toBe(200);
  expect((await command(players.Richard.token, 'act', 'rule:method-instagram')).statusCode).toBe(
    200,
  );
  expect((await command(room.token, 'complete')).statusCode).toBe(200);
  const finished = await state(room.token);
  expect(finished.analysis.targets.filter((t) => t.current)).toHaveLength(2);
  expect(finished.sharedPlan!.methods[0].evidence).toBe('user-reported');
  expect(finished.observations).toEqual([]);
  expect(finished.debrief.timingAvailable).toBe(false);
  const report = teamReport({
    ...finished,
    events: [...finished.events, { ...finished.events[0], actor: '<script>alert(1)</script>' }],
  });
  expect(report).toContain('Team check — simulated results');
  expect(report).toContain('Confirm recovery for YouTube');
  expect(report).not.toContain('Confirm recovery for Google Drive');
  expect(report).not.toContain('<script>');
  expect(report).not.toContain('PRIVATE-');
  expect(report).toContain('&lt;script&gt;');
  expect(
    (
      await app.inject({
        method: 'DELETE',
        url: `/api/sessions/${room.id}`,
        headers: auth(players.Antonio.token),
      })
    ).statusCode,
  ).toBe(403);
  expect(
    (
      await app.inject({
        method: 'DELETE',
        url: `/api/sessions/${room.id}`,
        headers: auth(room.token),
      })
    ).statusCode,
  ).toBe(200);
  expect((await app.inject({ url: `/api/sessions/${room.id}/info` })).statusCode).toBe(404);
  expect(
    (
      await app.inject({
        url: `/api/sessions/${room.id}/state`,
        headers: auth(players.Antonio.token),
      })
    ).statusCode,
  ).toBe(401);
  for (const table of ['sessions', 'participants', 'commands', 'events'])
    expect((store.db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n).toBe(
      0,
    );
});

it('rejects invalid losses and account assignments, and keeps account scope in this room', async () => {
  const instance = await createApp(':memory:');
  apps.push(instance);
  const { app } = instance;
  const plan = teamPlan();
  for (const lostIds of [[], ['not-present'], ['drive', 'drive']]) {
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/plan-sessions',
          payload: { plan, lostIds, name: 'Host' },
        })
      ).statusCode,
    ).toBe(400);
  }
  const room = (
    await app.inject({
      method: 'POST',
      url: '/api/plan-sessions',
      payload: { plan, lostIds: ['drive'], name: 'Host' },
    })
  ).json();
  const add = (accountIds: string[]) =>
    app.inject({
      method: 'POST',
      url: `/api/sessions/${room.id}/custom-roles`,
      headers: auth(room.token),
      payload: { name: 'Backup owner', responsibilities: ['administrator'], accountIds },
    });
  expect((await add(['backup'])).statusCode).toBe(400);
  expect((await add(['missing'])).statusCode).toBe(400);
  const role = (await add(['drive', 'instagram'])).json();
  expect(role.accountIds).toEqual(['drive', 'instagram']);
  const other = (
    await app.inject({
      method: 'POST',
      url: '/api/plan-sessions',
      payload: { plan, lostIds: ['drive'], name: 'Other host' },
    })
  ).json();
  const guest = (
    await app.inject({
      method: 'POST',
      url: `/api/sessions/${other.id}/join`,
      payload: { name: 'Guest' },
    })
  ).json();
  for (const invalidRole of [role.id, 'finance'])
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/api/sessions/${other.id}/roles`,
          headers: auth(other.token),
          payload: { participantId: guest.participant.id, role: invalidRole },
        })
      ).statusCode,
    ).toBe(400);
});
