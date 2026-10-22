# Tide deployment hand-off

`WithdrawalApprovalContract.cs` is the proposed Tide Forseti policy for the synthetic joint-account demo.

It requires an explicit, private signing operation where:

- the requester is a holder of `account:joint-owner`;
- the requester cannot approve their own withdrawal;
- two distinct other holders of that role approve;
- the payload is VND, at most 100,000,000 VND, and expires within 180 seconds;
- only the original requester can execute after approval.

Run `npm run test:policy` and the official local compile harness before sending it to Tide. Deployment is **not self-service**. Ask the Tide team at `info@tide.org` or in the official Discord to review and deploy it on a test network. Do not mark the signing flow verified until a committed policy has non-empty `signed_policy_data` and a real round succeeds.
