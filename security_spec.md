# Security Specification — Vortex (E2EE & Mandatory 2FA Community Platform)

## 1. Data Invariants

1. **PII & TOTP Isolation Invariant**: User email addresses, TOTP 2FA secrets (`totpSecret`), and recovery hashes (`recoveryHash`) are strictly isolated inside `/users/{userId}/private/{docId}` and can ONLY be read or written by `request.auth.uid == userId` when `exists(/databases/$(database)/documents/users/$(userId))` is true.
2. **Master Gate Invariant**: Subcollections (`/users/{userId}/private/{docId}`, `/servers/{serverId}/channels/{channelId}`, `/servers/{serverId}/messages/{messageId}`) require the parent document (`/users/{userId}` or `/servers/{serverId}`) to exist via `exists()` or `get()`.
3. **Identity & Ownership Integrity**: Every created document must bind its creator/owner UID (`uid`, `ownerId`, `authorId`, `requesterId`, `senderId`) strictly to `request.auth.uid` with `request.auth.token.email_verified == true`.
4. **Temporal Integrity**: All `createdAt` and `updatedAt` fields must strictly equal `request.time`. Immortal fields (`uid`, `id`, `ownerId`, `serverId`, `authorId`, `requesterId`, `recipientId`, `createdAt`) cannot be mutated on `update`.
5. **Terminal State Locking**: Once a `/friendships/{friendshipId}` document reaches `status == 'blocked'`, no further updates are permitted.
6. **Query Enforcement**: Every `allow list` rule explicitly evaluates `resource.data` without relying on client-side filtering or performing `get()`/`exists()` inside `list`.

## 2. The "Dirty Dozen" Payloads

1. **Shadow Field Injection on User Profile**: Creating `/users/user_1` with an extra undeclared field `{"isAdmin": true}` -> Rejected by `hasOnly()`.
2. **PII Cross-User Read**: Authenticated `user_2` attempting `get` on `/users/user_1/private/security` -> Rejected by `request.auth.uid == userId`.
3. **Unverified Email Write**: Authenticated user with `email_verified == false` attempting to create `/servers/srv_1` -> Rejected by `isVerified()`.
4. **Identity Spoofing on Server Creation**: Authenticated `user_1` creating `/servers/srv_1` with `ownerId: "user_2"` -> Rejected by `incoming().ownerId == request.auth.uid`.
5. **Orphaned Channel Creation**: Creating `/servers/non_existent_srv/channels/ch_1` -> Rejected by Master Gate `get(/databases/$(database)/documents/servers/$(serverId)).data.ownerId == request.auth.uid`.
6. **Value Poisoning on Server Slowmode**: Updating `/servers/srv_1` `botSlowmodeSeconds` with `"invalid_string"` or `999999` -> Rejected by `isValidServer(incoming())`.
7. **Timestamp Forgery on Message Creation**: Creating `/servers/srv_1/messages/msg_1` with a past or future `createdAt` timestamp != `request.time` -> Rejected by `incoming().createdAt == request.time`.
8. **Immortal Field Mutation on Message Update**: Author `user_1` attempting to change `authorId` or `createdAt` on `/servers/srv_1/messages/msg_1` -> Rejected by `affectedKeys().hasOnly(...)` and `incoming().authorId == existing().authorId`.
9. **Self-Friendship Creation**: User `user_1` creating `/friendships/fr_1` where `requesterId == recipientId` -> Rejected by `incoming().requesterId != incoming().recipientId`.
10. **State Shortcutting on Friendship Creation**: User `user_1` creating `/friendships/fr_1` directly with `status: "accepted"` -> Rejected by `incoming().status == 'pending'`.
11. **Terminal State Bypass on Blocked Friendship**: Attempting to update `/friendships/fr_1` from `status: "blocked"` back to `"accepted"` -> Rejected by `existing().status != 'blocked'`.
12. **Resource Poisoning / Oversized ID**: Creating `/servers/{150_char_id}` or a message with a 10,000-character `ciphertext` -> Rejected by `isValidId()` and `.size() <= 4000`.
