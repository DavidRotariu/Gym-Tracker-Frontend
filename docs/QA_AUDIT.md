# Overload — QA / Reliability Audit (Phase 1: find everything)

Date: 2026-11-06 · Commit audited: `8e4da28` (main) · No application code was changed.

## How this audit was done

| Method | What it covered |
|---|---|
| Full read of `src/` | Every route, component, hook, API client, mock backend, CSS, layout, PWA config. The bugs below come from tracing real code paths. |
| `tsc --noEmit` | Clean (0 errors). |
| `eslint .` | **Fails: 18 errors, 4 warnings** (see BUILD-001). |
| `next build` | Succeeds (Next 16.3.0 / Turbopack), 13 routes. |
| Tests | There are none in the repo. |
| Live browser run | Attempted at 375×812 with the MSW mock backend. The embedded browser refused to register the MSW service worker, and the app showed a **permanent black screen**, which confirms PWA-001. Live interaction testing couldn't continue past that point, so every other item is a code-level finding. |

**Confidence labels.** **Confirmed** means the code path is unambiguous, or it was observed. **Highly likely** means the code path is clear but the outcome depends on timing or the backend. **Suspected** means plausible and worth a test. **Requires iPhone** means it depends on iOS Safari/WebKit behaviour that only a device can settle.

---

## 1. Summary counts

| | Count |
|---|---|
| **Total issues** | **121** |
| 🔴 P0 Critical | 5 |
| 🟠 P1 Major | 14 |
| 🟡 P2 Moderate | 51 |
| 🔵 P3 Minor | 42 |
| ⚪ P4 Cosmetic | 9 |
| Known gaps re-verified (not counted above) | 7 |

---

## 2. Top 20: what a week of real use would make feel "buggy"

Ranked by perceived damage, not by technical severity.

| # | ID | One-line |
|---|---|---|
| 1 | WORKOUT-001 | Typed weights, ticks and set types visibly revert and then come back, or vanish, when several edits are in flight (slow gym signal). |
| 2 | WORKOUT-002 | Rapid edits can reach the server out of order, so history and the summary can disagree with what the screen showed. |
| 3 | AUTH-002 | Access-token expiry hard-reloads you to /login in the middle of a workout. |
| 4 | WORKOUT-004 | One stray tap on the ✕ on a video deletes the exercise and every logged set, with no confirm. |
| 5 | WORKOUT-017 | Exercise demo videos show as empty grey boxes after a reload or a swap. |
| 6 | REST-002 | The rest timer never alerts you if the phone is locked or the app is in the background, which is the normal state between sets. |
| 7 | HOME-001 | The QR sheet says "No QR code uploaded yet" while loading or offline, at the gym door. |
| 8 | WORKOUT-012 | Any touch, including starting a scroll, slams the keypad shut. |
| 9 | WORKOUT-003 | A double tap on the ✓ un-completes the set, and every tick restarts the rest timer. |
| 10 | LAUNCH-001 | Reopening the PWA mid-workout offers "Let's do it!", and tapping it creates a duplicate workout. |
| 11 | WORKOUT-015 | Focus or dimming jumps to the wrong card after auto-advance or when the keypad opens. |
| 12 | WORKOUT-019 | Swipe-delete a set and it stays there, so you delete it again and get an error toast. |
| 13 | UI-001 | After a sheet closes, the next tap or scroll is swallowed for about 0.4 s. |
| 14 | WORKOUT-008 | The "Log first set" autofill lands late and overwrites what you just typed. |
| 15 | WORKOUT-006 | A deleted or failed workout shows an endless skeleton with no back button. |
| 16 | UI-007 / WORKOUT-023 | Every navigation scrolls to the top, so Back from exercise detail loses your place mid-workout. |
| 17 | AUTH-001 | After logout and a login as someone else, the previous user's splits, history and "Resume workout" are still showing. |
| 18 | WORKOUT-007 | Finish fails silently on bad network, and errors after Finish are hidden under the summary. |
| 19 | WORKOUT-021 / PWA-003 | Whole-page re-render every second, plus every exercise video downloaded on cellular after login, means jank and battery/data drain. |
| 20 | UI-006 | Swipe rows jitter on diagonal drags, and tapping a half-open row triggers the content underneath. |

---

## 3. Complete bug inventory

Each entry gives: severity, area, the problem, repro, expected vs actual, likely cause, evidence and confidence.

### 3.1 Authentication & session

