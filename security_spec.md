# Security Specification — أكاديمية المِنَّة ثلاثية الأبعاد

## 1. Data Invariants
1. A `UserProfile` document at `/users/{userId}` can only be read, created, or updated by an authenticated, email-verified user whose `request.auth.uid == userId`, with `uid == userId`.
2. All subcollection documents (`stationStates`, `factStates`, `quizAnswers`, `achievements`) enforce the Master Gate: the parent `/users/{userId}` document must exist and the requester must be the verified owner (`request.auth.uid == userId`).
3. `createdAt`, `uid`, `ownerId`, `stationId`, `factId`, `questionId`, `achievementId`, and `unlockedAt` are immutable after creation.
4. `createdAt`, `updatedAt`, and `unlockedAt` must strictly equal `request.time`.
5. All IDs match `^[a-zA-Z0-9_\-]+$` with strict max lengths (`<= 128` for userId, `<= 64` for sub-entity IDs, `<= 32` for chapterId).
6. Bounded array `completedCardIds` has `size() <= 30` and type-checks index 0 when non-empty.

## 2. The "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Unauthenticated read**: Reading `/users/alice` with `auth == null`.
2. **Cross-user profile read**: User `bob` reading `/users/alice`.
3. **Unverified email write**: User `alice` with `email_verified: false` creating `/users/alice`.
4. **UID spoofing**: User `alice` creating `/users/alice` with `uid: "bob"`.
5. **Ghost field injection**: User `alice` creating `/users/alice` with extra `isAdmin: true`.
6. **Client timestamp forgery**: User `alice` writing `updatedAt: new Date(0)` instead of `serverTimestamp()`.
7. **Immutable field mutation**: User `alice` updating `createdAt` or `uid` on `/users/alice`.
8. **Negative/overflow XP poisoning**: User `alice` writing `xp: -50` or `xp: 99999999`.
9. **Orphan subcollection write**: Creating `/users/alice/stationStates/ch2_s1` before `/users/alice` exists.
10. **Oversized ID poisoning**: Writing `/users/alice/stationStates/` with a 200-char ID or invalid characters `../admin`.
11. **Unbounded array attack**: Writing `completedCardIds` with 31+ items or non-string element `[123]`.
12. **Achievement tampering**: Updating or deleting an already unlocked `/users/alice/achievements/first_station` document.
