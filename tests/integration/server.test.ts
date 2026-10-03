import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../../apps/server/app';
import { harborAid } from '../../packages/domain/fixture';
import { createHash } from 'node:crypto';
import { exportPlan } from '../../apps/server/exports';

const opened: Awaited<ReturnType<typeof createApp>>[] = [];
afterEach(async () => {
  for (const { app } of opened.splice(0)) await app.close();
});
async function setup() {
  const instance = await createApp(':memory:');
  opened.push(instance);
  const room = (
    await instance.app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: { blueprint: harborAid, name: 'Host' },
    })
  ).json();
  const headers = { authorization: `Bearer ${room.token}` };
  return { ...instance, room, headers };
}
describe('durable rooms', () => {
  it('persists one event for duplicate commands and reconciles action IDs', async () => {
    const { app, store, room, headers } = await setup();
    const request = {
      method: 'POST' as const,
      url: `/api/sessions/${room.id}/commands`,
      headers,
      payload: { id: 'start-1', revision: 0, type: 'start' },
    };
    expect((await app.inject(request)).statusCode).toBe(200);
    expect((await app.inject(request)).json().duplicate).toBe(true);
    expect(store.getSession(room.id).events).toHaveLength(1);
    expect(
      (await app.inject({ url: `/api/sessions/${room.id}/actions/start-1`, headers })).json()
        .accepted,
    ).toBe(true);
    expect(
      (await app.inject({ ...request, payload: { id: 'next', revision: 0, type: 'advance' } }))
        .statusCode,
    ).toBe(409);
  });
  it('requires membership, protects role assignment, and filters private clues', async () => {
    const { app, room, headers } = await setup();
    const joined = (
      await app.inject({
        method: 'POST',
        url: `/api/sessions/${room.id}/join`,
        payload: { name: 'Fin' },
      })
    ).json();
    const ph = { authorization: `Bearer ${joined.token}` };
    expect((await app.inject({ url: `/api/sessions/${room.id}/state` })).statusCode).toBe(401);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/api/sessions/${room.id}/roles`,
          headers: ph,
          payload: { participantId: joined.participant.id, role: 'finance' },
        })
      ).statusCode,
    ).toBe(403);
    await app.inject({
      method: 'POST',
      url: `/api/sessions/${room.id}/roles`,
      headers,
      payload: { participantId: joined.participant.id, role: 'finance' },
    });
    await app.inject({
      method: 'POST',
      url: `/api/sessions/${room.id}/commands`,
      headers,
      payload: { id: 's', revision: 0, type: 'start' },
    });
    const view = (await app.inject({ url: `/api/sessions/${room.id}/state`, headers: ph })).json();
    expect(view.observations).toHaveLength(0);
    expect(view.actions.filter((a: { role: string }) => a.role === 'administrator')).toHaveLength(
      0,
    );
    expect(
      (await app.inject({ url: `/api/sessions/${room.id}/export`, headers: ph })).statusCode,
    ).toBe(403);
    expect(
      (await app.inject({ url: '/api/sessions/different-room/state', headers: ph })).statusCode,
    ).toBe(401);
  });
  it('exports a transcript whose saved digest detects modification', async () => {
    const { app, room, headers } = await setup();
    const out = (await app.inject({ url: `/api/sessions/${room.id}/export`, headers })).json();
    const hash = (s: string) => createHash('sha256').update(s).digest('hex');
    expect(hash(out.content)).toBe(out.sha256);
    expect(hash(`${out.content} `)).not.toBe(out.sha256);
    expect(out.content).not.toContain(room.token);
  });
  it('escapes user text in standalone exports and includes no scripts', () => {
    const b = structuredClone(harborAid);
    b.name = '<script>alert(1)</script>';
    const html = exportPlan(b, 'work-lockout');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('src="http');
  });
});
