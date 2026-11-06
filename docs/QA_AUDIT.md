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

## 0. Fix progress (final — updated after Phase 7; the release decision is in section 11)

The original findings below are unchanged. A **Status** line under a finding means it was fixed (✅) or partly fixed (🟡). A finding with no Status line is still open.

| Phase | What | Audit issues fixed | Verification |
|---|---|---|---|
| Phase 2 (commit `af67962`) | Data integrity: write queue, rollbacks, auth/session, start-or-resume, confirmations, input checks | 21 fixed, 2 partly (AUTH-002, PROF-003; PROF-003 completed in Phase 3) | Typecheck, build, and a Node check of the queue; several were later confirmed in the Phase 3 browser run |
| Phase 3 | Interaction reliability: sheets, swipe rows, keypad, focus, add set and ✓ taps, loading/error states, navigation/scroll, touch handling | 30 fixed, 8 partly | Browser run on the mock backend (now possible thanks to the PWA-001 fix), using simulated latency/failures (see below), plus typecheck and build |

| Phase 4 | State, network and PWA reliability: one app-wide failure toast, empty-workout handling, discard/auto-end recovery, save-status indicator, cache invalidation, history paging, keypad-close jump, clock isolation | 2 fixed (WORKOUT-021, SPLIT-002), 9 partly (AUTH-002, HOME-007, WORKOUT-022, -024, -029, -032, -034, STATE-001, STATE-005); 15 new issues/follow-ups recorded (NEW-006…-015, see section 3.14 and 8) | Browser run at 375×812 on the mock backend with latency, per-route failures, offline and expired-token switches; typecheck, build, 4 unit tests. Details and limits in section 8 |

| Phase 5 | Engineering hardening: refresh-token audit, offline behaviour, video bandwidth, large-workout performance, request efficiency, double-tap safety, multi-tab, logout during saves | 6 original issues fixed (PWA-003, AUTH-005, AUTH-006, PROF-001, WORKOUT-013, PERF-001), WORKOUT-021 completed, AUTH-002 client hardening done and the issue reclassified **blocked by backend**; 10 new issues recorded (NEW-016…-025, section 9) | Browser run at 375×812 on the mock backend (slow, offline, expired, failing, combined, two tabs, 10-exercise workout), plus 9 unit tests. Details and limits in section 9 |

| Phase 6 | Polish and production readiness: lint to zero, accessibility (sheet focus, hit areas), production-bundle check of the demo code, a handful of cheap P3/P4 fixes, README | 7 P3 and 2 P4 fixed (BUILD-001, PICK-004, PICK-005, UI-011, PROF-004, AUTH-010, HOME-006; BUILD-002, WORKOUT-030); 5 more partly fixed; every remaining P3/P4 triaged in section 10 | Full browser smoke at 375×812 plus a 1280×800 layout check, 9 unit tests, typecheck, lint (0 / 0), build, a production-mode bundle scan. **Not done:** a systematic typography/spacing/contrast review and a microcopy sweep (section 10.3) |

| Phase 7 | Final release audit: re-test of the high-risk fixes, the Phase 6 tests that had been skipped, production-bundle check, contrast measurement | 3 new issues found and fixed (NEW-028 stale-cache second workout, NEW-029 avatar remove, NEW-030 contrast); no previously fixed P0/P1/P2 regressed; original counts unchanged | Browser run at 375×812 against the mock backend (section 11.2) |

**Still open, by original severity** (after Phase 7; partly fixed issues count as open) (partly fixed issues count as open):

| | Original | Fixed | Open |
|---|---|---|---|
| 🔴 P0 | 5 | 4 | 1: AUTH-002 (**blocked by backend**: the app side is done, see section 9.1) |
| 🟠 P1 | 14 | 13 | 1: PWA-002 (no offline shell / persisted queue — deliberate, see 9.2) |
| 🟡 P2 | 51 | 37 | 14 (all classified in section 9.4: 4 deferred to the iPhone pass, 4 deferred product/UX decisions, 3 backend-dependent, 2 blocked by the platform, 1 partly fixed by design) |
| 🔵 P3 | 42 | 12 | 30 |
| ⚪ P4 | 9 | 2 | 7 |

