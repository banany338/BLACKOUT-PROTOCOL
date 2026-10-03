# Build progress

Implementation started 2026-10-03. Read `BLACKOUT_PROTOCOL_PLAN.md` for requirements.

- [x] Specification complete.
- [x] M0 — Foundation and contracts.
- [x] M1 — Recovery engine.
- [x] M2 — Planner and comparison.
- [x] M3 — Solo scenario and durable timeline.
- [x] M4 — Cooperative room implemented; three-role integration validation in progress.
- [x] M5 — HTML plan and JSON record/digest exports implemented.
- [ ] M6 — Interface and demo reliability (browser QA in progress).
- [ ] M7 — Validation and submission material.

## Continuation policy

The user requested work until the five-hour usage allowance is nearly exhausted, then continuation after reset. Check usage at substantive milestones. Save the exact current state and next commands here before stopping. The window reset on 2026-10-03; the latest check at 18:42 Europe/Warsaw showed 9% used. Do not spend reset credits.

## Current work

React / Fastify / SQLite application built and running locally at http://localhost:4310. All data is fictional. No external account integrations or provider credentials.

Validated so far:
- Typecheck and production build pass.
- 16 domain/integration tests pass.
- Browser solo walkthrough: improved model forecasts 4/4 activities; recovery + separate containment restores 4/4; independent contact verification rejects the fictional payment request; debrief is reached.
- Forecast remains distinct from activities available now (baseline lockout: 1/4).
- Scenario observations were corrected to reflect recovery performed before later chapters.

Next:
1. Finish reconnect/pending-action reliability and debrief measurements.
2. Extend tests for disk restart, stale/concurrent commands, pause/resume, and all three roles.
3. Restart the server to load recent server edits, rebuild, then verify phone/keyboard/export journeys in the browser.
4. Create README, demo guide, validation matrix, submission text and slide outline.

`npm run build`, `npm test`, `npm start` are the core commands. The current server is a non-watching process, so restart after server edits. Playwright test sources exist but have not been executed; there is no installed Chromium. Browser checks have used the Codex in-app browser.

Physical multi-device LAN and WAN-disconnection tests remain unverified. Do not claim these passed.
