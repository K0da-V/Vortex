/**
 * Firestore Security Rules Test Suite — Dirty Dozen Verification
 * Verifies that all 12 adversarial payloads defined in security_spec.md return PERMISSION_DENIED.
 */

export interface SecurityTestCase {
  id: number;
  name: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  auth: { uid: string; email_verified: boolean } | null;
  payload?: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_TESTS: SecurityTestCase[] = [
  {
    id: 1,
    name: 'Shadow Field Injection on User Profile',
    operation: 'create',
    path: '/users/user_1',
    auth: { uid: 'user_1', email_verified: true },
    payload: {
      uid: 'user_1',
      displayName: 'Alice',
      username: 'alice',
      avatarUrl: '',
      bannerColor: '#4f46e5',
      bio: 'Dev',
      customStatus: 'Online',
      presence: 'online',
      e2eePublicKey: 'PUBKEY_1234567890',
      e2eeFingerprint: 'ABCD-1234-EFGH-5678',
      twoFactorEnabled: true,
      isAdmin: true, // Ghost field
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'PII Cross-User Read on Private Security Doc',
    operation: 'get',
    path: '/users/user_1/private/security',
    auth: { uid: 'user_2', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Unverified Email Write on Server Creation',
    operation: 'create',
    path: '/servers/srv_1',
    auth: { uid: 'user_1', email_verified: false },
    payload: {
      id: 'srv_1',
      name: 'Vortex Core',
      ownerId: 'user_1',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Identity Spoofing on Server Creation',
    operation: 'create',
    path: '/servers/srv_1',
    auth: { uid: 'user_1', email_verified: true },
    payload: {
      id: 'srv_1',
      name: 'Spoofed Server',
      ownerId: 'user_2',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Orphaned Channel Creation Under Non-Existent Server',
    operation: 'create',
    path: '/servers/missing_srv/channels/ch_1',
    auth: { uid: 'user_1', email_verified: true },
    payload: {
      id: 'ch_1',
      serverId: 'missing_srv',
      name: 'geral',
      category: 'Texto',
      type: 'text',
      topic: '',
      isLocked: false,
      ownerId: 'user_1',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Value Poisoning on Server Slowmode',
    operation: 'update',
    path: '/servers/srv_1',
    auth: { uid: 'user_1', email_verified: true },
    payload: {
      botSlowmodeSeconds: 999999,
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Timestamp Forgery on Message Creation',
    operation: 'create',
    path: '/servers/srv_1/messages/msg_1',
    auth: { uid: 'user_1', email_verified: true },
    payload: {
      id: 'msg_1',
      serverId: 'srv_1',
      channelId: 'ch_1',
      authorId: 'user_1',
      createdAt: '2020-01-01T00:00:00Z',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Immortal Field Mutation on Message Update',
    operation: 'update',
    path: '/servers/srv_1/messages/msg_1',
    auth: { uid: 'user_1', email_verified: true },
    payload: {
      authorId: 'user_2',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Self-Friendship Creation',
    operation: 'create',
    path: '/friendships/fr_1',
    auth: { uid: 'user_1', email_verified: true },
    payload: {
      id: 'fr_1',
      requesterId: 'user_1',
      recipientId: 'user_1',
      status: 'pending',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'State Shortcutting on Friendship Creation',
    operation: 'create',
    path: '/friendships/fr_1',
    auth: { uid: 'user_1', email_verified: true },
    payload: {
      id: 'fr_1',
      requesterId: 'user_1',
      recipientId: 'user_2',
      status: 'accepted',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Terminal State Bypass on Blocked Friendship',
    operation: 'update',
    path: '/friendships/fr_blocked',
    auth: { uid: 'user_2', email_verified: true },
    payload: {
      status: 'accepted',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Resource Poisoning Oversized Ciphertext',
    operation: 'create',
    path: '/directMessages/dm_1',
    auth: { uid: 'user_1', email_verified: true },
    payload: {
      id: 'dm_1',
      friendshipId: 'fr_1',
      senderId: 'user_1',
      senderName: 'Alice',
      recipientId: 'user_2',
      ciphertext: 'A'.repeat(5000),
      iv: '123456789012',
      signature: 'SIG_1234567890',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
];
