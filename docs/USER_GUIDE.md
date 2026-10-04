# BLACKOUT PROTOCOL — start here

BLACKOUT helps answer one question: **if your team loses access to an important account, how will it keep working?**

For an explanation of recent changes and unfinished work, read [Project updates](PROJECT_UPDATES.md).

For slides, the speaking script and promo files, read [Presentation and promo](PRESENTATION.md). The final visual pass uses the same three main steps below; it adds no setup requirements or new controls.

## The three main steps

### 1. My plan

The dependency map is the main view. Select an account to inspect its owner and recovery methods. Choose **Edit this service** to update just that item. Choose **Add a service** to add another.

Start with **Add first service**. Enter your organisation, service name and responsible person, then choose **Save to map**. Add the other services one at a time.

Each newly added service gets a result called “Use [service name]”. Select that work item on the map to rename it or change its requirements.

For an account, **Add recovery option** records a way back in. Select every resource the method needs, or **Add a phone or backup**. Record any account needed to retrieve the backup. Leave the method as **Not sure yet** until its owner confirms it.

**More details** holds the service type, normal access dependencies and notes. The full editor remains available under the plan menu’s **Advanced editor** for imports and broader changes.

Example: your work email can be recovered through a backup mailbox, but that backup mailbox can only be recovered through your work email. If both are locked, the two accounts cannot help each other. BLACKOUT points out that loop.

**Owner** means the person, team or job title responsible. You can type any name. It does not create a login or permission.

### 2. Check a problem

Choose **Try a blackout**, then select something you cannot access. You can choose several things together. The same map changes colour to show the consequences. Select a node to inspect it; on a phone, use **Inspect a service**.

The results say:

- **Still works:** you still have everything needed.
- **Can get back to work:** you have recorded a recovery method that could help. Read the steps and requirements.
- **No confirmed way back:** a method is missing or still uncertain.

This check changes only the plan on screen. It does not lock, reset or sign in to a real account.

A suggested improvement is a possibility to evaluate. Saving it creates a separate **proposed plan**. Someone must set it up with the actual provider before you rely on it.

### 3. Next steps

Write down what needs preparing, who will do it, and what happened when they tried it. For example: “Keep the emergency contact list somewhere we can reach without work email.”

**Tried successfully** means a person completed the actual procedure. Clicking a status in BLACKOUT does not test the account.

## Save your work

Use **Save & restore** for an encrypted backup. Keep its passphrase separately. Use **Save a readable plan** from the problem check for a document you can read, print or save as PDF.

The readable document is not encrypted. Share it only with authorised people. Keep passwords and recovery codes out of the plan.

## Check your own map with the team

Use this after you have recorded the real services and their recovery arrangements.

1. In **Check a problem**, select the account, phone or person you want to lose in the simulation. Choose **Check with team**.
2. Review the names, owners, dependencies and recovery status to be shared. **View everything that will be shared** opens the exact map snapshot. Private notes, instructions, tasks, history and the workspace key are excluded. Labels and owner names are still shared, so keep secrets out of those fields too.
3. Enter your host name and choose **Create team room**. The private workspace locks. The shared snapshot is stored on the local server; it does not track later private-plan edits.
4. Send the invite link to trusted team members. Joining puts them in a waiting screen. Select **Accounts for [person]** to approve access and assign the named owner, all accounts or observer. Each approved person sees the whole shared map.
5. For an extra owner, open **Add a person or responsibility**, name them and select the accounts they handle. This assignment gives permissions inside this check. It does not change Google, Instagram or YouTube permissions.
6. Choose **Start team check**. Each person can record simulated recovery only for their assigned accounts. A method remains blocked until its prerequisites are available; an unconfirmed method stays blocked. The shared map updates after an accepted action.
7. Choose **Finish team check**, review preparations, and **Save check summary**. When an existing method is unconfirmed, the summary asks its owner to confirm it first; extra recovery options stay under **Other possible preparations**. This HTML document includes the simulated outcome, gaps and timeline. It is unencrypted. A simulated action never marks a real method as tried.
8. Use **Room controls → Delete shared room** when finished. This removes its active server records and closes participant views. It does not remove downloaded copies, server backups or your original private plan.

**Back to my plan** returns to the locked private workspace. Unlock it with your passphrase. **Save & restore → Previous team rooms** reopens rooms saved in this browser.

The room needs the running server. All devices must be able to reach it. When the server finds a private LAN address, the host’s invite panel offers a local-network link automatically. Devices need the same reachable local network; a localhost link only works on the host computer. If several addresses are offered, choose the one your team can reach. Firewalls and guest-network isolation may still block connections. Private planning and readable-plan generation remain local, and the portable file omits team rooms.

## Optional: practise with a story

Open **Save & restore → Optional team practice → Open practice**, or go to `/practice`. This story currently uses a separate fictional plan.

1. **Start solo practice** to learn by yourself, or **Set up team practice** to invite others.
2. Read your clues and share useful ones with the team.
3. Choose an action. The app records the choice and shows its fictional outcome.
4. The host moves to the next part, then chooses **Finish and review**.

The story is about a locked email account and a suspicious payment request. No actual payment or account operation takes place.

### Why are there roles?

Different people usually hold different information during an emergency. Roles let a team practise bringing that information together.

| Responsibility | What that person does in the story |
| --- | --- |
| Account recovery | Regains access and secures the account. |
| Payment checks | Checks whether a payment request is genuine. |
| Team communication | Shares trusted contacts and keeps people informed. |

The host can see every responsibility, which makes solo practice possible. An observer sees shared information.

### Add your own role

Before starting, choose **Add your own role**, type a name, select one or more responsibilities, and choose **Save role**. Then select that role beside a participant's name. Several participants can share it.

For example, “Volunteer lead” can handle team communication and payment checks. The role receives the corresponding clues and actions. These are roles for this practice session, separate from the people named in your actual plan.

## What are the “tests” mentioned in development updates?

Automated tests are checks the developers run to catch software mistakes, such as losing a saved plan or showing a private clue to the wrong person. You do not need to run them to use BLACKOUT.

The technical passage about POST requests, revisions, SQLite and Socket.IO describes what happens behind the scenes when someone chooses an action. For a user, the process is simply: **choose an action → see the result → the team sees the update.**
