import { blueprintSchema, type Blueprint, type Failure, type Rule } from './model';

const source = 'Harbor Aid fictional provider policy. Valid only inside this rehearsal.';
const rule = (
  id: string,
  label: string,
  requiresAll: string[],
  grants: string[],
  kind: 'action' | 'derived' = 'action',
  extra: Partial<Rule> = {},
): Rule => ({
  id,
  label,
  requiresAll,
  grants,
  kind,
  enabled: true,
  evidence: 'fixture',
  sourceNote: source,
  responsibleRole: 'administrator',
  ...extra,
});

export const harborAid: Blueprint = blueprintSchema.parse({
  id: 'harbor-aid',
  version: 1,
  name: 'Harbor Aid',
  improved: false,
  description:
    'A volunteer team preparing a community distribution event. One work identity connects the tools they depend on.',
  resources: [
    {
      id: 'backup',
      label: 'Recovery mailbox',
      kind: 'account',
      fact: 'backup.trusted',
      owner: 'Administrator',
      description:
        'Its password is unavailable. The only documented reset route uses the work identity.',
      column: 0,
      row: 0,
    },
    {
      id: 'phone',
      label: 'Admin phone',
      kind: 'device',
      fact: 'phone.available',
      owner: 'Administrator',
      description: 'Available for calls. It cannot independently recover the work identity.',
      column: 0,
      row: 1,
    },
    {
      id: 'custodian',
      label: 'Recovery custodian',
      kind: 'person',
      fact: 'custodian.available',
      owner: 'Coordinator',
      description: 'Available in this exercise and knows an independent contact.',
      column: 0,
      row: 2,
    },
    {
      id: 'device',
      label: 'Clean device',
      kind: 'device',
      fact: 'device.clean',
      owner: 'Administrator',
      description: 'A clean device required by the fictional recovery procedure.',
      column: 0,
      row: 3,
    },
    {
      id: 'kit',
      label: 'Offline recovery kit',
      kind: 'artifact',
      fact: 'offline-kit.available',
      owner: 'Coordinator',
      description: 'An independently stored recovery method. Absent from the baseline plan.',
      column: 0,
      row: 4,
    },
    {
      id: 'work',
      label: 'Work identity',
      kind: 'account',
      fact: 'work.trusted',
      controlFact: 'work.control',
      owner: 'Administrator',
      description: 'Signs the team into shared files, volunteer roster, and team chat.',
      column: 1,
      row: 1,
    },
    {
      id: 'files',
      label: 'Shared files',
      kind: 'service',
      fact: 'files.available',
      owner: 'Administrator',
      description: 'Contains event instructions and the emergency recovery document.',
      column: 2,
      row: 0,
    },
    {
      id: 'roster',
      label: 'Volunteer roster',
      kind: 'service',
      fact: 'roster.available',
      owner: 'Coordinator',
      description: 'The current shift roster for the distribution event.',
      column: 2,
      row: 1,
    },
    {
      id: 'chat',
      label: 'Team chat',
      kind: 'service',
      fact: 'chat.available',
      owner: 'Coordinator',
      description: 'Routine coordination, available after trusted work sign-in.',
      column: 2,
      row: 2,
    },
    {
      id: 'website',
      label: 'Public website',
      kind: 'service',
      fact: 'website.available',
      owner: 'Coordinator',
      description: 'Remains publicly readable during the work-account incident.',
      column: 2,
      row: 3,
    },
    {
      id: 'operations',
      label: 'Coordinate volunteers',
      kind: 'activity',
      fact: 'volunteers.ready',
      owner: 'Coordinator',
      description: 'Requires the current roster AND a usable communication route.',
      column: 3,
      row: 1,
    },
  ],
  initialFacts: [
    'work.control',
    'work.trusted',
    'phone.available',
    'custodian.available',
    'device.clean',
    'website.available',
    'kit.not-configured',
  ],
  rules: [
    rule(
      'recover-work-mailbox',
      'Recover through backup mailbox',
      ['backup.trusted', 'device.clean'],
      ['work.control'],
    ),
    rule(
      'recover-backup',
      'Reset backup through work identity',
      ['work.trusted', 'device.clean'],
      ['backup.trusted'],
    ),
    rule(
      'recover-work-kit',
      'Recover using the independent kit',
      ['offline-kit.available', 'custodian.available', 'device.clean'],
      ['work.control'],
      'action',
      { enabled: false },
    ),
    rule(
      'prepare-kit',
      'Custodian holds an independent recovery kit',
      ['kit.prepared'],
      ['offline-kit.available'],
      'derived',
      { enabled: false, responsibleRole: 'coordinator' },
    ),
    rule('kit-record', 'Record prepared kit', ['kit.not-configured'], ['kit.prepared'], 'action', {
      enabled: false,
    }),
    rule(
      'rotate',
      'Rotate work credentials',
      ['work.control', 'device.clean'],
      ['work.credentials-rotated'],
    ),
    rule('revoke', 'Revoke active sessions', ['work.control'], ['work.sessions-revoked']),
    rule(
      'review',
      'Review recovery settings',
      ['work.control'],
      ['work.recovery-settings-reviewed'],
    ),
    rule(
      'restore-trust',
      'Verify containment is complete',
      [
        'work.control',
        'work.credentials-rotated',
        'work.sessions-revoked',
        'work.recovery-settings-reviewed',
      ],
      ['work.trusted'],
    ),
    rule('files-access', 'Trusted work sign-in', ['work.trusted'], ['files.available'], 'derived'),
    rule(
      'roster-access',
      'Trusted work sign-in',
      ['work.trusted'],
      ['roster.available'],
      'derived',
    ),
    rule('chat-access', 'Trusted work sign-in', ['work.trusted'], ['chat.available'], 'derived'),
    rule(
      'chat-comms',
      'Communicate through team chat',
      ['chat.available'],
      ['communications.available'],
      'derived',
    ),
    rule(
      'phone-comms',
      'Use independently known contact',
      ['phone.available', 'custodian.available'],
      ['communications.available'],
      'derived',
    ),
    rule(
      'coordinate',
      'Roster and communication route',
      ['roster.available', 'communications.available'],
      ['volunteers.ready'],
      'derived',
      { responsibleRole: 'coordinator' },
    ),
  ],
  targets: [
    { id: 'instructions', label: 'Read event instructions', fact: 'files.available' },
    { id: 'shifts', label: 'Access the shift roster', fact: 'roster.available' },
    { id: 'coordinate', label: 'Coordinate volunteers', fact: 'volunteers.ready' },
    { id: 'public', label: 'Keep public information available', fact: 'website.available' },
  ],
  assumptions: [
    'All accounts, policies, messages, and actions are fictional.',
    'The backup mailbox credentials are currently unavailable.',
    'The work-account incident includes lockout and revocation of work sessions.',
    'An available custodian and clean recovery device are assumed.',
  ],
});

