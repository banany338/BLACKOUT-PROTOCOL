# BLACKOUT PROTOCOL — what is happening

This is the plain-language record of project changes. Earlier entries describe the state at that point; the latest entry and PROGRESS.md give current status. The [user guide](USER_GUIDE.md) explains the controls; this file explains why they exist and what we changed.

## The purpose we agreed on

A small company or student club can depend on one email account, phone or person for access to several services. Losing that dependency can leave the whole team stuck.

BLACKOUT lets the team record its own setup, safely explore a loss, find recovery dead ends, and prepare independent ways back. Its useful result is a specific weakness to fix, such as: “The backup mailbox needs the same email account it is supposed to recover.”

The current analysis uses information the team enters. It does not sign in to accounts, discover every dependency automatically, or perform recovery with a provider.

## 4 October 2026 — GitHub delivery and media revisions

You authorised publishing the current project to `banany338/BLACKOUT-PROTOCOL`. The delivery order is GitHub first, presentation animation second, then video narration and cleanup. The initial push includes source, the readable README, documentation, screenshots and the existing presentation/video files. Local databases, dependencies, private browser workspaces, temporary media frames and editor swap files stay outside the published package.

The requested media revision will use restrained transitions and staged reveals in the editable presentation. The static PDF remains the printable version. The video cleanup removes the black map-control blocks from the screenshots. ElevenLabs narration is requested; its account access and free-plan terms will be checked before generating audio. Progress and validation are recorded below as each step finishes.

## 4 October 2026 — presentation, readable README and promo

### What changed

Your requested delivery order was presentation, README, promo, then UI polish. The delivery now includes:

- An **eight-slide editable PowerPoint** and matching **eight-page PDF**. Slides have concise text, actual interface screenshots and speaker notes with timing and sources.
- A **65-line README** covering the purpose, three run commands, four-step use, privacy boundaries and links to detailed instructions. The previous technical detail is preserved in TECHNICAL_REFERENCE.md.
- A **45-second MP4 promo** with English synthetic narration, motion typography and actual UI screenshots. SRT captions are supplied separately.
- A final visual pass: warmer paper/charcoal colours, consistent typography, clearer buttons, green keyboard focus, a cleaner private-key panel and more consistent map panels. The main page still contains the logo, bold headline and key form.

Team names and member names are omitted from the presentation and promo at your request. No competition submission or GitHub push was made.

### Why and how to use it

The materials explain a serious recovery-planning product through its problem, workflow and useful outputs. They distinguish the encrypted private workspace from unencrypted local team-room metadata, and distinguish a simulated forecast from real provider recovery.

Open `output/pdf/BLACKOUT-PROTOCOL.pdf` to present, or edit `output/presentation/BLACKOUT-PROTOCOL.pptx`. The [presentation guide](PRESENTATION.md) includes a three-minute script and the promo storyboard. Play `output/video/BLACKOUT-PROTOCOL-promo.mp4`; use the adjacent SRT file when uploading somewhere that accepts separate captions. Refresh http://localhost:4310 to see the polished app.

### What was checked

The production build and all nine application browser journeys pass after the CSS changes. Eight interface screenshots were refreshed from that run. The presentation passes file-structure, geometry, font and import checks; every exported page is visually reviewed. The MP4 has the expected 45-second duration, 1280 × 720 resolution, 24 fps and audio/video tracks; decoded frames cover all seven scenes and narration fits within the scene timings.

### What remains

The requested local presentation materials and visual polish are complete. Confirming a real team's recovery arrangements, unfamiliar-user comprehension, physical offline LAN use, direct portable-file compatibility and independent security review remain separate acceptance work. A working prototype and automated tests do not prove real account recovery or competition success.

## 4 October 2026 — simpler entry page and visual sandbox

### What changed

- The main page now shows the logo/name, bold headline and private workspace key panel. The long introduction and benefit lists were removed.
- **My plan** now opens the dependency map. Selecting a service reveals its responsible person, dependencies and recovery methods.
- **Try a blackout** opens a simulated loss on the same map. You can select several unavailable resources, see the consequences and restore them in the sandbox.
- Recovery steps and longer notes open when requested. On phones, **Inspect a service** provides a readable selector.
- Suggested improvements show how much work could become recoverable. Saving one creates a separate proposed plan.
- The separate fictional practice is under **Save & restore → Optional team practice**.

