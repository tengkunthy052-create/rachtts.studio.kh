# Firestore Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Strict Ownership & Verified Email**: Every document under `/users/{userId}` (including `/private/{docId}` and `/speeches/{speechId}`) belongs exclusively to `userId == request.auth.uid` with `request.auth.token.email_verified == true`.
2. **PII Isolation**: User email addresses reside exclusively in `/users/{userId}/private/info` and are never exposed to other users or blanket-readable collections.
3. **No Orphaned Subcollections (Master Gate)**: A `SpeechRecord` under `/users/{userId}/speeches/{speechId}` or `UserPrivateInfo` under `/users/{userId}/private/{docId}` cannot be created unless the parent `/users/{userId}` exists (or is created atomically in the same batch via `existsAfter`).
4. **Immutable Identity & Temporal Integrity**: `uid`, `userId`, `id`, and `createdAt` cannot be modified after creation. `createdAt` on create and `updatedAt` on create/update must strictly equal `request.time`.
5. **Bounded Payloads**: `text` is strictly bounded to `[1, 50000]` characters, `dailyCount` to `[0, 1000]`, `durationSeconds` to `[0, 86400]`, and all path IDs match `^[a-zA-Z0-9_\-]+$` with length `<= 128`.
6. **Zero Ghost Fields**: Both `create` (`hasAll` + `hasOnly`) and `update` (`affectedKeys().hasOnly(...)`) reject unapproved keys such as `isAdmin`, `role`, or arbitrary shadow fields.

## 2. The "Dirty Dozen" Attack Payloads (All Must Fail with PERMISSION_DENIED)
1. **Unauthenticated Read/Write**: `request.auth == null` reading `/users/alice` or creating `/users/alice/speeches/s1`.
2. **Unverified Email Write**: `request.auth.uid == 'alice'` with `request.auth.token.email_verified == false` writing `/users/alice`.
3. **Cross-User Read (PII Leak)**: `alice` attempting `get` on `/users/bob` or `/users/bob/private/info`.
4. **Cross-User List Scraping**: `alice` attempting `list` on `/users` or `/users/bob/speeches`.
5. **Identity Spoofing on Create**: `alice` creating `/users/alice/speeches/s1` with `{ userId: "bob", ... }`.
6. **Ghost Privilege Field (Shadow Write)**: `alice` creating `/users/alice` with `{ ..., isAdmin: true }` or `role: "admin"`.
7. **ID Poisoning**: `alice` creating `/users/alice/speeches/../../bad_id_longer_than_128...` failing `isValidId()`.
8. **Payload Exhaustion (Denial of Wallet)**: `alice` creating a `SpeechRecord` with `text.size() > 50000` or invalid `dailyDate`.
9. **Timestamp Tampering**: `alice` creating `/users/alice/speeches/s1` with client-forged `createdAt` != `request.time`.
10. **Immutable Field Mutation**: `alice` updating `/users/alice/speeches/s1` to change `userId`, `id`, or `createdAt`.
11. **Missing Validation Helper / Type Poisoning on Update**: `alice` updating `dailyCount` to a string `"unlimited"` or negative `-5`.
12. **Orphaned Subcollection Write**: `alice` creating `/users/alice/speeches/s1` when parent `/users/alice` does not exist and is not created in the same batch.