export const failures: Failure[] = [
  {
    id: 'none',
    label: 'Normal operations',
    description: 'Inspect the organisation before an incident.',
    removes: [],
    adds: [],
    disabledRules: [],
    compromised: [],
  },
  {
    id: 'work-lockout',
    label: 'Work account compromised',
    description:
      'The attacker changes credentials. Work sessions are revoked. The team loses trusted work access.',
    removes: [
      'work.control',
      'work.trusted',
      'work.credentials-rotated',
      'work.sessions-revoked',
      'work.recovery-settings-reviewed',
    ],
    adds: [],
    disabledRules: [],
    compromised: ['work'],
  },
  {
    id: 'backup-lost',
    label: 'Recovery mailbox unavailable',
    description:
      'The backup route is unavailable. The trusted work account still provides an independent starting point.',
    removes: ['backup.trusted'],
    adds: [],
    disabledRules: [],
    compromised: [],
  },
  {
    id: 'phone-lost',
    label: 'Admin phone lost',
    description:
      'A fresh work sign-in is required, and the phone is unavailable. Existing trusted work access is removed in this model.',
    removes: [
      'phone.available',
      'work.control',
      'work.trusted',
      'work.credentials-rotated',
      'work.sessions-revoked',
      'work.recovery-settings-reviewed',
    ],
    adds: [],
    disabledRules: [],
    compromised: [],
  },
];
export const failureById = (id: string) => failures.find((f) => f.id === id) ?? failures[0];

export function withRecoveryKit(blueprint: Blueprint): Blueprint {
  const b = structuredClone(blueprint);
  b.version += 1;
  b.improved = true;
  if (!b.initialFacts.includes('kit.prepared')) b.initialFacts.push('kit.prepared');
  b.rules = b.rules.map((r) =>
    ['recover-work-kit', 'prepare-kit'].includes(r.id) ? { ...r, enabled: true } : r,
  );
  b.assumptions = [
    ...new Set([
      ...b.assumptions,
      'Proposed: an independent kit has been prepared and can be retrieved by the custodian. Implement and test this arrangement separately.',
    ]),
  ];
  return blueprintSchema.parse(b);
}