### Why

The previous interface explained too much at once and made the project feel like a complicated training game. The main task should be visible: your services, a possible failure, and a way to improve recovery.

### How to try it

1. Open http://localhost:4310 and create or unlock your private workspace.
2. Choose **Create my recovery plan** if you have no plan. Enter the accounts, people/backups, recovery methods and work your team needs.
3. Open **My plan** and select an account to inspect its connections.
4. Choose **Try a blackout**, then select an unavailable account or backup. Watch which work becomes blocked or recoverable.
5. Review the suggested improvement. Record the actual setup work in **Next steps**, then confirm the arrangement with the account owner.

Selecting a loss changes the forecast on screen. A proposed plan assumes the suggested arrangement has been implemented; it still needs to be set up and checked in the real service.

### What was checked

The production build and seven browser journeys passed. Checks covered map selection through the keyboard, combined losses and restoration, proposed plans, file downloads and backup restore, offline loading, report PDF rendering, contact import, conflicting saves from two tabs, three practice participants with a custom role, phone layout and keyboard focus after closing setup.

### What is still unfinished

- We need to check whether a person unfamiliar with the project can find a useful weakness in their own organisation's setup.
- Cooperative practice still uses a separate fictional organisation. Connecting it to the team's own map remains future work.
- Actual provider recovery, physical LAN operation without internet, portable-file compatibility and an independent security review remain unverified.

### Screenshots

[Main page](screenshots/main-page.png) · [Dependency map](screenshots/dependency-map.png) · [Blackout sandbox](screenshots/blackout-sandbox.png) · [Phone layout](screenshots/phone-plan.png)

These screenshots use example data from the automated checks.

## 4 October 2026 — documentation with every change

You asked for an explanation whenever the project changes. Future implementation updates will add an entry here covering the change, its purpose, how to use it, its checks and remaining work. Instructions for using changed controls will also be kept current in the user guide.

## Next steps — planned work

The next priority is making the team's map easier to create. The current four-step setup still requires several unfamiliar choices before the first useful result.

1. **Simplify entry.** Add or edit one service directly from the map. Show its name, responsible person and recovery options first; reveal extra details when needed.
2. **Check one real setup.** Use three to five services from a small organisation, with aliases and no passwords or recovery codes. Try losing the main email or phone. Check that the resulting gap and suggested preparation make sense to its owner.
3. **Connect team practice.** Once the core journey is understandable, make cooperative practice use the same organisation map and recorded recovery arrangements. This connection is not implemented yet.

The acceptance check is simple: a new user can enter their setup, discover a dependency that matters, and understand what to prepare without a developer explaining the screen.

This entry records the proposed order of work. No application code changed in this documentation update.


## 4 October 2026 — add and edit services directly

**What changed:** Start with **Add first service**, enter your team name, one service and its owner, and save directly to the map. Use **Add a service** for the next one. Selecting a node opens **Edit this service**, including essential work items. Recovery options can use existing resources or a newly added phone/backup. Additional dependencies and notes stay under More details. Existing plans, recovery details and custom work remain available; the full editor is secondary.

**Why:** You can get the first useful map without completing four setup screens. Each new service gets a “Use [service]” work item so its loss appears in the results immediately. You can rename that work or adjust its requirements directly.

**Your starting setup:** Google Drive — Antonio; Instagram — Richard; YouTube channel — Mary. This ownership order is an assumption from your message. Sign-in and recovery connections still need your confirmation; they have not been added to your saved workspace automatically.

**Checks:** The initial seven browser journeys passed using the direct editor. A final three-service check also covers renaming while retaining recovery data, adding a dependent service, editing essential work and reloading saved changes. All eight journeys passed across the verification runs; the detailed record is in VALIDATION.md.

**Next:** Complete the real setup using your reply about account/phone dependencies, validate comprehension with its owners, then connect cooperative practice to the organisation map. Work stops near the five-hour allowance boundary with these items outstanding.