**Simulating network problems in the demo build** (added in Phase 3, mock builds only, set from the browser console):
`localStorage.overload_mock_latency = "1500"` delays every mock API call by 1.5 s.
`localStorage.overload_mock_fail = "PATCH /sets/"` makes any request matching that regex (on "METHOD /path") return a 500.
Added in Phase 5: `localStorage.overload_mock_valid_epoch = "1"` expires every access token while `/auth/refresh` still works (the demo now issues rotating refresh tokens), `localStorage.overload_mock_refresh_invalid = "1"` expires the refresh token too, and `overload_mock_refresh_calls` counts refresh requests. The demo database is now shared by all tabs of the app.
Added in Phase 4: `localStorage.overload_mock_offline = "1"` makes every call fail like a dead connection, and `localStorage.overload_mock_expired = "1"` makes every authenticated call return 401 (expired token). Latency is applied before the failure check, so a failure window can be timed to hit one request in a queue.
Remove the keys to go back to normal.

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
- **Status:** ✅ Fixed — Phase 2. Login as a different user, and logout, clear the query cache and user-scoped localStorage. *Files:* `src/hooks/use-auth.ts`. *Verified:* Static/build only.
- **Problem:** Logout clears tokens but not the React Query cache or user-scoped localStorage. The next account on the same device sees the previous user's data.
- **Repro:** Log in as A and open Home, Splits and History. Log out, then sign up or log in as B within 30 s. Open Home.
- **Expected:** B sees only B's data.
- **Actual:** The module-level `queryClient` survives client-side navigation, and queries younger than `staleTime` (30 s) don't refetch on mount. B sees A's splits, history, streak, avatar, membership and "Resume workout" (which then opens A's session id, which 404s; see WORKOUT-006). `overload_favorites`, `overload_rest_timer`, `overload_exercise_order_*` and `overload_launch_shown` also carry over.
- **Cause:** `logout()` only removes three keys. Query keys aren't user-scoped. `queryClient.clear()` is never called.
- **Evidence:** `src/hooks/use-auth.ts:102-108`, `src/app/(app)/profile/page.tsx:73-76`, `src/app/providers.tsx:11-15`, `src/hooks/use-users.ts:49-53` (`["profile-picture"]`), `["membership"]`.
- **Confidence:** Confirmed (code path).

#### AUTH-002 · 🔴 P0 · Auth → Token expiry
- **Status:** ⛔ Blocked by backend — Phase 5. The app side is complete and tested against a mock that models refresh tokens; what's missing is the API. The deployed API must (1) return `refresh_token` from `POST /auth/login` and `POST /auth/signup`, and (2) implement `POST /auth/refresh` taking `{"refresh_token": "…"}` and returning `{"access_token": "…", "refresh_token": "…"}` (rotation optional; 400/401/403 for a bad token). I did not call the deployed API to check; the code comment in `src/lib/api/auth.ts` says it issues none today. Until then a 401 means the write is lost — the user is told ("Change not saved — it's been undone. Sign in to continue."), sent to sign-in with an explanation, and the server's state is loaded fresh after sign-in. Nothing is replayed (see 9.2 for why). Client behaviour, all covered by `src/lib/api/client.test.ts` and verified in the browser: one refresh at a time however many requests 401 together; each retried exactly once (a second 401 isn't retried); a request that 401s after another already renewed the token retries with the new one instead of spending a rotating refresh token twice; a refresh *rejected* by the server ends the session; a refresh that merely *can't be reached* (offline, timeout, 5xx) does **not** sign the user out; a refresh that finishes after sign-out can't resurrect the session; reload keeps working (tokens are in localStorage and the 401 path renews lazily). *Files:* `src/lib/api/client.ts, src/hooks/use-auth.ts, src/lib/mock/handlers.ts`. *Remaining:* background/foreground relies on the 401 path rather than a visibility-triggered refresh (fine with refresh tokens; irrelevant without).
- **Problem:** The deployed API issues no refresh token (code comment). When the access token expires, the next request gets a 401. `clearSession()` then does `window.location.href = "/login"`, a hard reload, even in the middle of a workout.
- **Repro:** Start a workout and wait past the token TTL (or edit `overload_token` to an expired JWT). Tap ✓ on a set.
- **Expected:** A silent refresh, or at least a re-auth prompt that keeps the workout state.
- **Actual:** A full reload to /login. In-flight optimistic mutations are lost, along with any keypad draft and the rest-timer context. The 401 PATCH that triggered it is never retried.
- **Cause:** No refresh token, and a hard redirect inside the API client.
- **Evidence:** `src/lib/api/auth.ts:6`, `src/hooks/use-auth.ts:48-51` ("No-ops today"), `src/lib/api/client.ts:52-61, 100-106`.
- **Confidence:** Highly likely. The severity depends on the backend token TTL, which needs confirming.

#### AUTH-003 · 🟠 P1 · Auth → Refresh concurrency
- **Status:** ✅ Fixed — Phase 2. Single-flight refresh shared by every 401, and one app-wide refresh timer. *Files:* `src/lib/api/client.ts, src/hooks/use-auth.ts`. *Verified:* Static/build only.
- **Problem:** There's no single-flight around refresh. Every concurrent 401 calls `/auth/refresh` with the same refresh token, and every `useAuth()` instance (root page, `(app)` layout, Profile, login and signup each create one) schedules its own refresh timer.
- **Repro:** This only becomes visible once refresh tokens are issued. Let the token expire with 3 queries mounted, or 2 `useAuth` instances alive at refresh time.
- **Expected:** One refresh, with the other requests waiting for it.
- **Actual:** N parallel refreshes. With rotating refresh tokens, every one after the first fails, so `clearSession()` logs the user out, and reuse detection may revoke the whole token family.
- **Evidence:** `src/lib/api/client.ts:31-50, 100-106`; `src/hooks/use-auth.ts:34-71` (a timer per hook instance).
- **Confidence:** Confirmed (latent until refresh tokens ship).

#### AUTH-004 · 🟡 P2 · Auth → Blob requests
- **Status:** ✅ Fixed — Phase 3. Image requests (QR, avatar) refresh the token and retry on a 401. *Files:* `src/lib/api/client.ts`. *Verified:* Static/build only.
- **Problem:** `apiRequestBlob` (QR image, profile picture) has no 401 → refresh → retry path.
- **Actual:** After expiry the QR or avatar fails silently. The QR sheet shows "No QR code uploaded yet" (see HOME-001).
- **Evidence:** `src/lib/api/client.ts:121-131`.
- **Confidence:** Confirmed.

#### AUTH-005 · 🟡 P2 · Auth → `useAuth` state model
- **Status:** ✅ Fixed — Phase 5. `useAuth` listens for `storage` events: signing out in one tab sends the others to sign-in, and a different user signing in clears the other tab's query cache. *Files:* `src/hooks/use-auth.ts`. *Verified (Phase 5):* browser, two tabs — logout in tab A moved tab B to /login. Not exercised: signing in as a different user in one tab while another is open.
- **Problem:** `user` is local state in each hook instance, read once from localStorage. Logout in Profile doesn't update the layout's instance. There's no `storage` listener, so logging out in another tab or window isn't noticed.
- **Evidence:** `src/hooks/use-auth.ts:34-71`.
- **Confidence:** Confirmed.

#### AUTH-006 · 🟡 P2 · Auth → /login
- **Status:** ✅ Fixed — Phase 5. The demo credentials are pre-filled only when `NEXT_PUBLIC_USE_MOCKS=true`. *Files:* `src/app/(auth)/login/page.tsx`. *Verified (Phase 5):* build and code path; the production-mode login form was not opened.
- **Problem:** Demo credentials (`demo@overload.app` / `demo1234`) are pre-filled in every build, not only the mock build.
- **Actual:** It fights iOS password autofill. If that account exists on the real backend, people can sign into a shared account just by tapping Sign in.
- **Evidence:** `src/app/(auth)/login/page.tsx:15-16`.
- **Confidence:** Confirmed.

#### AUTH-007 · 🟡 P2 · Network → All requests
- **Status:** ✅ Fixed — Phase 3. Requests time out after 20 s (60 s for uploads) via AbortSignal.timeout. *Files:* `src/lib/api/client.ts`. *Verified:* Static/build only.
- **Problem:** `fetch` has no timeout or AbortController anywhere.
- **Repro:** Gym Wi-Fi that accepts the connection but stalls.
- **Actual:** "Signing in…", "Starting…", skeletons and the LaunchGate black screen hang until the OS times out (60 s or more).
- **Evidence:** `src/lib/api/client.ts:90-94, 126`.
- **Confidence:** Confirmed.

#### AUTH-008 · 🟡 P2 · Network → Error parsing and messages
- **Status:** ✅ Fixed — Phase 3. Network and timeout failures, and non-JSON error bodies, become readable ApiRequestErrors. *Files:* `src/lib/api/client.ts`. *Verified:* Browser: the server's error message was shown ("Simulated server error."). The network and HTML paths are static only.
- **Problem:** Non-JSON error bodies (an HTML 502/504 from a gateway, a Lambda timeout page) make `JSON.parse` throw a raw `SyntaxError`. Network failure throws a `TypeError` ("Load failed" on Safari). The workout page shows `err.message` verbatim.
- **Actual:** Toasts such as "Load failed" or "Unexpected token '<'…".
- **Evidence:** `src/lib/api/client.ts:108-109`; `src/app/(app)/workout/[sessionId]/page.tsx:102-106`.
- **Confidence:** Confirmed.

#### AUTH-009 · 🔵 P3 · Auth → Routing
- **Problem:** A signed-in user who opens /login or /signup isn't redirected. Every protected screen renders `null` on the first frame (`loading` starts as `true`), so each cold load starts with a blank frame.
- **Evidence:** `src/hooks/use-auth.ts:35-36`, `src/app/(app)/layout.tsx:23`.
- **Confidence:** Confirmed.

#### AUTH-010 · 🔵 P3 · Auth → /signup validation
- **Status:** ✅ Fixed — Phase 6. Sign-up rejects a password that is under 8 characters once trimmed, with a clear message, and trims the email. *Verified:* code and typecheck; the form wasn't submitted in the browser.
- **Problem:** Validation relies only on the browser's native `required`, `minLength` and `type=email` bubbles. Nothing is trimmed, so a password of 8 spaces passes the client. There's no inline guidance for "≥ 8 characters".
- **Evidence:** `src/app/(auth)/signup/page.tsx:55-71`.
- **Confidence:** Confirmed.

### 3.2 Launch gate

#### LAUNCH-001 · 🟠 P1 · Launch gate → "Let's do it!"
- **Status:** ✅ Fixed — Phase 2 (+Phase 3). The gate uses the shared start-or-resume path and says "Resume workout". Phase 3: sessions past the 3h cap are closed out instead of resumed (NEW-002). *Files:* `src/components/LaunchGate.tsx, src/hooks/use-workouts.ts`. *Verified:* Verified in browser (mock backend, 375×812, Phase 3): the gate showed Resume; 3 rapid starts created 1 workout.
- **Problem:** The gate ignores an in-progress workout. Home and Splits both guard against this; the gate doesn't.
- **Repro:** Start a workout. Kill the PWA (or let iOS evict it) and reopen it. Standalone iOS reopens at `start_url` "/", sessionStorage is empty, so the gate shows "It's Push Day!". Tap "Let's do it!".
- **Expected:** "Resume workout", or straight back to the open session.
- **Actual:** A **second** in-progress session is created and the first one is orphaned.
- **Evidence:** `src/components/LaunchGate.tsx:57-60` (no `inProgress` check, compare `home/page.tsx:102-109`), `src/app/manifest.ts:15`.
- **Confidence:** Confirmed (code). The relaunch behaviour needs an iPhone to confirm.

#### LAUNCH-002 · 🟠 P1 · Launch gate → Loading
- **Status:** ✅ Fixed — Phase 3. If the gate's data isn't ready within 2.5 s it moves on to Home instead of holding a blank screen. *Files:* `src/components/LaunchGate.tsx`. *Verified:* Static/build only.
- **Problem:** While splits and history load, the gate renders an opaque full-screen black overlay with no spinner and no way out.
- **Repro:** A slow or stalled network on cold launch.
- **Actual:** A black screen for as long as the fetch hangs (no timeout, see AUTH-007). It looks like the app crashed.
- **Evidence:** `src/components/LaunchGate.tsx:50-55`.
- **Confidence:** Confirmed.

#### LAUNCH-003 · 🟡 P2 · Launch gate → Start failure
- **Status:** ✅ Fixed — Phase 3. Start errors are shown under the gate's buttons. *Files:* `src/components/LaunchGate.tsx, src/hooks/use-workouts.ts`. *Verified:* Static/build only.
- **Problem:** `start()` awaits `mutateAsync` with no catch.
- **Actual:** On failure the button goes back to "Let's do it!" with no message (an unhandled promise rejection).
- **Evidence:** `src/components/LaunchGate.tsx:57-60`.
- **Confidence:** Confirmed.

### 3.3 Home / Today

#### HOME-001 · 🟠 P1 · Home → QR sheet
- **Status:** ✅ Fixed — Phase 3. The QR is cached in React Query (fetched once, kept until an upload), with separate loading, none-uploaded, and failed-with-retry states. *Files:* `src/hooks/use-users.ts, src/app/(app)/home/page.tsx, src/components/LaunchGate.tsx`. *Verified:* Verified in browser (mock backend, 375×812, Phase 3): the sheet opened straight onto the result. Offline use still needs PWA-002.
- **Problem:** The QR blob is re-fetched on every open (nothing is cached, and the URL is set to null on close). The placeholder text "No QR code uploaded yet" shows **while it loads and when it fails**.
- **Repro:** Open the QR sheet on poor or no signal, which is exactly where it's needed, at the gym door.
- **Expected:** The last known QR appears instantly and works offline.
- **Actual:** A misleading "No QR code uploaded yet". It flashes on every open even when the network is good.
- **Evidence:** `src/hooks/use-users.ts:10-42`, `src/app/(app)/home/page.tsx:56, 280-291`.
- **Confidence:** Confirmed.

#### HOME-002 · 🟡 P2 · Home / Splits → Start workout errors
- **Status:** ✅ Fixed — Phase 3. start-or-resume tracks its own pending and error state. Errors show on Home (the CTA and the sheet) and on Splits, and the button reads "Starting…". *Files:* `src/hooks/use-workouts.ts, src/app/(app)/home/page.tsx, src/app/(app)/splits/page.tsx`. *Verified:* Static/build only.
- **Problem:** `start()` on Home and on Splits awaits `mutateAsync` with no catch.
- **Actual:** On failure nothing happens: the Choose-split sheet stays open, the buttons re-enable, and there's no message.
- **Evidence:** `src/app/(app)/home/page.tsx:102-114`, `src/app/(app)/splits/page.tsx:29-39`.
- **Confidence:** Confirmed.

#### HOME-003 · 🟡 P2 · Home → Recommended card
- **Status:** Deferred — Phase 5 (UX decision). The floating CTA already reads "Resume workout" when one is open; what the recommended card's ▶ should do then (resume, or ask) is a product call. No data is at risk — the existing session is resumed, not duplicated.
- **Problem:** "Start Push now" (▶) silently opens an unrelated in-progress workout if one exists.
- **Repro:** Leave a Legs workout unfinished, then tap ▶ on the recommended Push card.
- **Actual:** You land in the Legs session with no explanation.
- **Evidence:** `src/app/(app)/home/page.tsx:102-109, 157-159`.
- **Confidence:** Confirmed.

#### HOME-004 · 🟡 P2 · Home → Floating CTA overlap
- **Status:** ✅ Fixed — Phase 3. A spacer clears the floating CTA and its fade. *Files:* `src/app/(app)/home/page.tsx`. *Verified:* Static/build only.
- **Problem:** The CTA stack (88 px offset, a 56 px button and a 32 px gradient) reaches about 176 px plus the safe area, but `main` only reserves 104 px plus the safe area.
- **Actual:** The bottom of the page content, such as the "Last workout" card, sits under the CTA and gradient, worst on SE or mini-sized phones.
- **Evidence:** `src/app/(app)/home/page.tsx:244-265`, `src/app/(app)/layout.tsx:43`.
- **Confidence:** Highly likely.

#### HOME-005 · 🟡 P2 · Home → QR upload
- **Status:** ✅ Fixed — Phase 3. Upload errors are shown, non-images are rejected with a message, and the input is reset so the same file can be picked again. *Files:* `src/app/(app)/home/page.tsx`. *Verified:* Static/build only.
- **Problem:** There's no type or size validation and no error message (`uploadQr.mutate` has no onError). The file input value is never reset, so re-picking the same file does nothing.
- **Evidence:** `src/app/(app)/home/page.tsx:293-306`.
- **Confidence:** Confirmed.

#### HOME-006 · 🔵 P3 · Home → Header date
- **Status:** ✅ Fixed — Phase 6. The header date is re-read when the app returns to the foreground. *Verified:* code only (no overnight run).
- **Problem:** `today` is memoised with `[]`, so in a PWA left alive overnight the header still shows yesterday.
- **Evidence:** `src/app/(app)/home/page.tsx:58-66`.
- **Confidence:** Confirmed.

#### HOME-007 · 🔵 P3 · Home → In-progress detection
- **Status:** 🟡 Partly fixed — Phase 3. Phase 4 deletes (not completes) an empty abandoned session, so it can no longer appear as a "Last workout · 0m". Cross-device staleness remains.
- **Problem:** `inProgress` is read from the cached history list (30 s stale, top 50 only). It can show "Choose split" while a workout is open on another device, or "Resume" a session that was already finished elsewhere.
- **Evidence:** `src/app/(app)/home/page.tsx:77`, `src/hooks/use-workouts.ts:6-11`.
- **Confidence:** Confirmed.

#### HOME-008 · ⚪ P4 · Home → Small polish
- **Status:** 🟡 Partly fixed — Phase 6. The flame only pulses for a live streak, and the badge is exposed to screen readers as an image with its label. "0 streak" and the raw `#12` muscle ids while loading are unchanged.
- **Problem:** "0 streak" shows for new users, and the flame pulses forever. While muscles load, the split summary shows raw `#12` ids.
- **Evidence:** `src/app/(app)/home/page.tsx:41, 386-422`.
- **Confidence:** Confirmed.

### 3.4 Splits

#### SPLIT-001 · 🟠 P1 · Splits → Edit → Delete split
- **Status:** ✅ Fixed — Phase 2. "Delete split" now asks for confirmation, shows a pending state and shows an error on failure. *Files:* `src/components/splits/SplitForm.tsx`. *Verified:* Static/build only.
- **Problem:** "Delete split" on the edit page deletes immediately with no confirmation (the list path does confirm). There's no pending state, and `mutateAsync` in `onClick` has no catch.
- **Repro:** Open a split's edit page and tap "Delete split" (or double-tap it).
- **Actual:** The split is gone with no undo. A double tap sends two DELETEs. Failures are silent.
- **Evidence:** `src/app/(app)/splits/[id]/edit/page.tsx:37-40`, `src/components/splits/SplitForm.tsx:103-106`.
- **Confidence:** Confirmed.

#### SPLIT-002 · 🟡 P2 · Splits → Swipe delete
- **Status:** ✅ Fixed — Phase 4. A failed swipe-delete toasts "Split not deleted — it's still there." and the row stays (it was never removed optimistically). *Files:* `src/hooks/use-splits.ts, src/app/(app)/splits/page.tsx`. *Verified (Phase 4):* browser, with a failure injected on `DELETE /splits/`.
- **Problem:** The delete isn't optimistic, has no pending state and no onError. The row stays until the refetch, and a failure is silent.
- **Evidence:** `src/app/(app)/splits/page.tsx:104-108`, `src/hooks/use-splits.ts:34-40`.
- **Confidence:** Confirmed.

#### SPLIT-003 · 🟡 P2 · Splits → Stepper typed values
- **Status:** ✅ Fixed — Phase 2. Exercise counts are rounded to whole numbers. *Files:* `src/components/splits/MuscleAllocator.tsx`. *Verified:* Static/build only.
- **Problem:** The Stepper's tap-to-type input uses `inputMode="decimal"` and `clamp` keeps two decimals, so `nr_of_exercises` can be 2.5. The backend expects an integer.
- **Actual:** You get the generic "Couldn't save this split" with no hint why. Typed 0 or negatives clamp silently.
- **Evidence:** `src/components/ui/Stepper.tsx:42-45, 96-100, 140`.
- **Confidence:** Highly likely (depends on backend validation).

#### SPLIT-004 · 🔵 P3 · Splits → Stepper on iOS
- **Problem:** Tap-to-type mounts an input with `autoFocus` after a state update, which is outside the user gesture. iOS focuses the input but doesn't raise the keyboard.
- **Evidence:** `src/components/ui/Stepper.tsx:87-89, 141`.
- **Confidence:** Requires iPhone.

#### SPLIT-005 · 🔵 P3 · Splits → Post-save navigation
- **Status:** ✅ Fixed — Phase 3. Create, save and delete use router.replace. *Files:* `src/app/(app)/splits/new/page.tsx, src/app/(app)/splits/[id]/edit/page.tsx`. *Verified:* Static/build only.
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
- **Status:** ✅ Fixed — Phase 2. start-or-resume waits for the history list (ensureQueryData) and ignores repeat taps. *Files:* `src/hooks/use-workouts.ts`. *Verified:* Verified in browser (mock backend, 375×812, Phase 3): 3 rapid taps → 1 workout.
- **Problem:** The in-progress guard reads `history`, which may still be undefined, so it falls through and creates a duplicate workout.
- **Evidence:** `src/app/(app)/splits/page.tsx:31`.
- **Confidence:** Confirmed.

### 3.5 Exercise detail

#### EX-001 · 🟡 P2 · Exercise → Edit → Rest time
- **Status:** ✅ Fixed — Phase 2. An empty or non-integer rest time is rejected. *Files:* `src/app/(app)/exercises/[id]/page.tsx`. *Verified:* Static/build only.
- **Problem:** An empty field gives `Number("") === 0`, which passes validation, so 0 s is saved silently. Decimals are accepted too. The error text says "positive" but 0 is allowed. Together with WORKOUT-037, the timer then chimes the moment a set is ticked.
- **Evidence:** `src/app/(app)/exercises/[id]/page.tsx:295-299`.
- **Confidence:** Confirmed.

#### EX-002 · 🟡 P2 · Exercise → Favourite
- **Status:** Deferred — Phase 5 (backend). Needs confirmation of whether `GET /exercises` returns the signed-in user's favourite flag; the mock only sets it from `PATCH /exercises/:id`. Favourites are still mirrored in localStorage (cleared on logout).
- **Problem:** The favourite state comes only from localStorage and ignores `Exercise.favourite` from the API.
- **Actual:** It's wrong on a new device, after reinstalling or clearing data, and for another user on the same device. Toggling it may POST favourites the server already has.
- **Evidence:** `src/hooks/use-favorites.ts:31-97`, `src/types/index.ts:37`.
- **Confidence:** Highly likely.

#### EX-003 · 🟡 P2 · Exercise → Error and not-found states
- **Status:** ✅ Fixed — Phase 3. A failed history load shows "Couldn't load history" with retry instead of "No logs yet". *Files:* `src/app/(app)/exercises/[id]/page.tsx`. *Verified:* Static/build only.
- **Problem:** A history fetch error renders "No logs yet". An unknown exercise id keeps the title "Exercise" forever, with no not-found state.
- **Evidence:** `src/app/(app)/exercises/[id]/page.tsx:34-37, 134-141`.
- **Confidence:** Confirmed.

#### EX-004 · 🟡 P2 · Exercise → Stats accuracy
- **Status:** Deferred — Phase 5 (backend). The history entries carry no `completed` flag, so the client can't tell logged sets from placeholders; the fix belongs in the API response.
- **Problem:** PR, volume and the set count include every history set, including warm-ups and **never-completed** sets. Those are common because "Add set" copies values forward, and the mock history endpoint returns uncompleted sets. Bodyweight and timer exercises show "0 kg" PRs and "0 kg × 12" rows. Negative (assisted) weights display as positive.
- **Evidence:** `src/app/(app)/exercises/[id]/page.tsx:41-61, 218`; `src/lib/mock/handlers.ts:146-170`.
- **Confidence:** Highly likely (depends on what the real backend returns).

#### EX-005 · 🔵 P3 · Exercise → Back button
- **Status:** ✅ Fixed — Phase 3. With no in-app history, Back goes to /home. *Files:* `src/components/ui/LargeTitle.tsx`. *Verified:* Static/build only.
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
- **Status:** ✅ Fixed — Phase 2. One ordered write queue per session (mutation scope), per-entity rollback, a single refetch when the queue drains, and no refetch-on-focus while writes are pending. *Files:* `src/hooks/use-workout-session.ts, src/hooks/use-workouts.ts`. *Verified:* Node check against React Query (Phase 2), plus browser: a failed save rolled back only its own field and the retry saved (Phase 3).
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
- **Status:** ✅ Fixed — Phase 2. Writes reach the server one at a time, in tap order (mutation scope). *Files:* `src/hooks/use-workout-session.ts`. *Verified:* Node check (Phase 2), plus browser: 3 rapid adds were saved as sets 1, 2, 3 (Phase 3).
- **Problem:** Each tap fires an independent PATCH: set-type cycling, ✓/un-✓, every keypad commit, copy-previous. There's no per-set serialisation, so the server applies them in arrival order. `usePatchSets` also sends N requests in parallel with `Promise.all`.
- **Repro (cellular):** Cycle a set's type 4 times quickly, or tick and un-tick a set.
- **Actual:** The server can end in a state the UI never showed. After the refetch the type "jumps", or a set that showed ✓ is saved as not completed, so it's missing from the summary, history, volume and PRs.
- **Evidence:** `src/components/workout/SetRow.tsx:290-300, 335-352`; `src/hooks/use-workout-session.ts:173-174`.
- **Confidence:** Highly likely.

#### WORKOUT-003 · 🟠 P1 · Workout → Set completion toggle
- **Status:** ✅ Fixed — Phase 3. A second ✓ tap within 400 ms counts as the same intention. *Files:* `src/components/workout/SetRow.tsx`. *Verified:* Verified in browser (mock backend, 375×812, Phase 3): a double-click left the set completed and the rest timer started once.
- **Problem:** ✓ is a pure toggle with no guard against repeats.
- **Repro:** Double-tap ✓, or tap it 10 times.
- **Actual:** A double tap un-completes the set. Every completion restarts the rest timer, vibrates, re-celebrates and calls `markExerciseTrained`. Ten taps send ten PATCHes, which feeds WORKOUT-002.
- **Evidence:** `src/components/workout/SetRow.tsx:335-352`; `workout/[sessionId]/page.tsx:460-478`.
- **Confidence:** Confirmed.

#### WORKOUT-004 · 🔴 P0 · Workout → Remove exercise
- **Status:** ✅ Fixed — Phase 2. Asks for confirmation when the exercise has logged sets, removes it optimistically, and is disabled on unsaved cards. *Files:* `src/app/(app)/workout/[sessionId]/page.tsx, src/components/workout/ExerciseCard.tsx`. *Verified:* Static/build only.
- **Problem:** The ✕ in the action pill on the card video deletes the exercise and all of its logged sets on a single tap, with no confirmation and no undo. It sits next to the swap and drag buttons. The delete isn't optimistic and has no pending state, so a second tap sends a duplicate DELETE, which 404s and shows an error toast.
- **Repro:** Reach for the drag handle or swap and catch ✕ instead.
- **Evidence:** `src/components/workout/ExerciseCard.tsx:190-204`; `src/hooks/use-workout-session.ts:85-92`; `page.tsx:618`.
- **Confidence:** Confirmed.

#### WORKOUT-005 · 🟠 P1 · Workout → Swap exercise
- **Status:** ✅ Fixed — Phase 2. Asks for confirmation before a swap clears logged sets. *Files:* `src/app/(app)/workout/[sessionId]/page.tsx`. *Verified:* Static/build only.
- **Problem:** Swapping clears every set, completed ones included (on the server too: `we.sets = []` in the mock), with no confirmation.
- **Evidence:** `src/hooks/use-workout-session.ts:63-76`; `src/lib/mock/handlers.ts:403-415`; `ExerciseCard.tsx:172-189`.
- **Confidence:** Confirmed.

#### WORKOUT-006 · 🟠 P1 · Workout → Load errors
- **Status:** ✅ Fixed — Phase 3. An error state with Home and Try again (no retry for a 404). *Files:* `src/app/(app)/workout/[sessionId]/page.tsx, src/app/providers.tsx`. *Verified:* Verified in browser (mock backend, 375×812, Phase 3): /workout/99999 showed "This workout no longer exists" with a Home button.
- **Problem:** The page has no error state. `isLoading || !session` covers errors too.
- **Repro:** Open a discarded or deleted session through a stale "Resume" (see AUTH-001 / HOME-007) or an old link, or open it while offline.
- **Actual:** Three skeleton blocks forever. The session bar (the only back button) isn't rendered and the tab bar is hidden on this route, so in standalone mode **you're stuck**.
- **Evidence:** `src/app/(app)/workout/[sessionId]/page.tsx:500-511`; `src/app/(app)/layout.tsx:27, 48`.
- **Confidence:** Confirmed.

#### WORKOUT-007 · 🟠 P1 · Workout → Finish
- **Status:** ✅ Fixed — Phase 2 (+Phase 3). Finish waits for queued writes, catches errors, and summarizes the saved state. The error toast sits above the summary. Phase 3: the button reads "Saving…" while it waits. *Files:* `src/app/(app)/workout/[sessionId]/page.tsx, src/hooks/use-workouts.ts`. *Verified:* Static/build only.
- **Problem:** `finish()` awaits `mutateAsync` with no catch. Finish doesn't wait for pending set PATCHes. The summary is built from the local optimistic snapshot.
- **Actual:** On a network failure Finish silently does nothing. If a set PATCH fails after the summary opens, the error toast (z-40) is hidden under the summary (z-50), so the summary shows data the server never saved.
- **Evidence:** `src/app/(app)/workout/[sessionId]/page.tsx:481-486, 658-667, 693-700`.
- **Confidence:** Confirmed.

#### WORKOUT-008 · 🟠 P1 · Workout → First-set autofill race
- **Status:** ✅ Fixed — Phase 2. First-set autofill only fills a set that's still untouched. *Files:* `src/app/(app)/workout/[sessionId]/page.tsx`. *Verified:* Static/build only.
- **Problem:** "Log first set" POSTs the set, then fetches exercise history, then **unconditionally** PATCHes weight, reps and RIR from last time.
- **Repro (slow network):** Tap "Log first set", then type 100 kg or tick ✓ before the history request returns.
- **Actual:** Your input is overwritten with last session's numbers. It can even change a set that's already completed.
- **Evidence:** `src/app/(app)/workout/[sessionId]/page.tsx:406-419`.
- **Confidence:** Highly likely.

#### WORKOUT-009 · 🟠 P1 · Workout → Keypad draft persistence
- **Status:** ✅ Fixed — Phase 2. The keypad commits its draft on visibilitychange (hidden), pagehide and unmount. *Files:* `src/components/workout/NumericKeypad.tsx`. *Verified:* Static/build only. Eviction behaviour needs an iPhone.
- **Problem:** A draft is only committed when you tap somewhere else (`pointerdown`). Nothing commits it on `visibilitychange`, `pagehide` or unmount.
- **Repro:** Type "102.5" and lock the phone or switch apps. iOS evicts the PWA.
- **Actual:** The value is lost.
- **Evidence:** `src/components/workout/NumericKeypad.tsx:67-79, 110-118`.
- **Confidence:** Confirmed (the eviction part needs an iPhone).

#### WORKOUT-010 · 🟡 P2 · Workout → Keypad accepts decimals for reps and seconds
- **Status:** ✅ Fixed — Phase 2. Reps and seconds fields take whole numbers only; "." is disabled. *Files:* `src/components/workout/SetRow.tsx, src/components/workout/NumericKeypad.tsx`. *Verified:* Verified in browser (mock backend, 375×812, Phase 3): "." disabled on reps.
- **Problem:** The "." key is always enabled, so reps can be "8.5".
- **Actual:** If the backend validates integers, the PATCH fails, the edit rolls back and an error toast appears.
- **Evidence:** `src/components/workout/NumericKeypad.tsx:44`, `SetRow.tsx:132-150, 325-333`.
- **Confidence:** Suspected (backend).

#### WORKOUT-011 · 🟡 P2 · Workout → No-op commits
- **Status:** ✅ Fixed — Phase 2. An unchanged value no longer sends a PATCH. *Files:* `src/components/workout/SetRow.tsx`. *Verified:* Static/build only.
- **Problem:** Opening and closing a field PATCHes even when nothing changed. An empty field PATCHes null.
- **Actual:** Extra requests widen the race window in WORKOUT-001 and WORKOUT-002.
- **Evidence:** `src/components/workout/SetRow.tsx:120-130`.
- **Confidence:** Confirmed.

#### WORKOUT-012 · 🟡 P2 · Workout → Keypad vs scrolling
- **Status:** ✅ Fixed — Phase 3. A press outside the keypad saves the draft immediately, but only a tap (no movement, no pointercancel) closes it. Scrolling keeps it open, and tapping another field switches to it without closing and reopening. *Files:* `src/components/workout/NumericKeypad.tsx, src/components/workout/SetRow.tsx`. *Verified:* Verified in browser (mock backend, 375×812, Phase 3) (mouse drag): the keypad stayed open and the value was saved. Native touch scroll requires an iPhone.
- **Problem:** Any `pointerdown` outside the keypad closes it, including the start of a scroll gesture. The body `paddingBottom` added "so you can scroll lower sets above the keypad" can never be used. When the keypad closes, the padding is removed, which shrinks the page and makes it jump near the bottom.
- **Evidence:** `src/components/workout/NumericKeypad.tsx:91-99, 110-118`.
- **Confidence:** Confirmed.

#### WORKOUT-013 · 🟡 P2 · Workout → Keypad stale closures
- **Status:** ✅ Fixed — Phase 5. The keypad's commit now calls the latest `onCommit` (through a ref) instead of the one captured when the field opened, so the forward-fill sees sets added or saved since. It also records the committed value immediately, which stopped a double write (press-to-save then the release that closes the keypad each queued the same PATCH). *Files:* `src/components/workout/SetRow.tsx`. *Verified (Phase 5):* browser — one PATCH per edit; the forward-fill reached 3 later sets.
- **Problem:** `keypad.open()` captures `onCommit` from the render in which the field opened, so the commit runs `handleChangeSet(we, …)` with the `we` from that moment. Sets added, or optimistic-to-real id swaps, after the field opened are ignored by the forward-fill.
- **Evidence:** `src/components/workout/SetRow.tsx:162-167`; `page.tsx:437-458`.
- **Confidence:** Confirmed.

#### WORKOUT-014 · 🟡 P2 · Workout → Forward-fill edge cases
- **Status:** ✅ Fixed — Phase 2. Forward-fill and its live preview skip completed and unsaved sets. *Files:* `src/app/(app)/workout/[sessionId]/page.tsx, src/components/workout/ExerciseCard.tsx`. *Verified:* Verified in browser (mock backend, 375×812, Phase 3): the fill reached only the empty later set.
- **Problem:** Forward-fill writes into later sets **even if they're already completed**, as long as that field is null. The live mirror previews values on unsaved (optimistic) sets, but the commit skips them, so the preview value appears and then disappears.
- **Evidence:** `page.tsx:441-456`; `ExerciseCard.tsx:72-79`.
- **Confidence:** Confirmed.

#### WORKOUT-015 · 🟡 P2 · Workout → Exercise focus and dimming
- **Status:** ✅ Fixed — Phase 3. The scroll-spy ignores app-started smooth scrolls, freezes while the keypad is open, and measures the real session-bar height (safe area included). It focuses the last card at the bottom of the page and the first at the top. *Files:* `src/app/(app)/workout/[sessionId]/page.tsx, src/lib/scroll.ts, src/components/workout/ExerciseCard.tsx, src/components/workout/NumericKeypad.tsx`. *Verified:* Verified in browser (mock backend, 375×812, Phase 3): exactly one focused card at the top, middle and bottom; focus stayed on the edited card while scrolling with the keypad open.
- **Problem:** Exactly one id is focused at a time, but it's often the wrong one.
  - (a) Auto-advance to the last card: `scrollIntoView({block:"center"})` can't centre it at the bottom of the page, and the scroll-spy then hands focus back to the previous card.
  - (b) Opening the keypad calls `scrollBy`, the scroll-spy refocuses, and the card you're editing dims.
  - (c) Smooth scrolls pass over intermediate cards, so focus flickers through them.
  - (d) The centre maths hard-codes the 56 px bar and ignores `safe-area-inset-top` (about 59 px), which biases the result.
  - (e) Reorder layout-animation transforms skew `getBoundingClientRect`.
- **Evidence:** `page.tsx:271-301 (278), 315-332`; `NumericKeypad.tsx:101-108`.
- **Confidence:** Highly likely.

#### WORKOUT-016 · 🟡 P2 · Workout → Reorder persistence
- **Status:** ✅ Fixed — Phase 3. The stored order uses server ids, and placeholder ids are replaced once the server confirms them. The order key is removed on finish or discard. *Files:* `src/app/(app)/workout/[sessionId]/page.tsx`. *Verified:* Verified in browser (mock backend, 375×812, Phase 3): the saved order survived a reload, and an added exercise's placeholder id became its real id.
- **Problem:** Exercises added during the session are keyed by their **optimistic id** for the rest of the page's life (`exerciseKeyAlias`), and that key is what `saveOrder` stores. The alias map lives in memory only.
- **Actual:** After a reload or PWA relaunch the saved keys don't match, and every exercise added during the session falls back to the end in server order. So the local-only reorder, a known gap, is also broken locally.
- **Evidence:** `page.tsx:41-50, 180-205`; `use-workout-session.ts:17-18`.
- **Confidence:** Confirmed.

#### WORKOUT-017 · 🟡 P2 · Workout → Exercise videos blank
- **Status:** ✅ Fixed — Phase 3. The video observer re-attaches when the video element appears or changes. A failure is tracked per src, so swapping away from broken media recovers. *Files:* `src/components/ui/MediaThumb.tsx`. *Verified:* Static/build only (the mock data has no videos).
- **Problem:** `MediaThumb`'s IntersectionObserver effect depends only on `[wantsMotion]`. When the `<video>` element appears after the first render, the observer never attaches. That happens when the session loads before `/exercises` (on cold load or reload), when you swap from an image exercise to a video one, or when the view moves from the fallback letter to video. With `preload="none"` the video never loads, so the box stays empty grey. `failed` also isn't reset when `src` changes, so swapping away from broken media keeps showing the fallback letter.
- **Evidence:** `src/components/ui/MediaThumb.tsx:44, 54-73, 103`.
- **Confidence:** Highly likely.

#### WORKOUT-018 · 🟡 P2 · Workout → Videos under Reduced Motion or Low Power Mode
- **Status:** Deferred — Phase 5 (real iPhone). Partly fixed in Phase 3; Low Power Mode and Reduced Motion playback need a device.
- **Problem:** With Reduced Motion the observer is skipped and there's no poster, so with `preload="none"` nothing ever shows. iOS Low Power Mode blocks autoplay, `play()` rejects silently, and the box stays blank. `thumbnail_url` is never used as a poster.
- **Evidence:** `src/components/ui/MediaThumb.tsx:47, 56, 93-113`.
- **Confidence:** Confirmed for Reduced Motion. Requires iPhone for Low Power Mode.

#### WORKOUT-019 · 🟡 P2 · Workout → Delete set and remove exercise feedback
- **Status:** ✅ Fixed — Phase 2. Deleting a set and removing an exercise are optimistic, so the row leaves on the tap. Gaps in set numbers remain by design. *Files:* `src/hooks/use-workout-session.ts`. *Verified:* Static/build only.
- **Problem:** Both are non-optimistic with no pending state. The swiped row springs closed and stays visible until the refetch, so users delete again, the second DELETE 404s, and an error toast appears. Deleted middle sets leave permanent numbering gaps (1, 3, 4).
- **Evidence:** `use-workout-session.ts:85-92, 202-208`; `SwipeRow.tsx:128-132`.
- **Confidence:** Confirmed.

#### WORKOUT-020 · 🟡 P2 · Workout → Add set under latency
- **Status:** ✅ Fixed — Phase 3. Every Add-set tap adds one row immediately. Set numbers are reserved across in-flight taps, and pending saves never disable the button. *Files:* `src/app/(app)/workout/[sessionId]/page.tsx`. *Verified:* Verified in browser (mock backend, 375×812, Phase 3) (800 ms latency): 3 taps → 3 rows within 200 ms; the server has sets 1, 2, 3.
- **Problem:** The per-exercise guard holds for the whole POST round trip, so extra taps are dropped rather than queued (3 taps on a slow network give 1 set). New rows have `pointer-events:none` and 70 % opacity until saved.
- **Evidence:** `page.tsx:373-384`; `SetRow.tsx:277, 285`; `ExerciseCard.tsx:336`.
- **Confidence:** Confirmed.

#### WORKOUT-021 · 🟡 P2 · Workout → Per-second full re-render
- **Status:** ✅ Fixed — Phase 4 + Phase 5. Phase 4 isolated the 1 s clock. Phase 5 measured the rest of the tree on a 10-exercise / 52-set session (temporary render counters, since removed): one Add set re-rendered **all 10 cards and ~400 set rows** (4 cache commits each), because the mutations rebuilt every exercise object and the page passed new inline callbacks. Fixed by (1) mutations keeping the identity of untouched exercises, (2) `ExerciseCard` memoised on what it shows, with the page's handlers routed through a latest-ref so skipped renders can't use stale closures. Now Add set re-renders 1 card (4 vs 80 renders) and 9 rows (36 vs 400 counted); changing a set type, 2 cards; typing a digit, only the edited card; timer running idle, none. No long tasks (>50 ms) in any of it. *Files:* `src/hooks/use-workout-session.ts, src/components/workout/ExerciseCard.tsx, src/app/(app)/workout/[sessionId]/page.tsx`. *Verified (Phase 5):* browser, desktop Chromium. *Not measured:* real-device frame rate, scroll smoothness, input latency, or heap (a 20-tap burst moved the JS heap 35→53 MB, which one GC can't distinguish from growth — inconclusive).
- **Problem:** `now` state at the page root ticks every second and re-renders every ExerciseCard, SetRow, Reorder item and SwipeRow. Inline closures defeat any memoisation. This causes jank while scrolling or typing on older iPhones.
- **Evidence:** `page.tsx:96, 111-114, 604-639`.
- **Confidence:** Confirmed.

#### WORKOUT-022 · 🟡 P2 · Workout → 3-hour auto-end
- **Status:** 🟡 Partly fixed — Phase 4. Phase 5 triage: the remaining part (a warning before the 3 h cut-off, and not cutting off a workout that is actively being logged) is a product decision — deferred.
- **Problem:** At 3 h the workout auto-completes and redirects to history, even while you're actively logging (a long leg day, or chatting between sets). There's no warning. The end time is set to the last *completed* set. If the PATCH fails, the `autoEnded` ref blocks any retry and nothing tells you.
- **Evidence:** `page.tsx:122-133`; `src/lib/format.ts:78-90`.
- **Confidence:** Confirmed.

#### WORKOUT-023 · 🟡 P2 · Workout → Navigation away and back
- **Status:** 🟡 Partly fixed — Phase 3. Phase 5 triage: the back button going to Home rather than "back" is a deliberate choice for a focused full-screen screen — deferred as a product decision; scroll restoration works.
- **Problem:** The back button uses `router.push("/home")` rather than going back. Going to exercise detail and back lands at the top of the workout, because the layout scrolls to the top on every pathname change.
- **Evidence:** `page.tsx:522`; `src/app/(app)/layout.tsx:19-21`.
- **Confidence:** Confirmed.

#### WORKOUT-024 · 🟡 P2 · Workout → Discard
- **Status:** 🟡 Partly fixed — Phase 4. Phase 5 triage: what's left is `window.confirm` looking non-native — a polish item, deferred to the polish phase. All data-safety parts are fixed.
- **Problem:** Discard uses `window.confirm`, which looks non-native and blocks. It navigates first and deletes second. If the DELETE fails, nothing is shown and the workout reappears as "Resume". The `overload_exercise_order_<id>` key and the rest timer are left behind.
- **Evidence:** `page.tsx:488-498`; `use-workouts.ts:47-60`.
- **Confidence:** Confirmed.

#### WORKOUT-025 · 🔵 P3 · Workout → Superset ungroup
- **Problem:** No confirmation, no pending state and no onError. (Known gap: there's no UI to create supersets.)
- **Evidence:** `page.tsx:632`; `SupersetGroup.tsx:22-29`.
- **Confidence:** Confirmed.

#### WORKOUT-026 · 🟡 P2 · Workout → Completing an empty set
- **Status:** ✅ Fixed — Phase 2. Tapping ✓ with no reps and nothing from last time opens the reps field instead. *Files:* `src/components/workout/SetRow.tsx`. *Verified:* Static/build only.
- **Problem:** With no previous values, ✓ marks the set complete with null weight and reps. It counts in "Sets" and shows green "Not logged" in history.
- **Evidence:** `SetRow.tsx:337-351`; `format.ts:160-181`.
- **Confidence:** Confirmed.

#### WORKOUT-027 · 🔵 P3 · Workout → Side effects before confirmation
- **Status:** Open (Phase 4 re-checked: a failed tick still leaves its rest timer running).
- **Problem:** The rest timer, celebration and auto-favourite fire before the completion PATCH succeeds. If it fails, the tick rolls back but the timer keeps running and the favourite stays.
- **Evidence:** `page.tsx:460-471`.
- **Confidence:** Confirmed.

#### WORKOUT-028 · 🔵 P3 · Workout → Duplicate exercises
- **Problem:** The picker gives no "already in workout" indicator, so the same exercise is easy to add twice.
- **Evidence:** `ExercisePicker.tsx:111-126`.
- **Confidence:** Confirmed.

#### WORKOUT-029 · 🟡 P2 · Workout → Error toast UX
- **Status:** 🟡 Partly fixed — Phase 4; classified in Phase 5 (see 9.5). Retry buttons were deliberately **not** added: a failed set write is rolled back, so the user's retry is simply repeating the action, and an automatic or button retry of an ordered, optimistic write could apply it after later edits. Remaining: one error at a time.
- **Problem:** A single 4 s toast at the top with no retry and no dismiss. It shows raw messages (AUTH-008) and is hidden under the summary. A newer error replaces an older one.
- **Evidence:** `page.tsx:100-110, 658-667`.
- **Confidence:** Confirmed.

#### WORKOUT-030 · ⚪ P4 · Workout → Checkmark pulse
- **Status:** ✅ Fixed — Phase 6. The tick's pop animation no longer plays for sets that are already complete when the row mounts (`initial={false}`); it still plays when a set is ticked. *Verified:* typecheck/build and the browser smoke test (ticking works); the animation itself was not inspected frame by frame.
- **Problem:** `animate={{scale:[1,1.3,1]}}` runs on mount for every completed set (page load, coming back from detail) and on every refetch flip.
- **Evidence:** `SetRow.tsx:359`.
- **Confidence:** Confirmed.

#### WORKOUT-031 · 🔵 P3 · Workout → Copy previous
- **Problem:** The small "Previous" text is a button that overwrites typed weight and reps with one stray tap, with no undo.
- **Evidence:** `SetRow.tsx:269-272, 302-310`.
- **Confidence:** Confirmed.

#### WORKOUT-032 · 🔵 P3 · Workout → Finishing with nothing logged
- **Status:** 🟡 Partly fixed — Phase 4. Finish with no completed sets now offers to discard instead of saving an empty entry. Finishing with some sets unticked still goes through unprompted. *Files:* `src/app/(app)/workout/[sessionId]/page.tsx`. *Verified (Phase 4):* browser (Cancel stays put; OK discards; discard failure then retry).
- **Problem:** Finish with zero exercises, zero completed sets, or incomplete sets goes through without a prompt, which creates empty history entries.
- **Evidence:** `page.tsx:481-486`.
- **Confidence:** Confirmed.

#### WORKOUT-033 · 🔵 P3 · Workout → Summary lost on reload
- **Status:** Open.
- **Problem:** The summary exists only in component state. A reload redirects to the history page.
- **Evidence:** `page.tsx:95, 130-133`.
- **Confidence:** Confirmed.

#### WORKOUT-034 · 🔵 P3 · Workout → PR detection
- **Status:** 🟡 Partly fixed — Phase 4. The finish summary's limited history no longer shares a cache key with the cards' unbounded history (`["exercise-history", id, "recent-50"]`), and both are invalidated when a workout is finished or deleted. PR logic (weight only, warm-ups, assisted) is unchanged. *Files:* `src/components/workout/WorkoutSummary.tsx, src/hooks/use-workouts.ts`. *Verified (Phase 4):* browser — exercise detail showed 4 sessions; after finishing a workout it showed 5 on a client-side return inside the 30 s stale window.
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
- **Status:** ✅ Fixed — Phase 2. A rest_time of 0 means no timer. *Files:* `src/app/(app)/workout/[sessionId]/page.tsx`. *Verified:* Static/build only.
- **Problem:** `rest_time: 0` sets `endAt = now`, `remaining` is 0, and `ring()` fires immediately (chime plus vibration) on every tick.
- **Evidence:** `RestTimer.tsx:118-123, 164-175`.
- **Confidence:** Confirmed.

#### WORKOUT-038 · 🔵 P3 · Workout → Drag to reorder on iPhone
- **Problem:** Cards are tall (176 px video plus sets), so dragging past the viewport depends on Framer's Reorder auto-scroll. Starting from the 40 px handle inside the overlay pill next to ✕ invites mis-taps (WORKOUT-004).
- **Evidence:** `page.tsx:711-725`; `ExerciseCard.tsx:154-171`.
- **Confidence:** Requires iPhone.

#### WORKOUT-039 · 🔵 P3 · Workout → Duplicate `set_number`
- **Status:** 🟡 Partly fixed — Phase 3. Exercise-detail history rows no longer key on set_number alone. *Files:* `src/app/(app)/exercises/[id]/page.tsx`. *Verified:* Static/build only.
- **Problem:** Sets added concurrently from two tabs or devices, or via a race, can share a `set_number`. History lists use `key={set_number}`, which causes React key collisions.
- **Evidence:** `exercises/[id]/page.tsx:209`; `page.tsx:389`.
- **Confidence:** Suspected.

### 3.7 Rest timer

#### REST-001 · 🟡 P2 · Rest timer → Global persistence
- **Status:** ✅ Fixed — Phase 3; Phase 4 also clears it on Finish and Discard and removes the timer from the finish summary. *Verified (Phase 4):* browser.
- **Problem:** `overload_rest_timer` is a single global key, not per session or per user. It survives Finish, Discard and logout, so the next workout (or the next user) opens with a leftover countdown that can still ring.
- **Evidence:** `RestTimer.tsx:12, 105-116`.
- **Confidence:** Confirmed.

#### REST-002 · 🟡 P2 · Rest timer → Background or locked phone
- **Status:** Blocked — platform/infrastructure (Phase 4 verdict stands; Phase 5 did not change it). Needs Web Push (service worker + push subscription + a server scheduling a push for the rest end; iOS 16.4+ installed PWA with notification permission). *Requires iPhone.*
- **Problem:** The end is only signalled by in-page JS, and `ring()` only fires within 5 s of the end. With the phone locked or the PWA in the background (the normal state between sets), there's no sound, vibration or notification, and it stays silent when you come back.
- **Evidence:** `RestTimer.tsx:164-175`.
- **Confidence:** Requires iPhone (the logic itself is confirmed).

#### REST-003 · 🟡 P2 · Rest timer → Audio unlock happens once
- **Status:** Deferred — Phase 5 (real iPhone). Partly fixed in Phase 3; audio resuming after a lock can only be checked on a device.
- **Problem:** The AudioContext is unlocked on the first `pointerdown` only (`once: true`). iOS suspends or interrupts it on background or lock, and nothing resumes it, so the chime stops working for the rest of the workout.
- **Evidence:** `RestTimer.tsx:41-58, 100-104`.
- **Confidence:** Requires iPhone.

#### REST-004 · ⚪ P4 · Rest timer → Ring wind-up
- **Problem:** The `stroke-dashoffset 1s linear` transition animates from the previous value when the timer restarts.
- **Evidence:** `RestTimer.tsx:229`.
- **Confidence:** Confirmed.

### 3.8 Add-exercise picker

#### PICK-001 · 🟡 P2 · Picker → Long-press preview on iOS
- **Status:** ✅ Fixed — Phase 3. A scrim only closes on a press that started on it, so the release of the long-press (or an iOS ghost click) can't dismiss the peek. *Files:* `src/components/ui/Sheet.tsx (Scrim), src/components/workout/ExercisePicker.tsx`. *Verified:* Verified in browser (mock backend, 375×812, Phase 3): a click with no press didn't close it, a real tap did. Long-press on iOS requires an iPhone.
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
- **Status:** ✅ Fixed — Phase 6. The equipment filter also matches the exercise's `equipment` field, not just its name. *Verified:* code and typecheck only (the demo data has few equipment values).
- **Problem:** The filter matches on the exercise *name* and ignores the `equipment` field.
- **Evidence:** `ExercisePicker.tsx:117-118`.
- **Confidence:** Confirmed.

#### PICK-005 · 🔵 P3 · Picker → 204 from `/last-set`
- **Status:** ✅ Fixed — Phase 6. `getLastSet` turns a 204 into `null`, so React Query no longer treats it as an error and retries. *Verified:* code and typecheck.
- **Problem:** `apiRequest` returns `undefined` on a 204. React Query v5 treats undefined data as an error ("Query data cannot be undefined"), retries once and logs a console error.
- **Evidence:** `client.ts:96-98`; `mock/handlers.ts:190`; `use-exercises.ts:25-31`.
- **Confidence:** Confirmed (mock). The real API may differ.

#### PICK-006 · ⚪ P4 · Picker → Small issues
- **Problem:** Escape closes the preview and the sheet together. The muscle-strip skeleton is tied to *exercises* loading, so a muscles error shows an empty strip.
- **Evidence:** `ExercisePicker.tsx:320, 442-449`; `Sheet.tsx:84-91`.
- **Confidence:** Confirmed.

### 3.9 Sheets, gestures, scrolling, layout (cross-cutting)

#### UI-001 · 🟡 P2 · Sheet → Exit swallows input
- **Status:** ✅ Fixed — Phase 3. The sheet layer stops catching touches the moment its exit animation starts (useIsPresent). *Files:* `src/components/ui/Sheet.tsx`. *Verified:* Verified in browser (mock backend, 375×812, Phase 3): 50 ms after close, taps reach the page and the scroll lock is released.
- **Problem:** During the exit animation (about 300–400 ms) the `fixed inset-0 z-50` wrapper stays mounted with no `pointer-events:none`.
- **Repro:** Close any sheet, then immediately scroll or tap.
- **Actual:** The first gesture does nothing.
- **Evidence:** `src/components/ui/Sheet.tsx:96-99`.
- **Confidence:** Confirmed.

#### UI-002 · 🟡 P2 · Sheet → Drag area
- **Status:** ✅ Fixed — Phase 3. The sheet header (title row) is now a drag surface as well as the grabber. Pulling down from scrolled-to-top content is still not supported. *Files:* `src/components/ui/Sheet.tsx`. *Verified:* Verified in browser (mock backend, 375×812, Phase 3): X still closes the sheet. The drag gesture itself is static only.
- **Problem:** Drag-to-dismiss only starts from a grabber about 16 px tall. The header isn't draggable, and pulling down when the content is at scroll-top doesn't dismiss. That doesn't feel native.
- **Evidence:** `Sheet.tsx:145-150`.
- **Confidence:** Confirmed.

#### UI-003 · 🟡 P2 · Sheet → iOS scroll lock
- **Status:** Deferred — Phase 5 (real iPhone). Partly fixed in Phase 3; background scroll lock behaviour needs a device.
- **Problem:** The lock is only `body { overflow:hidden }`. iOS Safari can still scroll or rubber-band the page behind via touches on the scrim, and there's no `position:fixed` lock.
- **Evidence:** `Sheet.tsx:24-30`.
- **Confidence:** Requires iPhone.

#### UI-004 · 🔵 P3 · Dialogs → Accessibility
- **Status:** 🟡 Partly fixed — Phase 6. Every `Sheet` now moves focus into the dialog when it opens, keeps Tab inside it, closes on Escape, and returns focus to what opened it (it already had `role="dialog"`, `aria-modal`, a label and a 44 px Close). *Verified:* browser — focus inside on open, Tab from the last control wraps to the first, Escape closes, focus returns to the "New split" button. Not done: the exercise preview dialog, `inert` on the page behind, a screen-reader run.
- **Problem:** No focus move, focus trap or focus return in the Sheet or the preview dialog. The background stays reachable by screen readers. Interactive `<div>`s include the drag grabber and the scrims.
- **Evidence:** `Sheet.tsx`, `ExercisePicker.tsx:453-543`.
- **Confidence:** Confirmed.

#### UI-005 · 🔵 P3 · Dialogs → Back with a sheet open
- **Problem:** Browser or OS back navigates the page instead of closing the sheet.
- **Evidence:** `Sheet.tsx` (no history entry).
- **Confidence:** Confirmed.

#### UI-006 · 🟡 P2 · SwipeRow → Gesture handling
- **Status:** ✅ Fixed — Phase 3. Each gesture's axis is locked when it starts; touch-action:pan-y is set; a tap on an open row closes it instead of hitting the content; the click that ends a swipe is swallowed. *Files:* `src/components/ui/SwipeRow.tsx`. *Verified:* Verified in browser (mock backend, 375×812, Phase 3) (mouse): the swipe opened without opening the keypad, a tap closed the row, and the next tap opened the field. Touch requires an iPhone.
- **Problem:**
  - No `touch-action: pan-y`.
  - The direction is re-derived from the cumulative delta on every move, so diagonal drags jitter and can leave the row half-open mid-gesture.
  - Tapping inside an *open* row triggers the content (navigates in History, opens the keypad on a shifted set row) instead of closing it.
  - `trackMouse` lets desktop drags click links.
  - Every row adds a document listener.
- **Evidence:** `src/components/ui/SwipeRow.tsx:64-99, 146-152`.
- **Confidence:** Highly likely.

#### UI-007 · 🟡 P2 · Layout → Scroll reset on every navigation
- **Status:** ✅ Fixed — Phase 3. Each history entry stores its own scroll position (in history.state). New navigations start at the top; Back and Forward restore the stored position. popstate can't be used, because Next 16 renders the page before it fires. *Files:* `src/app/(app)/layout.tsx`. *Verified:* Verified in browser (mock backend, 375×812, Phase 3): workout at 700 px → exercise detail (0) → Back → 700 px.
- **Problem:** `useLayoutEffect(() => scrollTo(0))` runs on every pathname change. Back from a history detail lands at the top of a long history list, and back from exercise detail lands at the top of the workout.
- **Evidence:** `src/app/(app)/layout.tsx:19-21`.
- **Confidence:** Confirmed.

#### UI-008 · 🟡 P2 · iOS → Status bar in Light theme
- **Status:** Deferred — Phase 5 (real iPhone). Status-bar colour in Light theme needs a device (and a decision on `black-translucent`).
- **Problem:** `statusBarStyle: "black-translucent"` always draws white status-bar text. In Light theme the time and battery are white on white.
- **Evidence:** `src/app/layout.tsx:36-40`.
- **Confidence:** Requires iPhone (well-known iOS behaviour).

#### UI-009 · 🔵 P3 · iOS → Callouts and text selection
- **Status:** 🟡 Partly fixed — Phase 3. Phase 6 triage: needs a device (deferred to the iPhone pass).
- **Problem:** Selection and callouts are only disabled on media and picker rows. A long-press on the exercise name `<Link>` in a card opens the iOS link preview, and long-presses on rows select text.
- **Evidence:** `ExerciseCard.tsx:227-232`; `globals.css` (no global `user-select`).
- **Confidence:** Requires iPhone.

#### UI-010 · 🔵 P3 · iOS → Double-tap
- **Status:** ✅ Fixed — Phase 3. touch-action: manipulation on controls, in the base layer so the touch-none and pan-y utilities still win. *Files:* `src/app/globals.css`. *Verified:* Requires iPhone.
- **Problem:** There's no `touch-action: manipulation`. Rapid keypad or stepper taps may be treated as a double-tap zoom or merged into one.
- **Evidence:** `globals.css`; `NumericKeypad.tsx:143-155`.
- **Confidence:** Requires iPhone.

#### UI-011 · 🔵 P3 · Layout → Long names
- **Status:** ✅ Fixed — Phase 6. The large title, the launch-gate heading and the finish-summary heading break long unbroken names (`overflow-wrap: anywhere`). *Verified:* code only; no overlong name was entered.
- **Problem:** Long names without spaces overflow horizontally in the `LargeTitle` h1, the LaunchGate "It's {name}!" (uppercase stat font) and the Summary title, which have no `break-words` or truncation.
- **Evidence:** `LargeTitle.tsx:99`; `LaunchGate.tsx:97-99`; `WorkoutSummary.tsx:123-125`.
- **Confidence:** Confirmed.

#### UI-012 · ⚪ P4 · Layout → Tap targets under 44 px
- **Status:** 🟡 Partly fixed — Phase 6. The 36 px header/session-bar buttons (back, discard, QR, new split, exercise back, membership delete), the set-type button and the theme segments now have a 44 px hit area with no visual change (an invisible `::before`). "Copy previous" and the "Remove" avatar link are still small. *Verified:* build and browser smoke (controls still work); hit areas not measured on a device.
- **Problem:** The theme segmented control (32 px), the session-bar back and discard (36 px), the Home QR and new-split header buttons (36 px), the membership trash (36 px), the "Remove" avatar link and the "Copy previous" text are all under 44 px.
- **Evidence:** `profile/page.tsx:160, 344`; `workout page:525, 550`.
- **Confidence:** Confirmed.

#### UI-013 · 🔵 P3 · Layout → Remount on every navigation
- **Problem:** `motion.main key={pathname}` remounts the page with a fade on every navigation, which replays stagger animations and skeletons and adds layout shift.
- **Evidence:** `src/app/(app)/layout.tsx:32-36`.
- **Confidence:** Confirmed.

### 3.10 State, cache and history

#### STATE-001 · 🟡 P2 · History → 50-session cap
- **Status:** 🟡 Partly fixed — Phase 4. Phase 5 triage: blocked on confirming the real API honours the `before` cursor (and its maximum `limit`); Home's streak reading only the latest 50 is a separate, accepted limit until then.
- **Problem:** `GET /workouts?limit=50` with no pagination. Workout 51 and older are unreachable. "N workouts logged" and the streak are capped by the 50.
- **Evidence:** `src/hooks/use-workouts.ts:6-11`; `history/page.tsx:48`.
- **Confidence:** Confirmed.

#### STATE-002 · 🟡 P2 · History → Swipe delete
- **Status:** ✅ Fixed — Phase 2. History swipe-delete asks for confirmation; Phase 4 adds a toast when a delete fails ("Workout not deleted — it's still in your history."). *Verified (Phase 4):* browser.
- **Problem:** The optimistic removal has no rollback or error message: the row reappears silently on failure. There's no confirmation, so one swipe and tap irreversibly deletes a whole workout.
- **Evidence:** `history/page.tsx:97`; `use-workouts.ts:47-60`.
- **Confidence:** Confirmed.

#### STATE-003 · 🟡 P2 · History detail → No error state
- **Status:** ✅ Fixed — Phase 3. An error / not-found state with retry. *Files:* `src/app/(app)/history/[sessionId]/page.tsx`. *Verified:* Verified in browser (mock backend, 375×812, Phase 3): /history/99999.
- **Problem:** A missing or deleted session, or a network error, gives an endless skeleton.
- **Evidence:** `history/[sessionId]/page.tsx:95-99`.
- **Confidence:** Confirmed.

#### STATE-004 · 🔵 P3 · Memory → Alias maps
- **Status:** Open — not worth fixing (Phase 6 triage): two small Maps that grow by one entry per added set/exercise until reload.
- **Problem:** `setKeyAlias` and `exerciseKeyAlias` are module-level Maps that are never cleared, so they grow across workouts until reload.
- **Evidence:** `use-workout-session.ts:17-18`.
- **Confidence:** Confirmed.

#### STATE-005 · 🔵 P3 · localStorage → Robustness
- **Status:** 🟡 Partly fixed — Phase 2/4/6. User-scoped keys are cleared on logout and user change; favourites are shape-checked and their `setItem` is guarded; the theme write is guarded. Still unguarded: the workout order and rest-timer `setItem` calls, and the login `persist()`.
- **Problem:**
  - No key is namespaced per user.
  - `overload_exercise_order_<sessionId>` is written per session and never deleted.
  - JSON reads aren't shape-checked: a non-array `overload_favorites` makes `.includes` throw in the picker or favourites.
  - `setItem` calls are unguarded in `persist()` (login), `writeStored`, `saveOrder` and `writeFavoriteIds`. When storage is unavailable or full, login or set completion throws.
- **Evidence:** `use-favorites.ts:31-43`; `page.tsx:57-69`; `RestTimer.tsx:32-34`; `use-auth.ts:73-82`.
- **Confidence:** Confirmed.

### 3.11 Profile

#### PROF-001 · 🟡 P2 · Profile → Membership date uses UTC
- **Status:** ✅ Fixed — Phase 5. The default and `max` date use the local calendar, not UTC. *Files:* `src/app/(app)/profile/page.tsx`. *Verified (Phase 5):* code and typecheck only; not tested across a midnight/timezone boundary.
- **Problem:** `todayInputValue()` uses `toISOString()` (UTC) for both the default and `max`. Ahead of UTC (Europe) in the early hours you can't pick your local "today". Behind UTC in the evening, the default is tomorrow.
- **Evidence:** `profile/page.tsx:226-228, 357-360`.
- **Confidence:** Confirmed.

#### PROF-002 · 🟡 P2 · Profile → Avatar
- **Status:** ✅ Fixed — Phase 3. Messages for a wrong file type, a file that's too large, and a failed upload or remove. Shows "Uploading picture…" while uploading. *Files:* `src/app/(app)/profile/page.tsx`. *Verified:* Static/build only.
- **Problem:** A wrong type or a file over 5 MB is silently ignored. Upload and remove errors are silent. There's no progress indicator during upload.
- **Evidence:** `profile/page.tsx:64-71, 130`.
- **Confidence:** Confirmed.

#### PROF-003 · 🟡 P2 · Profile → Membership
- **Status:** ✅ Fixed — Phase 2 + Phase 3. Phase 2: removing the payment asks for confirmation. Phase 3: log and remove errors are shown, the button reads "Logging…" while pending, and repeat taps are ignored. *Files:* `src/app/(app)/profile/page.tsx`. *Verified:* Static/build only.
- **Problem:** The trash icon deletes the payment record in one tap with no confirmation. Log and delete errors are silent. A query error renders "No payment logged".
- **Evidence:** `profile/page.tsx:268-271, 279-294, 339-347`.
- **Confidence:** Confirmed.

#### PROF-004 · 🔵 P3 · Profile → Expiry date parsing
- **Status:** ✅ Fixed — Phase 6. `daysUntil` and `formatMembershipDate` read the first 10 characters, so a full ISO timestamp from the API no longer yields "NaN days left". *Verified:* code only.
- **Problem:** `daysUntil` assumes a bare `YYYY-MM-DD`. If the real API sends a full ISO datetime, the screen shows "NaN days left".
- **Evidence:** `format.ts:123-127`.
- **Confidence:** Suspected.

#### PROF-005 · ⚪ P4 · Theme → Flashes
- **Problem:** The segmented control renders "Auto" selected for the first frame, then flips to the stored value. The manifest's `background_color` and `theme_color` are #000, so a Light-theme user gets a black splash and then a white flash. (Known gap: Auto resolves to dark, confirmed.)
- **Evidence:** `ThemeProvider.tsx:73-82`; `manifest.ts:19-20`.
- **Confidence:** Confirmed.

### 3.12 PWA lifecycle, performance, build

#### PWA-001 · 🟠 P1 · Boot → Mock build black screen
- **Status:** ✅ Fixed — Phase 3. If the MSW service worker can't register, the mocks are served by wrapping fetch instead. The demo build no longer sits on a black screen. *Files:* `src/lib/mock/browser.ts`. *Verified:* Verified in browser (mock backend, 375×812, Phase 3): the pane blocks service workers, and the app now boots.
- **Problem:** With `NEXT_PUBLIC_USE_MOCKS=true` (as `.env.local` sets it), `Providers` renders `null` until MSW starts, and it never handles a rejection. If service-worker registration fails (private browsing, SW disabled, storage evicted, some webviews), the screen is black forever.
- **Evidence:** `src/app/providers.tsx:18-31, 41`.
- **Confidence:** **Confirmed live** (black screen plus "[MSW] Failed to register the Service Worker" during this audit).

#### PWA-002 · 🟠 P1 · PWA → No offline support
- **Status:** Open — deliberate (Phase 5 investigation, see 9.2). Offline *behaviour* is now sound: inside a workout you can keep editing (held and replayed in order, with "Offline · will sync"), and cold-navigating to a screen offline shows a real error with a retry instead of an empty or endless-loading screen (NEW-016). Still not built, on purpose: an app-shell service worker (a cold launch with no signal still gets the browser's offline page) and a persisted write queue (NEW-015). *Backend dependency:* a safe persisted queue needs idempotency keys and a version/precondition on writes. *Requires iPhone:* what iOS does to the PWA and its queue in the background.
- **Problem:** There's no app service worker or app-shell cache, and React Query isn't persisted.
- **Actual:** Cold-launching with no signal (a basement gym) shows Safari's offline page. The workout, the QR and history are all unavailable. If the app is killed with unsynced mutations in flight, they're lost.
- **Evidence:** `public/` (only `mockServiceWorker.js`), `next.config.ts`, `providers.tsx`.
- **Confidence:** Confirmed (the iOS outcome needs an iPhone).

#### PWA-003 · 🟠 P1 · Perf/Data → VideoPrefetcher
- **Status:** ✅ Fixed — Phase 5. Investigation: `VideoPrefetcher` fetched every exercise video and thumbnail (4 at a time, once per session, right after login) with `cache: "force-cache"`; the `navigator.connection` guard doesn't exist on Safari. Exercise clips otherwise load lazily (`preload="none"` until an IntersectionObserver sees the card ≥25 % visible). Now it only warms the small, app-hosted muscle illustrations, and skips save-data, 2G and cellular connections where the API exists. *Files:* `src/components/VideoPrefetcher.tsx`. *Verified (Phase 5):* browser, with every demo exercise given a clip URL — opening a 10-exercise workout requested 0 clips on load, 2 once the first frame rendered (the two cards on screen), and 6 after scrolling through ~4 screens; none for the rest. The picker uses the same component and the same gate. *Not verified:* real mp4 sizes, Safari range requests, Low Power Mode (iPhone).
- **Problem:** Once per app session it downloads **every** exercise video and thumbnail, four at a time, right after login. The cellular check uses `navigator.connection`, which Safari doesn't have, so on iPhone it always runs, including on cellular. That competes with API calls at the gym. Safari's `<video>` uses range requests, which often can't reuse a full `fetch()` cache entry, so the download may be wasted entirely. The hook dependency on `muscles` is missing.
- **Evidence:** `src/components/VideoPrefetcher.tsx:18-21, 51-79`.
- **Confidence:** Highly likely.

#### PWA-004 · 🟡 P2 · iOS → No haptics at all
- **Status:** Blocked — platform. iOS Safari has no `navigator.vibrate`; nothing to fix in the app (a Taptic-style feedback isn't available to web apps).
- **Problem:** iOS Safari has no `navigator.vibrate`. All haptic feedback (completion, rest end, picker) is silently absent on the target device.
- **Evidence:** `SetRow.tsx:230`; `RestTimer.tsx:55`; `ExercisePicker.tsx:136`.
- **Confidence:** Confirmed (platform).

#### PWA-005 · 🔵 P3 · Boot → Blank frames
- **Problem:** Providers render `null` until mocks are ready, then AppLayout renders `null` until the auth effect runs, then the gate shows a black overlay. That's three blank phases before any content.
- **Evidence:** `providers.tsx:41`; `(app)/layout.tsx:23`; `LaunchGate.tsx:50-55`.
- **Confidence:** Confirmed.

#### PERF-001 · 🔵 P3 · Workout → Unbounded history per card
- **Status:** ✅ Fixed — Phase 5. Workout cards ask for the 3 most recent sessions of an exercise (`limit=3`, own cache key) instead of its whole history; the exercise detail page still loads all of it. *Files:* `src/hooks/use-exercises.ts, src/components/workout/ExerciseCard.tsx`. *Verified (Phase 5):* browser — one request per exercise on opening a workout, none duplicated. *Caveat:* the mock ignores `limit`, and I haven't confirmed the real API's semantics (most recent N sessions assumed, as `seedFirstSet` already did).
- **Problem:** Each ExerciseCard fetches the full, unlimited exercise history: N requests with unbounded payloads every time the workout opens.
- **Evidence:** `ExerciseCard.tsx:83`; `use-exercises.ts:17-23`.
- **Confidence:** Confirmed.

#### PERF-002 · 🔵 P3 · Workout → Layout animations vs the scroll-spy
- **Problem:** Reorder.Item layout animations run on every height change. On every scroll frame the scroll-spy calls `getBoundingClientRect` on all cards, forcing layout during the animations.
- **Evidence:** `page.tsx:271-301, 721`.
- **Confidence:** Highly likely.

#### PERF-003 · ⚪ P4 · Perf → Always-running effects
- **Status:** 🟡 Partly fixed — Phase 6. The streak flame no longer animates forever when the streak is 0. The auth background blob is unchanged (iPhone check).
- **Problem:** The streak flame pulses forever, and the auth background animates an 85vmax `blur(120px)` blob. Both are GPU-heavy on older iPhones.
- **Evidence:** `home/page.tsx:392-399`; `AuthBackground.tsx:22-37`.
- **Confidence:** Confirmed.

#### PERF-004 · 🔵 P3 · Perf → A video per card
- **Problem:** Every exercise card has a looping video. The IntersectionObserver plays any card that is at least 25 % visible, so 2–3 decoders often run at once through an hour-long workout, which costs battery and heat.
- **Evidence:** `MediaThumb.tsx:64-70`; `ExerciseCard.tsx:140-150`.
- **Confidence:** Highly likely.

#### BUILD-001 · 🔵 P3 · Build → ESLint fails (18 errors, 4 warnings)
- **Status:** ✅ Fixed — Phase 6. `npm run lint` is now 0 errors, 0 warnings (was 18 / 4 at the audit, 16 / 2 at the start of Phase 6). No rule is disabled to get there: the `setState`-in-effect patterns became `useSyncExternalStore` (theme, signed-in user, favourites, a `useMounted` hook for portals), "adjust state while rendering" (picker open/close reset, set-row draft) or derived values (workout display order, focused card, rest-timer restore and expiry); the generated `public/mockServiceWorker.js` is now in the ESLint ignore list (it is vendor output); unused config variables removed. The remaining `eslint-disable-next-line` comments are on `<img>` for blob/remote sources and two intentional `exhaustive-deps` cases. *Verified:* lint, typecheck, build, and the browser smoke test (theme, sign-in/out, favourites, rest timer and its restore after reload, saved exercise order after reload, sheets).
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
- **Status:** ✅ Fixed — Phase 6. README now describes the real stack (Next 16, TanStack Query, Tailwind 4, Framer Motion, an external API, MSW demo mode), the env variables, the scripts and the demo switches.
- **Problem:** The README describes Next 15, Supabase, Sonner and qrcode.react, none of which are in the dependencies.
- **Evidence:** `README.md`.
- **Confidence:** Confirmed.

#### BUILD-003 · 🔵 P3 · Quality → No tests
- **Status:** 🟡 Partly fixed — Phase 5/6. 9 unit tests (`hasCompletedSets`, `workoutEndTime`, and the 5 auth/refresh tests) run with `npm test`. No component or end-to-end tests.
- **Problem:** There are no unit, integration or e2e tests, so nothing guards the regressions listed above. Highest-value targets: forward-fill, `workoutEndTime`, `suggestSplit`, `currentStreak`, `daysUntil`, and the optimistic hooks.
- **Confidence:** Confirmed.

### 3.13 New issues found in Phase 3

#### NEW-001 · 🟡 P2 · Mock build → API routes collide with page routes
- **Status:** ✅ Fixed — Phase 3. A guard handler passes page/RSC requests through before any mock handler runs. *Files:* `src/lib/mock/browser.ts`. *Verified:* static only (client navigation to /splits wasn't separately exercised).
- **Problem:** The mock API shares the app's origin. `GET /splits` and `GET /splits/:id` also match the RSC fetches Next makes when navigating to the `/splits` and `/splits/new` pages, so the mock answered with JSON and Next fell back to a full page reload, which drops all in-memory state.
- **Confidence:** Highly likely (handler paths vs. page routes).

#### NEW-002 · 🟡 P2 · Start/Resume → Abandoned session offered as "Resume"
- **Status:** ✅ Fixed — Phase 3. `isLiveSession()` (within the 3h window) decides what's resumable. start-or-resume closes an abandoned session at its last completed set, then starts the new one. *Files:* `src/hooks/use-workouts.ts`, `src/app/(app)/home/page.tsx`, `src/components/LaunchGate.tsx`. *Verified:* in the browser (a 5-hour-old session was closed and a new one started; Home showed "Choose split").
- **Problem:** The gate and Home offered "Resume workout" for a session older than 3 h. Tapping it opened the session, the auto-end closed it, and the user landed on that session's history page instead of in a workout.
- **Confidence:** Confirmed (reproduced in the browser with the demo data).

#### NEW-003 · 🔵 P3 · Launch gate → Wrong instruction
- **Status:** ✅ Fixed — Phase 3. The text now says "from the QR button on Today". *Files:* `src/components/LaunchGate.tsx`. *Verified:* static.
- **Problem:** The placeholder said "Add your gym QR in Profile", but QR upload only exists on Today's QR sheet.

#### NEW-004 · 🟡 P2 · Workout → Errors lost under rapid edits
- **Status:** ✅ Fixed — Phase 3. Workout write call sites use `mutateAsync(...).catch(showError)`, which gives each call its own promise. *Files:* `src/app/(app)/workout/[sessionId]/page.tsx`. *Verified:* in the browser (an injected PATCH failure showed its toast).
- **Problem:** React Query only runs the callbacks passed to `mutate(vars, { onError })` for the **latest** call on a hook. With several set edits, adds or deletes in flight, an earlier failure rolled back silently with no toast, and an earlier "Log first set" lost its autofill.
- **Confidence:** Confirmed (documented React Query behaviour).

#### NEW-005 · 🔵 P3 · Queries → 4xx responses retried
- **Status:** ✅ Fixed — Phase 3. 4xx responses are no longer retried. *Files:* `src/app/providers.tsx`. *Verified:* in the browser (the 404 screen appears without the extra retry delay).
- **Problem:** `retry: 1` applied to 404/403 too, which delayed every not-found or error screen by a retry round trip.

#### NEW-006 · 🔵 P3 · History → Empty abandoned sessions become "0m" entries
- **Status:** ✅ Fixed — Phase 4. Decision: an empty session is not a workout, so it is deleted instead of completed. That happens in three places, all through `hasCompletedSets()`: start-or-resume closing a stale session, the 3 h auto-end, and Finish with nothing completed (which asks "Discard this workout?"). Because the session never gets a `completed_at`, History, the streak, "Last workout" and the counts can't see it. Consistent across Resume (it's gone), History, streak and counts; there's no XP in the app. *Files:* `src/lib/format.ts, src/hooks/use-workouts.ts, src/app/(app)/workout/[sessionId]/page.tsx`. *Verified (Phase 4):* browser — a seeded 5 h-old empty session was deleted when "Let's do it!" was tapped; a 7 s-from-cap empty session was deleted and sent Home; a unit test covers the helper. *Remaining:* an empty session already saved as 0m by an older build stays in History (the summary list has no set count to filter on).
- **Problem:** When an abandoned session with no completed sets is closed out (by the 3h auto-end or by start-or-resume), it's saved as a 0-minute workout. It shows as "Last workout · 0m", appears in History, and counts toward the streak. Seen in the browser after NEW-002's close-out.
- **Options:** Delete empty sessions instead of completing them, or hide 0-set sessions from History and the streak.

#### NEW-007 · 🔵 P3 · Keypad → Page jumps when it closes near the bottom
- **Status:** 🟡 Partly fixed — Phase 4. Cause: the keypad's bottom padding on `<body>` (228 px) was removed in a single frame, so with the page scrolled to the bottom the document shrank at once and the browser clamped the scroll position. Now the padding eases out over 0.28 s in step with the panel sliding away, so the scroll position follows continuously instead of jumping (opening is still instant, so scrolling the field into view isn't clamped). *Files:* `src/components/workout/NumericKeypad.tsx`. *Verified (Phase 4):* browser, by stepping the CSS transition: scrollY went 2310 → 2132 → 2092 → 2084 → 2082 across the transition instead of one step. The content still travels the same distance when you're at the very bottom; it now slides. *Requires iPhone:* the iOS visual viewport, rubber-banding and the keyboard-free keypad weren't exercised.
- **Problem:** While the keypad is open, the body gets bottom padding the height of the keypad; closing it removes the padding at once. When the page is scrolled to the bottom, the page shrinks and the content jumps. This matters more now that scrolling with the keypad open is possible (WORKOUT-012).

#### NEW-008 · 🔵 P3 · Workout → Discard failure is invisible
- **Status:** ✅ Fixed — Phase 4 (see WORKOUT-024). A failed discard keeps the workout open, toasts "Workout not discarded — it's still open." and can be retried. *Verified (Phase 4):* browser, failure then retry.
- **Problem:** Discard navigates to Home before the DELETE finishes. If the DELETE fails, the rollback brings the workout back as "Resume", but no error is shown anywhere.

### 3.14 New issues found in Phase 4

#### NEW-009 · 🟡 P2 · Failed saves after leaving the screen were silent
- **Status:** ✅ Fixed — Phase 4.
- **Problem:** The error toast belonged to the workout page. Tick a set, tap Back to Home, and when the request failed a few seconds later the rollback happened (the tick vanished) but nothing said so — the page that would have shown the message was gone.
- **Fix:** Failures are reported by the QueryClient's `MutationCache.onError`, which runs whichever screen is open (`meta.failure` carries the "what happened to my change" half). *Verified (Phase 4):* browser — failed PATCH after navigating to Home toasted on Home.

#### NEW-010 · 🟡 P2 · Writes had no "is it saved?" signal and nothing marked an offline queue
- **Status:** ✅ Fixed — Phase 4.
- **Problem:** With slow signal or no signal, queued edits looked identical to saved ones, and TanStack pauses mutations while the browser is offline without telling anyone.
- **Fix:** The session bar shows "Saving…" while writes are outstanding (after a 0.5 s grace so quick saves don't flash), "Offline · will sync" when the browser reports offline, and nothing when the server has everything. Desktop browsers also get a "leave site?" prompt while writes are outstanding. *Verified (Phase 4):* browser — offline event → label shown, 2 edits held; online event → label gone and both edits reached the server in order. (Not mutation `isPaused`: a write waiting its turn in the queue is "paused" too, which first showed "Offline" wrongly.)

#### NEW-011 · 🟡 P2 · Exercise history stayed stale after finishing or deleting a workout
- **Status:** ✅ Fixed — Phase 4.
- **Problem:** `["exercise-history", id]` and `["last-set", id]` were never invalidated. After Finish, the exercise detail page and the cards' "Previous" column could show pre-workout data for up to 30 s, and Home/History agreed while exercise detail didn't.
- **Fix:** Finishing, auto-ending, and deleting a workout invalidate both. *Verified (Phase 4):* browser (4 → 5 sessions with no reload).

#### NEW-012 · 🔵 P3 · Rest timer ran on the finish summary
- **Status:** ✅ Fixed — Phase 4. The timer is removed with the summary and its stored state cleared (it could chime over the summary and leave a record behind).

#### NEW-013 · 🔵 P3 · Session expiry gave no explanation
- **Status:** ✅ Fixed — Phase 4 (see AUTH-002). The sign-in screen explains it.

#### NEW-014 · ⚪ P4 · Mock offline switch resolved as status 0, not a network error
- **Status:** ✅ Fixed — Phase 4 (mock only). The fetch fallback now throws a `TypeError` for a dropped connection, like a real `fetch`, so the client's "No connection…" message is what's exercised.

#### NEW-015 · 🟡 P2 · Writes in flight when the app is killed are lost (limitation, not a bug to fix cheaply)
- **Status:** Open — documented (see PWA-002). After iOS kills the PWA or the tab is closed mid-save, those edits don't reach the server and nothing replays them.

### 3.15 New issues found in Phase 5

#### NEW-016 · 🟡 P2 · Cold navigation while offline showed empty states
- **Status:** ✅ Fixed — Phase 5. With nothing cached, an offline query *paused* (never loaded, never failed), so History said "No workouts yet", Splits and Today showed nothing/"No splits yet", and Exercise detail showed "?". Queries now use `networkMode: "offlineFirst"` (try anyway; cached data still shows) and don't retry while offline; Splits, Today, History, Profile (membership) and Exercise detail show a real "couldn't load" state with a retry, and recover by themselves when the connection returns. Mutations keep pausing offline. *Verified (Phase 5):* browser, offline event + dead network, cold navigation to each screen, then reconnect. *Not verified:* a real offline cold *launch* (needs PWA-002).

#### NEW-017 · 🟡 P2 · Double/triple taps sent duplicate requests
- **Status:** ✅ Fixed — Phase 5. Triple-tapping Finish sent 3 PATCHes (the `isPending` guard only updates after a re-render); triple-tapping Delete on a set, Discard, History delete, or split delete sent 2–3 DELETEs (a removed row lingers for its exit animation and can be tapped again). Now one request each, guarded by refs. *Verified (Phase 5):* browser at 400–600 ms latency, request counts: Finish 3→1, set delete 3→1, History delete 3→1, Discard 3→1, 5 rapid Add set → 5 distinct sets. Start workout was already guarded (Phase 2).

#### NEW-018 · 🟡 P2 · Logging out dropped saves still in flight
- **Status:** ✅ Fixed — Phase 5. `logout()` cleared the cache and token under queued writes: no error, no rollback message, edits just gone. It now waits (up to 8 s) for outstanding writes ("Signing out…"), then clears; if some are still unsent (offline, stalled server) it says so in a toast on the sign-in screen. *Verified (Phase 5):* browser — 2 adds queued at 700 ms latency then Log out: both reached the server. *Remaining:* offline logout past 8 s still loses the unsent edits, with the toast.

#### NEW-019 · 🟠 P1 · Refresh handling could sign the user out wrongly or resurrect a session
- **Status:** ✅ Fixed — Phase 5 (latent until the backend issues refresh tokens). A refresh that failed for any reason, including a dropped connection, ended the session; and one finishing after sign-out wrote the tokens back. See AUTH-002 for the behaviour now. *Verified (Phase 5):* unit tests + browser with the mock's rotating refresh tokens.

#### NEW-020 · 🔵 P3 · A refetch of the whole session after almost every write
- **Status:** ✅ Fixed — Phase 5. The queue-drain refetch fired every time the queue momentarily emptied (13 GETs for ~21 quick taps against a fast server). It's now debounced 400 ms. Also: finishing/deleting a workout no longer refetches exercise-history queries that are about to unmount (marked stale instead). *Verified (Phase 5):* browser, request counts.

#### NEW-021 · 🔵 P3 · Listener/timer leaks
- **Status:** ✅ Fixed — Phase 5. `ViewportFix` left up to three timeouts running after unmount, and the exercise picker's long-press timer survived the picker closing. Both are now cleaned up. Everything else in the listener audit (9.6) was already clean.

#### NEW-022 · ⚪ P4 · Demo database wasn't shared between tabs
- **Status:** ✅ Fixed — Phase 5 (mock only). Each tab kept its own copy and overwrote the others' writes, so multi-tab behaviour couldn't be tested honestly. Tabs now share it via `storage` events. A first attempt (re-read on every call) lost updates between concurrent requests and was replaced.

#### NEW-023 · 🔵 P3 · Stale tab adds a set that already exists
- **Status:** Open — accepted behaviour (see 9.7). Two tabs: tab B (stale) taps Add set; the server rejects the duplicate set number, B rolls it back and says "Set not added. You cannot add this set.", and B converges when it regains focus. No corruption, but it isn't silent-merge either. *Backend dependency:* the rejection relies on the server enforcing unique set numbers (the mock does; the code comments say the real API does).

#### NEW-024 · 🔵 P3 · Two tabs can each start a workout
- **Status:** 🟡 Mitigated — Phase 7. The cause was real: start-or-resume used `ensureQueryData`, which returns a *stale* cached history list as-is, so a tab that had loaded the list before another tab started a workout went on to start a second one. It now always fetches the list from the server first. *Verified:* two tabs — tab B (list cached, no open workout) tapped Start after tab A had started one and resumed A's workout instead of creating another. *Remaining:* two starts inside the same round trip can still both succeed; only the server can prevent that (backend: refuse or return the existing open workout). Classified BACKEND.

#### NEW-025 · 🔵 P3 · Weight/reps/seconds had no upper limit
- **Status:** ✅ Fixed — Phase 5 (client side). The keypad fields now clamp to what the backend can plausibly store: weight 0–2000 kg with at most 2 decimals, reps 0–999, seconds 0–3600, whole numbers for reps/seconds. Typed values the keypad can't produce (pasting) don't exist — there is no text input. *Verified (Phase 5):* browser — 999999 → 2000, 12.345 → 12.35, 5000 reps → 999, "." disabled on reps, cleared field → null. *Backend dependency:* the real limits are unknown; these are conservative guesses, not contract.

### 3.16 New issues found in Phase 6

#### NEW-026 · 🔵 P3 · The demo database shipped inside the production profile bundle
- **Status:** ✅ Fixed — Phase 6. The profile screen imported the demo reset helper (and with it the seed database) statically, so a real build carried it even though the button is hidden. It is now a guarded dynamic import. *Verified:* built with `NEXT_PUBLIC_USE_MOCKS=false` and scanned `.next/static` — no `overload_mock`, `mock-token` or "Simulated server" strings.

#### NEW-027 · ⚪ P4 · `public/mockServiceWorker.js` is served in production
- **Status:** Open — accepted. The MSW worker script is a static file in `public/`; it is inert unless something registers it (only the demo build does). Removing it would break the demo build's service-worker path (the fetch fallback would still work). Delete it from a production deploy if a clean artefact matters.

### 3.17 New issues found in Phase 7

#### NEW-028 · 🟡 P2 · A stale tab could start a second open workout
- **Status:** ✅ Fixed — Phase 7 (see NEW-024 for the remaining server-side part). `useStartOrResumeWorkout` now fetches the history list fresh. *Files:* `src/hooks/use-workouts.ts`.

#### NEW-029 · 🔵 P3 · An empty picture response rendered as a broken avatar
- **Status:** ✅ Fixed — Phase 7. After "Remove", the demo backend answered 204 (the app expects 404 for "no picture"), and the client turned the empty body into an image URL. The client now treats an empty body as "no picture", and the mock returns real bytes / 404 like the API contract in the code. *Verified:* upload, navigate away and back, remove — in the browser.

#### NEW-030 · 🟡 P2 · Text and white-on-red controls were below WCAG AA contrast
- **Status:** ✅ Fixed — Phase 7 (text and controls measured in the browser; see 11.5 for what could not be measured). Measured every text node on Home, Splits, History, Profile, Exercise detail and Workout in both themes against its effective background. Dark: tertiary text (`#747479`) was 3.5–4.0:1 → `#8a8a90`. Light: secondary/tertiary were 3.6–4.2:1 on card backgrounds → `#5c5c61` / `#66666b`; accent text `#c2510a` → `#b04a08`; the red, orange and purple used as *text* on their soft badges were 3.1/2.0/3.6:1 → `#d70015`, `#a85a00`, `#8944ab`. White text on red (swipe Delete, error toasts) was 3.4:1 → a new `--red-strong` (`#d1241b`, 5.3:1). After the change all six routes report no text below AA in either theme. *Files:* `src/app/globals.css`, `SwipeRow.tsx`, `Toaster.tsx`, `home/page.tsx`.

#### NEW-031 · ⚪ P4 · Inconsistent copy
- **Status:** ✅ Fixed — Phase 7. "Retry" → "Try again" (the one outlier, membership); "session" → "workout" in two empty-state messages. Other term pairs were checked and are consistent: Finish (never "Complete"), Discard (an unfinished workout) vs Delete (history, splits) vs Remove (an exercise in a workout, the payment, the picture), Start.

#### NEW-032 · 🔵 P3 · The lifter's exercise order isn't shown in History
- **Status:** Accepted — product (the known gap "reorder is local-only"). The order set by dragging is kept on this device for the open workout; the saved workout in History, and any other device, show the server's order.

#### NEW-033 · ⚪ P4 · Unused Supabase variables in `.env`
- **Status:** Accepted. `NEXT_PUBLIC_SUPABASE_*` are present in the local `.env` (not tracked by git) and used nowhere in `src/`; confirmed absent from the production bundle.

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

**Phase 3 update.** The app now runs in the audit browser (PWA-001 fix), so the Phase 3 items marked "Verified in browser" were exercised for real against the mock backend. Two limits apply:

- **Mouse, not touch.** The embedded browser is desktop Chromium driven with a mouse at a 375×812 viewport. Native touch scrolling, `pointercancel` handoff to native scroll, momentum, iOS ghost clicks, long-press callouts, the keyboard and the visual viewport were not exercised.
- **Throttled frames.** The pane delivers very few animation frames while idle, so animation timing (sheet springs, layout animations) couldn't be judged visually; screenshots were used to force frames when testing the scroll-spy.

Everything marked "Requires iPhone" still does.

- **A physical iPhone, iOS Safari, or an installed standalone PWA.** These were assessed from code and known WebKit behaviour only: REST-002/003, UI-003/008/009/010, PICK-001, SPLIT-004, EX-007, WORKOUT-018 (Low Power Mode), WORKOUT-038, the relaunch-at-`start_url` path in LAUNCH-001, keyboard and `visualViewport` behaviour (ViewportFix), momentum scrolling, the file pickers (HEIC conversion), audio-session "ambient" mixing, and backgrounding or eviction timing.
- **Live interaction testing.** The audit browser couldn't register the MSW service worker, so the app never got past the black boot screen (which confirms PWA-001). Every race, gesture and animation item comes from tracing the code, not from observing it.
- **Real network conditions.** Throttling, offline mode and recovery weren't exercised. Timing-dependent races (WORKOUT-001/002/008) are rated "Highly likely", not "Confirmed".
- **Backend behaviour.** Not checked: the access-token TTL and refresh support (AUTH-002/003), integer validation for reps and exercise counts (WORKOUT-010, SPLIT-003), whether exercise history includes uncompleted sets (EX-004), the membership date format (PROF-004), the `/last-set` 204 vs null response (PICK-005), the shared-catalog permissions (EX-006), and whether swap deletes sets server-side (WORKOUT-005; the mock does).
- **Production environment.** I don't know whether the deployed Vercel build runs with `NEXT_PUBLIC_USE_MOCKS=true` (which decides PWA-001's real-world impact) or which `NEXT_PUBLIC_BASE_URL` it uses.
- **Multi-device and multi-tab scenarios.** AUTH-005, HOME-007 and WORKOUT-039 weren't reproduced.

---

## 8. Phase 4 report: state, network and PWA reliability

### 8.1 What was tested, and how

All of this ran in the browser at 375×812 against the mock backend, with `overload_mock_latency`, `overload_mock_fail`, and the new `overload_mock_offline` / `overload_mock_expired` switches, plus a seeded 127-workout history. It was desktop Chromium driven with synthetic pointer events, not a phone.

| Scenario | Result |
|---|---|
| 3 rapid Add set at 800 ms | 3 rows at once; server sets 1, 2, 3 (no duplicates) |
| Add, tick, edit reps, delete set, add set, edit weight inside a few seconds at 800 ms | UI and server agreed once the queue drained; request order preserved |
| One request failing between successful ones (failure window timed to hit only the tick) | Only the tick rolled back; the add and the type change stayed; toast named the failed change |
| Fails immediately (offline switch), fails after a delay, two in a row | Each rolled back its own change and toasted with the reason; retry afterwards succeeded and matched the server |
| Failed save, then leave the screen | Toast appeared on Home (NEW-009) |
| Browser offline event with edits | "Offline · will sync"; nothing sent; on reconnect both edits landed in order |
| Save → reload (after it landed) | Server value shown |
| Background (visibilitychange hidden) with the keypad open | Draft committed (one PATCH); returning caused no duplicate writes |
| Expired token: edit a set | Failed write toasted, redirect to /login?next=…, expiry notice, sign-in returned to the workout with server state |
| Logout, then another user | Tokens, favourites, order and timer keys gone; user B saw none of A's data (Home empty) |
| Finish while a set write and the finish itself fail | Button read "Saving…" while queued, then Finish returned with a toast; workout still open; retry finished it |
| Empty workout: Finish / auto-end / stale start-or-resume | Discard prompt / deleted / deleted (NEW-006) |
| Discard with failure, then retry | Stayed open with toast, then deleted; timer and order keys cleared |
| Rest timer: start, leave, return | Remaining time correct (89 s → 86 s → 84 s on return); a timer past its end is not shown or rung after reload |
| Finish, then exercise detail | History refreshed without waiting for staleTime (NEW-011) |
| History with 127 workouts | Paged 49 → 99 → 127, no duplicates; delete failure kept the row |
| Membership log failure, then retry | Error shown, "Logging…" while pending, retry worked |
| Split swipe-delete failure | Toast; row stayed |

`npm run typecheck` and `npm run build` pass. `npm test` runs 4 unit tests (`src/lib/format.test.ts`: `hasCompletedSets`, `workoutEndTime`). `npm run lint` is 17 errors and 3 warnings (was 18 and 4); the Phase 4 changes added none.

**Not exercised in the browser:** QR upload and profile-picture upload failures (the demo build can't pick a file from the script), signup/login failures beyond the expiry flow, multi-tab behaviour, real network throttling and packet loss, real process kill, and anything on iOS.

### 8.2 Cache-key audit

| Key | Notes |
|---|---|
| `["workouts"]` | Latest 50 summaries. Not user-scoped, but the whole cache is cleared on login and logout, so no other user's data can be read. Patched in place on finish/delete. |
| `["workouts", id]` | One session; updated per entity by the write queue and refetched once when the queue drains. Written by `setQueryData` only when it already exists, so a late response can't create an entry after logout. |
| `["splits"]`, `["splits", id]` | Invalidated on create/update/delete. The edit form seeds once (SPLIT-006, open). |
| `["exercises", muscle]`, `["muscles"]` | Global catalogue. |
| `["exercise-history", id]` | Unbounded, used by cards and the detail page. Now invalidated on finish/delete (NEW-011). The summary uses its own key (WORKOUT-034). |
| `["last-set", id]` | Invalidated with the history. |
| `["qr-image"]`, `["profile-picture"]`, `["membership"]` | Cleared on login/logout; invalidated on upload/change. |
| `["favorites"]` | Invalidated by mutations but never queried (no GET endpoint). Harmless, but it does nothing. |

Not changed, and why: adding user ids to keys would be redundant with clearing the cache at the two points where the user changes. Session *expiry* alone doesn't clear the cache, but nothing is readable until a new sign-in, which does.

### 8.3 Client-side persistence inventory

| Key | Store | Holds | User-scoped | Written | Read | Cleared | Survives logout? |
|---|---|---|---|---|---|---|---|
| `overload_token`, `overload_refresh_token`, `overload_user` | localStorage | Access/refresh token, `{id, email}` | Yes | Login/signup/refresh | Every request; `useAuth` | Logout, expiry | No |
| `overload_last_user` | localStorage | The last user's id only | Yes | Login | Next login (decides whether to wipe user keys) | Never (by design) | **Yes, id only** |
| `overload_favorites` | localStorage | Favourited exercise ids (mirror; no GET endpoint) | Yes | Toggle, first completed set | Picker, exercise page | Logout, different user's login | No |
| `overload_exercise_order_<sessionId>` | localStorage | Local drag order of a workout | Yes (session ids are per user) | Reorder, list change | Workout page | Finish, discard, logout, different user | No |
| `overload_rest_timer` | localStorage | One timer: session id, duration, end time | Yes (tagged with the session) | Timer actions | Workout page | Finish, discard, logout | No |
| `overload_launch_shown` | sessionStorage | "Gate shown this session" | n/a | Gate | Gate | Logout; ends with the tab/process | No |
| `overload_session_expired` | sessionStorage | "Session expired" flag | n/a | 401 handling | Login screen | Successful sign-in | n/a |
| `overload_theme` | localStorage | Theme choice | Device, not user | Profile | Boot script | Never | Yes (device setting, not personal data) |
| `overload_mock_db` | localStorage | The whole demo database, **including demo passwords** | Mock only | Mock API | Mock API | "Reset demo data" | Yes — demo builds only |
| `overload_mock_latency`, `_fail`, `_offline`, `_expired` | localStorage | Demo failure switches | Mock only | By hand | Mock API | By hand | Yes — demo builds only |
| `overload_media_prefetched` | sessionStorage | "Videos prefetched" flag | n/a | Prefetcher | Prefetcher | Tab end | No |
| IndexedDB | — | Not used. No cookies set by the app. | | | | | |

Notes: tokens in localStorage are readable by any script on the origin (a standard trade-off; the app loads no third-party scripts). The Next/MSW dev server and the mock service worker add their own storage in demo builds only. Nothing user-specific besides the id survives logout.

### 8.4 Lifecycle verdicts

- **Background → foreground:** keypad drafts are committed on hide; no duplicate requests on return; refetch-on-focus is suppressed while writes are pending; the elapsed clock resyncs on `visibilitychange`; the rest timer is derived from its absolute end time.
- **Reload from each route:** the workout, splits, profile, exercise detail and the launch gate/home were loaded fresh and started correctly; History was reached by client-side navigation only. (The app has no route that needs in-memory state to render.)
- **Close and reopen (iOS kill):** not simulable here. By design: auth, the open workout (server side) and the rest timer (if it was still running) come back; the exercise order comes back from localStorage; in-flight or queued writes, the keypad draft if it wasn't committed, scroll position, and the finish summary do not (see PWA-002 and NEW-015).
- **Abandon/resume rules (one answer):** a session is *resumable* if it's unfinished and under 3 h old; *abandoned* beyond that — closed at its last completed set if it has any, deleted if it doesn't (both on the next start and by the 3 h timer when the page is open); *completed* once it has a `completed_at`; and a completed or deleted session never shows as Resume.
- **Large workout:** 5 cards / 21 sets measured (see WORKOUT-021). A 10-exercise session wasn't built.

### 8.5 Needs a real iPhone (not claimed fixed)

Native scrolling, swipes and long-press; scroll hand-off and the sheet's background scroll lock; the iOS keyboard and `visualViewport`; double-tap zoom; whether the keypad-close easing (NEW-007) feels right; the rest timer while the phone is locked (REST-002 — needs push, not just a device); audio resuming after a lock (REST-003); Low Power Mode video; process termination and what a reopened PWA restores; status-bar colour; touch PWA behaviour generally.

### 8.6 Still open from Phase 4's scope (as of Phase 4 — section 9 supersedes it where an item changed)

- AUTH-002: needs backend refresh tokens. AUTH-005: no cross-tab sign-out.
- PWA-002 / NEW-015: no offline shell, no persisted write queue.
- REST-002: needs Web Push.
- WORKOUT-027: a failed tick still leaves its rest timer running.
- STATE-001: Home's streak/Resume read the latest 50 only; backend support for `before` unconfirmed.
- WORKOUT-021: per-action re-render cascade remains (not per second).
- The new toast shows one error at a time and has no retry button.

---

## 9. Phase 5 report: engineering hardening

### 9.1 AUTH-002 — can it be fixed in this repository?

**No. The app side is finished; the capability has to come from the backend.** Findings from the investigation:

| Area | Finding |
|---|---|
| Token storage | access token, refresh token and user in localStorage (`overload_token`, `overload_refresh_token`, `overload_user`); cleared on logout and on expiry. |
| Client | `apiRequest` 401 → `refreshAccessToken()` (single flight) → retry once → else `clearSession()`. The code for `POST /auth/refresh {refresh_token}` already existed but had four defects, now fixed: any refresh failure (even no signal) signed the user out; a refresh finishing after logout restored the session; a second concurrent 401 spent a rotating refresh token again; blob requests had no sign-out path. |
| Backend | `AuthResponse.refresh_token` is optional and the API client comment says the deployed API issues none, so `/auth/refresh` is never called today. Requirement: login/signup return `refresh_token`; `POST /auth/refresh {refresh_token}` returns `{access_token, refresh_token}`; invalid/expired → 400/401/403. I did not probe the deployed API. |
| Mock | The demo now issues `mock-token-<id>~<epoch>` access tokens and single-use rotating `mock-refresh-…` tokens, so the whole flow runs end to end. |
| Verified in browser | Concurrent requests after expiry → 1 refresh, all succeed (membership + picture + QR). Three queued writes after expiry → 1 refresh, all three saved in order, no toast. Refresh endpoint returning 500 → user stays signed in, write rolled back with "The server had a problem", retry works. Refresh token expired → /login with the expiry notice. Sign-out while a refresh is in flight → tokens not restored. |
| Unit tests | `src/lib/api/client.test.ts` (5 tests): single flight; rejected refresh ends the session; unreachable refresh doesn't; refresh after sign-out is dropped; no second retry. |
| Until the backend ships it | A 401 write is lost, visibly (toast → sign-in with an explanation → fresh server state). No UI claims it saved. |

### 9.2 PWA-002 / NEW-015 — offline and the persisted queue

**Offline inside a workout (works):** the cached workout and exercise list stay usable; weight, reps, ticks, set-type, adds, deletes and navigating between cards all apply optimistically; writes are held (TanStack pauses mutations offline) and replayed in order on reconnect; "Offline · will sync" shows in the session bar. Verified with the browser's offline event: edits held, nothing sent, both landed in order after reconnect. Needing the network by nature: opening the exercise picker's catalogue the first time, `seedFirstSet` history (falls back silently), Finish (waits in the queue and says "Saving…").

**Offline while navigating (fixed, NEW-016):** each of Today, Splits, History, Exercise detail and Profile now shows a real error with retry when it has nothing cached, and recovers on reconnect. A route already visited shows its cached data.

**Persisted write queue — decision: not built; NEW-015 stays open.** A replay after the app was killed is only safe if all of these hold, and they don't:
1. *Idempotency* — `POST` set/exercise creation has no idempotency key; a write that reached the server just before the kill would be replayed into a duplicate set (or a 409).
2. *No stale overwrite* — PATCHes are last-writer-wins with no version or `If-Match`; replaying an old edit after the same set was changed on another device or tab silently overwrites newer data.
3. *Identity mapping* — queued writes reference optimistic ids (`optimistic-…`) that only exist in memory; they'd need remapping through the queue on restart.
4. *Identity/session isolation* — it'd have to be keyed to a user id and dropped on logout/different user. That part is easy; 1–3 are not.
What it would need: idempotency keys on creates, a precondition/version on updates, and a ledger of optimistic→real ids. The current non-persistent queue is the deliberate safe choice; its limits are the "Saving…"/"Offline" label, commit-on-hide for keypad drafts, and the sign-out wait (NEW-018).

### 9.3 PWA-003 — video bandwidth
See PWA-003 above. When videos load: only when a card/row is ≥25 % on screen (`preload="none"` until then); none are prefetched; the muscle illustrations (app-hosted PNGs) are the only prefetched assets. Concurrency is the browser's (a screen's worth of `<video>`s at most).

### 9.4 Every remaining P2, classified

| ID | Class | Reason |
|---|---|---|
| AUTH-002 (P0) | Blocked — backend | 9.1 |
| AUTH-005 | **Fixed** | cross-tab sign-out |
| AUTH-006 | **Fixed** | demo credentials mock-only |
| PROF-001 | **Fixed** | local date |
| WORKOUT-013 | **Fixed** | latest commit handler |
| WORKOUT-021 | **Fixed** | measured and reduced, 9.8 |
| HOME-003 | Defer (UX decision) | no data risk |
| WORKOUT-022 | Defer (product) | warning before 3 h cut-off |
| WORKOUT-023 | Defer (product) | back goes Home on purpose |
| WORKOUT-024 | Defer (polish) | `window.confirm` styling only |
| WORKOUT-029 | Partly fixed | no retry buttons by design (9.5) |
| STATE-001 | Partly fixed / backend | confirm `before` support |
| EX-002 | Defer (backend) | favourite flag source |
| EX-004 | Defer (backend) | history lacks `completed` |
| WORKOUT-018, REST-003, UI-003, UI-008 | Defer (real iPhone) | 9.10 |
| REST-002, PWA-004 | Blocked (platform) | push / vibration |

### 9.5 Error and retry model (WORKOUT-029)

| Class | Examples | Behaviour |
|---|---|---|
| Automatically retried | Query failures | One retry after a second, only when online; otherwise an error state with a "Try again" button (and auto-refetch on reconnect). |
| User retries | Set/exercise/workout writes, deletes, finish, discard, start | Rolled back, toasted with what happened to the change and why ("Set not added. No connection. Check your signal and try again."), the user repeats it. Not auto-retried: the writes are ordered and optimistic; replaying one after later edits could reorder them. |
| Needs sign-in | 401 with no usable refresh | Toast, sign-in screen with an explanation. |
| Permanently invalid | Out-of-range numbers, bad file types | Prevented in the UI (clamping, disabled keys, file checks) or the server's message is shown. |
| Retry button exists | Page loads (workout, history, exercise, splits, today, membership), loading older history, the QR | Meaningful and safe (a read). |

### 9.6 Listener, timer and subscription audit

Reviewed every `addEventListener`, `setInterval`, `setTimeout`, `requestAnimationFrame`, `IntersectionObserver` and `useSyncExternalStore` in `src/`. Clean: RestTimer (one interval keyed on the end time; unlock, visibility and focus listeners removed on unmount; a timer belongs to its session and is unmounted on leaving), keypad listeners (re-registered per field, removed), scroll-spy, layout scroll recording, sheets/escape handlers, swipe rows, stepper hold timers, set-row flash timers, `ElapsedClock`, `SaveStatus` (`beforeunload` removed with the effect), toast timer (single), queue-drain timers (one per session, replaced not stacked), auth refresh timer (one module-level, cleared on logout), `storage` listener (per mounted `useAuth`, removed). Fixed: `ViewportFix` timeouts and the picker long-press timer (NEW-021). Not cleaned but bounded and harmless: the auto-advance `setTimeout(350)` and the just-added-card scroll retry (≤20 × 100 ms) both no-op on an unmounted page.

### 9.7 Multi-tab

Not synchronised, and doesn't need to be for correctness: each tab has its own cache; the server (mock: shared `localStorage`) is the arbiter. Tested with two tabs on one workout: A adds a set → B (stale) still shows the old list; B's own Add set is rejected by the server and rolled back with a toast, then B converges when it regains focus (focus refetch); B editing a set A also knows overwrites only that field (PATCHes are per-field). Logout in A sends B to sign-in. No silent corruption found. Known gaps: NEW-023, NEW-024. Not tested: three tabs, background-tab timer throttling, two different users.

### 9.8 Large-workout and request audit (10 exercises, 52 sets, some completed, 3 with history)

Verified in the browser: initial render; scrolling top to bottom (6 of 10 clips requested, 0 long tasks); edit a set near the top and near the bottom (one PATCH each, the right row); keypad open/close; add set (set numbers continuous 1…7 after a delete and re-add); delete a set; remove an exercise (cards 10 → 9); swap an exercise (sets cleared, history fetched once for the new one); rest timer start/idle (no card renders); 20 rapid taps (20 serialized PATCHes, UI = server); Finish (summary, timer gone, server `completed_at` set). Not done: dragging to reorder (no pointer-drag harness), real-device frame rate, memory growth (inconclusive, see WORKOUT-021).

Request sequence for opening a workout (no duplicates): `GET /workouts/:id`, `GET /splits/:id`, `GET /exercises`, and one `GET /exercises/:id/history` per exercise (now `limit=3`). An edit is one PATCH plus one `GET /workouts/:id` once the burst ends. Finish: one PATCH (+ the summary's own history reads). Triple-tap checks are in NEW-017. Slow-network → navigate → back → retry produced no multiplying requests (queries share keys; the offline/expired retries were single-flight).

### 9.9 Combined failures run

slow + failure (Phase 4 and again); slow + offline (held writes then replay); expired + pending saves (3 queued writes, 1 refresh, all saved); refresh failing + pending write; failure then retry; logout during pending saves (NEW-018); a chaos sequence at 600 ms latency — keypad draft open, add set, offline blip, tick, background event, online, navigate away and back — ended with UI = server (the draft value, the new set and the tick all saved, no toast).

### 9.10 Real-iPhone checklist (reproducible)

Do these on an iPhone, installed to the Home Screen (Add to Home Screen) and also once in Safari, with the demo build and the console switches above where they help (use a connected Mac's Web Inspector, or add the latency/offline switches via a temporary settings screen). Record device, iOS version, and pass/fail.

**Touch**
1. Workout with ≥10 cards: scroll slowly and with a flick — smooth, no jump when the clip videos start.
2. Swipe a set row left, then a diagonal drag — opens only on a horizontal drag; page still scrolls vertically (UI-006).
3. Start vertically scrolling from a swipe row and from the keypad area — no accidental open/close (WORKOUT-012).
4. Long-press an exercise name in the picker — preview peek stays up after release, no link preview/callout (PICK-001, UI-009).
5. Drag the sheet grabber and header to dismiss; try pulling down from scrolled-to-top content (UI-002).
6. With a sheet open, try to scroll the page behind it, from the scrim and the header (UI-003).
7. Drag an exercise to reorder, to the edge of the screen (WORKOUT-038).

**Keyboard / keypad**
8. Open the keypad on the last card; close it by tapping outside — watch for a jump (NEW-007).
9. Switch between weight and reps fields directly; type a value, lock the phone, unlock — value kept (WORKOUT-009).
10. Exercise detail → Edit sheet: focus the lowest field — Save button reachable above the keyboard (EX-007).
11. Login: type the password, dismiss the keyboard — fixed bars sit on the screen edge (ViewportFix).
12. Rapid taps on the stepper and keypad keys — none dropped or zoomed (UI-010).

**PWA lifecycle**
13. Open a workout, tick a set, immediately go Home and force-quit — reopen: "Resume workout" on the launch gate; the tick is either saved or not (note which, with and without signal) (NEW-015).
14. Start the rest timer, background the app for 30 s, reopen — correct remaining time; background past the end — no stale ring (REST-002).
15. Airplane mode mid-workout: edit, add, tick, go back online — "Offline · will sync" then all changes on the server, in order.
16. Airplane mode, force-quit, reopen the PWA — record what is shown (PWA-002: expected the browser's offline page).
17. Leave the app 4+ hours with a workout open — reopen: resume vs. cleaned up per the rules in 8.4.
18. Add to Home Screen from a signed-in session; kill and reopen — still signed in.

**Media / audio**
19. Exercise clips autoplay in cards and in the picker; Low Power Mode on — a still frame, not a blank box (WORKOUT-018).
20. With music playing, tick a set / let the rest timer end — music keeps playing, chime mixes (REST-003).
21. Lock the phone during a rest — nothing sounds (known limit, REST-002); on unlock the timer is correct.
22. Vibration: confirm there is none (PWA-004).

**Status bar and safe areas**
23. Dark and Light theme: status-bar text legible, bar colour matches (UI-008).
24. Notch/Dynamic Island: session bar, toast, launch gate and the tab bar clear the safe areas in portrait and landscape.
25. Home-indicator area: keypad and rest timer sit above it.

### 9.11 Verification summary

| Check | Result |
|---|---|
| `npm run typecheck` | clean |
| `npm run build` | passes (13 routes) |
| `npm test` | 9 / 9 pass (`format`: 4, `client` auth: 5) |
| `npm run lint` | 16 errors, 2 warnings (was 17 / 3); none from Phase 5 changes — all in files with the existing `set-state-in-effect` / `refs` backlog |
| Browser (375×812, mock) | normal, slow, offline, failure, expired + refresh, combined, 10-exercise, two tabs |
| Not tested | a real backend; drag-reorder; real-device performance; real offline launch; more than two tabs |

---

## 10. Phase 6 report: polish and production readiness

**Scope note.** This phase fixed what was concrete and verifiable: lint, accessibility basics, production-bundle safety, and a set of cheap functional/visual P3/P4 items. It did **not** include a systematic visual-system audit, a typography/spacing/contrast review of every screen, a microcopy sweep, or an animation review — I did a visual look at Home, Workout, Profile (dark and light), History and a 1280×800 layout, and found nothing broken, but that is a spot check, not an audit. Those items are carried to Phase 7 / a design pass (10.3).

### 10.1 Demo controls (Part 24) — verdict

`overload_mock_latency`, `_fail`, `_offline`, `_expired`, `_valid_epoch`, `_refresh_invalid` and the mock refresh counters live only in `src/lib/mock/browser.ts` and `handlers.ts`. They are reached only through a dynamic import guarded by `NEXT_PUBLIC_USE_MOCKS === "true"`, and the demo reset in Profile is now guarded the same way. A production build (`NEXT_PUBLIC_USE_MOCKS=false`) contains none of it (scanned, see NEW-026). They can't affect real behaviour, so they stay as development tooling. Residual: NEW-027.

### 10.2 Accessibility and interaction changes

- Sheets: focus moves in, Tab is trapped, Escape closes, focus returns (UI-004).
- 44 px hit areas on the small icon buttons without changing their look (UI-012).
- Streak badge exposed as an image with its label (HOME-008).
- Audit by script: no icon-only `<button>` lacks an `aria-label`, and no `<div onClick>` exists in `src/`. Global `:focus-visible` ring and `prefers-reduced-motion` handling already existed.
- Not done: contrast measurements, `inert` background, screen-reader testing, keyboard-only pass through the workout screen.

### 10.3 Every remaining P3/P4, triaged

| Class | Items |
|---|---|
| Fixed this phase | BUILD-001, BUILD-002, PICK-004, PICK-005, UI-011, PROF-004, AUTH-010, HOME-006, WORKOUT-030 |
| Partly fixed (a part remains) | HOME-007, HOME-008, PERF-003, UI-004, UI-012, STATE-005, BUILD-003, WORKOUT-032, -034, -039, NEW-007 |
| Functional, cheap, deferred (not done for time) | AUTH-009 (signed-in user can open /login), SPLIT-006 (edit form seeds once), SPLIT-007 (delete warning when a split has history), SPLIT-008 (PUT sends `pic: null`), WORKOUT-027 (rest timer runs after a failed tick), WORKOUT-028 (picker doesn't flag duplicates), WORKOUT-031 (Copy previous has no undo), WORKOUT-033 (summary lost on reload), WORKOUT-035 (assisted volume), WORKOUT-036 (swap picker unfiltered), PICK-002, PICK-006, UI-005 (Back with a sheet open) |
| Visual / interaction polish, deferred | REST-004 (ring wind-up), PWA-005 (blank boot frames), UI-013 (page remount fade), WORKOUT-025 (ungroup confirm; no UI to create supersets) |
| Real iPhone needed | SPLIT-004, EX-007, WORKOUT-038, UI-009 |
| Backend/product | EX-006 (shared exercise catalogue), PICK-003 (picker renders the whole catalogue; a virtualised list is a bigger change), PERF-002, PERF-004 (video per card; the observer already gates playback) |
| Not worth fixing | STATE-004 (two tiny Maps), BUILD-003 beyond the current tests |
| Blocked / other | NEW-023, NEW-024 (server rules), NEW-027 |

### 10.4 Lint and code quality

Errors 16 → 0, warnings 2 → 0 (audit start: 18 / 4). Cleanup that changed structure: `useMounted`, external-store reads for theme/user/favourites, derived workout order and focus, the rest timer's restore and expiry moved out of effects, object URLs cached per blob (no effect, no leak under StrictMode). Behaviour was kept: re-verified in the browser (theme toggle persisted and applied, sign-in/out and cross-tab, favourites toggle, rest timer start and restore after reload, reversed saved order applied after reload). No temporary debug code remains (the render counters from Phase 5 were removed then).

### 10.5 Regression smoke (375×812 mock backend; layout also at 1280×800)

Sign in / log out / sign in; launch gate; start from Splits; add sets; edit via keypad; tick (rest timer); failed write toast then retry; expiry → refresh; offline → "Offline · will sync" → reconnect; finish → summary → history detail; favourites; sheet focus behaviour; light/dark theme; saved exercise order after reload; rest-timer restore after reload. Phase 5 flows (triple-tap guards, 10-exercise workout, two tabs, logout during saves) were **not** re-run after the lint refactors, except where listed. Not exercised this phase: reorder by drag, split create/edit/delete through the UI, history "load older", exercise rest-time edit, QR/avatar upload.

### 10.6 Verification

`npm run typecheck` clean · `npm test` 9/9 · `npm run lint` 0 errors, 0 warnings · `npm run build` passes (13 routes) · production-mode build scanned for demo code (none).

---

## 11. Final release audit (Phase 7)

### 11.1 Decision

**READY WITH KNOWN LIMITATIONS.** No release blocker was found: nothing silently loses or corrupts data, nothing exposes another user's data, and every failure path tested ends in a visible message and a recoverable state. The limitations that matter, in order:

1. **Real iPhone is untested.** The app is a phone PWA; everything iOS-specific (touch, keyboard, safe areas, process termination, audio, Low Power Mode, status bar) is unverified. Do a short pass with the 25-step checklist (9.10) before a wide release.
2. **AUTH-002 (backend).** Without refresh tokens, an expired access token costs the one write that hit the 401 (shown as "Change not saved… Sign in to continue") and sends the user to sign-in; the workout is intact on the server. Confirm the access-token lifetime: if it is short (≈1 h or less) this will be common, and shipping refresh tokens is strongly recommended. The client is ready (9.1).
3. **PWA-002 / NEW-015.** Writes queued or in flight when iOS kills the app are lost (deliberate: a persisted queue is unsafe without server idempotency and versioning). The user sees "Saving…" / "Offline · will sync" while unsent; a cold launch with no signal shows the browser's offline page.
4. **Release hygiene.** Deploy with `NEXT_PUBLIC_USE_MOCKS` **unset** (a mock build pre-fills demo credentials and runs the demo backend). Verified: a build without it contains no demo code, credentials, mock switches, source maps or `console.log`.

### 11.2 What was re-tested this phase (browser, 375×812, mock backend)

| Area | Result |
|---|---|
| Data-integrity sequence (sign in → start → add exercise (picker) → add sets → edit weights/reps → complete some → reorder (saved order) → swap → delete a set → rest timer → navigate away/back → finish → summary → History → reopen → reload → log out/in → verify) | Server and UI agreed at every step; Finish changed nothing but `completed_at`; summary volume matched the sets; order key and timer cleared on finish; History showed the same data after reload and re-login |
| Network chaos A–G | **A** slow + 5 rapid edits + navigate away: all landed, no toast, no duplicate requests. **B** offline edits/add held ("Offline · will sync"), converged on reconnect. **C** one failed write in the middle: only it rolled back, others kept, retry worked, UI = server. **D** expired token with 3 requests: 1 refresh, all saved. **E** pending saves then log out: both reached the server first. **F** keypad draft + pending save + background/return: draft committed, no duplicates. **G** offline cold load of a workout: real error with "Try again"; recovered on reconnect |
| Auth | Covered by the 5 unit tests (single flight, rejected refresh, unreachable refresh, logout during refresh, no second retry) plus Phase 5/6 browser runs; re-run in browser: expired + refresh (D), logout during saves (E), sign-in/out |
| Lifecycle | Empty-finish and failed/retried discard, stale and empty-abandoned sessions, 3 h auto-end: verified in Phase 4/5 and not changed since; the hooks involved were re-exercised by the sequences above |
| Large workout (10 exercises, 49 sets) | 0 long tasks; one request per edit; top edit, bottom edit, add set, delete, type cycle, triple-tap Finish (1 PATCH). Timer: see 11.5 |
| Split CRUD | create (validation, failed create, rapid submit → 1 split), edit (failed edit, double save), delete (failed delete, triple tap → 1), Back, reload — all correct |
| History pagination (126 workouts) | 49 → 99 → 126; slow load shows "Loading…" and disables the button; a failed load shows the error and "Try again"; retry works; no duplicates; newest-first order; button disappears at the end |
| QR upload | none yet → non-image rejected → failed upload shown → retry succeeds → replace works. (The demo keeps the file in memory, so it does not survive a reload — demo limitation) |
| Avatar | wrong type, >5 MB, failed upload ("Uploading picture…" shown), retry, failed remove, remove; found and fixed NEW-029 |
| Two tabs | stale tab's Add set rejected with a message and converges on focus (Phase 5, re-checked after the mock fix); logout in one tab signs the other out; concurrent start → NEW-024/NEW-028 |
| Reorder | the saved order is applied after reload, a new exercise is appended after it, it survives leaving and returning, and is cleared on finish. The drag gesture itself could **not** be driven in this harness (synthetic and tool pointer drags don't engage the Framer Reorder) — see 11.5 |

### 11.3 Production sanity

`NEXT_PUBLIC_USE_MOCKS=false npm run build`, then scan of `.next/static`: no `demo1234`, `demo@overload`, `overload_mock*`, `mock-token`, "Simulated server", `mockServiceWorker`, `supabase`, or `console.log`; no source-map files. `.env*` files are git-ignored and untracked. Logging: the app writes nothing to the console. Error messages shown to users are the API's `error.message` or fixed strings; stack traces and codes are not shown. The only accepted residue is NEW-027 (the inert `public/mockServiceWorker.js`). Tokens live in localStorage (standard trade-off, no third-party scripts).

### 11.4 Remaining P3/P4, each classified

| ID | Class | Why it stays |
|---|---|---|
| AUTH-009 | Deferred | signed-in user can still open /login |
| HOME-007 | Backend | cross-device "in progress" needs a server rule |
| SPLIT-004, EX-007, UI-009, WORKOUT-038, PERF-002, PERF-004, PROF-005, PERF-003 | Platform | need an iPhone to observe or tune |
| SPLIT-006, WORKOUT-027, -028, -031, -032, -036, PICK-003, UI-004, UI-005, STATE-005, PWA-005, SPLIT-008, UI-012 | Deferred | worth doing, none release-blocking (details in 10.3) |
| SPLIT-007, WORKOUT-034, -035, EX-006 | Product | what a "PR", "volume" and a shared catalogue should mean is a product call |
| WORKOUT-039 | Not reproducible | duplicate set numbers: client reserves numbers and the server rejects duplicates (409), confirmed in the two-tab test |
| WORKOUT-025, WORKOUT-033, PICK-002, UI-013, STATE-004, BUILD-003, HOME-008, REST-004, PICK-006, NEW-032, NEW-033 | Accepted | negligible impact |
| NEW-007 | Platform | keypad-close easing needs a device |
| NEW-023, NEW-024, NEW-027 | Backend / accepted | see their entries |

### 11.5 Not tested / limits (nothing here is claimed fixed)

- **Real iPhone — not tested at all.** The 25 checklist items in 9.10 are all outstanding.
- **Drag-to-reorder gesture** — not drivable here; only its persistence logic was tested.
- **Visual audit** — contrast was measured numerically on six screens in both themes, and the sign-in, Home, Profile (light and dark), History and Workout screens were looked at at 375×812 (plus a 1280×800 layout check in Phase 6). Not systematically reviewed: every sheet/confirmation/empty/error state, typography and spacing consistency, white text laid over exercise images/gradients (the measurement script can't see the gradient). Animations were reviewed in code (two infinite animations: the live-streak flame, a 46 s background blob; reduced motion is honoured) — no change made.
- **Keyboard/screen reader** — programmatic scan (no unnamed controls; hidden file input is the only exception), a sheet focus/Tab/Escape test. Enter/Space on every custom control and an actual screen-reader run were not done.
- **Timers** — the 10-exercise run's rest-timer check was inconclusive (ticking an incomplete set opens the keypad by design); timer behaviour rests on the Phase 4–6 runs.
- Three or more tabs; two different users in two tabs; real network conditions; a real backend.

### 11.6 Final counts (original audit issues)

| | Original | Fixed | Open |
|---|---|---|---|
| 🔴 P0 | 5 | 4 | 1 — AUTH-002 (blocked: backend) |
| 🟠 P1 | 14 | 13 | 1 — PWA-002 (deliberate) |
| 🟡 P2 | 51 | 37 | 14 — all classified in 9.4 |
| 🔵 P3 | 42 | 12 | 30 — classified in 11.4 |
| ⚪ P4 | 9 | 2 | 7 — classified in 11.4 |

Issues found after the original audit are tracked as NEW-001…NEW-033; their status is on each entry (all P0/P1/P2 ones are fixed except NEW-015, the deliberate persisted-queue limitation, and NEW-024's server-side part).

### 11.7 Verification

`npm run typecheck` clean · `npm test` 9/9 · `npm run lint` 0 errors, 0 warnings · `npm run build` passes (13 routes) · production-bundle scan clean (11.3).
