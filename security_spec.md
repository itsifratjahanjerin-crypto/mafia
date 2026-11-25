# Security Specification & Payload-First TDD (`security_spec.md`)

## 1. Data Invariants
1. **Owner-Only Profile & Stats**: A `/users/{userId}` document can only be created, read, or updated by `request.auth.uid == userId` with `email_verified == true`. Career stats (`gamesPlayed`, `gamesWon`, `gmHostedCount`) cannot be negative or incremented arbitrarily by other users.
2. **Master Gate on Subcollections**: `/users/{userId}/friends/{friendUid}` and `/users/{userId}/matchHistory/{matchId}` require the parent `/users/{userId}` document to exist (`exists()` / `get()`), and only the owning `userId` can read, create, or delete them.
3. **Friend Lookup Without Enumeration**: `/playerDirectory/{friendCode}` permits single-document `get` by signed-in users who know an exact `friendCode`, while `allow list` is strictly denied (`false`) to prevent directory scraping. Only the owning `uid` may create or update their directory entry, and `uid` + `friendCode` are immutable after creation.
4. **Public vs Private Room Directory Isolation**: `/rooms/{roomCode}` allows `list` ONLY when `resource.data.isPublic == true || resource.data.hostUid == request.auth.uid`. Single-document `get` requires a valid alphanumeric `roomCode`. Secret Mafia roles, night targets, detective results, and hidden votes are NEVER stored in `/rooms/{roomCode}`.
5. **Invite Integrity & Terminal State Locking**: `/invites/{inviteId}` can only be created by `fromUid == request.auth.uid` with `status == 'pending'`. Only the recipient (`toUid`) may transition `status` from `'pending'` to `'accepted'` or `'dismissed'`. Once `status` is `'accepted'` or `'dismissed'`, no further updates are permitted.
6. **Temporal Integrity & Path Variable Hardening**: Every document ID (`userId`, `friendCode`, `friendUid`, `matchId`, `roomCode`, `inviteId`) must match `^[a-zA-Z0-9_\-]+$` (or stricter regex) and be `<= 128` chars. `createdAt` and `updatedAt` timestamps must strictly equal `request.time`.

## 2. The "Dirty Dozen" Attack Payloads
All 12 payloads below MUST evaluate to `PERMISSION_DENIED`:
1. **Shadow Field Injection on User Create**: `PUT /users/alice` with `{ uid: "alice", friendCode: "MAF-1111", ..., isAdmin: true }` -> Rejected by `keys().hasOnly(...)`.
2. **Identity Spoofing on User Create**: `PUT /users/bob` authenticated as `alice` with `{ uid: "alice", ... }` -> Rejected by `request.auth.uid == userId`.
3. **Unverified Email Write**: Authenticated user with `email_verified: false` attempting `POST /users/alice` -> Rejected by `isVerifiedUser()`.
4. **Blanket User List Scraping**: `LIST /users` by any signed-in user -> Rejected (`allow list: if false;` on `/users`).
5. **Directory Enumeration Scraping**: `LIST /playerDirectory` by any signed-in user -> Rejected (`allow list: if false;` on `/playerDirectory`).
6. **Directory Hijack Update**: User `bob` updating `/playerDirectory/MAF-ALICE` (`existing.uid == "alice"`) -> Rejected (`existing().uid == request.auth.uid`).
7. **Orphaned Friend Write**: User `alice` writing `/users/alice/friends/bob` before `/users/alice` exists -> Rejected by Master Gate `exists(/databases/$(database)/documents/users/$(userId))`.
8. **Private Room Listing Leak**: `LIST /rooms` without `where('isPublic', '==', true)` -> Rejected by `allow list: if isSignedIn() && (resource.data.isPublic == true || resource.data.hostUid == request.auth.uid)`.
9. **Room Host Hijack**: Non-host user updating `/rooms/ABC123` to change `hostUid` or `phase` -> Rejected (`existing().hostUid == request.auth.uid`).
10. **Invite Spoofing**: User `eve` creating `/invites/inv1` with `fromUid: "alice"` -> Rejected (`incoming().fromUid == request.auth.uid`).
11. **Invite Terminal State Bypass**: Recipient updating `/invites/inv1` where `existing().status == 'accepted'` back to `'pending'` -> Rejected by terminal state lock.
12. **Path Poisoning & Client Timestamp Forgery**: Creating `/rooms/<1500-char-junk>` or setting `createdAt` to a past client timestamp instead of `request.time` -> Rejected by `isValidId()` and `incoming().createdAt == request.time`.
