# BLACKOUT PROTOCOL

**Your main account is gone. Can your team recover?**

BLACKOUT helps a small company, student club or volunteer team find account-recovery dead ends before an outage. Map your services and owners, try losing an email or phone, and prepare a way back that does not depend on the missing account.

![BLACKOUT PROTOCOL](docs/screenshots/main-page.png)

## Run it

Install **Node.js 22.13 or newer**, then run these commands in the project folder:

```sh
npm ci
npm run build
npm start
```

Open **http://localhost:4310**. Stop the server with **Ctrl+C**.

For development, use `npm run dev` and open http://localhost:5173. The normal server uses the last build, so rebuild after changing the frontend.

## Get a useful result

1. **Create a private workspace.** Choose a separate passphrase and keep it safe.
2. **Add your services.** Enter each service, its owner, access dependencies and known recovery options. Unknown methods stay unconfirmed.
3. **Try a blackout.** Select an unavailable account or backup. See which work stops and what recovery needs.
4. **Prepare the fix.** Keep an improvement as a separate proposal, assign the real preparation, and save a readable recovery plan plus an encrypted backup.

Optional: **Check with team** lets approved participants check the recovery order using a reviewed copy of your map. Owners receive account responsibilities, and accepted simulated steps update everyone's view.

## What it actually does

- Finds missing prerequisites, recovery loops and work affected by one or several losses.
- Compares your current setup with an independent fallback proposal.
- Tracks preparation tasks and exports a readable HTML recovery reference.
- Encrypts private saved plans and backups on your device.
- Imports recovery contact fields from a local Google Directory JSON export for review.
- Runs cached private planning offline after the app shows **Available offline**. Team rooms need the local server.

## Privacy and limits

Private plans stay encrypted in this browser. Keep passwords and recovery codes out of the map, and download encrypted backups before clearing browser data. Readable HTML exports are unencrypted.

Sharing is explicit. The preview excludes private notes, instructions, tasks, history and the workspace key. **Shared room metadata is stored unencrypted on the local server.** Use a trusted network and non-sensitive aliases; the room server is not ready for public hosting.

The app analyses information you provide. It does **not** sign in to providers, perform recovery or prove that a method will work. Confirm proposed arrangements with the real owner and provider. Direct opening of the generated portable HTML, physical offline LAN use and independent security review remain unverified.

## Checked

**41 unit/integration tests and 9 browser journeys pass**, including backup restore, downloads, offline planning, phone layout and a host with three independent participants. See [validation details](docs/VALIDATION.md).

```sh
npm run build
npm test
npm run test:e2e
```

Install the test browser once with `npx playwright install chromium` if needed.

## Read more

[User guide](docs/USER_GUIDE.md) · [Project updates](docs/PROJECT_UPDATES.md) · [Technical reference](docs/TECHNICAL_REFERENCE.md) · [Presentation and promo](docs/PRESENTATION.md) · [Submission text](docs/SUBMISSION.md)

Built with React, TypeScript, React Flow, Fastify, Socket.IO, Zod and Node SQLite. AI assisted design, implementation, testing, documentation and presentation materials. The app uses deterministic rules and requires no AI service. [Libraries and sources](docs/SOURCES.md).
