# Validation record

Updated 4 October 2026. Current checks use macOS arm64, Node 24.14.1 and Playwright Chromium. Example organisations and recovery methods in tests are QA inputs, not verified arrangements for the user's team.

## Current results

| Check | Result |
| --- | --- |
| TypeScript and production build | Pass; generates web app, offline cache and ~720 KB portable HTML |
| Unit/integration tests | **41 pass across 11 files** |
| Browser journeys | **9 pass** |
| Own-map team check | Host plus three independent participant browser profiles |
| Shared-field filtering | Private notes, instructions, tasks, source and history excluded from room input/state |
| Pending participant | Organisation map, owners, roles, actions and events withheld until host approval |
| Account permissions | Wrong-owner actions rejected; host-only controls enforced; custom account scopes validated |
| Recovery order | Missing prerequisites block actions; one owner recovers a prerequisite before the next can act |
| Unknown method | Remains blocked; summary asks its owner to confirm it; simulation leaves evidence unchanged |
| Selected loss | Restoring a prerequisite does not silently restore another separately lost account |
| Shared room deletion | Host-only; active session, participants, commands and events removed; participant views close |
| Summary download | Actual HTML file received; escaped text; no private notes; timeline and simulated outcome present |

## Browser journeys

1. Direct planning, map selection, combined losses/restoration, separate proposed plans, lock/reload.
2. Actual readable HTML/encrypted file receipts, file-picker restore, offline cached reload, report rendering to PDF.
3. Google Directory import through the file picker with unconfirmed access/methods.
4. A stale editing tab cannot overwrite saved changes.
5. Three independent participants finish the fictional practice with a custom role, private clues and independent verification.
6. Phone width 390 × 844: navigation/map selector, no horizontal document overflow.
7. Service-editor focus stays in the dialog and returns on Escape.
8. Three-service direct editing, preserved recovery metadata, normal dependencies, custom essential work and reload.
9. Own-map sharing preview and request filtering, three approved owners, an additional account responsibility, ordered recovery, blocked unknown method, phone width, downloaded summary, saved-room reopening, reload with retained assignment, host deletion and original private-plan preservation.

## Other automated coverage

- AND prerequisites, alternative methods, dead ends, cycles, evidence propagation, multi-loss and independent proposals.
- Import whitelisting/reference resolution, schema limits and duplicate identity handling.
- AES-GCM roundtrips, fresh nonces, incorrect passwords, tamper detection, changed keys, saved-snapshot conflict rejection.
- Role/cross-room authority, stale revisions, command idempotency and acknowledgement reconciliation.
- SQLite close/reopen retaining accepted actions and membership.
- Five Socket.IO clients, empty invalidation broadcasts, rejected invalid credentials and reconnect state.
- Report escaping/integrity checks, deterministic results and analysis performance within the existing test bounds.

## Failures found and resolved

- Map background intercepted node clicks. Node pointer events now allow selection.
- A direct-editor test refreshed before the encrypted save completed. It waits for the completed save before reloading.
- A transformed map node retained its previous painted status text despite correct DOM/state updates. Remounting the status element on a state/loss change resolves it. The targeted browser journey passes, and macOS OCR reads “Unconfirmed” in the captured work node.
- The DELETE client request set a JSON content type without a body. The request helper now adds that header only for requests with a body; browser deletion passes.
- Team-editor selectors initially omitted the resource-kind text or used a label-text query including option text. They now use the controls' actual accessible names.
- Sandboxed listeners/browser access returned EPERM. Approved runs outside the sandbox passed; this is an environment restriction, not a failed application assertion.

The earlier download and missing-Chromium limitations are resolved by the current Playwright runs. Build notices about bundle size, upstream Zod annotations and Node SQLite's experimental status remain; none blocked verification.

## Still unverified

- Physical devices on a LAN with WAN disconnected, firewall/guest-network behaviour and discovered invite-address reachability. Browser profiles and loopback transport do not establish those results.
- Direct `file://` execution of the generated portable file. The computer-use tool blocks that protocol and prohibited an alternate-browser workaround; no workaround was attempted.
- Actual Google/Instagram/YouTube recovery procedures or permissions. The app uses declared arrangements and performs simulations.
- A new user completing their own setup and explaining the weakness without developer guidance.
- Independent security review and production deployment controls. Team snapshots are plaintext on a trusted local server; deletion removes active records, not downloaded copies or server backups.
- A complete accessibility audit. Keyboard and phone checks cover specific journeys only.

The user's actual services/owners were supplied, but their recovery connections are still pending confirmation. Technical correctness is not evidence of competition success or a successful real-provider recovery.

## Presentation and final visual polish

The final palette, typography, buttons, key panel and map-panel styling passed the production build and all nine browser journeys (20.9 seconds). Eight documentation screenshots were refreshed from that passing run. No recovery rules or user workflows changed in the visual pass.

The eight-slide PPTX passes package, geometry, declared font and import checks. Every slide is rendered and visually reviewed; its matching eight-page PDF is rendered and reviewed. This does not establish native PowerPoint compatibility on another computer.

The 45-second MP4 is encoded at 1280 × 720 and 24 fps, with one video track and one audio track. Representative decoded frames cover all seven scenes. Each narration segment fits inside its scene. SRT captions are supplied separately. The promo rendering check is separate from the nine application browser journeys.
