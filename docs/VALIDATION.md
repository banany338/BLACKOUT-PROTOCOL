# Validation record

Updated 2026-10-03. Tested on macOS arm64, Node 24.14.1, using the Codex in-app browser for interactive checks.

## Automated checks

| Check | Result |
| --- | --- |
| TypeScript and production build | Pass |
| Domain, API, persistence and realtime tests | **23 pass across 7 files** |
| Dependency audit after updates | **0 reported vulnerabilities** at install time |
| Two-account dead end; usable entry point; alternative methods | Pass |
| AND prerequisites, containment gates, unknown methods, propagated evidence | Pass |
| Forecast leaves the baseline and current facts unchanged | Pass |
| Stable output from fixed inputs | Pass |
| Server rejects missing credentials, role spoofing and cross-room credentials | Pass |
| Three roles share independent evidence before Finance can verify | Pass through API integration |
| Concurrent actions based on one revision | One accepted, stale action rejected with 409 |
| Duplicate action and acknowledgement reconciliation | One consequence / one event |
| SQLite close/reopen with committed action and lost acknowledgement | Same membership, state and original result recovered |
| Pause and resume | Decisions blocked while paused; event order retained; measured time excludes pause |
| Five Socket.IO clients: facilitator, three players, observer | All receive an empty invalidation notification within the 1-second test bound on loopback |
| Socket reconnect | Role-filtered state restored at the latest revision |
| Invalid socket credential | Rejected |
| Analysis at 30 resources / 100 rules | Each of 20 runs below the 500 ms test bound |
| Browser-compatible SHA-256 | Matches Node for UTF-8 bytes; changed bytes fail comparison |
| Export HTML escaping / script exclusion | Pass |
| Client bundle privacy scan | Server-only private scenario text absent |

The first realtime test attempt was blocked by sandbox permission to bind localhost. It passed when run with a permitted temporary loopback listener. This is a local transport test, not a physical LAN latency measurement.

Build notes: Vite reports a ~606 KB initial JavaScript bundle (~190 KB gzip), and upstream Zod comment-annotation notices. Node reports SQLite's experimental status. Neither prevented the build or tests.

## Interactive browser checks

| Journey | Result |
| --- | --- |
| Baseline and kit comparison | 1/4 → 4/4 forecast; available-now stays 1/4 |
| Improved solo exercise | Recovery, rotation, revocation, settings review and containment gate restore 4/4 |
| Independent contact shared → verify payment | Verified branch reached; impersonated request rejected |
| Unsafe payment approval | Fictional 4,800 PLN loss and unsafe-decision explanation shown |
| Fresh debrief measurements | First containment and restored trust display elapsed times from events |
| Old room reopened after server restart | Phase, revision, decisions and timeline preserved |
| New run | New room at revision 0; previous room preserved |
| Dynamic roster clue after recovery | Says roster is available again |
| Phone width 390 × 844 | Readable list, navigation, comparison and follow-up fields |
| Horizontal overflow at phone width | Document width and scroll width both 390 pixels on map and comparison |
| Save follow-up note | New blueprint version and confirmation shown |
| Keyboard activation | Navigation and exercise actions used successfully |
| Record export button | Digest shown; in-app-browser download event timed out, so file receipt is unverified |

## Still to validate

- Three separate browser profiles or real devices playing the full cooperative UI together. API role flow and five-client transport are tested; this exact UI journey is not.
- Physical LAN with WAN disconnected, keeping the router and server available.
- Downloaded HTML opened with the app stopped, including print preview.
- Browser file-picker integrity journey against original and tampered records.
- Complete keyboard focus-trap and reduced-motion audit. The implementation includes both, but a full accessibility audit has not been performed.
- Playwright end-to-end suite: authored, not executed; Chromium is not installed in this workspace.
- Two new users explaining the recovery loop and improvement.
- Final slide PDF, with team names and event timing confirmed.

## Claims supported by these checks

The local prototype implements the complete planner, simulation, comparison and export-generation loop. Recovery rules and transport semantics have automated coverage. Its fictional fixture produces the displayed 1/4 and 4/4 results. Production security, real-provider recovery success, physical LAN performance and user comprehension have not been established by these tests.
