import { withRole } from "@/lib/auth/protect";
import { displayNameFromToken } from "@/lib/auth/identity";
import {
  approveWithdrawalRequest,
  createWithdrawalDraft,
  MAX_WITHDRAWAL_VND,
  readBankDatabase,
} from "@/lib/demo-db";
import { WithdrawalPolicyError } from "@/lib/withdrawal-policy";
import { FaceIdentityError } from "@/lib/face-identity";

export const dynamic = "force-dynamic";

type RequestBody = {
  amountVnd?: unknown;
  recipientName?: unknown;
  recipientBank?: unknown;
  accountLast4?: unknown;
  reason?: unknown;
};

type ApprovalBody = {
  withdrawalId?: unknown;
  faceEmbeddings?: unknown;
};

function cleanText(value: unknown, field: string, maxLength: number) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > maxLength) {
    throw new Error(`${field} must be between 1 and ${maxLength} characters`);
  }
  return value.trim();
}

export const POST = withRole("account:joint-owner", async (request, jwt) => {
  if (!jwt.sub) {
    return Response.json({ error: "Verified Tide token has no subject" }, { status: 400 });
  }

  try {
    const body = (await request.json()) as RequestBody;
    const amountVnd = Number(body.amountVnd);
    if (!Number.isSafeInteger(amountVnd) || amountVnd < 100_000 || amountVnd > MAX_WITHDRAWAL_VND) {
      return Response.json(
        { error: `Amount must be a whole VND value from 100,000 to ${MAX_WITHDRAWAL_VND.toLocaleString("en-US")}` },
        { status: 400 },
      );
    }

    const database = await readBankDatabase();
    if (amountVnd > database.account.availableVnd) {
      return Response.json({ error: "Amount exceeds the available balance" }, { status: 400 });
    }

    const accountLast4 = cleanText(body.accountLast4, "Destination account", 4);
    if (!/^\d{4}$/.test(accountLast4)) {
      return Response.json({ error: "Enter the final 4 digits of the destination account" }, { status: 400 });
    }

    const withdrawal = await createWithdrawalDraft(
      {
        amountVnd,
        recipientName: cleanText(body.recipientName, "Recipient name", 80),
        recipientBank: cleanText(body.recipientBank, "Recipient bank", 80),
        accountLast4,
        reason:
          typeof body.reason === "string" && body.reason.trim()
            ? body.reason.trim().slice(0, 160)
            : "Joint account withdrawal",
      },
      jwt.sub,
      displayNameFromToken(jwt),
    );

    return Response.json(
      {
        withdrawal: { id: withdrawal.id, status: withdrawal.status },
        notice:
          "Request shared with the other co-owners. Tide verifies each identity and role; this local app records approvals, while Forseti signing and bank execution remain disabled.",
      },
      { status: 201 },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Invalid withdrawal request" },
      { status: 400 },
    );
  }
});

export const PATCH = withRole("account:joint-owner", async (request, jwt) => {
  if (!jwt.sub) {
    return Response.json({ error: "Verified Tide token has no subject" }, { status: 400 });
  }

  try {
    const body = (await request.json()) as ApprovalBody;
    if (typeof body.withdrawalId !== "string" || !/^WD-[A-Z0-9]{8}$/.test(body.withdrawalId)) {
      return Response.json({ error: "Invalid withdrawal request id" }, { status: 400 });
    }

    const withdrawal = await approveWithdrawalRequest(
      body.withdrawalId,
      jwt.sub,
      displayNameFromToken(jwt),
      body.faceEmbeddings,
    );
    const quorumReached = withdrawal.approvals.length >= withdrawal.approvalsRequired;

    return Response.json({
      withdrawal: {
        id: withdrawal.id,
        status: withdrawal.status,
        approvalCount: withdrawal.approvals.length,
        approvalsRequired: withdrawal.approvalsRequired,
      },
      notice: quorumReached
        ? "Two independent co-owners approved in the local application. The amount was debited from the demo account balance; no Tide policy signature or real bank transfer was produced."
        : "Approval recorded from the server-verified Tide identity. One more independent co-owner is required.",
    });
  } catch (error) {
    if (error instanceof FaceIdentityError) {
      return Response.json(
        {
          error: error.message,
          code: error.code,
          requestCancelled: error.code === "FACE_MISMATCH",
        },
        { status: error.code === "FACE_NOT_ENROLLED" ? 428 : 403 },
      );
    }
    if (error instanceof WithdrawalPolicyError) {
      const status = error.code === "SELF_APPROVAL" ? 403 : 409;
      return Response.json({ error: error.message, code: error.code }, { status });
    }
    const message = error instanceof Error ? error.message : "Could not approve withdrawal request";
    return Response.json({ error: message }, { status: message === "Withdrawal request not found" ? 404 : 400 });
  }
});
