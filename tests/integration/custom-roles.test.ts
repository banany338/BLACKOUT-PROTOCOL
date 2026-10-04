import { it, expect } from 'vitest';
import { createApp } from '../../apps/server/app';
import { withRecoveryKit, harborAid } from '../../packages/domain/fixture';

it('custom responsibilities control private clues and actions, never host powers', async () => {
  const { app, store } = await createApp(':memory:');
  try {
    const room = store.create(withRecoveryKit(harborAid), 'Host'),
      guest = store.addParticipant(room.id, 'Volunteer');
    const host = { authorization: `Bearer ${room.token}` },
      member = { authorization: `Bearer ${guest.token}` };
    const add = (headers: typeof host, name = 'Volunteer lead') =>
      app.inject({
        method: 'POST',
        url: `/api/sessions/${room.id}/custom-roles`,
        headers,
        payload: { name, responsibilities: ['finance', 'coordinator'] },
      });
    expect((await add(member)).statusCode).toBe(403);
    const added = await add(host);
    expect(added.statusCode).toBe(200);
    const role = added.json();
    expect((await add(host)).statusCode).toBe(400);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/api/sessions/${room.id}/custom-roles`,
          headers: host,
          payload: { name: 'Admin', responsibilities: ['facilitator'] },
        })
      ).statusCode,
    ).toBe(400);
    const assign = (role: string) =>
      app.inject({
        method: 'POST',
        url: `/api/sessions/${room.id}/roles`,
        headers: host,
        payload: { participantId: guest.participant.id, role },
      });
    expect((await assign('custom:000000000000000000')).statusCode).toBe(400);
    expect((await assign(role.id)).statusCode).toBe(200);
    const second = store.addParticipant(room.id, 'Second volunteer');
    store.assign(room.id, store.member(room.id, room.token), second.participant.id, role.id);
    const command = async (token: string, type: string, target?: string) =>
      app.inject({
        method: 'POST',
        url: `/api/sessions/${room.id}/commands`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          id: crypto.randomUUID(),
          revision: store.getSession(room.id).revision,
          type,
          target,
        },
      });
    expect((await command(guest.token, 'start')).statusCode).toBe(403);
    await command(room.token, 'start');
    await command(room.token, 'advance');
    await command(room.token, 'advance');
    const view = (
      await app.inject({ url: `/api/sessions/${room.id}/state`, headers: member })
    ).json();
    expect(view.customRoles[0].name).toBe('Volunteer lead');
    expect(view.responsibilities).toEqual(['finance', 'coordinator']);
    expect(view.observations.some((o: { id: string }) => o.id === 'known-contact')).toBe(true);
    expect(view.observations.some((o: { id: string }) => o.id === 'lockout')).toBe(false);
    expect(view.actions.some((a: { role: string }) => a.role === 'administrator')).toBe(false);
    expect((await command(guest.token, 'share', 'lockout')).statusCode).toBe(403);
    expect((await command(guest.token, 'act', 'verify-payment')).statusCode).toBe(400);
    expect((await command(guest.token, 'share', 'known-contact')).statusCode).toBe(200);
    expect((await command(guest.token, 'act', 'verify-payment')).statusCode).toBe(200);
    expect(store.getSession(room.id).paymentDecision).toBe('verified');
    expect(
      (await app.inject({ url: `/api/sessions/${room.id}/export`, headers: member })).statusCode,
    ).toBe(403);
    expect((await add(host, 'Late role')).statusCode).toBe(400);
    const other = store.create(harborAid, 'Other host');
    expect(() =>
      store.assign(
        other.id,
        store.member(other.id, other.token),
        store.addParticipant(other.id, 'Other').participant.id,
        role.id,
      ),
    ).toThrow('Choose a role');
  } finally {
    await app.close();
  }
});
