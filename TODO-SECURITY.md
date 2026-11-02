# Security & Code Health TODO

Findings from the November 2026 code review. Items already fixed are listed at the bottom for reference.

## 🔴 HIGH PRIORITY

### 1. Audit database permissions (RLS policies)
The repo doesn't contain the RLS policies, so they couldn't be reviewed. Check these in Supabase Dashboard → Authentication → Policies:

- [ ] **`user_profiles` UPDATE**: should only allow `auth.uid() = id`. When a match is saved, the app updates stats on *every* player's profile from the saving player's device ([[roomCode].tsx](app/tracker/[roomCode].tsx) → `updateUserStatsAfterMatch`). If those updates succeed today, any user can edit anyone's profile (username, stats, avatar). If they fail, other players' stats silently aren't updating.
- [ ] **Move stat recalculation server-side**: replace the client-side stats update with a database trigger on `saved_matches` insert (or an RPC), then lock `user_profiles` UPDATE down to the owner.
- [ ] **`live_matches` UPDATE**: joining now goes through `join_live_match` (security definer), so plain UPDATE can be restricted to the host (`auth.uid() = "hostId"`). Check that nothing else needs non-host updates first.
- [ ] **`live_matches` DELETE**: should be host-only.
- [ ] **`saved_matches` INSERT**: check that `userId` must equal `auth.uid()`.
- [ ] **`friends`**: UPDATE (accept) should only be allowed for `user_id_2 = auth.uid()` (the recipient). The app now enforces this, but only RLS actually prevents a user accepting their own request.
- [ ] **`session_logs`**: anonymous visitors can insert, and the app updates rows by id. Make sure anon/users can't read or update other people's rows.

### 2. Storage bucket policies (`profile-pictures`)
Profile picture upload is now enabled without a password.
- [ ] Require authentication to upload.
- [ ] Restrict uploads and deletes to the user's own files. File names are `profile-<userId>-<timestamp>.<ext>`; moving to a `<userId>/` folder prefix makes this an easy policy: `(storage.foldername(name))[1] = auth.uid()::text`.
- [ ] Set a file size limit (5 MB matches the app) and allowed MIME types (`image/jpeg`, `image/png`, `image/webp`, `image/heic`) on the bucket.

### 3. Visitor logging privacy
[sessionLogger.ts](utils/sessionLogger.ts) sends every visitor's IP address to ipapi.co and stores their IP, city, region and user agent.
- [ ] Add a privacy policy / notice that covers this (the "Terms" button on the home screen is currently a placeholder).
- [ ] Decide whether you need IP + city at all; country-level or no geolocation would reduce risk.
- [ ] ipapi.co's free tier has a daily request limit; past it, logging silently records `unknown`.
- [ ] Add a retention policy (e.g. delete `session_logs` rows older than 90 days).

---

## 🟡 MEDIUM PRIORITY

### 4. Live match data sync
- [ ] The host's score sync writes the whole `livePlayerStats` blob. If it fires before the host's screen receives a new player's join, that player's display name in stats briefly reverts (their slot is safe). Fix by moving play recording to small RPCs, or by merging names from `matchSetup.playerNames`.
- [ ] When saving a match, `saved_matches.userSlotMap` and the stats update use the host's local slot map, which could miss a player who joined in the last second. Re-fetch the match row before saving.

### 5. Client-side rate limits are cosmetic
Magic link and password reset limits ([magicLinkAuth.ts](utils/magicLinkAuth.ts), [passwordReset.ts](utils/passwordReset.ts)) are stored on the device and are trivial to bypass.
- [ ] Confirm Supabase Auth's server-side rate limits are configured (Dashboard → Authentication → Rate Limits).
- [ ] Error messages like "No account found with this email" reveal which emails are registered; consider a generic message.

### 6. Regenerate database types
[types/database.ts](types/database.ts) is out of date (missing `join_live_match`, `kick_community_member`, `update_community`, etc.).
- [ ] Run `npm run generate-types` and fix any new type errors it surfaces.

### 7. Lint warnings (59)
Mostly `react-hooks/exhaustive-deps` and unused variables.
- [ ] Fix carefully screen by screen: adding missing effect dependencies can cause loops or extra fetches, so test each screen after changing it.

### 8. Content Security Policy
[vercel.json](vercel.json) allows `'unsafe-inline'` and `'unsafe-eval'` in `script-src`.
- [ ] Test whether the Expo web export works without `'unsafe-eval'`; remove it if so.
- [ ] `Permissions-Policy: camera=()` blocks the camera on web. That's fine while photo features are mobile-only, but must change if camera features come to web.

---

## 🟢 LOW PRIORITY / CLEANUP

### 9. Dead code and leftovers
- [ ] Unused Expo template components: `HelloWave`, `ParallaxScrollView`, `Collapsible`, `ExternalLink`, `components/ThemedText.tsx`, `components/ThemedView.tsx` (the app uses `components/themed/`), `HomeButton`, `AuthScreen`, `GameStats`, `ScoreBoard`, `MatchSummaryDemo`.
- [ ] Unused utils: `photoProcessing.ts`, `imageUrlHelper.ts`, `loggerConfig.ts`, `hooks/useKeyboardShortcuts.ts`.
- [ ] Debug buttons on the feed screen (`debugFeedProvider`, `debugUserCommunities` in [_feed/index.tsx](app/(tabs)/_feed/index.tsx)); check whether they're reachable and remove or hide behind `__DEV__`.
- [ ] Unused `modalDescription` / `modalInput` styles left in [edit-profile.tsx](app/edit-profile.tsx) from the removed password modal.
- [ ] `die.png` (1.6 MB) in the repo root.
- [ ] Duplicated session-handling code in [auth/callback.tsx](app/auth/callback.tsx) (the "session found" and "code exchange" branches are copy-pasted).

### 10. Logging
- [ ] Many `console.log` calls with emoji debug output ship to production. Route them through [logger.ts](utils/logger.ts), which already silences non-errors in production.
- [ ] [auth/callback.tsx](app/auth/callback.tsx) logs signup data (username, nickname, school).
- [ ] The root layout logs the current page on every navigation.

### 11. Error display
- [ ] The root `ErrorBoundary` in [_layout.tsx](app/_layout.tsx) shows raw error text to users. Show a friendly message and a "Reload" button instead.

### 12. Tooling
- [ ] Supabase CLI is v2.34.3; v3.0.0 is available.
- [ ] Commit the fetched migration files so local and remote migration history stay in sync.

---

## ✅ FIXED (November 2026)

- [x] URL `userId` param injected into PostgREST `.or()` filters on user profiles → now validated as a UUID
- [x] Users could accept their own friend request from a profile page → only the recipient can accept
- [x] Hard-disabled debug panel and "security test" (uploaded junk files to production storage) removed
- [x] Hardcoded profile picture password removed; profile pictures re-enabled
- [x] Profile picture uploads restricted to known image types with correct MIME type; replaced pictures are deleted from storage
- [x] Player-join race condition → atomic `join_live_match` database function (tested: 20 simultaneous joins, 1 winner)
- [x] Host score sync no longer overwrites newly joined players' slots
- [x] Live tracker re-created its realtime subscription on every update; realtime channels leaked on unmount
- [x] Double navigation after saving a match
- [x] `window.location.reload()` crash path on native; `localStorage` used on native
- [x] Password update logged the full user object
- [x] Unused username lookups (extra network request) removed from signup, community join and stats paths
- [x] 97 TypeScript errors fixed (invalid `'85vh'` style type)
- [x] Unused `api.anthropic.com` removed from the CSP
