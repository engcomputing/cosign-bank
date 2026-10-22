import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  applyApplicationApproval,
  type WithdrawalApproval,
  type WithdrawalStatus,
} from "./withdrawal-policy";
import { FaceIdentityError } from "./face-identity";
import { verifyFaceProfile } from "./face-profile-store";

export type { WithdrawalApproval, WithdrawalStatus } from "./withdrawal-policy";

export const APPROVAL_WINDOW_SECONDS = 180;
export const MAX_WITHDRAWAL_VND = 100_000_000;

export type JointOwner = {
  id: string;
  name: string;
  initials: string;
  sharePercent: number;
  device: string;
};

export type WithdrawalRequest = {
  id: string;
  requestedBySubject: string;
  requestedByDisplayName: string;
  amountVnd: number;
  recipientName: string;
  recipientBank: string;
  accountLast4: string;
  reason: string;
  status: WithdrawalStatus;
  approvalsRequired: 2;
  approvals: WithdrawalApproval[];
  createdAt: string;
  expiresAt: string;
  cancelledAt?: string;
  cancellationReason?: string;
  cancelledByDisplayName?: string;
};

export type BankDatabase = {
  account: {
    id: string;
    name: string;
    accountNumberMasked: string;
    currency: "VND";
    balanceVnd: number;
    availableVnd: number;
    owners: JointOwner[];
  };
  recentActivity: Array<{
    id: string;
    label: string;
    counterparty: string;
    amountVnd: number;
    direction: "in" | "out";
    createdAt: string;
  }>;
  withdrawalRequests: WithdrawalRequest[];
};

export type WithdrawalInput = {
  amountVnd: number;
  recipientName: string;
  recipientBank: string;
  accountLast4: string;
  reason: string;
};

const dataDirectory = path.join(process.cwd(), "data");
const databasePath = path.join(dataDirectory, "bank-demo-db.json");
let databaseUpdateQueue: Promise<unknown> = Promise.resolve();

export async function readBankDatabase(): Promise<BankDatabase> {
  const raw = await readFile(databasePath, "utf8");
  return JSON.parse(raw) as BankDatabase;
}

async function updateBankDatabase<T>(mutator: (database: BankDatabase) => T | Promise<T>): Promise<T> {
  const update = databaseUpdateQueue.then(async () => {
    const database = await readBankDatabase();
    const result = await mutator(database);
    await mkdir(dataDirectory, { recursive: true });
    const temporaryPath = `${databasePath}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(database, null, 2)}\n`, "utf8");
    await rename(temporaryPath, databasePath);
    return result;
  });

  databaseUpdateQueue = update.then(
    () => undefined,
    () => undefined,
  );
  return update;
}

export async function createWithdrawalDraft(
  input: WithdrawalInput,
  verifiedSubject: string,
  verifiedDisplayName: string,
) {
  return updateBankDatabase((database) => {
    const createdAt = new Date();
    const withdrawal: WithdrawalRequest = {
      id: `WD-${randomUUID().slice(0, 8).toUpperCase()}`,
      requestedBySubject: verifiedSubject,
      requestedByDisplayName: verifiedDisplayName,
      amountVnd: input.amountVnd,
      recipientName: input.recipientName,
      recipientBank: input.recipientBank,
      accountLast4: input.accountLast4,
      reason: input.reason,
      status: "awaiting-app-approvals",
      approvalsRequired: 2,
      approvals: [],
      createdAt: createdAt.toISOString(),
      expiresAt: new Date(createdAt.getTime() + APPROVAL_WINDOW_SECONDS * 1000).toISOString(),
    };

    database.withdrawalRequests.unshift(withdrawal);
    return withdrawal;
  });
}

export async function approveWithdrawalRequest(
  withdrawalId: string,
  verifiedSubject: string,
  verifiedDisplayName: string,
  liveFaceSamples: unknown,
) {
  const result = await updateBankDatabase(async (database) => {
    const index = database.withdrawalRequests.findIndex((withdrawal) => withdrawal.id === withdrawalId);
    if (index < 0) {
      throw new Error("Withdrawal request not found");
    }

    const current = database.withdrawalRequests[index];
    applyApplicationApproval(current, {
      subject: verifiedSubject,
      displayName: verifiedDisplayName,
    });
    let faceVerification;
    try {
      faceVerification = await verifyFaceProfile(verifiedSubject, liveFaceSamples);
    } catch (error) {
      if (error instanceof FaceIdentityError && error.code === "FACE_MISMATCH") {
        const withdrawal: WithdrawalRequest = {
          ...current,
          status: "cancelled-face-mismatch",
          cancelledAt: new Date().toISOString(),
          cancellationReason: "Face did not match the enrolled Founder profile",
          cancelledByDisplayName: verifiedDisplayName,
        };
        database.withdrawalRequests[index] = withdrawal;
        return { withdrawal, faceMismatch: true as const };
      }
      throw error;
    }
    const policyState = applyApplicationApproval(current, {
      subject: verifiedSubject,
      displayName: verifiedDisplayName,
      faceMatched: true,
      faceSimilarity: faceVerification.similarity,
    });
    const withdrawal: WithdrawalRequest = { ...current, ...policyState };
    database.withdrawalRequests[index] = withdrawal;
    return { withdrawal, faceMismatch: false as const };
  });

  if (result.faceMismatch) {
    throw new FaceIdentityError(
      "FACE_MISMATCH",
      "This is not the enrolled Founder. The withdrawal request was cancelled immediately.",
    );
  }

  return result.withdrawal;
}
