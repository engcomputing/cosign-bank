import test from "node:test";
import assert from "node:assert/strict";
import {
  applyApplicationApproval,
  WithdrawalPolicyError,
} from "../src/lib/withdrawal-policy.ts";

const now = new Date("2026-10-22T05:00:00.000Z");

function request(overrides = {}) {
  return {
    requestedBySubject: "owner-a",
    status: "awaiting-app-approvals",
    approvalsRequired: 2,
    approvals: [],
    expiresAt: "2026-10-22T05:03:00.000Z",
    ...overrides,
  };
}

test("requester cannot self-approve", () => {
  assert.throws(
    () => applyApplicationApproval(request(), { subject: "owner-a", displayName: "Owner A" }, now),
    (error) => error instanceof WithdrawalPolicyError && error.code === "SELF_APPROVAL",
  );
});

test("the same verified subject cannot approve twice", () => {
  const first = applyApplicationApproval(
    request(),
    { subject: "owner-b", displayName: "Owner B" },
    now,
  );
  assert.throws(
    () => applyApplicationApproval(first, { subject: "owner-b", displayName: "Owner B" }, now),
    (error) => error instanceof WithdrawalPolicyError && error.code === "DUPLICATE_APPROVAL",
  );
});

test("two distinct non-requesters reach only the application quorum", () => {
  const first = applyApplicationApproval(
    request(),
    { subject: "owner-b", displayName: "Owner B" },
    now,
  );
  assert.equal(first.status, "awaiting-app-approvals");
  assert.equal(first.approvals.length, 1);

  const second = applyApplicationApproval(
    first,
    { subject: "owner-c", displayName: "Owner C" },
    new Date(now.getTime() + 1_000),
  );
  assert.equal(second.status, "application-approved");
  assert.deepEqual(second.approvals.map((approval) => approval.subject), ["owner-b", "owner-c"]);
});

test("expired requests fail closed", () => {
  assert.throws(
    () =>
      applyApplicationApproval(
        request({ expiresAt: "2026-10-22T04:59:59.000Z" }),
        { subject: "owner-b", displayName: "Owner B" },
        now,
      ),
    (error) => error instanceof WithdrawalPolicyError && error.code === "REQUEST_EXPIRED",
  );
});

test("face-mismatch cancelled requests cannot receive another approval", () => {
  assert.throws(
    () =>
      applyApplicationApproval(
        request({ status: "cancelled-face-mismatch" }),
        { subject: "owner-b", displayName: "Owner B" },
        now,
      ),
    (error) => error instanceof WithdrawalPolicyError && error.code === "REQUEST_CANCELLED",
  );
});
