import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { Server } from 'socket.io';
import { z } from 'zod';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { networkInterfaces } from 'node:os';
import { blueprintSchema, roles, type ViewerRole } from '../../packages/domain/model';
import { analyze } from '../../packages/domain/engine';
import { failureById, failures, harborAid } from '../../packages/domain/fixture';
import { DomainError, projectSession } from '../../packages/domain/session';
import { Store } from './store';
import { observations } from './scenario';
import { exportPlan, exportTranscript } from './exports';
import { planSchema } from '../../packages/planner/model';
import { shareablePlan } from '../../packages/planner/team';
import { toBlueprint, lossScenario } from '../../packages/planner/analysis';

const commandSchema = z
  .object({
    id: z.string().min(1).max(100),
    revision: z.number().int().nonnegative(),
    type: z.enum(['start', 'advance', 'pause', 'resume', 'complete', 'share', 'act']),
    target: z.string().max(100).optional(),
  })
  .strict();
const nameSchema = z.string().trim().min(1).max(60);
const failureSchema = z.enum(['none', 'work-lockout', 'backup-lost', 'phone-lost']);
export async function createApp(dbPath = process.env.BLACKOUT_DB ?? 'data/blackout.sqlite') {
  const app = Fastify({ logger: false, bodyLimit: 512_000 });
  const store = new Store(dbPath);
  const io = new Server(app.server, { serveClient: false, maxHttpBufferSize: 32_000 });
  io.use((socket, next) => {
    try {
      const id = z.string().max(100).parse(socket.handshake.auth.sessionId);
      const token = z.string().max(100).parse(socket.handshake.auth.token);
      store.member(id, token);
      socket.data.room = id;
      next();
    } catch {
      next(new Error('Room access denied'));
    }
  });
  io.on('connection', (socket) => {
    socket.join(socket.data.room);
    socket.emit('changed');
  });
  const changed = (id: string) => io.to(id).emit('changed');
  const token = (req: { headers: { authorization?: string } }) =>
    req.headers.authorization?.replace(/^Bearer /, '');
  const routeId = (params: unknown) => z.object({ id: z.string().max(100) }).parse(params).id;
  app.addHook('onSend', async (req, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff').header('Referrer-Policy', 'no-referrer');
    if (req.url.startsWith('/api')) reply.header('Cache-Control', 'no-store');
  });
  app.setErrorHandler((error, _req, reply) => {
    if (error instanceof z.ZodError)
      return reply.code(400).send({ error: error.issues.map((i) => i.message).join('; ') });
    if (error instanceof DomainError)
      return reply.code(error.status).send({ error: error.message });
    const known = error as { statusCode?: number; message?: string };
    const status =
      typeof known.statusCode === 'number' && known.statusCode < 500 ? known.statusCode : 500;
    if (status === 500) console.error(error);
    return reply.code(status).send({
      error: status === 500 ? 'The server could not complete this request.' : known.message,
    });
  });
  app.get('/api/health', async () => ({ status: 'ok', product: 'BLACKOUT PROTOCOL' }));
  app.get('/api/templates', async () => ({ blueprints: [harborAid], failures }));
  app.post('/api/blueprints', async (req) => ({
    id: store.saveBlueprint(blueprintSchema.parse(req.body)),
  }));
  app.get('/api/blueprints/:id', async (req) => store.getBlueprint(routeId(req.params)));
  app.post('/api/analysis', async (req) => {
    const input = z
      .object({ blueprint: blueprintSchema, failureId: failureSchema })
      .parse(req.body);
    return analyze(input.blueprint, failureById(input.failureId));
  });
  app.post('/api/comparisons', async (req) => {
    const input = z
      .object({ baseline: blueprintSchema, improved: blueprintSchema, failureId: failureSchema })
      .parse(req.body);
    if (JSON.stringify(input.baseline.targets) !== JSON.stringify(input.improved.targets))
      throw new DomainError('Comparison requires the same critical targets.');
    return {
      baseline: analyze(input.baseline, failureById(input.failureId)),
      improved: analyze(input.improved, failureById(input.failureId)),
      engineVersion: '1',
      failureId: input.failureId,
    };
  });
  app.post('/api/export-plan', async (req, reply) => {
    const { blueprint, failureId } = z
      .object({ blueprint: blueprintSchema, failureId: failureSchema })
      .parse(req.body);
    reply
      .header('Content-Disposition', 'attachment; filename="blackout-recovery-plan.html"')
      .type('text/html');
    return exportPlan(blueprint, failureId);
  });
  app.post('/api/sessions', async (req) => {
    const { blueprint, name } = z
      .object({ blueprint: blueprintSchema, name: nameSchema.default('Facilitator') })
      .parse(req.body);
    return store.create(blueprint, name);
  });
  app.post('/api/plan-sessions', async (req) => {
    const input = z
      .object({
        plan: planSchema,
        lostIds: z.array(z.string().min(1).max(80)).min(1).max(100),
        name: nameSchema,
      })
      .strict()
      .parse(req.body);
    if (
      new Set(input.lostIds).size !== input.lostIds.length ||
      input.lostIds.some((id) => !input.plan.assets.some((a) => a.id === id))
    )
      throw new DomainError('Choose losses from this plan.');
    const plan = shareablePlan(input.plan);
    return store.create(toBlueprint(plan), input.name, {
      plan,
      lostIds: input.lostIds,
      failure: lossScenario(plan, input.lostIds),
    });
  });
  app.get('/api/sessions/:id/info', async (req) => {
    const s = store.getSession(routeId(req.params));
    return { mode: s.mode ?? 'story', phase: s.phase };
  });
  app.post('/api/sessions/:id/join', async (req) => {
    const { name } = z.object({ name: nameSchema }).parse(req.body);
    const id = routeId(req.params),
      result = store.addParticipant(id, name);
    changed(id);
    return result;
  });
  app.delete('/api/sessions/:id', async (req) => {
    const id = routeId(req.params),
      member = store.member(id, token(req));
    store.deleteSession(id, member);
    changed(id);
    return { ok: true };
  });
  app.get('/api/sessions/:id/state', async (req) => {
    const id = routeId(req.params),
      member = store.member(id, token(req));
    const view = projectSession(store.getSession(id), member, store.participants(id), observations);
    if (view.mode === 'organisation' && member.role === 'facilitator') {
      const address = app.server.address();
      const port =
        address && typeof address === 'object' ? address.port : Number(process.env.PORT ?? 4310);
      view.joinUrls = [
        ...new Set(
          Object.values(networkInterfaces()).flatMap((entries) =>
            (entries ?? [])
              .filter(
                (entry) =>
                  entry.family === 'IPv4' &&
                  !entry.internal &&
                  /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(entry.address),
              )
              .map((entry) => `http://${entry.address}:${port}/join/${id}`),
          ),
        ),
      ];
    }
    return view;
  });
  app.post('/api/sessions/:id/roles', async (req) => {
    const id = routeId(req.params),
      member = store.member(id, token(req));
    const { participantId, role } = z
      .object({
        participantId: z.string().max(100),
        role: z.union([
          z.enum([...roles, 'observer', 'pending']),
          z.string().regex(/^custom:[a-f0-9]{18}$/),
        ]),
      })
      .parse(req.body);
    store.assign(id, member, participantId, role as ViewerRole);
    changed(id);
    return { ok: true };
  });
  app.post('/api/sessions/:id/custom-roles', async (req) => {
    const id = routeId(req.params),
      member = store.member(id, token(req));
    const { name, responsibilities, accountIds } = z
      .object({
        name: nameSchema,
        responsibilities: z.array(z.enum(roles)).min(1).max(3),
        accountIds: z.array(z.string().min(1).max(80)).min(1).max(100).optional(),
      })
      .strict()
      .parse(req.body);
    const role = store.addRole(id, member, name, responsibilities, accountIds);
    changed(id);
    return role;
  });
  app.post('/api/sessions/:id/commands', async (req) => {
    const id = routeId(req.params),
      member = store.member(id, token(req));
    const result = store.command(id, member, commandSchema.parse(req.body));
    changed(id);
    return result;
  });
  app.get('/api/sessions/:id/actions/:actionId', async (req) => {
    const { id, actionId } = z
      .object({ id: z.string().max(100), actionId: z.string().max(100) })
      .parse(req.params);
    return store.actionResult(id, actionId, store.member(id, token(req)));
  });
  app.get('/api/sessions/:id/export', async (req) => {
    const id = routeId(req.params),
      member = store.member(id, token(req));
    if (member.role !== 'facilitator')
      throw new DomainError('Only the facilitator can export the full exercise record.', 403);
    return exportTranscript(store.getSession(id));
  });
  const output = resolve('dist/client');
  if (existsSync(output)) {
    await app.register(fastifyStatic, { root: output });
    app.setNotFoundHandler((req, reply) =>
      req.url.startsWith('/api/')
        ? reply.code(404).send({ error: 'Endpoint not found.' })
        : reply.sendFile('index.html'),
    );
  }
  app.addHook('onClose', async () => {
    io.disconnectSockets(true);
    await new Promise<void>((r) => io.close(() => r()));
    store.close();
  });
  return { app, store, io };
}
