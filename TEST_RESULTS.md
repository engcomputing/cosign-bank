# Test results

Recorded on 22 October 2026 on the user's Apple Silicon Mac through the Codex Desktop terminal.

## Environment

| Check | Actual result | Status |
| --- | --- | --- |
| Node.js | `v22.22.2` | PASS |
| npm | `10.9.7` | PASS |
| Docker Engine | Docker Desktop `29.9.2`, `aarch64` | PASS |
| TideCloak | Local `tidecloak` container on `localhost:8080` | PASS |
| Next.js | `16.4.2` with webpack | PASS |
| Tide SDK | `@tidecloak/nextjs@0.14.17` | PASS |
| Local vision SDK | `@mediapipe/tasks-vision@1.1.1` with self-hosted model/WASM | PASS |
| Face embedding SDK | `@vladmandic/human@3.3.6` with self-hosted FaceRes models | PASS |

Docker was queried through `/Users/phuc/.docker/bin/docker` and reported the engine on the user's Mac. No cloud Docker daemon was used.

## Verified evidence

| Test | Actual evidence | Status |
| --- | --- | --- |
| TypeScript | `npm run typecheck` exited 0 | PASS |
| Production build | `npm run build` compiled all current routes | PASS |
| Policy parity | `npm run test:policy`: 5 passed, 0 failed | PASS |
| Application approval policy | `npm run test:app-policy`: 5 passed, 0 failed, including fail-closed cancelled state | PASS |
| Client DPoP and liveness claim regression | `npm run test:client`: 2 passed, 0 failed | PASS |
| Liveness state machine | `npm run test:liveness`: 4 passed, 0 failed | PASS |
| Face identity policy | `npm run test:face`: 4 passed, 0 failed | PASS |
| Wrong-founder policy simulation | A live sample closest to Founder C was rejected when submitted for Founder B | PASS |
| Wrong-founder cancellation UI | Client regression verifies the red **Withdrawal request cancelled** state and `cancelled-face-mismatch` handling | PASS |
| Static-photo simulation | Repeated one-face/open-eye observations timed out without passing the mandatory blink transition | PASS |
| Multiple-face fail closed | A two-face observation immediately entered `failed`; approval was not sent | PASS |
| Self-hosted vision assets | Model returned `200` (3,758,596 bytes); WASM returned `200`, `application/wasm` (13,519,922 bytes) | PASS |
| Self-hosted face-recognition assets | BlazeFace, FaceMesh and FaceRes JSON/BIN files all returned `200`; total local size 9,242,015 bytes | PASS |
| Forseti compile — `byte[]` | Official Tide harness stubs: 0 warnings, 0 errors | PASS |
| Forseti compile — `ReadOnlyMemory<byte>` | Official Tide harness stubs: 0 warnings, 0 errors | PASS |
| Forseti sandbox scan | No blocked call sites | PASS |
| Account API without token | `GET /api/account` returned `401` | PASS |
| Forged browser owner role | `x-role: account:joint-owner` without token returned `401` | PASS |
| Invalid bearer token | Invalid token returned `401` | PASS |
| Forged withdrawal | `POST /api/withdrawals` with browser role but no token returned `401` | PASS |
| Tide redirect | **Sign in with Tide** reached the real `ork1.tideprotocol.com` sign-in page with the local DPoP callback | PASS |
| Three linked identities | Admin A, Founder B and Founder C all had `vuid` and `tideUserKey` server-side | PASS |
| Three governed co-owner roles | `account:joint-owner=true` verified through TideCloak Admin API for all three users | PASS |
| QEA administrator quorum | Three linked `tide-realm-admin` users; each new role grant reported threshold `2` | PASS |
| One admin cannot commit | After Admin A acted, all three grants were `1/2`, `readyToCommit=false`, and no user had the role | PASS |
| Independent second approval | Founder B approved; Tide Console auto-committed all three role grants and pending count became `0` | PASS |
| Authenticated account API | Dev server observed authenticated `GET /api/account` returning `200` after fresh sign-in | PASS |
| Role fail-closed | Before role commit/fresh token, authenticated `GET /api/account` returned `403` | PASS |
| Authenticated withdrawal | A real Tide-authenticated session created a synthetic request through `POST /api/withdrawals` | PASS |
| Shared approval inbox | Separate co-owner session displayed the same request in the CoSign Bank dashboard | PASS |
| Application quorum | Latest request reached `application-approved`; database contained 2 approvals from 2 distinct Tide subjects | PASS |
| Synthetic completion UI | Client regression verifies `application-approved` displays **Demo withdrawal successful** and the no-real-funds notice | PASS |
| Requester exclusion | Stored approval subjects did not contain the verified requester subject | PASS |
| Landing page | Desktop DOM and visual screenshot inspected; no horizontal overflow at 1280 px | PASS |
| Tide Doctor | 18 passed, 1 expected custom-contract deployment warning, 0 failures; `RESULT: OK` | PASS |
| Data preservation | New runtime database is `data/bank-demo-db.json`; earlier research JSON remains present | PASS |