#### AUTH-001 · 🔴 P0 · Auth → Logout
- **Problem:** Logout clears tokens but not the React Query cache or user-scoped localStorage. The next account on the same device sees the previous user's data.
- **Repro:** Log in as A and open Home, Splits and History. Log out, then sign up or log in as B within 30 s. Open Home.
- **Expected:** B sees only B's data.
- **Actual:** The module-level `queryClient` survives client-side navigation, and queries younger than `staleTime` (30 s) don't refetch on mount. B sees A's splits, history, streak, avatar, membership and "Resume workout" (which then opens A's session id, which 404s; see WORKOUT-006). `overload_favorites`, `overload_rest_timer`, `overload_exercise_order_*` and `overload_launch_shown` also carry over.
- **Cause:** `logout()` only removes three keys. Query keys aren't user-scoped. `queryClient.clear()` is never called.
- **Evidence:** `src/hooks/use-auth.ts:102-108`, `src/app/(app)/profile/page.tsx:73-76`, `src/app/providers.tsx:11-15`, `src/hooks/use-users.ts:49-53` (`["profile-picture"]`), `["membership"]`.
- **Confidence:** Confirmed (code path).

#### AUTH-002 · 🔴 P0 · Auth → Token expiry
- **Problem:** The deployed API issues no refresh token (code comment). When the access token expires, the next request gets a 401. `clearSession()` then does `window.location.href = "/login"`, a hard reload, even in the middle of a workout.
- **Repro:** Start a workout and wait past the token TTL (or edit `overload_token` to an expired JWT). Tap ✓ on a set.
- **Expected:** A silent refresh, or at least a re-auth prompt that keeps the workout state.
- **Actual:** A full reload to /login. In-flight optimistic mutations are lost, along with any keypad draft and the rest-timer context. The 401 PATCH that triggered it is never retried.
- **Cause:** No refresh token, and a hard redirect inside the API client.
- **Evidence:** `src/lib/api/auth.ts:6`, `src/hooks/use-auth.ts:48-51` ("No-ops today"), `src/lib/api/client.ts:52-61, 100-106`.
- **Confidence:** Highly likely. The severity depends on the backend token TTL, which needs confirming.

#### AUTH-003 · 🟠 P1 · Auth → Refresh concurrency
- **Problem:** There's no single-flight around refresh. Every concurrent 401 calls `/auth/refresh` with the same refresh token, and every `useAuth()` instance (root page, `(app)` layout, Profile, login and signup each create one) schedules its own refresh timer.
- **Repro:** This only becomes visible once refresh tokens are issued. Let the token expire with 3 queries mounted, or 2 `useAuth` instances alive at refresh time.
- **Expected:** One refresh, with the other requests waiting for it.
- **Actual:** N parallel refreshes. With rotating refresh tokens, every one after the first fails, so `clearSession()` logs the user out, and reuse detection may revoke the whole token family.
- **Evidence:** `src/lib/api/client.ts:31-50, 100-106`; `src/hooks/use-auth.ts:34-71` (a timer per hook instance).
- **Confidence:** Confirmed (latent until refresh tokens ship).

#### AUTH-004 · 🟡 P2 · Auth → Blob requests
- **Problem:** `apiRequestBlob` (QR image, profile picture) has no 401 → refresh → retry path.
- **Actual:** After expiry the QR or avatar fails silently. The QR sheet shows "No QR code uploaded yet" (see HOME-001).
- **Evidence:** `src/lib/api/client.ts:121-131`.
- **Confidence:** Confirmed.

#### AUTH-005 · 🟡 P2 · Auth → `useAuth` state model
- **Problem:** `user` is local state in each hook instance, read once from localStorage. Logout in Profile doesn't update the layout's instance. There's no `storage` listener, so logging out in another tab or window isn't noticed.
- **Evidence:** `src/hooks/use-auth.ts:34-71`.
- **Confidence:** Confirmed.

#### AUTH-006 · 🟡 P2 · Auth → /login
- **Problem:** Demo credentials (`demo@overload.app` / `demo1234`) are pre-filled in every build, not only the mock build.
- **Actual:** It fights iOS password autofill. If that account exists on the real backend, people can sign into a shared account just by tapping Sign in.
- **Evidence:** `src/app/(auth)/login/page.tsx:15-16`.
- **Confidence:** Confirmed.

#### AUTH-007 · 🟡 P2 · Network → All requests
- **Problem:** `fetch` has no timeout or AbortController anywhere.
- **Repro:** Gym Wi-Fi that accepts the connection but stalls.
- **Actual:** "Signing in…", "Starting…", skeletons and the LaunchGate black screen hang until the OS times out (60 s or more).
- **Evidence:** `src/lib/api/client.ts:90-94, 126`.
- **Confidence:** Confirmed.

#### AUTH-008 · 🟡 P2 · Network → Error parsing and messages
- **Problem:** Non-JSON error bodies (an HTML 502/504 from a gateway, a Lambda timeout page) make `JSON.parse` throw a raw `SyntaxError`. Network failure throws a `TypeError` ("Load failed" on Safari). The workout page shows `err.message` verbatim.
- **Actual:** Toasts such as "Load failed" or "Unexpected token '<'…".
- **Evidence:** `src/lib/api/client.ts:108-109`; `src/app/(app)/workout/[sessionId]/page.tsx:102-106`.
- **Confidence:** Confirmed.

#### AUTH-009 · 🔵 P3 · Auth → Routing
- **Problem:** A signed-in user who opens /login or /signup isn't redirected. Every protected screen renders `null` on the first frame (`loading` starts as `true`), so each cold load starts with a blank frame.
- **Evidence:** `src/hooks/use-auth.ts:35-36`, `src/app/(app)/layout.tsx:23`.
- **Confidence:** Confirmed.

#### AUTH-010 · 🔵 P3 · Auth → /signup validation
- **Problem:** Validation relies only on the browser's native `required`, `minLength` and `type=email` bubbles. Nothing is trimmed, so a password of 8 spaces passes the client. There's no inline guidance for "≥ 8 characters".
- **Evidence:** `src/app/(auth)/signup/page.tsx:55-71`.
- **Confidence:** Confirmed.

### 3.2 Launch gate

#### LAUNCH-001 · 🟠 P1 · Launch gate → "Let's do it!"
- **Problem:** The gate ignores an in-progress workout. Home and Splits both guard against this; the gate doesn't.
- **Repro:** Start a workout. Kill the PWA (or let iOS evict it) and reopen it. Standalone iOS reopens at `start_url` "/", sessionStorage is empty, so the gate shows "It's Push Day!". Tap "Let's do it!".
- **Expected:** "Resume workout", or straight back to the open session.
- **Actual:** A **second** in-progress session is created and the first one is orphaned.
- **Evidence:** `src/components/LaunchGate.tsx:57-60` (no `inProgress` check, compare `home/page.tsx:102-109`), `src/app/manifest.ts:15`.
- **Confidence:** Confirmed (code). The relaunch behaviour needs an iPhone to confirm.

#### LAUNCH-002 · 🟠 P1 · Launch gate → Loading
- **Problem:** While splits and history load, the gate renders an opaque full-screen black overlay with no spinner and no way out.
- **Repro:** A slow or stalled network on cold launch.
- **Actual:** A black screen for as long as the fetch hangs (no timeout, see AUTH-007). It looks like the app crashed.
- **Evidence:** `src/components/LaunchGate.tsx:50-55`.
- **Confidence:** Confirmed.

#### LAUNCH-003 · 🟡 P2 · Launch gate → Start failure
- **Problem:** `start()` awaits `mutateAsync` with no catch.
- **Actual:** On failure the button goes back to "Let's do it!" with no message (an unhandled promise rejection).
- **Evidence:** `src/components/LaunchGate.tsx:57-60`.
- **Confidence:** Confirmed.

### 3.3 Home / Today

#### HOME-001 · 🟠 P1 · Home → QR sheet
- **Problem:** The QR blob is re-fetched on every open (nothing is cached, and the URL is set to null on close). The placeholder text "No QR code uploaded yet" shows **while it loads and when it fails**.
- **Repro:** Open the QR sheet on poor or no signal, which is exactly where it's needed, at the gym door.
- **Expected:** The last known QR appears instantly and works offline.
- **Actual:** A misleading "No QR code uploaded yet". It flashes on every open even when the network is good.
- **Evidence:** `src/hooks/use-users.ts:10-42`, `src/app/(app)/home/page.tsx:56, 280-291`.
- **Confidence:** Confirmed.

#### HOME-002 · 🟡 P2 · Home / Splits → Start workout errors
- **Problem:** `start()` on Home and on Splits awaits `mutateAsync` with no catch.
- **Actual:** On failure nothing happens: the Choose-split sheet stays open, the buttons re-enable, and there's no message.
- **Evidence:** `src/app/(app)/home/page.tsx:102-114`, `src/app/(app)/splits/page.tsx:29-39`.
- **Confidence:** Confirmed.

#### HOME-003 · 🟡 P2 · Home → Recommended card
- **Problem:** "Start Push now" (▶) silently opens an unrelated in-progress workout if one exists.
- **Repro:** Leave a Legs workout unfinished, then tap ▶ on the recommended Push card.
- **Actual:** You land in the Legs session with no explanation.
- **Evidence:** `src/app/(app)/home/page.tsx:102-109, 157-159`.
- **Confidence:** Confirmed.

#### HOME-004 · 🟡 P2 · Home → Floating CTA overlap
- **Problem:** The CTA stack (88 px offset, a 56 px button and a 32 px gradient) reaches about 176 px plus the safe area, but `main` only reserves 104 px plus the safe area.
- **Actual:** The bottom of the page content, such as the "Last workout" card, sits under the CTA and gradient, worst on SE or mini-sized phones.
- **Evidence:** `src/app/(app)/home/page.tsx:244-265`, `src/app/(app)/layout.tsx:43`.
- **Confidence:** Highly likely.

#### HOME-005 · 🟡 P2 · Home → QR upload
- **Problem:** There's no type or size validation and no error message (`uploadQr.mutate` has no onError). The file input value is never reset, so re-picking the same file does nothing.
- **Evidence:** `src/app/(app)/home/page.tsx:293-306`.
- **Confidence:** Confirmed.

#### HOME-006 · 🔵 P3 · Home → Header date
- **Problem:** `today` is memoised with `[]`, so in a PWA left alive overnight the header still shows yesterday.
- **Evidence:** `src/app/(app)/home/page.tsx:58-66`.
- **Confidence:** Confirmed.

#### HOME-007 · 🔵 P3 · Home → In-progress detection
- **Problem:** `inProgress` is read from the cached history list (30 s stale, top 50 only). It can show "Choose split" while a workout is open on another device, or "Resume" a session that was already finished elsewhere.
- **Evidence:** `src/app/(app)/home/page.tsx:77`, `src/hooks/use-workouts.ts:6-11`.
- **Confidence:** Confirmed.

#### HOME-008 · ⚪ P4 · Home → Small polish
- **Problem:** "0 streak" shows for new users, and the flame pulses forever. While muscles load, the split summary shows raw `#12` ids.
- **Evidence:** `src/app/(app)/home/page.tsx:41, 386-422`.
- **Confidence:** Confirmed.

### 3.4 Splits

#### SPLIT-001 · 🟠 P1 · Splits → Edit → Delete split
- **Problem:** "Delete split" on the edit page deletes immediately with no confirmation (the list path does confirm). There's no pending state, and `mutateAsync` in `onClick` has no catch.
- **Repro:** Open a split's edit page and tap "Delete split" (or double-tap it).
- **Actual:** The split is gone with no undo. A double tap sends two DELETEs. Failures are silent.
- **Evidence:** `src/app/(app)/splits/[id]/edit/page.tsx:37-40`, `src/components/splits/SplitForm.tsx:103-106`.
- **Confidence:** Confirmed.

#### SPLIT-002 · 🟡 P2 · Splits → Swipe delete
- **Problem:** The delete isn't optimistic, has no pending state and no onError. The row stays until the refetch, and a failure is silent.
- **Evidence:** `src/app/(app)/splits/page.tsx:104-108`, `src/hooks/use-splits.ts:34-40`.
- **Confidence:** Confirmed.

#### SPLIT-003 · 🟡 P2 · Splits → Stepper typed values
- **Problem:** The Stepper's tap-to-type input uses `inputMode="decimal"` and `clamp` keeps two decimals, so `nr_of_exercises` can be 2.5. The backend expects an integer.
- **Actual:** You get the generic "Couldn't save this split" with no hint why. Typed 0 or negatives clamp silently.
- **Evidence:** `src/components/ui/Stepper.tsx:42-45, 96-100, 140`.
- **Confidence:** Highly likely (depends on backend validation).

#### SPLIT-004 · 🔵 P3 · Splits → Stepper on iOS
- **Problem:** Tap-to-type mounts an input with `autoFocus` after a state update, which is outside the user gesture. iOS focuses the input but doesn't raise the keyboard.
- **Evidence:** `src/components/ui/Stepper.tsx:87-89, 141`.
- **Confidence:** Requires iPhone.

#### SPLIT-005 · 🔵 P3 · Splits → Post-save navigation
- **Problem:** Create and save use `router.push("/splits")`, so Back returns to the stale form.
- **Evidence:** `src/app/(app)/splits/new/page.tsx:19`, `src/app/(app)/splits/[id]/edit/page.tsx:35`.
- **Confidence:** Confirmed.

#### SPLIT-006 · 🔵 P3 · Splits → Edit with stale cache
- **Problem:** `SplitForm` seeds `useState` once from the cached split. When the background refetch brings newer data, the form doesn't update, so saving overwrites the newer data.
- **Evidence:** `src/components/splits/SplitForm.tsx:25-28`.
- **Confidence:** Confirmed.

#### SPLIT-007 · 🔵 P3 · Splits → Deleting a referenced split
- **Problem:** There's no warning when the split has history or an open workout. Afterwards the workout bar says "Ad-hoc workout" and history rows say "Workout".
- **Evidence:** `workout/[sessionId]/page.tsx:513`, `history/page.tsx:107-109`.
- **Confidence:** Confirmed.

#### SPLIT-008 · ⚪ P4 · Splits → PUT wipes `pic`
- **Problem:** Every save sends `pic: null`.
- **Evidence:** `src/components/splits/SplitForm.tsx:51`.
- **Confidence:** Confirmed.

#### SPLIT-009 · 🔵 P3 · Splits → Start before history loads
- **Problem:** The in-progress guard reads `history`, which may still be undefined, so it falls through and creates a duplicate workout.
- **Evidence:** `src/app/(app)/splits/page.tsx:31`.
- **Confidence:** Confirmed.

### 3.5 Exercise detail

#### EX-001 · 🟡 P2 · Exercise → Edit → Rest time
- **Problem:** An empty field gives `Number("") === 0`, which passes validation, so 0 s is saved silently. Decimals are accepted too. The error text says "positive" but 0 is allowed. Together with WORKOUT-037, the timer then chimes the moment a set is ticked.
- **Evidence:** `src/app/(app)/exercises/[id]/page.tsx:295-299`.
- **Confidence:** Confirmed.

#### EX-002 · 🟡 P2 · Exercise → Favourite
- **Problem:** The favourite state comes only from localStorage and ignores `Exercise.favourite` from the API.
- **Actual:** It's wrong on a new device, after reinstalling or clearing data, and for another user on the same device. Toggling it may POST favourites the server already has.
- **Evidence:** `src/hooks/use-favorites.ts:31-97`, `src/types/index.ts:37`.
- **Confidence:** Highly likely.

#### EX-003 · 🟡 P2 · Exercise → Error and not-found states
- **Problem:** A history fetch error renders "No logs yet". An unknown exercise id keeps the title "Exercise" forever, with no not-found state.
- **Evidence:** `src/app/(app)/exercises/[id]/page.tsx:34-37, 134-141`.
- **Confidence:** Confirmed.

#### EX-004 · 🟡 P2 · Exercise → Stats accuracy
- **Problem:** PR, volume and the set count include every history set, including warm-ups and **never-completed** sets. Those are common because "Add set" copies values forward, and the mock history endpoint returns uncompleted sets. Bodyweight and timer exercises show "0 kg" PRs and "0 kg × 12" rows. Negative (assisted) weights display as positive.
- **Evidence:** `src/app/(app)/exercises/[id]/page.tsx:41-61, 218`; `src/lib/mock/handlers.ts:146-170`.
- **Confidence:** Highly likely (depends on what the real backend returns).

#### EX-005 · 🔵 P3 · Exercise → Back button
- **Problem:** `back={true}` calls `router.back()`. On a deep link or after a reload, Back does nothing or leaves the app.
- **Evidence:** `src/components/ui/LargeTitle.tsx:38-41`, `exercises/[id]/page.tsx:68`.
- **Confidence:** Confirmed.

#### EX-006 · 🔵 P3 · Exercise → Shared catalog edits
- **Problem:** Edits change the global exercise for every user, as the code comment acknowledges. Any user can rename or retarget exercises for everyone.
- **Evidence:** `src/app/(app)/exercises/[id]/page.tsx:249-252`.
- **Confidence:** Suspected (backend policy).

#### EX-007 · 🔵 P3 · Exercise → Edit sheet and keyboard
- **Problem:** The sheet is fixed and capped at 88 % with the body scroll locked. With the iOS keyboard up, the lower fields and the Save button can sit behind it.
- **Evidence:** `src/components/ui/Sheet.tsx:97-117`.
- **Confidence:** Requires iPhone.

### 3.6 Workout screen (`/workout/[sessionId]`), highest priority

#### WORKOUT-001 · 🔴 P0 · Workout → Optimistic mutation model
- **Problem:** Every set and exercise mutation does three things: it snapshots the **whole session** in `onMutate`, rolls back to **that snapshot** on error, and invalidates and refetches the session in `onSettled`. With overlapping mutations, all of these fight each other.
  - A rollback restores a snapshot taken before other in-flight edits, wiping them from the UI even if they saved.
  - A refetch triggered when mutation A settles can return before mutation B has committed on the server, so B's optimistic value reverts on screen and then flips back on the next refetch. You see flicker, checkmarks un-ticking, or typed weights reverting.
  - `refetchOnWindowFocus` (the default) adds a refetch every time you come back to the app.
- **Repro (slow 3G throttle):** Type a weight on set 1, tap ✓ on set 1, tap "Add set", and cycle set 2's type, all within about 1 s.
- **Expected:** Every change stays put and the server ends in the same state.
- **Actual:** Values and ticks visibly revert and re-apply. A failure in one request rolls back unrelated edits.
- **Cause:** No per-entity merge or rollback, no mutation queue or scope, and an invalidate per mutation.
- **Evidence:** `src/hooks/use-workout-session.ts:6-8, 119-149, 169-200`; `src/app/providers.tsx:11-15`.
- **Confidence:** Highly likely.

#### WORKOUT-002 · 🔴 P0 · Workout → Out-of-order writes
- **Problem:** Each tap fires an independent PATCH: set-type cycling, ✓/un-✓, every keypad commit, copy-previous. There's no per-set serialisation, so the server applies them in arrival order. `usePatchSets` also sends N requests in parallel with `Promise.all`.
- **Repro (cellular):** Cycle a set's type 4 times quickly, or tick and un-tick a set.
- **Actual:** The server can end in a state the UI never showed. After the refetch the type "jumps", or a set that showed ✓ is saved as not completed, so it's missing from the summary, history, volume and PRs.
- **Evidence:** `src/components/workout/SetRow.tsx:290-300, 335-352`; `src/hooks/use-workout-session.ts:173-174`.
- **Confidence:** Highly likely.

#### WORKOUT-003 · 🟠 P1 · Workout → Set completion toggle
- **Problem:** ✓ is a pure toggle with no guard against repeats.
- **Repro:** Double-tap ✓, or tap it 10 times.
- **Actual:** A double tap un-completes the set. Every completion restarts the rest timer, vibrates, re-celebrates and calls `markExerciseTrained`. Ten taps send ten PATCHes, which feeds WORKOUT-002.
- **Evidence:** `src/components/workout/SetRow.tsx:335-352`; `workout/[sessionId]/page.tsx:460-478`.
- **Confidence:** Confirmed.

#### WORKOUT-004 · 🔴 P0 · Workout → Remove exercise
- **Problem:** The ✕ in the action pill on the card video deletes the exercise and all of its logged sets on a single tap, with no confirmation and no undo. It sits next to the swap and drag buttons. The delete isn't optimistic and has no pending state, so a second tap sends a duplicate DELETE, which 404s and shows an error toast.
- **Repro:** Reach for the drag handle or swap and catch ✕ instead.
- **Evidence:** `src/components/workout/ExerciseCard.tsx:190-204`; `src/hooks/use-workout-session.ts:85-92`; `page.tsx:618`.
- **Confidence:** Confirmed.

#### WORKOUT-005 · 🟠 P1 · Workout → Swap exercise
- **Problem:** Swapping clears every set, completed ones included (on the server too: `we.sets = []` in the mock), with no confirmation.
- **Evidence:** `src/hooks/use-workout-session.ts:63-76`; `src/lib/mock/handlers.ts:403-415`; `ExerciseCard.tsx:172-189`.
- **Confidence:** Confirmed.

#### WORKOUT-006 · 🟠 P1 · Workout → Load errors
- **Problem:** The page has no error state. `isLoading || !session` covers errors too.
- **Repro:** Open a discarded or deleted session through a stale "Resume" (see AUTH-001 / HOME-007) or an old link, or open it while offline.
- **Actual:** Three skeleton blocks forever. The session bar (the only back button) isn't rendered and the tab bar is hidden on this route, so in standalone mode **you're stuck**.
- **Evidence:** `src/app/(app)/workout/[sessionId]/page.tsx:500-511`; `src/app/(app)/layout.tsx:27, 48`.
- **Confidence:** Confirmed.

#### WORKOUT-007 · 🟠 P1 · Workout → Finish
- **Problem:** `finish()` awaits `mutateAsync` with no catch. Finish doesn't wait for pending set PATCHes. The summary is built from the local optimistic snapshot.
- **Actual:** On a network failure Finish silently does nothing. If a set PATCH fails after the summary opens, the error toast (z-40) is hidden under the summary (z-50), so the summary shows data the server never saved.
- **Evidence:** `src/app/(app)/workout/[sessionId]/page.tsx:481-486, 658-667, 693-700`.
- **Confidence:** Confirmed.

#### WORKOUT-008 · 🟠 P1 · Workout → First-set autofill race
- **Problem:** "Log first set" POSTs the set, then fetches exercise history, then **unconditionally** PATCHes weight, reps and RIR from last time.
- **Repro (slow network):** Tap "Log first set", then type 100 kg or tick ✓ before the history request returns.
- **Actual:** Your input is overwritten with last session's numbers. It can even change a set that's already completed.
- **Evidence:** `src/app/(app)/workout/[sessionId]/page.tsx:406-419`.
- **Confidence:** Highly likely.

#### WORKOUT-009 · 🟠 P1 · Workout → Keypad draft persistence
- **Problem:** A draft is only committed when you tap somewhere else (`pointerdown`). Nothing commits it on `visibilitychange`, `pagehide` or unmount.
- **Repro:** Type "102.5" and lock the phone or switch apps. iOS evicts the PWA.
- **Actual:** The value is lost.
- **Evidence:** `src/components/workout/NumericKeypad.tsx:67-79, 110-118`.
- **Confidence:** Confirmed (the eviction part needs an iPhone).

#### WORKOUT-010 · 🟡 P2 · Workout → Keypad accepts decimals for reps and seconds
- **Problem:** The "." key is always enabled, so reps can be "8.5".
- **Actual:** If the backend validates integers, the PATCH fails, the edit rolls back and an error toast appears.
- **Evidence:** `src/components/workout/NumericKeypad.tsx:44`, `SetRow.tsx:132-150, 325-333`.
- **Confidence:** Suspected (backend).

#### WORKOUT-011 · 🟡 P2 · Workout → No-op commits
- **Problem:** Opening and closing a field PATCHes even when nothing changed. An empty field PATCHes null.
- **Actual:** Extra requests widen the race window in WORKOUT-001 and WORKOUT-002.
- **Evidence:** `src/components/workout/SetRow.tsx:120-130`.
- **Confidence:** Confirmed.

#### WORKOUT-012 · 🟡 P2 · Workout → Keypad vs scrolling
- **Problem:** Any `pointerdown` outside the keypad closes it, including the start of a scroll gesture. The body `paddingBottom` added "so you can scroll lower sets above the keypad" can never be used. When the keypad closes, the padding is removed, which shrinks the page and makes it jump near the bottom.
- **Evidence:** `src/components/workout/NumericKeypad.tsx:91-99, 110-118`.
- **Confidence:** Confirmed.

#### WORKOUT-013 · 🟡 P2 · Workout → Keypad stale closures
- **Problem:** `keypad.open()` captures `onCommit` from the render in which the field opened, so the commit runs `handleChangeSet(we, …)` with the `we` from that moment. Sets added, or optimistic-to-real id swaps, after the field opened are ignored by the forward-fill.
- **Evidence:** `src/components/workout/SetRow.tsx:162-167`; `page.tsx:437-458`.
- **Confidence:** Confirmed.

#### WORKOUT-014 · 🟡 P2 · Workout → Forward-fill edge cases
- **Problem:** Forward-fill writes into later sets **even if they're already completed**, as long as that field is null. The live mirror previews values on unsaved (optimistic) sets, but the commit skips them, so the preview value appears and then disappears.
- **Evidence:** `page.tsx:441-456`; `ExerciseCard.tsx:72-79`.
- **Confidence:** Confirmed.

#### WORKOUT-015 · 🟡 P2 · Workout → Exercise focus and dimming
- **Problem:** Exactly one id is focused at a time, but it's often the wrong one.
  - (a) Auto-advance to the last card: `scrollIntoView({block:"center"})` can't centre it at the bottom of the page, and the scroll-spy then hands focus back to the previous card.
  - (b) Opening the keypad calls `scrollBy`, the scroll-spy refocuses, and the card you're editing dims.
  - (c) Smooth scrolls pass over intermediate cards, so focus flickers through them.
  - (d) The centre maths hard-codes the 56 px bar and ignores `safe-area-inset-top` (about 59 px), which biases the result.
  - (e) Reorder layout-animation transforms skew `getBoundingClientRect`.
- **Evidence:** `page.tsx:271-301 (278), 315-332`; `NumericKeypad.tsx:101-108`.
- **Confidence:** Highly likely.

#### WORKOUT-016 · 🟡 P2 · Workout → Reorder persistence
- **Problem:** Exercises added during the session are keyed by their **optimistic id** for the rest of the page's life (`exerciseKeyAlias`), and that key is what `saveOrder` stores. The alias map lives in memory only.
- **Actual:** After a reload or PWA relaunch the saved keys don't match, and every exercise added during the session falls back to the end in server order. So the local-only reorder, a known gap, is also broken locally.
- **Evidence:** `page.tsx:41-50, 180-205`; `use-workout-session.ts:17-18`.
- **Confidence:** Confirmed.

#### WORKOUT-017 · 🟡 P2 · Workout → Exercise videos blank
- **Problem:** `MediaThumb`'s IntersectionObserver effect depends only on `[wantsMotion]`. When the `<video>` element appears after the first render, the observer never attaches. That happens when the session loads before `/exercises` (on cold load or reload), when you swap from an image exercise to a video one, or when the view moves from the fallback letter to video. With `preload="none"` the video never loads, so the box stays empty grey. `failed` also isn't reset when `src` changes, so swapping away from broken media keeps showing the fallback letter.
- **Evidence:** `src/components/ui/MediaThumb.tsx:44, 54-73, 103`.
- **Confidence:** Highly likely.

#### WORKOUT-018 · 🟡 P2 · Workout → Videos under Reduced Motion or Low Power Mode
- **Problem:** With Reduced Motion the observer is skipped and there's no poster, so with `preload="none"` nothing ever shows. iOS Low Power Mode blocks autoplay, `play()` rejects silently, and the box stays blank. `thumbnail_url` is never used as a poster.
- **Evidence:** `src/components/ui/MediaThumb.tsx:47, 56, 93-113`.
- **Confidence:** Confirmed for Reduced Motion. Requires iPhone for Low Power Mode.

#### WORKOUT-019 · 🟡 P2 · Workout → Delete set and remove exercise feedback
- **Problem:** Both are non-optimistic with no pending state. The swiped row springs closed and stays visible until the refetch, so users delete again, the second DELETE 404s, and an error toast appears. Deleted middle sets leave permanent numbering gaps (1, 3, 4).
- **Evidence:** `use-workout-session.ts:85-92, 202-208`; `SwipeRow.tsx:128-132`.
- **Confidence:** Confirmed.

#### WORKOUT-020 · 🟡 P2 · Workout → Add set under latency
- **Problem:** The per-exercise guard holds for the whole POST round trip, so extra taps are dropped rather than queued (3 taps on a slow network give 1 set). New rows have `pointer-events:none` and 70 % opacity until saved.
- **Evidence:** `page.tsx:373-384`; `SetRow.tsx:277, 285`; `ExerciseCard.tsx:336`.
- **Confidence:** Confirmed.

#### WORKOUT-021 · 🟡 P2 · Workout → Per-second full re-render
- **Problem:** `now` state at the page root ticks every second and re-renders every ExerciseCard, SetRow, Reorder item and SwipeRow. Inline closures defeat any memoisation. This causes jank while scrolling or typing on older iPhones.
- **Evidence:** `page.tsx:96, 111-114, 604-639`.
- **Confidence:** Confirmed.

#### WORKOUT-022 · 🟡 P2 · Workout → 3-hour auto-end
- **Problem:** At 3 h the workout auto-completes and redirects to history, even while you're actively logging (a long leg day, or chatting between sets). There's no warning. The end time is set to the last *completed* set. If the PATCH fails, the `autoEnded` ref blocks any retry and nothing tells you.
- **Evidence:** `page.tsx:122-133`; `src/lib/format.ts:78-90`.
- **Confidence:** Confirmed.

#### WORKOUT-023 · 🟡 P2 · Workout → Navigation away and back
- **Problem:** The back button uses `router.push("/home")` rather than going back. Going to exercise detail and back lands at the top of the workout, because the layout scrolls to the top on every pathname change.
- **Evidence:** `page.tsx:522`; `src/app/(app)/layout.tsx:19-21`.
- **Confidence:** Confirmed.

#### WORKOUT-024 · 🟡 P2 · Workout → Discard
- **Problem:** Discard uses `window.confirm`, which looks non-native and blocks. It navigates first and deletes second. If the DELETE fails, nothing is shown and the workout reappears as "Resume". The `overload_exercise_order_<id>` key and the rest timer are left behind.
- **Evidence:** `page.tsx:488-498`; `use-workouts.ts:47-60`.
- **Confidence:** Confirmed.

#### WORKOUT-025 · 🔵 P3 · Workout → Superset ungroup
- **Problem:** No confirmation, no pending state and no onError. (Known gap: there's no UI to create supersets.)
- **Evidence:** `page.tsx:632`; `SupersetGroup.tsx:22-29`.
- **Confidence:** Confirmed.

#### WORKOUT-026 · 🟡 P2 · Workout → Completing an empty set
- **Problem:** With no previous values, ✓ marks the set complete with null weight and reps. It counts in "Sets" and shows green "Not logged" in history.
- **Evidence:** `SetRow.tsx:337-351`; `format.ts:160-181`.
- **Confidence:** Confirmed.

#### WORKOUT-027 · 🔵 P3 · Workout → Side effects before confirmation
- **Problem:** The rest timer, celebration and auto-favourite fire before the completion PATCH succeeds. If it fails, the tick rolls back but the timer keeps running and the favourite stays.
- **Evidence:** `page.tsx:460-471`.
- **Confidence:** Confirmed.

#### WORKOUT-028 · 🔵 P3 · Workout → Duplicate exercises
- **Problem:** The picker gives no "already in workout" indicator, so the same exercise is easy to add twice.
- **Evidence:** `ExercisePicker.tsx:111-126`.
- **Confidence:** Confirmed.

#### WORKOUT-029 · 🟡 P2 · Workout → Error toast UX
- **Problem:** A single 4 s toast at the top with no retry and no dismiss. It shows raw messages (AUTH-008) and is hidden under the summary. A newer error replaces an older one.
- **Evidence:** `page.tsx:100-110, 658-667`.
- **Confidence:** Confirmed.

#### WORKOUT-030 · ⚪ P4 · Workout → Checkmark pulse
- **Problem:** `animate={{scale:[1,1.3,1]}}` runs on mount for every completed set (page load, coming back from detail) and on every refetch flip.
- **Evidence:** `SetRow.tsx:359`.
- **Confidence:** Confirmed.

#### WORKOUT-031 · 🔵 P3 · Workout → Copy previous
- **Problem:** The small "Previous" text is a button that overwrites typed weight and reps with one stray tap, with no undo.
- **Evidence:** `SetRow.tsx:269-272, 302-310`.
- **Confidence:** Confirmed.

#### WORKOUT-032 · 🔵 P3 · Workout → Finishing with nothing logged
- **Problem:** Finish with zero exercises, zero completed sets, or incomplete sets goes through without a prompt, which creates empty history entries.
- **Evidence:** `page.tsx:481-486`.
- **Confidence:** Confirmed.

#### WORKOUT-033 · 🔵 P3 · Workout → Summary lost on reload
- **Problem:** The summary exists only in component state. A reload redirects to the history page.
- **Evidence:** `page.tsx:95, 130-133`.
- **Confidence:** Confirmed.

#### WORKOUT-034 · 🔵 P3 · Workout → PR detection
- **Problem:** PRs compare weight only. Warm-ups and incomplete prior sets count, which can understate PRs. Assisted ("negative") exercises are inverted. The summary's `["exercise-history", id]` query (limit 50) shares its key with ExerciseCard's unbounded query, so whichever is cached first wins.
- **Evidence:** `WorkoutSummary.tsx:66-104`; `ExerciseCard.tsx:83`.
- **Confidence:** Confirmed.

#### WORKOUT-035 · 🔵 P3 · Workout → Volume
- **Problem:** Assisted weight is counted as load. Bodyweight sets contribute 0.
- **Evidence:** `format.ts:160-181`.
- **Confidence:** Confirmed.

#### WORKOUT-036 · 🔵 P3 · Workout → Swap picker isn't filtered
- **Problem:** `allowedMuscleIds` only reorders the muscle circles. The swap picker opens unfiltered and with no muscle preselected.
- **Evidence:** `ExercisePicker.tsx:94-126`; `page.tsx:684-690`.
- **Confidence:** Confirmed.

#### WORKOUT-037 · 🟡 P2 · Workout → Zero rest time
- **Problem:** `rest_time: 0` sets `endAt = now`, `remaining` is 0, and `ring()` fires immediately (chime plus vibration) on every tick.
- **Evidence:** `RestTimer.tsx:118-123, 164-175`.
- **Confidence:** Confirmed.

#### WORKOUT-038 · 🔵 P3 · Workout → Drag to reorder on iPhone
- **Problem:** Cards are tall (176 px video plus sets), so dragging past the viewport depends on Framer's Reorder auto-scroll. Starting from the 40 px handle inside the overlay pill next to ✕ invites mis-taps (WORKOUT-004).
- **Evidence:** `page.tsx:711-725`; `ExerciseCard.tsx:154-171`.
- **Confidence:** Requires iPhone.

#### WORKOUT-039 · 🔵 P3 · Workout → Duplicate `set_number`
- **Problem:** Sets added concurrently from two tabs or devices, or via a race, can share a `set_number`. History lists use `key={set_number}`, which causes React key collisions.
- **Evidence:** `exercises/[id]/page.tsx:209`; `page.tsx:389`.
- **Confidence:** Suspected.

### 3.7 Rest timer

#### REST-001 · 🟡 P2 · Rest timer → Global persistence
- **Problem:** `overload_rest_timer` is a single global key, not per session or per user. It survives Finish, Discard and logout, so the next workout (or the next user) opens with a leftover countdown that can still ring.
- **Evidence:** `RestTimer.tsx:12, 105-116`.
- **Confidence:** Confirmed.

#### REST-002 · 🟡 P2 · Rest timer → Background or locked phone
- **Problem:** The end is only signalled by in-page JS, and `ring()` only fires within 5 s of the end. With the phone locked or the PWA in the background (the normal state between sets), there's no sound, vibration or notification, and it stays silent when you come back.
- **Evidence:** `RestTimer.tsx:164-175`.
- **Confidence:** Requires iPhone (the logic itself is confirmed).

#### REST-003 · 🟡 P2 · Rest timer → Audio unlock happens once
- **Problem:** The AudioContext is unlocked on the first `pointerdown` only (`once: true`). iOS suspends or interrupts it on background or lock, and nothing resumes it, so the chime stops working for the rest of the workout.
- **Evidence:** `RestTimer.tsx:41-58, 100-104`.
- **Confidence:** Requires iPhone.

#### REST-004 · ⚪ P4 · Rest timer → Ring wind-up
- **Problem:** The `stroke-dashoffset 1s linear` transition animates from the previous value when the timer restarts.
- **Evidence:** `RestTimer.tsx:229`.
- **Confidence:** Confirmed.

### 3.8 Add-exercise picker

#### PICK-001 · 🟡 P2 · Picker → Long-press preview on iOS
- **Problem:** After the 450 ms long-press the preview overlay appears under the finger. If iOS hit-tests the synthesised click at touchend, the click lands on the preview's scrim (whose `onClose` fires), so the preview closes the moment you lift your finger.
- **Evidence:** `ExercisePicker.tsx:174-215, 456-465`.
- **Confidence:** Requires iPhone (Suspected).

#### PICK-002 · 🔵 P3 · Picker → Dead error path
- **Problem:** `onSelect` returns before the mutation finishes (fire-and-forget), so `addError` and the ✓ "adding" state never show a real failure. Errors surface on the workout toast instead.
- **Evidence:** `ExercisePicker.tsx:128-155`; `page.tsx:334-353`.
- **Confidence:** Confirmed.

#### PICK-003 · 🔵 P3 · Picker → Renders the whole catalog
- **Problem:** No virtualisation, and every row is an `<img>` without `loading="lazy"`, so all thumbnails are requested on open.
- **Evidence:** `ExercisePicker.tsx:401-407, 223-232`; `MediaThumb.tsx:119-128`.
- **Confidence:** Confirmed.

#### PICK-004 · 🔵 P3 · Picker → Equipment filter
- **Problem:** The filter matches on the exercise *name* and ignores the `equipment` field.
- **Evidence:** `ExercisePicker.tsx:117-118`.
- **Confidence:** Confirmed.

#### PICK-005 · 🔵 P3 · Picker → 204 from `/last-set`
- **Problem:** `apiRequest` returns `undefined` on a 204. React Query v5 treats undefined data as an error ("Query data cannot be undefined"), retries once and logs a console error.
- **Evidence:** `client.ts:96-98`; `mock/handlers.ts:190`; `use-exercises.ts:25-31`.
- **Confidence:** Confirmed (mock). The real API may differ.

#### PICK-006 · ⚪ P4 · Picker → Small issues
- **Problem:** Escape closes the preview and the sheet together. The muscle-strip skeleton is tied to *exercises* loading, so a muscles error shows an empty strip.
- **Evidence:** `ExercisePicker.tsx:320, 442-449`; `Sheet.tsx:84-91`.
- **Confidence:** Confirmed.

### 3.9 Sheets, gestures, scrolling, layout (cross-cutting)

#### UI-001 · 🟡 P2 · Sheet → Exit swallows input
- **Problem:** During the exit animation (about 300–400 ms) the `fixed inset-0 z-50` wrapper stays mounted with no `pointer-events:none`.
- **Repro:** Close any sheet, then immediately scroll or tap.
- **Actual:** The first gesture does nothing.
- **Evidence:** `src/components/ui/Sheet.tsx:96-99`.
- **Confidence:** Confirmed.

#### UI-002 · 🟡 P2 · Sheet → Drag area
- **Problem:** Drag-to-dismiss only starts from a grabber about 16 px tall. The header isn't draggable, and pulling down when the content is at scroll-top doesn't dismiss. That doesn't feel native.
- **Evidence:** `Sheet.tsx:145-150`.
- **Confidence:** Confirmed.

#### UI-003 · 🟡 P2 · Sheet → iOS scroll lock
- **Problem:** The lock is only `body { overflow:hidden }`. iOS Safari can still scroll or rubber-band the page behind via touches on the scrim, and there's no `position:fixed` lock.
- **Evidence:** `Sheet.tsx:24-30`.
- **Confidence:** Requires iPhone.

#### UI-004 · 🔵 P3 · Dialogs → Accessibility
- **Problem:** No focus move, focus trap or focus return in the Sheet or the preview dialog. The background stays reachable by screen readers. Interactive `<div>`s include the drag grabber and the scrims.
- **Evidence:** `Sheet.tsx`, `ExercisePicker.tsx:453-543`.
- **Confidence:** Confirmed.

#### UI-005 · 🔵 P3 · Dialogs → Back with a sheet open
- **Problem:** Browser or OS back navigates the page instead of closing the sheet.
- **Evidence:** `Sheet.tsx` (no history entry).
- **Confidence:** Confirmed.

#### UI-006 · 🟡 P2 · SwipeRow → Gesture handling
- **Problem:**
  - No `touch-action: pan-y`.
  - The direction is re-derived from the cumulative delta on every move, so diagonal drags jitter and can leave the row half-open mid-gesture.
  - Tapping inside an *open* row triggers the content (navigates in History, opens the keypad on a shifted set row) instead of closing it.
  - `trackMouse` lets desktop drags click links.
  - Every row adds a document listener.
- **Evidence:** `src/components/ui/SwipeRow.tsx:64-99, 146-152`.
- **Confidence:** Highly likely.

#### UI-007 · 🟡 P2 · Layout → Scroll reset on every navigation
- **Problem:** `useLayoutEffect(() => scrollTo(0))` runs on every pathname change. Back from a history detail lands at the top of a long history list, and back from exercise detail lands at the top of the workout.
- **Evidence:** `src/app/(app)/layout.tsx:19-21`.
- **Confidence:** Confirmed.

#### UI-008 · 🟡 P2 · iOS → Status bar in Light theme
- **Problem:** `statusBarStyle: "black-translucent"` always draws white status-bar text. In Light theme the time and battery are white on white.
- **Evidence:** `src/app/layout.tsx:36-40`.
- **Confidence:** Requires iPhone (well-known iOS behaviour).

#### UI-009 · 🔵 P3 · iOS → Callouts and text selection
- **Problem:** Selection and callouts are only disabled on media and picker rows. A long-press on the exercise name `<Link>` in a card opens the iOS link preview, and long-presses on rows select text.
- **Evidence:** `ExerciseCard.tsx:227-232`; `globals.css` (no global `user-select`).
- **Confidence:** Requires iPhone.

#### UI-010 · 🔵 P3 · iOS → Double-tap
- **Problem:** There's no `touch-action: manipulation`. Rapid keypad or stepper taps may be treated as a double-tap zoom or merged into one.
- **Evidence:** `globals.css`; `NumericKeypad.tsx:143-155`.
- **Confidence:** Requires iPhone.

#### UI-011 · 🔵 P3 · Layout → Long names
- **Problem:** Long names without spaces overflow horizontally in the `LargeTitle` h1, the LaunchGate "It's {name}!" (uppercase stat font) and the Summary title, which have no `break-words` or truncation.
- **Evidence:** `LargeTitle.tsx:99`; `LaunchGate.tsx:97-99`; `WorkoutSummary.tsx:123-125`.
- **Confidence:** Confirmed.

#### UI-012 · ⚪ P4 · Layout → Tap targets under 44 px
- **Problem:** The theme segmented control (32 px), the session-bar back and discard (36 px), the Home QR and new-split header buttons (36 px), the membership trash (36 px), the "Remove" avatar link and the "Copy previous" text are all under 44 px.
- **Evidence:** `profile/page.tsx:160, 344`; `workout page:525, 550`.
- **Confidence:** Confirmed.

#### UI-013 · 🔵 P3 · Layout → Remount on every navigation
- **Problem:** `motion.main key={pathname}` remounts the page with a fade on every navigation, which replays stagger animations and skeletons and adds layout shift.
- **Evidence:** `src/app/(app)/layout.tsx:32-36`.
- **Confidence:** Confirmed.

### 3.10 State, cache and history

#### STATE-001 · 🟡 P2 · History → 50-session cap
- **Problem:** `GET /workouts?limit=50` with no pagination. Workout 51 and older are unreachable. "N workouts logged" and the streak are capped by the 50.
- **Evidence:** `src/hooks/use-workouts.ts:6-11`; `history/page.tsx:48`.
- **Confidence:** Confirmed.

#### STATE-002 · 🟡 P2 · History → Swipe delete
- **Problem:** The optimistic removal has no rollback or error message: the row reappears silently on failure. There's no confirmation, so one swipe and tap irreversibly deletes a whole workout.
- **Evidence:** `history/page.tsx:97`; `use-workouts.ts:47-60`.
- **Confidence:** Confirmed.

#### STATE-003 · 🟡 P2 · History detail → No error state
- **Problem:** A missing or deleted session, or a network error, gives an endless skeleton.
- **Evidence:** `history/[sessionId]/page.tsx:95-99`.
- **Confidence:** Confirmed.

#### STATE-004 · 🔵 P3 · Memory → Alias maps
- **Problem:** `setKeyAlias` and `exerciseKeyAlias` are module-level Maps that are never cleared, so they grow across workouts until reload.
- **Evidence:** `use-workout-session.ts:17-18`.
- **Confidence:** Confirmed.

#### STATE-005 · 🔵 P3 · localStorage → Robustness
- **Problem:**
  - No key is namespaced per user.
  - `overload_exercise_order_<sessionId>` is written per session and never deleted.
  - JSON reads aren't shape-checked: a non-array `overload_favorites` makes `.includes` throw in the picker or favourites.
  - `setItem` calls are unguarded in `persist()` (login), `writeStored`, `saveOrder` and `writeFavoriteIds`. When storage is unavailable or full, login or set completion throws.
- **Evidence:** `use-favorites.ts:31-43`; `page.tsx:57-69`; `RestTimer.tsx:32-34`; `use-auth.ts:73-82`.
- **Confidence:** Confirmed.

### 3.11 Profile

#### PROF-001 · 🟡 P2 · Profile → Membership date uses UTC
- **Problem:** `todayInputValue()` uses `toISOString()` (UTC) for both the default and `max`. Ahead of UTC (Europe) in the early hours you can't pick your local "today". Behind UTC in the evening, the default is tomorrow.
- **Evidence:** `profile/page.tsx:226-228, 357-360`.
- **Confidence:** Confirmed.

#### PROF-002 · 🟡 P2 · Profile → Avatar
- **Problem:** A wrong type or a file over 5 MB is silently ignored. Upload and remove errors are silent. There's no progress indicator during upload.
- **Evidence:** `profile/page.tsx:64-71, 130`.
- **Confidence:** Confirmed.

#### PROF-003 · 🟡 P2 · Profile → Membership
- **Problem:** The trash icon deletes the payment record in one tap with no confirmation. Log and delete errors are silent. A query error renders "No payment logged".
- **Evidence:** `profile/page.tsx:268-271, 279-294, 339-347`.
- **Confidence:** Confirmed.

#### PROF-004 · 🔵 P3 · Profile → Expiry date parsing
- **Problem:** `daysUntil` assumes a bare `YYYY-MM-DD`. If the real API sends a full ISO datetime, the screen shows "NaN days left".
- **Evidence:** `format.ts:123-127`.
- **Confidence:** Suspected.

#### PROF-005 · ⚪ P4 · Theme → Flashes
- **Problem:** The segmented control renders "Auto" selected for the first frame, then flips to the stored value. The manifest's `background_color` and `theme_color` are #000, so a Light-theme user gets a black splash and then a white flash. (Known gap: Auto resolves to dark, confirmed.)
- **Evidence:** `ThemeProvider.tsx:73-82`; `manifest.ts:19-20`.
- **Confidence:** Confirmed.

### 3.12 PWA lifecycle, performance, build

#### PWA-001 · 🟠 P1 · Boot → Mock build black screen
- **Problem:** With `NEXT_PUBLIC_USE_MOCKS=true` (as `.env.local` sets it), `Providers` renders `null` until MSW starts, and it never handles a rejection. If service-worker registration fails (private browsing, SW disabled, storage evicted, some webviews), the screen is black forever.
- **Evidence:** `src/app/providers.tsx:18-31, 41`.
- **Confidence:** **Confirmed live** (black screen plus "[MSW] Failed to register the Service Worker" during this audit).

#### PWA-002 · 🟠 P1 · PWA → No offline support
- **Problem:** There's no app service worker or app-shell cache, and React Query isn't persisted.
- **Actual:** Cold-launching with no signal (a basement gym) shows Safari's offline page. The workout, the QR and history are all unavailable. If the app is killed with unsynced mutations in flight, they're lost.
- **Evidence:** `public/` (only `mockServiceWorker.js`), `next.config.ts`, `providers.tsx`.
- **Confidence:** Confirmed (the iOS outcome needs an iPhone).

#### PWA-003 · 🟠 P1 · Perf/Data → VideoPrefetcher
- **Problem:** Once per app session it downloads **every** exercise video and thumbnail, four at a time, right after login. The cellular check uses `navigator.connection`, which Safari doesn't have, so on iPhone it always runs, including on cellular. That competes with API calls at the gym. Safari's `<video>` uses range requests, which often can't reuse a full `fetch()` cache entry, so the download may be wasted entirely. The hook dependency on `muscles` is missing.
- **Evidence:** `src/components/VideoPrefetcher.tsx:18-21, 51-79`.
- **Confidence:** Highly likely.

#### PWA-004 · 🟡 P2 · iOS → No haptics at all
- **Problem:** iOS Safari has no `navigator.vibrate`. All haptic feedback (completion, rest end, picker) is silently absent on the target device.
- **Evidence:** `SetRow.tsx:230`; `RestTimer.tsx:55`; `ExercisePicker.tsx:136`.
- **Confidence:** Confirmed (platform).

#### PWA-005 · 🔵 P3 · Boot → Blank frames
- **Problem:** Providers render `null` until mocks are ready, then AppLayout renders `null` until the auth effect runs, then the gate shows a black overlay. That's three blank phases before any content.
- **Evidence:** `providers.tsx:41`; `(app)/layout.tsx:23`; `LaunchGate.tsx:50-55`.
- **Confidence:** Confirmed.

#### PERF-001 · 🔵 P3 · Workout → Unbounded history per card
- **Problem:** Each ExerciseCard fetches the full, unlimited exercise history: N requests with unbounded payloads every time the workout opens.
- **Evidence:** `ExerciseCard.tsx:83`; `use-exercises.ts:17-23`.
- **Confidence:** Confirmed.

#### PERF-002 · 🔵 P3 · Workout → Layout animations vs the scroll-spy
- **Problem:** Reorder.Item layout animations run on every height change. On every scroll frame the scroll-spy calls `getBoundingClientRect` on all cards, forcing layout during the animations.
- **Evidence:** `page.tsx:271-301, 721`.
- **Confidence:** Highly likely.

#### PERF-003 · ⚪ P4 · Perf → Always-running effects
- **Problem:** The streak flame pulses forever, and the auth background animates an 85vmax `blur(120px)` blob. Both are GPU-heavy on older iPhones.
- **Evidence:** `home/page.tsx:392-399`; `AuthBackground.tsx:22-37`.
- **Confidence:** Confirmed.

#### PERF-004 · 🔵 P3 · Perf → A video per card
- **Problem:** Every exercise card has a looping video. The IntersectionObserver plays any card that is at least 25 % visible, so 2–3 decoders often run at once through an hour-long workout, which costs battery and heat.
- **Evidence:** `MediaThumb.tsx:64-70`; `ExerciseCard.tsx:140-150`.
- **Confidence:** Highly likely.

#### BUILD-001 · 🔵 P3 · Build → ESLint fails (18 errors, 4 warnings)
- **Problem:** `npm run lint` exits non-zero. The findings:
  - `react-hooks/immutability`: `use-auth.ts:58` (`scheduleRefresh` referenced before declaration).
  - `react-hooks/refs`: `RestTimer.tsx:97` (ref written during render).
  - `react-hooks/set-state-in-effect`: `workout page:188, 220`, `ThemeProvider:80`, `Sheet:74`, `ExercisePicker:63, 68, 440`, `NumericKeypad:65`, `RestTimer:110, 171`, `SetRow:117`, `use-auth:67`, `use-favorites:67`, `use-users:16, 59`.
  - `react/no-unescaped-entities`: `profile:291`.
  - `react-hooks/exhaustive-deps`: `VideoPrefetcher:79`.
  - `@next/next/no-location-assign-relative-destination`: `client.ts:59`.
  - Unused var: `eslint.config.mjs:7`.
  - Unused disable directive: `mockServiceWorker.js`.
- **Confidence:** Confirmed.

#### BUILD-002 · ⚪ P4 · Docs → Stale README
- **Problem:** The README describes Next 15, Supabase, Sonner and qrcode.react, none of which are in the dependencies.
- **Evidence:** `README.md`.
- **Confidence:** Confirmed.

#### BUILD-003 · 🔵 P3 · Quality → No tests
- **Problem:** There are no unit, integration or e2e tests, so nothing guards the regressions listed above. Highest-value targets: forward-fill, `workoutEndTime`, `suggestSplit`, `currentStreak`, `daysUntil`, and the optimistic hooks.
- **Confidence:** Confirmed.

---

## 4. Focused lists

### 4.1 Workout-specific (start → perform → complete → finish → review)
- **Start:** LAUNCH-001, LAUNCH-003, HOME-002, HOME-003, HOME-007, SPLIT-009, WORKOUT-006.
- **Perform:** WORKOUT-001, -002, -004, -005, -008, -009, -010, -011, -012, -013, -014, -015, -016, -017, -018, -019, -020, -021, -023, -025, -028, -029, -031, -036, -038, -039; PICK-001…006; UI-006; STATE-004; PERF-001, -002, -004; AUTH-002.
- **Complete sets:** WORKOUT-003, -026, -027, -037; REST-001…004.
- **Finish:** WORKOUT-007, -022, -024, -032, -033, -034, -035.
- **Review:** STATE-001, -002, -003; EX-003, EX-004; UI-007.

### 4.2 iPhone / PWA-specific
LAUNCH-001 (start_url relaunch), REST-002, REST-003, PWA-002, PWA-003, PWA-004, UI-003, UI-008, UI-009, UI-010, SPLIT-004, EX-007, PICK-001, WORKOUT-009 (eviction), WORKOUT-018 (Low Power Mode), WORKOUT-038, WORKOUT-015(d) (safe-area maths), UI-002 (non-native sheet drag), AUTH-002 (the PWA is reopened after hours, so tokens expire).

### 4.3 Network / fetch
AUTH-002, -003, -004, -007, -008; WORKOUT-001, -002, -007, -008, -011, -019, -020, -029; LAUNCH-002, -003; HOME-001, -002, -005; SPLIT-001, -002; STATE-002; PROF-002, -003; PICK-005; PWA-002, -003.

### 4.4 Gestures / scrolling
UI-001, -002, -003, -006, -007, -009, -010; WORKOUT-012, -015, -023, -031, -038; PICK-001; WORKOUT-004 (target placement).

### 4.5 State / cache
AUTH-001, -005; WORKOUT-001, -002, -013, -016, -022; HOME-007; SPLIT-006; EX-002; REST-001; STATE-001…005; WORKOUT-034 (shared query key).

### 4.6 Performance
WORKOUT-021, PWA-003, PERF-001…004, PICK-003, WORKOUT-017 (wasted elements), UI-013.

---

## 5. Known gaps (re-verified, not counted as new bugs)

| Gap | Status |
|---|---|
| No UI to create supersets | Confirmed. `useCreateSuperset` exists but nothing calls it; only Ungroup is exposed (and see WORKOUT-025). |
| RIR picker unused | Confirmed. `RirPicker.tsx` isn't imported anywhere; history shows "—" with empty gauges. |
| Session notes read-only | Confirmed. Shown on the history detail page; there's no editor anywhere. |
| Exercise reorder is local-only | Confirmed, **and broken even locally** after a reload (WORKOUT-016). |
| Auto theme resolves to dark | Confirmed (`ThemeProvider.tsx:41-43`). |
| No `GET /favorites` (favourites mirrored locally) | Confirmed, but `Exercise.favourite` is in the API type and goes unused (EX-002). |
| Equipment filter is name-based | Confirmed (PICK-004). |

---

## 6. Recommended fix order

**Phase 1: data integrity**
1. AUTH-001: clear the query cache and namespace or clear localStorage on logout and on login.
2. WORKOUT-002, then WORKOUT-001: serialise writes per set (mutation `scope`), merge and roll back per entity rather than with whole-session snapshots, and invalidate once after the queue drains.
3. WORKOUT-004, WORKOUT-005: confirm (or undo-toast) remove and swap; make remove optimistic with a pending state.
4. WORKOUT-008: only apply the first-set autofill if the set is still untouched.
5. WORKOUT-009: commit keypad drafts on `visibilitychange`, `pagehide` and unmount.
6. WORKOUT-007: catch Finish errors, wait for pending mutations before finishing, and surface errors above the summary.
7. AUTH-002, AUTH-003: single-flight refresh, one scheduler, no hard reload (or a backend refresh token).
8. LAUNCH-001, SPLIT-009: guard against duplicate in-progress sessions everywhere (ideally on the server too).
9. SPLIT-001, STATE-002, PROF-003: confirmations on destructive actions.
10. WORKOUT-026, WORKOUT-014, WORKOUT-010, SPLIT-003, EX-001: input validation (integers, empty values, completed sets).

**Phase 2: interaction reliability**
UI-001, UI-002, UI-006, WORKOUT-003 (debounce or guard the ✓), WORKOUT-012, WORKOUT-019, WORKOUT-020, WORKOUT-031, PICK-001, UI-005, UI-003.

**Phase 3: workout reliability**
WORKOUT-015, WORKOUT-017, WORKOUT-018, WORKOUT-013, WORKOUT-011, WORKOUT-016, WORKOUT-022, WORKOUT-037, REST-001, REST-002 (a visible "rest over" state on return, Web Push if feasible), REST-003, WORKOUT-027, WORKOUT-034, WORKOUT-035, WORKOUT-036.

**Phase 4: navigation, state, PWA**
WORKOUT-006, STATE-003, EX-003, LAUNCH-002, HOME-001 (cache the QR blob), PWA-001, PWA-002 (an app-shell service worker plus a persisted query cache), UI-007, WORKOUT-023, EX-005, SPLIT-005, SPLIT-006, HOME-007, STATE-001, STATE-005, AUTH-004, AUTH-005, AUTH-007, AUTH-008, AUTH-009.

**Phase 5: performance**
WORKOUT-021 (isolate the clock into its own component), PWA-003, PERF-001, PERF-002, PERF-004, PICK-003, UI-013.

**Phase 6: polish**
UI-008, UI-011, UI-012, UI-009, UI-010, HOME-003, HOME-004, HOME-005, HOME-006, HOME-008, PROF-001, PROF-002, PROF-004, PROF-005, AUTH-006, AUTH-010, WORKOUT-028, WORKOUT-029, WORKOUT-030, WORKOUT-032, WORKOUT-033, REST-004, PICK-002, PICK-004, PICK-005, PICK-006, SPLIT-004, SPLIT-007, SPLIT-008, EX-002, EX-004, EX-006, EX-007, PWA-004, PWA-005, PERF-003, BUILD-001, BUILD-002, BUILD-003.

---

## 7. Things I could NOT verify

- **A physical iPhone, iOS Safari, or an installed standalone PWA.** These were assessed from code and known WebKit behaviour only: REST-002/003, UI-003/008/009/010, PICK-001, SPLIT-004, EX-007, WORKOUT-018 (Low Power Mode), WORKOUT-038, the relaunch-at-`start_url` path in LAUNCH-001, keyboard and `visualViewport` behaviour (ViewportFix), momentum scrolling, the file pickers (HEIC conversion), audio-session "ambient" mixing, and backgrounding or eviction timing.
- **Live interaction testing.** The audit browser couldn't register the MSW service worker, so the app never got past the black boot screen (which confirms PWA-001). Every race, gesture and animation item comes from tracing the code, not from observing it.
- **Real network conditions.** Throttling, offline mode and recovery weren't exercised. Timing-dependent races (WORKOUT-001/002/008) are rated "Highly likely", not "Confirmed".
- **Backend behaviour.** Not checked: the access-token TTL and refresh support (AUTH-002/003), integer validation for reps and exercise counts (WORKOUT-010, SPLIT-003), whether exercise history includes uncompleted sets (EX-004), the membership date format (PROF-004), the `/last-set` 204 vs null response (PICK-005), the shared-catalog permissions (EX-006), and whether swap deletes sets server-side (WORKOUT-005; the mock does).
- **Production environment.** I don't know whether the deployed Vercel build runs with `NEXT_PUBLIC_USE_MOCKS=true` (which decides PWA-001's real-world impact) or which `NEXT_PUBLIC_BASE_URL` it uses.
- **Multi-device and multi-tab scenarios.** AUTH-005, HOME-007 and WORKOUT-039 weren't reproduced.
