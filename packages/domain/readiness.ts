import type { Blueprint } from './model';

export const defaultFollowUps: Blueprint['followUps'] = [
  {
    id: 'independent-method',
    title: 'Confirm and prepare an independent recovery method',
    owner: 'Administrator',
    status: 'proposed',
    note: '',
    reviewDate: '',
  },
  {
    id: 'custodian',
    title: 'Confirm the custodian can retrieve recovery materials',
    owner: 'Recovery custodian',
    status: 'proposed',
    note: '',
    reviewDate: '',
  },
  {
    id: 'offline-reference',
    title: 'Store instructions and trusted contacts outside the work account',
    owner: 'Coordinator',
    status: 'proposed',
    note: '',
    reviewDate: '',
  },
  {
    id: 'practice',
    title: 'Practise recovery and containment; record the outcome',
    owner: 'Administrator',
    status: 'proposed',
    note: '',
    reviewDate: '',
  },
];

export const readinessTasks = (b: Blueprint) =>
  b.followUps?.length ? b.followUps : defaultFollowUps;
