# BLACKOUT PROTOCOL

**Know your way back before the account goes dark.**

A local recovery-planning and team-rehearsal tool for small organisations. Model the accounts and people your work depends on, expose recovery loops, rehearse a work-account compromise, then keep an offline action plan.

Harbor Aid is a fictional volunteer organisation. Its recovery mailbox depends on the same work identity it is meant to recover. The baseline lockout leaves **1 of 4** essential activities reachable. A proposed independent recovery kit raises the forecast to **4 of 4**, subject to the custodian, clean device, and containment prerequisites. Those numbers are computed from the rules.

## Run locally

Use Node.js **22.13+** (validated on **24.14.1**) and npm.

```sh
npm ci
npm run build
npm start
```

Open **http://localhost:4310**. Stop the server with Ctrl+C. Restarting preserves rooms in `data/blackout.sqlite`.

For development:

```sh
npm run dev
```

Open http://localhost:5173. Vite proxies API and room traffic to port 4310. `npm start` serves the built application and does not watch source changes; rebuild the frontend and restart after server edits.

Optional environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `4310` | API and built-app port |
| `HOST` | `0.0.0.0` | Bind address; use `127.0.0.1` for this computer only |
| `BLACKOUT_DB` | `data/blackout.sqlite` | Database path |

## Try the complete loop

1. Open **Recovery map** with the work-account failure selected.
2. Inspect the work identity and backup mailbox. Switch between the map and keyboard-friendly list.
3. Select **Recovery kit**, then **Compare plans**. Read the added assumptions.
4. Start a rehearsal. A facilitator can run every role alone, or invite participants.
5. Recover control, rotate credentials, revoke sessions, review recovery settings, and verify containment. These are simulated actions.
6. Advance to chapter 3. Share the coordinator's independent-contact observation, then verify the payment request as Finance.
7. End the exercise. Inspect the timeline and measured outcomes, export the plan, and save the JSON record with its separate digest.
8. Assign follow-up actions under **Compare plans**. Record what was actually implemented and tested.

**New run** creates another room from the same frozen blueprint. Previous rooms and timelines remain available under Exercise room and Evidence locker.

## Team exercise on a LAN

Build first and run `npm start`. Connect devices to the same trusted local network. Open the app using the server laptop's LAN IP and port 4310, then copy the join link from that address. A `localhost` link works only on the laptop itself. Client isolation or a firewall may prevent devices from reaching each other.

Use separate devices or browser profiles for participants. Tabs in the same browser profile share the room credential. Participants enter a name; the facilitator assigns Administrator, Finance, Coordinator, or Observer. Role-specific clues are filtered on the server. The facilitator sees every role for a solo walkthrough.

The running app uses local assets and has no runtime cloud or AI API dependency. The server and LAN must remain available. It is **not** a peer-to-peer mesh or an installable offline app. A downloaded HTML plan is a separate standalone reference. Physical multi-device and WAN-disconnection checks still need to be performed; see [validation](docs/VALIDATION.md).

## What the model means

- **Available now:** established by current facts and non-action rules.
- **Recoverable:** there is a modelled sequence of actions whose prerequisites can be satisfied.
- **Trusted:** separate from merely having control of an account; containment gates must be completed.
- **Needs confirmation:** a route depends on an unknown method and is excluded from the working-route count.
- **Evidence:** fictional fixture, owner-marked tested, reported but untested, or unknown. Marking a follow-up task tested does not silently change rule evidence.

Methods combine prerequisites with AND; separate methods provide alternatives. Forecasting does not perform recovery actions. The planner preserves the baseline when proposing the kit. Every exercise stores its own blueprint snapshot.

## Records and privacy

Room snapshots, event sequences, accepted command IDs and hashed room tokens are stored in SQLite. The browser stores the planner and its room credentials locally. Keep the same browser profile and origin to resume membership. Losing that local credential requires joining again and receiving a role; there is no account-recovery system for application users in this prototype.

The JSON export includes the frozen blueprint, failure definition, versions, events and measured outcome. Compare its SHA-256 digest with a separately saved reference in Evidence locker. Verification stays in the browser, including on LAN HTTP. A digest detects changes relative to that reference; it does not prove real incidents occurred or prevent replacement of both the record and digest.

Use fictional, non-sensitive data. This prototype uses bearer room credentials over local HTTP and has no production identity provider, encryption at rest, hosted multi-tenant access controls, or independent security review. Do not expose the server to the public internet or put real recovery codes in the blueprint.

## Validation and structure

```sh
npm run typecheck
npm run build
npm test
npm audit
```

The realtime test temporarily binds to `127.0.0.1`; a restrictive sandbox must permit that listener. Playwright journeys are in `tests/e2e` but need Chromium installed before `npm run test:e2e`. They have not yet been executed in this workspace. Browser checks so far used Codex's in-app browser.

- `packages/domain`: schemas, fictional fixture, closure/cycle engine, scenario reducer and debrief measurements.
- `apps/server`: Fastify routes, SQLite transactions, server-only observations, Socket.IO invalidations and exports.
- `apps/web`: planner, editor, recovery graph, cooperative room, follow-up tracking and integrity checker.
- `tests`: API, persistence, realtime and browser journeys.
- [Demo guide](docs/DEMO.md), [validation record](docs/VALIDATION.md), [submission draft](docs/SUBMISSION.md), [progress / continuation](docs/PROGRESS.md).

## Credits and build disclosure

Built with TypeScript, React, Vite, React Flow, Fastify, Socket.IO, Zod, Node SQLite, Lucide and noble hashes. Dependency versions are pinned by `package-lock.json`. See [sources and disclosure](docs/SOURCES.md).

AI assistance was used for concept development, specification, implementation, test creation, debugging and documentation. The application itself uses deterministic rules and requires no AI service. Subtle `Hello, friend.` and `eps1.0_lockout` details reference Mr. Robot; no show artwork, character likenesses, audio, or affiliation is used.
