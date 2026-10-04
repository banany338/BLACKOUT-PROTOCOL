# Finish the current version

## Fixed scope

BLACKOUT helps a small team find a recovery weakness and decide what to prepare. This version includes private service mapping, simulated losses, independent-method proposals, assigned preparation tasks, encrypted backups, readable offline plans and an optional shared check of the same map. Feature expansion is paused.

## Ready to use locally

The web app is running at **http://localhost:4310**. Refresh, unlock your workspace, and use **My plan → Try a blackout**.

To run a fresh checkout with Node 22.13 or later:

```sh
npm ci
npm run build
npm start
```

Keep the server running for shared rooms. The cached private planner can work offline after it reports **Available offline**. Back up the workspace before clearing browser data.

The build also generates `dist/portable/BLACKOUT-PROTOCOL.html`. It contains the private planner with networking disabled. Direct-file browser compatibility still needs manual verification; use the served web app as the currently verified option.

## Software checks completed

- Production build and TypeScript pass.
- 41 unit/integration checks pass.
- Nine browser journeys pass, including downloads, restore, offline planning, direct editing and four independent browser profiles in an organisation check.
- Saved team-room reopening and participant assignment after reload pass in the targeted check.

See [Validation](VALIDATION.md) for what those checks establish and their limits.

## The remaining acceptance check

Use Google Drive, Instagram and YouTube with their actual owners. The suggested pairing is Antonio, Richard and Mary, in that order; confirm it.

For each service, record only:

1. Who controls it.
2. Which email, phone or person sign-in/recovery depends on.
3. Whether the recovery arrangement has actually been configured or tried.

Try losing the shared dependency. The owner should be able to explain which work stops, why, and one preparation that would help. If they cannot, record that specific confusing step and fix it before adding features.

Physical-device LAN use, portable-file compatibility and an independent security review remain unverified. This version performs no real-provider recovery. Shared rooms are for reviewed metadata on a trusted local server.

## Presentation and documentation

[Presentation, speaking script and promo](PRESENTATION.md) · [User guide](USER_GUIDE.md) · [What changed](PROJECT_UPDATES.md) · [Three-minute walkthrough](DEMO.md) · [Submission text](SUBMISSION.md).

The delivery files include an eight-slide animated PPTX, an eight-page static PDF and a 45-second MP4 with English narration and SRT captions. Use `output/presentation/BLACKOUT-PROTOCOL-animated.pptx` for the slideshow. They use actual interface screenshots with illustrative data. Team names and member names are omitted, as requested. The README is the short run/use guide; detailed notes are preserved in TECHNICAL_REFERENCE.md.

The application and materials were pushed to [GitHub](https://github.com/banany338/BLACKOUT-PROTOCOL) on 4 October at the user's request. No competition form was submitted.
