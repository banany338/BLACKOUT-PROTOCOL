import type { Observation } from '../../packages/domain/session';
// Server-only narrative. Never import this module from the web client.
export const observations: Observation[] = [
  {
    id: 'lockout',
    audience: 'administrator',
    stage: 1,
    title: 'Your work account no longer recognises you',
    body: 'The sign-in page rejects your credentials. You receive a notice that work sessions have been revoked. The recovery option points to the backup mailbox, whose password is unavailable.',
    source: 'Fictional account notification',
  },
  {
    id: 'urgent-payment',
    audience: 'finance',
    stage: 2,
    title: '“Please pay this before the event starts”',
    body: 'A message appearing to come from the administrator asks you to send 4,800 PLN to a new supplier account. It says to keep the conversation in this email thread because the administrator is busy.',
    source: 'Simulated email — sender unverified',
  },
  {
    id: 'known-contact',
    audience: 'coordinator',
    stage: 3,
    title: 'You have an independent contact',
    body: 'The printed volunteer folder contains the administrator’s previously verified phone contact. The administrator confirms through that route that they did not request the payment. Share this observation so finance can verify the request.',
    source: 'Fictional printed contact list and callback',
  },
  {
    id: 'roster-impact',
    audience: 'coordinator',
    stage: 3,
    title: 'The team cannot open the shift roster',
    body: 'Volunteer coordination depends on the roster and a usable communication route. The public website is still readable, but the emergency recovery instructions are inside the locked shared drive.',
    source: 'Coordinator’s operational check',
  },
  {
    id: 'recovery-dead-end',
    audience: 'administrator',
    stage: 4,
    title: 'The backup points back to the failed account',
    body: 'The backup mailbox reset process sends its confirmation to the work identity. Neither account has an accessible trusted starting point in the baseline model. External provider support is possible, but its outcome and waiting time are unknown.',
    source: 'Documented fictional recovery policy',
  },
];
