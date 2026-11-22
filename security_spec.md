# Security Specification — Store (Sahasna Tech Solution)

## 1. Data Invariants
1. **Tenant Isolation**: Every document in `/users/{uid}` and its subcollections (`shopProfile`, `savedThemes`, `staff`, `tickets`, `ticketParts`, `ticketTimeline`, `inventory`, `posSales`, `posSaleItems`, `bookings`) belongs strictly to `uid == request.auth.uid` with `request.auth.token.email_verified == true`.
2. **Master Gate**: Subcollection writes require the parent `/users/{uid}` document to exist (or be created atomically in the same batch via `existsAfter`) and `incoming().ownerUid == uid`.
3. **Immutable Ownership**: `ownerUid` and `id` cannot be reassigned after creation.
4. **Strict Payload Boundaries**: Every entity enforces exact allowed keys via `hasAll` and `hasOnly` on create, `affectedKeys().hasOnly(...)` on update, and strict string length & numeric bounds.
5. **Temporal Integrity**: `updatedAt` must equal `request.time` on every write.
6. **ID Hardening**: Document IDs in all single-document operations must match `^[a-zA-Z0-9_\-]+$` and be <= 128 chars.

## 2. The "Dirty Dozen" Attack Payloads (Must Return PERMISSION_DENIED)
1. **Cross-Tenant Read**: User B (`uidB`) attempts `get(/users/{uidA}/tickets/t1)`.
2. **Cross-Tenant Write**: User B (`uidB`) attempts `set(/users/{uidA}/inventory/item1)` with `ownerUid: uidB`.
3. **Unverified Email Write**: User with `email_verified: false` attempts to write `/users/{uid}/shopProfile/default`.
4. **Shadow Field Injection**: Authenticated owner attempts to write `tickets/t1` with extra ghost field `isAdminBypass: true`.
5. **OwnerUid Spoofing**: Authenticated owner attempts to write `inventory/item1` with `ownerUid: "other_user"`.
6. **Oversized ID Poisoning**: Authenticated owner attempts to write `tickets/{200-char-junk-id}`.
7. **Invalid Character ID**: Authenticated owner attempts to write `tickets/bad$id!`.
8. **Client Timestamp Forgery**: Authenticated owner sends `updatedAt: "2020-01-01T00:00:00Z"` instead of `request.time`.
9. **Blanket Collection List by Other User**: User B attempts `list` on `/users/{uidA}/posSales`.
10. **Invalid Enum Status**: Authenticated owner attempts to set `tickets/t1` status to `"HackedStatus"`.
11. **Oversized String Denial-of-Wallet**: Authenticated owner attempts to send 50KB string in `faultDescription`.
12. **Immutable ID Mutation on Update**: Authenticated owner attempts to change `id` or `ownerUid` during `tickets/t1` update.