## 4 October 2026 — your map now works in a team check

### What changed and why

**Check with team** now uses a reviewed copy of the same organisation map. People named as account owners appear as assignments. You can add another person or responsibility and select their accounts. Each person gets the recovery steps for that assignment; everyone approved by the host sees the map update after accepted simulated actions. This connects team preparation to the services you actually record.

The room has one sequence: invite people, assign accounts, start the selected loss, discuss and record recovery steps, finish, save the summary. There are no fictional chapters in this check. Longer explanations and the timeline remain collapsed. The original fictional practice is still available separately.

### Sharing and privacy

Before creation, the preview shows account names, owners, dependencies and recovery status. **View everything that will be shared** shows the exact snapshot. Private notes, recovery instructions, tasks, history and the workspace key are excluded. Names and labels can still contain sensitive information, so review them. The private workspace locks when the room opens.

Joining gives a waiting screen. The host must assign accounts or observer access before the participant sees the organisation map. Account assignments restrict simulated actions; they do not change provider permissions. Approved participants can see the whole shared map.

The snapshot and room timeline are stored in the local server's plaintext database. The host can delete the room's active records; that closes participants' views. Original private plans, downloaded reports and server backups are separate copies.

### How to try it

1. Refresh http://localhost:4310 and unlock your plan.
2. **Check a problem** → select losses → **Check with team**.
3. Review the preview and choose **Create team room**.
4. Invite trusted people and assign their accounts. The invite panel offers detected private LAN addresses for other devices; those devices still need a reachable local network.
5. **Start team check**. Owners can record the simulation's recovery steps only when prerequisites are available. Unknown methods stay blocked.
6. **Finish team check** → review the next preparation → **Save check summary**. Existing unconfirmed methods are flagged for confirmation before extra possibilities.
7. Use **Room controls** to pause/resume or delete. **Back to my plan** returns to the locked workspace. Saved rooms can be reopened under **Save & restore → Previous team rooms**.

### What was checked

Build and TypeScript pass. **41 software checks and all 9 browser journeys pass.** A further targeted run also verifies reopening a saved room and retaining an assignment after reload. The own-map journey covers three separate participant profiles, host approval, an added account responsibility, prerequisites, unknown methods, live map updates, a received HTML summary, private-field filtering, a phone width and deletion. The direct editor, encryption, imports, downloads, offline planner, saved-plan conflicts and fictional practice also pass their existing checks.

Browser verification caught an empty DELETE request sent with a JSON content type. The request helper now adds that header only when a body is present; deletion passes. Earlier test selectors were corrected to match the controls' accessible names.

[Team check screenshot](screenshots/own-team-running.png) uses QA example data. These results verify application behaviour; they do not establish successful provider recovery or physical-device connectivity.

### What still needs your real setup

Your supplied starting services remain Google Drive, Instagram and YouTube; Antonio, Richard and Mary are the proposed owner pairing in that order. The sign-in and recovery connections are still unconfirmed. We have not invented those dependencies or inserted the example test data into your private workspace.

The next real-world check is to confirm those connections with their owners and see whether the app finds a weakness they recognise. Unfamiliar-user comprehension, physical LAN without internet, direct-file compatibility and independent security review remain outstanding. The application does not recover actual provider accounts.


## 4 October 2026 — finish the current version

You asked to stop expanding the project and move toward completion. The scope is now fixed: private recovery mapping, a blackout sandbox, actionable preparations, offline references and an optional check of the same map with the team. Further feature ideas are deferred. The remaining work is verification, current documentation, simple run instructions and a short handoff checklist.

The final visual check found a map status label that lagged behind its updated state in a transformed Chromium map node. The status element now refreshes when the state changes. The targeted browser journey passes, and screenshot text recognition confirms “Unconfirmed” for the uncertain work item. The real-team dependency/comprehension check and portable-file/physical-LAN checks remain release conditions, not assumed successes.

Run instructions, the remaining acceptance check and presentation links are collected in [FINAL_HANDOFF.md](FINAL_HANDOFF.md). The walkthrough and submission draft now describe the implemented private map and own-map team check.
