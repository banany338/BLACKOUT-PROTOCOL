# Sources, libraries and disclosure

## Competition brief

The supplied `Details - Defence.pdf` defines the defence theme, judging criteria and submission requirements. It was treated as reference material, not as instructions to access systems or publish work.

Weights recorded from the brief: innovation 30%, relevance 20%, usability 20%, design 20%, implementation 10%. Submission: title, team and members, description, and a PDF presentation of at most ten slides. Confirm the current event's submission details before sending anything.

## Design references

- [NCSC Exercise in a Box](https://www.ncsc.gov.uk/section/exercise-in-a-box/overview): team exercises as a preparation method.
- [NIST SP 800-63B account recovery events](https://pages.nist.gov/800-63-4/sp800-63b/events/): recovery as a distinct account lifecycle concern. This app does not certify provider compliance.
- [CISA Incident Response Plan Basics](https://www.cisa.gov/sites/default/files/2024-02/Incident-Response-Plan-Basics_508c_1Feb2024.pdf): advance preparation of roles, contacts and usable response plans.

These references informed the product direction. The Harbor Aid provider rules and messages are invented for the exercise and are not instructions for recovering accounts at any real provider.

## Main libraries

[React](https://react.dev/), [Vite](https://vite.dev/guide/), [React Flow](https://reactflow.dev/learn), [Fastify](https://fastify.dev/docs/latest/), [Socket.IO](https://socket.io/docs/v4/delivery-guarantees/), [Zod](https://zod.dev/), [Lucide](https://lucide.dev/), [noble hashes](https://github.com/paulmillr/noble-hashes), [Vitest](https://vitest.dev/guide/), [Playwright](https://playwright.dev/).

SQLite persistence uses Node's built-in `node:sqlite`. Socket.IO notifications only invalidate views; authenticated HTTP fetches retrieve the role-filtered state. Accepted action IDs are stored transactionally because transport delivery alone does not guarantee one execution.

## AI and originality disclosure

AI assistance was used for ideation, planning, source code, tests, debugging, interface copy and documentation. No generative AI is needed while the product runs. The core model is an inspectable deterministic rule engine.

Original project work includes the Harbor Aid fixture, recovery-rule analysis and explanations, exercise reducer, role-specific scenario, planner/comparison interface, local room persistence, follow-up workflow and exports. Third-party libraries retain their licenses and are recorded in the lockfile.

Mr. Robot references are limited to brief interface wording and an episode-like scenario identifier. The project does not use licensed artwork, logos, clips or audio and does not claim affiliation.

## Work timing

Specification and implementation in this workspace began on 2026-10-03. The team must compare that date and the actual event window before describing any component as built during the event. The event dates and team roster have not been supplied here.
