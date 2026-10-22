# CoSign Bank

[![Built with TideCloak](https://tide.org/badges/built-with-tidecloak.svg)](https://tide.org/tidecloak?utm_source=github&utm_medium=readme&utm_campaign=unlocked)

A synthetic joint-account prototype for RMIT Hackathon 2026 — UNLOCKED, Challenge 2. It is not connected to a real bank and must not be used for real money.

## Project overview

### 1. Vision & originality

CoSign Bank turns an in-branch, three-signature withdrawal into a remote flow. One joint owner creates a precise withdrawal request; the other two approve independently; only then may a threshold signature be produced. The interface makes the trust state visible instead of hiding it behind a generic “pending” screen.

### 2. Trust constraint insight

A conventional banking app and its administrator can become a unilateral gatekeeper. Co-owners must trust the operator not to add a new privileged user or bypass approval records. This prototype configures three Tide realm administrators, so governed role changes require two independent approvals instead of one.

### 3. Value & impact

Families, small businesses and community funds could approve urgent payments remotely without coordinating a branch visit. A short, explicit approval window improves convenience while preserving collective control.

### 4. Why TideCloak matters

TideCloak provides real OIDC login, DPoP-bound tokens, server-verifiable roles and QEA governance. The live setup proved one administrator leaves a role grant at `1/2`; a second linked administrator is required. The included Forseti contract is prepared for future ORK enforcement but is not deployed.

### 5. Prototype & storytelling

Three co-owners sign in through Tide and enroll three numeric face embeddings under their verified Tide subjects. Approval requires a MediaPipe blink and randomized head turn, followed by a server-side match against that owner’s enrolled profile. Images and video are not saved. The backend excludes the requester and rejects duplicates. At `2/2`, the UI displays synthetic success; this remains application-layer approval, not a Tide signature or transfer.

## Implemented now

- Official Tide Agent Pack Next.js foundation with `@tidecloak/nextjs@0.14.17`.
- Strict DPoP in the browser and JWT + DPoP verification on every protected API.
- Three linked Tide users with committed `account:joint-owner` roles.
- Three Tide realm administrators and a verified `2-of-3` QEA threshold for governed changes.
- English bank interface, synthetic VND account and a shared approval inbox that refreshes every four seconds.
- Per-owner face enrollment using three FaceRes embeddings tied to the verified Tide subject; images and video are not saved.
- MediaPipe blink plus randomized head-turn challenge before enrollment and every approval.
- Server-side face comparison rejects missing profiles and browser-supplied match claims; a wrong-Founder match cancels the whole synthetic request and blocks further approvals.
- Server-side application quorum: requester excluded, duplicate approval rejected, two distinct Tide subjects required.
- Automatic **Demo withdrawal successful** dialog after the second valid approval; no bank API is called and no balance or real funds move.
- Forseti C# contract, policy manifest, local parity tests and dual-shape compile test.
- Honest separation between the working application demo and the undeployed future Forseti signing path.

## Local setup

### Prerequisites

- macOS with Docker Desktop installed **and its engine running**.
- Node.js 20.9 or later, npm, `curl`, `jq` and Python 3.
- A real licence email and your own acceptance of [Tide Terms & Conditions](https://tide.org/legal).

This project was verified on an Apple Silicon Mac with Node `22.22.2`, npm `10.9.7` and Docker Desktop Engine `29.9.2`. Docker reported by this README is the user's Mac engine, not a cloud container.

### Install

```bash
npm install
mkdir -p .tide-pack
curl -fsSL "https://mcp.tide.org/pack/templates.tgz" | tar -xz -C .tide-pack
cp .env.example .env
```

Edit `.env`. Set a strong `KC_BOOTSTRAP_ADMIN_PASSWORD`, your real `TIDE_LICENSE_EMAIL`, and `TIDE_TERMS_ACCEPTED=yes` only after personally accepting the terms. Never commit `.env`.

If `docker` is not found in a new Mac terminal:

```bash
export PATH="$HOME/.docker/bin:$PATH"
docker info
```

### Bootstrap TideCloak

> `npm run init` recreates the local TideCloak container and H2 state. Back up existing state first. Do not run it merely to restart an enrolled realm.

```bash
npm run init
```

Open the one-time enrollment link printed by the script and complete it yourself. Do not paste passwords, recovery data or verification codes into chat. A fresh setup derives realm `cosign-bank` and client `cosign-bank-client` from `package.json`.

### Start and reset demo data

```bash
npm run reset
npm run dev
```

Open `http://localhost:3000`. Reset only the synthetic bank database at any time with `npm run reset`; the earlier research demo files are left untouched.

For the three-person demo, prepare separate browser profiles before creating the request:

- normal browser profile: Admin A;
- Chrome Guest or Incognito: Founder B;
- Safari Private or another isolated browser profile: Founder C.

All three open `http://localhost:3000` and sign in with their own Tide identity. Create the withdrawal only after all dashboards are ready because the approval window is 180 seconds.

Before recording, each founder opens **Co-owners → Enroll my face**, completes the blink/head-turn challenge and saves their own profile. `npm run reset` keeps these profiles while resetting synthetic transactions. To explicitly delete all local biometric embeddings, run:

```bash
npm run reset:faces
```

## Deploying to Vercel (or any hosted Node host)

`data/tidecloak.json` is gitignored: it is environment-specific and is written by `npm run init`, so a hosted build checkout never contains it. The app therefore resolves the adapter on the server from the `CLIENT_ADAPTER` environment variable and passes it to the client provider as a prop. The build no longer imports the JSON file, so a clean checkout compiles.

1. Locally run `npm run init` and copy the generated `data/tidecloak.json`.
2. Collapse it to one line:
   ```bash
   jq -c . data/tidecloak.json
   ```
3. In Vercel, open **Project → Settings → Environment Variables** and add `CLIENT_ADAPTER` with that single-line JSON for Production, Preview and Development, then redeploy.
4. Never commit `data/tidecloak.json`.

If `CLIENT_ADAPTER` is missing or malformed the build still succeeds; the app renders a setup page explaining what to set, and `/api/config` returns the same message with HTTP 500. Local development is unchanged: with no `CLIENT_ADAPTER`, the adapter is read from `data/tidecloak.json`.

The adapter is public configuration (public client settings plus the realm's public signing keys), not a credential. `KC_BOOTSTRAP_ADMIN_*`, `TIDE_LICENSE_EMAIL` and `TIDE_TERMS_ACCEPTED` are only used by `npm run init` on your own machine and do not belong in a hosted environment.

### Hosted deployments: serverless storage caveat

The synthetic store is three plain JSON files under `data/`: `bank-demo-db.json`, `face-profiles.json` and the ignored `tidecloak.json`. All three are gitignored, and Vercel's filesystem is read-only and per-instance, so a deployed instance starts with no bank database and cannot persist approvals across requests or instances. Sign-in and the landing page work when `CLIENT_ADAPTER` is set; the joint-approval flow needs a writable shared store (Postgres, KV, a mounted volume) before it can be hosted. Run the full demo locally, or wire the store before pointing a reviewer at a hosted URL.

## Verification

With the app running:

```bash
npm run typecheck
npm run build
npm run test:policy
npm run test:app-policy
npm run test:liveness
npm run test:face
npm run test:contract
npm run test:unauth
bash .tide-pack/templates/shared/tide-doctor.sh \
  --app . --url http://localhost:3000 --realm cosign-bank
```

See [TEST_RESULTS.md](./TEST_RESULTS.md) for actual results and unverified steps.

## Activate Tide-enforced withdrawal signing

The following is intentionally **not automated or claimed complete**:

1. In a fresh environment, enroll three separate co-owner Tide identities and assign `account:joint-owner` through governed Tide administration.
2. Send `security/forseti/WithdrawalApprovalContract.cs` to the Tide team at `info@tide.org` or the [official Discord](https://discord.gg/XBMd9ny2q5) for test-network review and deployment.
3. Create and commit a `PolicySignRequest` using `security/forseti/policy-manifest.json`; verify non-empty `signed_policy_data`.
4. Implement and test the documented browser `createTideRequest` / `executeSignRequest` flow against that deployed policy.
5. Replace the local application approval record with the documented Tide request/signing lifecycle and record a real two-approver ORK round.

## Security boundary

TideCloak currently protects authentication, token integrity, DPoP binding and governed role changes. The `2/2` shown in the bank UI is enforced by this Next.js backend using verified Tide subjects; it is not QEA and is not an ORK threshold signature. The proposed Forseti contract can protect signing only after Tide deploys and commits it. The host still controls the UI, API and plaintext synthetic JSON database and could change code or records. No real bank rail is connected. Downloaded information cannot be revoked.

Face recognition is implemented only as a **demo control**. Three FaceRes embeddings per user are stored as plaintext numbers in ignored local file `data/face-profiles.json`; no raw image or video is saved. The server matches fresh embeddings to the profile bound to the verified Tide subject and also checks whether another enrolled founder is a closer match. A mismatch cancels the entire synthetic request, which also means a malicious or mistaken co-owner could cause denial of service and force creation of a new request. Enrollment is trust-on-first-use: the prototype cannot prove that the correct person performed the first enrollment. The host can inspect, replace or bypass templates and code. MediaPipe movement checks can reject a static open-eye frame but are not certified against replay video or generated media. Production requires encrypted biometric storage, supervised identity proofing, passkeys, certified liveness with server-verifiable results, consent/retention controls and banking compliance review.

## Stop services

```bash
docker stop tidecloak
docker start tidecloak
```

Use [SUBMISSION_CHECKLIST.md](./SUBMISSION_CHECKLIST.md) before publishing the repository or recording the final MP4.
