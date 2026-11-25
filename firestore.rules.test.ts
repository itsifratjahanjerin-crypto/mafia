/**
 * Dirty Dozen adversarial payload test matrix for firestore.rules.
 * Documents and verifies structural invariants from security_spec.md.
 */

export interface AdversarialCase {
  id: string;
  title: string;
  path: string;
  operation: 'create' | 'update' | 'get' | 'list' | 'delete';
  expectedOutcome: 'PERMISSION_DENIED';
  payload: Record<string, unknown>;
}

export const DIRTY_DOZEN_PAYLOADS: AdversarialCase[] = [
  {
    id: 'DD-01',
    title: 'Shadow Field Injection on User Create',
    path: '/users/alice',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    payload: {
      uid: 'alice',
      friendCode: 'MAF-1111',
      displayName: 'Alice',
      avatar: 'fedora',
      gamesPlayed: 0,
      gamesWon: 0,
      gmHostedCount: 0,
      lastActiveRoomCode: '',
      isAdmin: true,
    },
  },
  {
    id: 'DD-02',
    title: 'Identity Spoofing on User Create',
    path: '/users/bob',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    payload: { uid: 'alice', friendCode: 'MAF-2222' },
  },
  {
    id: 'DD-03',
    title: 'Unverified Email Write',
    path: '/users/alice',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    payload: { emailVerified: false },
  },
  {
    id: 'DD-04',
    title: 'Blanket User List Scraping',
    path: '/users',
    operation: 'list',
    expectedOutcome: 'PERMISSION_DENIED',
    payload: {},
  },
  {
    id: 'DD-05',
    title: 'Directory Enumeration Scraping',
    path: '/playerDirectory',
    operation: 'list',
    expectedOutcome: 'PERMISSION_DENIED',
    payload: {},
  },
  {
    id: 'DD-06',
    title: 'Directory Hijack Update',
    path: '/playerDirectory/MAF-ALICE',
    operation: 'update',
    expectedOutcome: 'PERMISSION_DENIED',
    payload: { uid: 'bob', currentRoomCode: 'HACK99' },
  },
  {
    id: 'DD-07',
    title: 'Orphaned Friend Write Without Parent User',
    path: '/users/alice/friends/bob',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    payload: { uid: 'alice', friendUid: 'bob', friendCode: 'MAF-2222' },
  },
  {
    id: 'DD-08',
    title: 'Private Room Listing Leak',
    path: '/rooms',
    operation: 'list',
    expectedOutcome: 'PERMISSION_DENIED',
    payload: { queryWithoutIsPublicFilter: true },
  },
  {
    id: 'DD-09',
    title: 'Room Host Hijack Update',
    path: '/rooms/ABC123',
    operation: 'update',
    expectedOutcome: 'PERMISSION_DENIED',
    payload: { hostUid: 'eve', phase: 'GAME_OVER' },
  },
  {
    id: 'DD-10',
    title: 'Invite Sender Spoofing',
    path: '/invites/inv1',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    payload: { inviteId: 'inv1', fromUid: 'alice', toUid: 'bob', status: 'pending' },
  },
  {
    id: 'DD-11',
    title: 'Invite Terminal State Bypass',
    path: '/invites/inv1',
    operation: 'update',
    expectedOutcome: 'PERMISSION_DENIED',
    payload: { status: 'pending', previousStatus: 'accepted' },
  },
  {
    id: 'DD-12',
    title: 'Path Poisoning & Client Timestamp Forgery',
    path: `/rooms/${'X'.repeat(1500)}`,
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    payload: { createdAt: '1999-01-01T00:00:00Z' },
  },
];