## Not yet verified

These items are **not complete** and must not be represented as working in the submission video:

| Step | Current state |
| --- | --- |
| Forseti contract deployed | Tide team review/deployment is required and has not occurred. |
| Committed policy has `signed_policy_data` | Cannot exist until contract deployment and policy approval. |
| Requester excluded during a real ORK round | Source and local tests pass; no live ORK signing round yet. |
| Two independent approvals produce a threshold signature | Not implemented or simulated. |
| Real bank withdrawal | No bank API or real money is connected. |
| Real debit or balance update | The success dialog is synthetic; the demo intentionally does not debit an account or mutate a bank balance. |
| Real camera blink/head-turn run | Model integration is built, but a human must manually allow the camera and complete it in each final recording profile. |
| Physical printed-photo attempt | The static-frame state machine passes its automated rejection test; an actual printed-photo/browser-camera run is not yet recorded. |
| Human face enrollment in all three sessions | Code is complete; each founder must still personally allow camera access and enroll before recording. |
| Physical wrong-founder match attempt | Automated embedding policy rejects another enrolled profile; a real camera run with two people is not yet recorded. |
| Certified anti-spoofing | Not implemented; the movement challenge and embedding model are prototype controls only. |
| Mobile browser rendering | Responsive CSS is implemented but a device-sized browser run was not completed in this session. |

## Confirmed limitations

- QEA governs Tide administrative changes; it is not the customer withdrawal workflow.
- The bank UI's `2/2` is a real server-side application record keyed by verified Tide subjects, but it is not protected by a Tide threshold signature.
- The custom Forseti policy is the intended cryptographic business-approval mechanism, but deployment is experimental and Tide-team-only.
- Synthetic account data, requests and approvals are plaintext local JSON. A host owner can read or alter them or change application code.
- The app does not hold or move real funds and has no production banking, KYC, AML, fraud, accessibility or regulatory certification.
- **Demo withdrawal successful** means only that the local application reached two valid approvals; it is not evidence of bank settlement.
- A 180-second policy window is time-bounded approval, not proof that two people acted at the exact same instant.
- Browser WebAuthn may invoke a platform biometric but does not prove the authenticator was specifically Face ID. The local blink/head-turn detector is not certified liveness and may be bypassed by replay video or generated media.
- Face profiles contain sensitive numeric embeddings in plaintext `data/face-profiles.json`. They are ignored by Git but the host can inspect, replace or delete them and can change the matching code.
- Enrollment is trust-on-first-use. The prototype binds the captured face to the current Tide subject but does not independently prove who performed initial enrollment.
- The demo policy cancels the whole request after a face mismatch. This intentionally fails closed, but a malicious or mistaken co-owner can cause denial of service and force a new request.
- The browser creates fresh embeddings, while the server performs matching and refuses browser-supplied match flags. A modified client could still replay stolen embeddings; this is not production biometric authorization.
- The default single-process DPoP replay store is suitable only for this local prototype.
