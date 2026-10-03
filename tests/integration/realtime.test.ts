import { expect, it } from 'vitest';
import { io, type Socket } from 'socket.io-client';
import { createApp } from '../../apps/server/app';
import { harborAid } from '../../packages/domain/fixture';

function once(socket: Socket, event: string): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), 3000);
    socket.once(event, (...args) => {
      clearTimeout(timer);
      resolve(args);
    });
  });
}

it('updates five clients without broadcasting private data and resynchronises after reconnect', async () => {
  const { app, store } = await createApp(':memory:');
  const sockets: Socket[] = [];
  try {
    const host = store.create(harborAid, 'Host');
    const members = ['administrator', 'finance', 'coordinator', 'observer'].map((role) => {
      const member = store.addParticipant(host.id, role);
      store.assign(
        host.id,
        host.participant,
        member.participant.id,
        role as 'administrator' | 'finance' | 'coordinator' | 'observer',
      );
      return member;
    });
    const address = await app.listen({ port: 0, host: '127.0.0.1' });
    for (const member of [host, ...members]) {
      const socket = io(address, {
        autoConnect: false,
        transports: ['websocket'],
        auth: { sessionId: host.id, token: member.token },
      });
      sockets.push(socket);
      const ready = once(socket, 'changed');
      socket.connect();
      await ready;
    }
    const updates = sockets.map((socket) => once(socket, 'changed'));
    const start = performance.now();
    await app.inject({
      method: 'POST',
      url: `/api/sessions/${host.id}/commands`,
      headers: { authorization: `Bearer ${host.token}` },
      payload: { id: 'start', revision: 0, type: 'start' },
    });
    expect(await Promise.all(updates)).toEqual([[], [], [], [], []]);
    const latency = performance.now() - start;
    expect(latency).toBeLessThan(1000);
    console.info(`Five-client loopback notification latency: ${latency.toFixed(1)} ms`);
    const finance = sockets[2];
    finance.disconnect();
    await app.inject({
      method: 'POST',
      url: `/api/sessions/${host.id}/commands`,
      headers: { authorization: `Bearer ${host.token}` },
      payload: { id: 'advance', revision: 1, type: 'advance' },
    });
    const reconnected = once(finance, 'changed');
    finance.connect();
    await reconnected;
    const view = (
      await app.inject({
        url: `/api/sessions/${host.id}/state`,
        headers: { authorization: `Bearer ${members[1].token}` },
      })
    ).json();
    expect(view.revision).toBe(2);
    expect(view.observations.map((o: { id: string }) => o.id)).toEqual(['urgent-payment']);
    const unauthorised = io(address, {
      autoConnect: false,
      reconnection: false,
      transports: ['websocket'],
      auth: { sessionId: host.id, token: 'invalid' },
    });
    sockets.push(unauthorised);
    const denied = once(unauthorised, 'connect_error');
    unauthorised.connect();
    expect((await denied)[0]).toMatchObject({ message: 'Room access denied' });
  } finally {
    sockets.forEach((socket) => socket.disconnect());
    await app.close();
  }
});
