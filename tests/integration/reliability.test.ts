import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { Store } from '../../apps/server/store';
import { createApp } from '../../apps/server/app';
import { harborAid, withRecoveryKit } from '../../packages/domain/fixture';
import { recordDigest } from '../../apps/web/integrity';

const apps: Awaited<ReturnType<typeof createApp>>[] = [];
afterEach(async () => {
  for (const { app } of apps.splice(0)) await app.close();
});

describe('persistence and role cooperation', () => {
  it('recovers committed state and the original acknowledgement after reopening SQLite', () => {
    const directory = mkdtempSync(join(tmpdir(), 'blackout-persistence-'));
    let store = new Store(join(directory, 'test.sqlite'));
    try {
      const room = store.create(harborAid, 'Host');
      const command = { id: 'ack-lost', revision: 0, type: 'start' };
      store.command(room.id, room.participant, command);
      store.close();
      store = new Store(join(directory, 'test.sqlite'));
      const member = store.member(room.id, room.token);
      expect(store.actionResult(room.id, command.id, member)).toEqual({
        accepted: true,
        revision: 1,
      });
      expect(store.command(room.id, member, command).duplicate).toBe(true);
      expect(store.getSession(room.id).events).toHaveLength(1);
      expect(store.getSession(room.id).phase).toBe('running');
      expect(() => store.command(room.id, member, { ...command, type: 'advance' })).toThrow(
        'already been used',
      );
    } finally {
      store.close();
      rmSync(directory, { recursive: true });
    }
  });
  it('lets three authorised roles cooperate while rejecting stale commands and role spoofing', async () => {
    const instance = await createApp(':memory:');
    apps.push(instance);
    const { app } = instance;
    const room = (
      await app.inject({
        method: 'POST',
        url: '/api/sessions',
        payload: { blueprint: withRecoveryKit(harborAid), name: 'Host' },
      })
    ).json();
    const auth = (token: string) => ({ authorization: `Bearer ${token}` });
    const players: Record<string, { token: string; participant: { id: string } }> = {};
    for (const role of ['administrator', 'finance', 'coordinator']) {
      players[role] = (
        await app.inject({
          method: 'POST',
          url: `/api/sessions/${room.id}/join`,
          payload: { name: role },
        })
      ).json();
      expect(
        (
          await app.inject({
            method: 'POST',
            url: `/api/sessions/${room.id}/roles`,
            headers: auth(room.token),
            payload: { participantId: players[role].participant.id, role },
          })
        ).statusCode,
      ).toBe(200);
    }
    const state = async (token: string) =>
      (await app.inject({ url: `/api/sessions/${room.id}/state`, headers: auth(token) })).json();
    let sequence = 0;
    const send = async (token: string, type: string, target?: string) =>
      app.inject({
        method: 'POST',
        url: `/api/sessions/${room.id}/commands`,
        headers: auth(token),
        payload: { id: `cmd-${++sequence}`, revision: (await state(token)).revision, type, target },
      });
    expect((await send(players.finance.token, 'start')).statusCode).toBe(403);
    await send(room.token, 'start');
    expect(
      (await state(players.administrator.token)).observations.map((o: { id: string }) => o.id),
    ).toEqual(['lockout']);
    expect((await state(players.finance.token)).observations).toHaveLength(0);
    expect((await send(players.finance.token, 'act', 'rule:recover-work-kit')).statusCode).toBe(
      403,
    );
    await send(room.token, 'advance');
    expect(JSON.stringify(await state(players.finance.token))).not.toContain(
      'printed volunteer folder',
    );
    expect((await send(players.finance.token, 'act', 'verify-payment')).statusCode).toBe(400);
    await send(room.token, 'advance');
    await send(players.coordinator.token, 'share', 'known-contact');
    expect(
      (await state(players.finance.token)).observations.map((o: { id: string }) => o.id),
    ).toContain('known-contact');
    expect((await send(players.finance.token, 'act', 'verify-payment')).statusCode).toBe(200);
    const revision = (await state(room.token)).revision;
    const concurrent = await Promise.all(
      ['recover-work-kit', 'support'].map((target, i) =>
        app.inject({
          method: 'POST',
          url: `/api/sessions/${room.id}/commands`,
          headers: auth(players.administrator.token),
          payload: {
            id: `parallel-${i}`,
            revision,
            type: 'act',
            target: i ? target : `rule:${target}`,
          },
        }),
      ),
    );
    expect(concurrent.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    const after = await state(room.token);
    expect(after.events.map((e: { sequence: number }) => e.sequence)).toEqual(
      Array.from({ length: after.revision }, (_, i) => i + 1),
    );
    expect(after.paymentDecision).toBe('verified');
    const pending = (
      await app.inject({
        method: 'POST',
        url: `/api/sessions/${room.id}/join`,
        payload: { name: 'Observer' },
      })
    ).json();
    expect((await state(pending.token)).actions).toHaveLength(0);
    expect(
      (
        await app.inject({
          url: `/api/sessions/${room.id}/export`,
          headers: auth(players.coordinator.token),
        })
      ).statusCode,
    ).toBe(403);
  });
  it('verifies browser-compatible hashes against Node, including a changed UTF-8 record', () => {
    const bytes = new TextEncoder().encode('{"event":"Zażółć / recovery"}\n');
    const expected = createHash('sha256').update(bytes).digest('hex');
    expect(recordDigest(bytes)).toBe(expected);
    bytes[0] ^= 1;
    expect(recordDigest(bytes)).not.toBe(expected);
  });
});
