# Two-minute demo script

This script demonstrates the **current verified prototype**. Prepare three isolated browser sessions, enroll each founder’s own face before recording, then run `npm run reset`. Do not call the application `2/2` an ORK signature or the camera check certified Face ID.

## 00:00–00:16 — The problem

**Show:** CoSign Bank landing page and the three-owner visual.

**Say:** “A three-person joint account can require everyone to visit a branch before one withdrawal. CoSign Bank proposes a remote alternative: one owner requests, and the other two approve independently.”

## 00:16–00:30 — Real Tide boundary

**Show:** Terminal, then the Tide sign-in page without exposing credentials.

```bash
curl -i http://localhost:3000/api/account
```

**Say:** “The account API returns 401 without Tide authentication. The server verifies the signed token, its DPoP proof and the governed co-owner role; a role typed by the browser is ignored.”

## 00:30–00:46 — One admin is insufficient

**Show:** Tide Console QEA Approvals or the recorded evidence that a role grant remained `1/2` and uncommitted after Admin A approved.

**Say:** “This realm has three linked administrators. A governed role change needs two approvals, so Admin A alone cannot add a co-owner. Founder B supplied the second approval before these roles committed.”

## 00:46–01:04 — Create the request

**Show:** Founder B and C display **Enrolled** under Face identity profile. In Admin A, click **Request co-owner approval**.

**Say:** “Admin A creates the synthetic request. The requester identity comes from the verified Tide token, never from a name sent by the browser, and the same request appears in both co-owner inboxes.”

## 01:04–01:26 — Two independent app approvals

**Show:** Founder B clicks **Approve**, blinks, follows the randomized head-turn arrow, then chooses **Match face and approve**: `1/2`. In a separate prepared request, present the wrong founder and show the red **Withdrawal request cancelled** state; no one can approve that request again. Create a fresh request, then Founder C completes the valid `2/2` flow. Return to Admin A and show **Demo withdrawal successful**.

**Say:** “Each founder enrolled three numeric face embeddings under their verified Tide identity. The server records approval only after liveness and a match to that account’s profile. A wrong identity cancels the synthetic request immediately. No image or video is saved. At two of two, the synthetic withdrawal completes; no real money moves.”

## 01:26–01:44 — Prepared cryptographic policy

**Show:** `security/forseti/WithdrawalApprovalContract.cs` and terminal output from `npm run test:contract`.

**Say:** “The prepared Forseti policy applies the same requester exclusion, distinct-owner and 180-second rules. It passes local compile and sandbox tests, but Tide-team deployment is still required.”

## 01:44–02:00 — Honest boundary

**Say:** “The host can still alter the local approval and biometric files. First enrollment is trust-on-first-use, and the camera models are not certified against replay or deepfakes. The success dialog is only a demo result: no ORK signature or real bank transfer is claimed.”
