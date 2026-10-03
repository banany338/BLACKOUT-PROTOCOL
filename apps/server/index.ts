import { createApp } from './app';
const { app } = await createApp();
const port = Number(process.env.PORT ?? 4310);
await app.listen({ port, host: process.env.HOST ?? '0.0.0.0' });
console.log(`BLACKOUT PROTOCOL is running at http://localhost:${port}`);
const close = async () => {
  await app.close();
  process.exit(0);
};
process.once('SIGINT', close);
process.once('SIGTERM', close);
