# Current checkpoint — 4 October 2026

## What is implemented

The core product is an organisation recovery map: add services and owners, record access/recovery dependencies, simulate a loss, see affected work, prepare independent recovery arrangements and save an offline reference. The main page stays minimal: logo/name, bold headline and private-key panel.

- Direct service editing, inline phones/backups, essential-work editing and a secondary advanced editor.
- Encrypted local workspace/backup, historical versions, passphrase change, conflict protection, local Google Directory import and readable HTML/PDF export.
- The same visual map in My plan and the blackout sandbox, including multiple losses, AND prerequisites, loops, unknown methods and separate proposals.
- **Own-map team checks:** explicit sharing preview; private fields excluded; workspace locks; host-approved participants; owner/account-scoped actions; custom account responsibilities; shared simulated state; pause/resume/finish; summary export; active room deletion; saved room reopening.
- Detected private LAN invite addresses. This reduces manual link preparation; it does not prove physical-device connectivity.
- Optional separate Harbor Aid story with custom responsibilities and private clues.
- Generated offline cache and a self-contained portable HTML build. Team rooms require their server; portable-file execution remains unverified.

## Validation

Production build and TypeScript pass. **41 unit/integration tests in 11 files and 9 Playwright browser journeys pass.** The new shared-map journey uses a host plus three independent browser profiles, verifies privacy/approval/account actions, captures a summary download and closes participant views on deletion. See [VALIDATION.md](VALIDATION.md).

## Completion direction

The user asked to stop expanding features and move toward completion. Core scope is frozen. The presentation, short README, narrated promo and final visual polish are complete. Use [PRESENTATION.md](PRESENTATION.md) for delivery files and the speaking script, and FINAL_HANDOFF.md for the verified run path and remaining acceptance check.

## Next work

1. Confirm the user's actual connections for Google Drive, Instagram and YouTube. Antonio/Richard/Mary pairing is provisional. A clarification is pending; do not invent dependencies or change their encrypted workspace automatically.
2. Ask owners/unfamiliar users to enter a non-secret setup and explain a useful finding. Automated tests cannot establish comprehension.
3. Physical LAN with WAN disconnected, provider recovery checks, portable-file compatibility and independent security review. Do not label the current trusted-local-network server as production-ready.

## Operations and constraints

Run `npm run build`, then `npm start`; open http://localhost:4310. Frontend changes need rebuilding and backend changes need restarting. The current server runs the rebuilt app. Portable output: `dist/portable/BLACKOUT-PROTOCOL.html`.

The user initially published GitHub themselves, then explicitly requested a push on 4 October. Publishing the current project and requested presentation/video revisions to `banany338/BLACKOUT-PROTOCOL` is now authorised. Do not change repository access. `PROJECT_DESCRIPTION.md` is the user's untracked file and is untouched.

Keep documentation current in PROJECT_UPDATES.md and USER_GUIDE.md, as required by AGENTS.md. Respect the request to stop at the five-hour allowance boundary and resume after reset. Do not consume reset credits automatically.
