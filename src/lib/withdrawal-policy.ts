export type WithdrawalApproval = {
  subject: string;
  displayName: string;
  approvedAt: string;
  faceMatched?: boolean;
  faceSimilarity?: number;
};

export type WithdrawalStatus =
  | "awaiting-app-approvals"
  | "application-approved"
  | "cancelled-face-mismatch"
  | "policy-deployment-required";

export type WithdrawalPolicyState = {
  requestedBySubject: string;
  status: WithdrawalStatus;
  approvalsRequired: 2;
  approvals: WithdrawalApproval[];
  expiresAt: string;
};

export class WithdrawalPolicyError extends Error {
  public readonly code:
    | "SELF_APPROVAL"
    | "DUPLICATE_APPROVAL"
    | "REQUEST_EXPIRED"
    | "REQUEST_COMPLETE"
    | "REQUEST_CANCELLED";

  constructor(
    code:
      | "SELF_APPROVAL"
      | "DUPLICATE_APPROVAL"
      | "REQUEST_EXPIRED"
      | "REQUEST_COMPLETE"
      | "REQUEST_CANCELLED",
    message: string,
  ) {
    super(message);
    this.name = "WithdrawalPolicyError";
    this.code = code;
  }
}

export function applyApplicationApproval(
  withdrawal: WithdrawalPolicyState,
  approval: Omit<WithdrawalApproval, "approvedAt">,
  now = new Date(),
): WithdrawalPolicyState {
  if (withdrawal.status === "cancelled-face-mismatch") {
    throw new WithdrawalPolicyError(
      "REQUEST_CANCELLED",
      "This withdrawal was cancelled after a face identity mismatch",
    );
  }

  if (withdrawal.requestedBySubject === approval.subject) {
    throw new WithdrawalPolicyError("SELF_APPROVAL", "The requester cannot approve their own withdrawal");
  }

  if (withdrawal.approvals.some((existing) => existing.subject === approval.subject)) {
    throw new WithdrawalPolicyError("DUPLICATE_APPROVAL", "This Tide identity already approved the request");
  }

  if (withdrawal.status === "application-approved") {
    throw new WithdrawalPolicyError("REQUEST_COMPLETE", "The application approval quorum is already complete");
  }

  if (!Number.isFinite(Date.parse(withdrawal.expiresAt)) || Date.parse(withdrawal.expiresAt) <= now.getTime()) {
    throw new WithdrawalPolicyError("REQUEST_EXPIRED", "The approval window has expired");
  }

  const approvals = [
    ...withdrawal.approvals,
    {
      ...approval,
      approvedAt: now.toISOString(),
    },
  ];

  return {
    ...withdrawal,
    status:
      approvals.length >= withdrawal.approvalsRequired
        ? "application-approved"
        : "awaiting-app-approvals",
    approvals,
  };
}
