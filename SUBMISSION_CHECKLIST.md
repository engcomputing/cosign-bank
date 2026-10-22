# Submission checklist

## Repository safety

- [ ] Run `npm run reset`, `npm run typecheck`, `npm run build`, `npm run test:policy`, `npm run test:app-policy`, `npm run test:liveness`, `npm run test:face`, `npm run test:contract` and runtime Tide Doctor.
- [ ] Confirm `.env`, `.env.local`, `.tide-pack/`, `data/tidecloak.json`, `data/bank-demo-db.json`, `data/face-profiles.json`, `data/keycloakdb*`, `.next/` and `node_modules/` are ignored.
- [ ] Inspect every staged file before the first push; do not rely only on filename patterns.
- [ ] Search staged content for passwords, bearer tokens, DPoP proofs, enrollment/action links, personal email addresses and local database state.
- [ ] Keep `.env.example` placeholder-only and do not commit `data/tidecloak.json`.
- [ ] Confirm all account holders, balances, transactions and recipients are fictional.
- [ ] Add a licence only if the team intentionally chooses one.

## Required Tide work before claiming full signing

- [ ] Fresh `cosign-bank` realm is licensed, IGA enabled and `iga.attestor=tide` verified.
- [x] Three separate co-owner Tide identities are enrolled in the retained local realm.
- [ ] Confirm three different people control the three identities during the final recording.
- [x] Each co-owner received `account:joint-owner` through committed `2-of-3` governed administration.
- [ ] Tide team reviews and deploys `WithdrawalApprovalContract.cs` on the selected test network.
- [ ] `PolicySignRequest` uses the committed model/parameters and produces non-empty `signed_policy_data`.
- [ ] Requester self-approval is refused in a real ORK signing round.
- [ ] One other approval remains below threshold and produces no signature.
- [ ] Two distinct other approvals produce a verifiable threshold signature.
- [ ] Token/doken refresh behaviour is recorded exactly as observed.
- [ ] `TEST_RESULTS.md` is updated with evidence; no unverified row is silently removed.

## Functional demo

- [x] Unauthenticated and forged API requests return `401`.
- [x] Landing page and bank interface build successfully.
- [x] Custom contract passes local parity, compile and sandbox tests.
- [x] Users completed real Tide sign-in and the dashboard API returned `200`.
- [x] Authenticated withdrawal request was recorded from the verified token identity.
- [x] Two distinct non-requester Tide identities completed the local application approval flow.
- [ ] Confirm the automatic **Demo withdrawal successful** dialog appears after the second approval in the final recording.
- [ ] Manually allow and complete the blink/head-turn challenge in both co-owner recording profiles.
- [ ] Founder B and Founder C each enroll their own face while signed into their own Tide account.
- [ ] Record a wrong-founder attempt being rejected without adding an approval.
- [ ] Record one static-photo attempt timing out without sending an approval.
- [ ] Full two-owner Tide approval/signing path is live; otherwise use the fail-closed demo script.
- [ ] No screen, narration or caption calls the prototype certified Face ID or certified liveness.
- [ ] Narration clearly says the success dialog is synthetic and no real funds are transferred.
- [ ] Recording hides passwords, recovery data, email addresses, tokens and one-time links.

## README and evidence

- [x] Project overview answers the five official prompts in 300 words or fewer.
- [x] Setup is separate from the project overview.
- [x] Tide, backend, host, plaintext and biometric boundaries are explicit.
- [x] `DEMO_SCRIPT.md` is timed for two minutes and matches current verified behaviour.
- [x] `TEST_RESULTS.md` separates observed evidence from future work.

## Video MP4 under 100 MB

- [ ] Record at 1080p or 720p, 30 fps, with readable browser zoom.
- [ ] Keep the final cut at two minutes or less.
- [ ] Export H.264 video with AAC audio as `.mp4`.
- [ ] Check `du -h demo.mp4`; it must be under `100 MB`.
- [ ] If needed: `ffmpeg -i input.mp4 -c:v libx264 -crf 28 -preset medium -c:a aac -b:a 96k demo.mp4`.
- [ ] Play the final MP4 from start to finish and verify text/audio.
- [ ] Commit the MP4 only after checking file size and confidential content.

## Public submission

- [ ] Create a new GitHub repository without generated secrets or Tide state.
- [ ] Push only after reviewing the complete diff and ignored files.
- [ ] Make the repository public only when the team is ready.
- [ ] Verify README, source and MP4 from a private browser window.
- [ ] Submit the public repository link through the official form.
- [ ] Submit before **Thursday 22 October 2026, 6:00 pm Vietnam time**.
